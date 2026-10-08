import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Invite from "./invite.model.js";
import Role from "./role.model.js";
import User from "./user.model.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/ApiError.js";
import { sendInviteEmail } from "../../lib/mailer.js";
import { OWNER_ROLE } from "./role-definitions.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// One generic failure for every bad token (prompt-125).
//
// Invalid, already used, revoked, superseded by a resend, and expired all return THIS — same
// status, same wording. Distinguishing them would turn the public endpoint into an oracle:
// "expired" confirms the token was real, which tells someone probing links that they have the
// right shape and only need a fresher one. 404 rather than 400/410 for the same reason.
function invalidInvite() {
  return new ApiError(404, "This invitation link is not valid. Ask for a new one.", {
    code: "invite_invalid",
  });
}

/** 32 bytes of CSPRNG, base64url. The raw value is returned once and never stored. */
function mintToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
}

function hashOf(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function acceptUrl(raw) {
  return `${env.APP_BASE_URL.replace(/\/+$/, "")}/accept-invite?token=${raw}`;
}

function serialize(inv, { now = new Date() } = {}) {
  return {
    id: String(inv._id),
    email: inv.email,
    role: inv.role ? { id: String(inv.role._id ?? inv.role), name: inv.role.name ?? null } : null,
    status: inv.expiresAt <= now ? "expired" : "pending",
    expiresAt: inv.expiresAt,
    lastSentAt: inv.lastSentAt ?? null,
    createdAt: inv.createdAt,
    invitedByName: inv.invitedBy?.name ?? null,
  };
}

/**
 * Creates an invite, revoking any live one for the same address.
 *
 * Replacing rather than erroring is deliberate: "invite Sam" twice is a normal thing to do when
 * the first email went astray, and leaving two valid tokens for one address means revoking one
 * does not actually stop anyone joining.
 */
export async function createInvite({ email, role: roleId }, actor) {
  const normalizedEmail = String(email).toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new ApiError(409, `${normalizedEmail} already has an account.`, { code: "user_exists" });
  }

  const role = await Role.findById(roleId).lean();
  if (!role) throw new ApiError(400, "Invalid role");
  assertMayGrant(actor, role);

  const now = new Date();
  await Invite.updateMany(
    { email: normalizedEmail, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: now } },
  );

  const { raw, hash } = mintToken();
  const invite = await Invite.create({
    email: normalizedEmail,
    role: role._id,
    tokenHash: hash,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    invitedBy: actor?._id ?? null,
  });

  const mail = await deliver(invite, role, raw, actor);
  const populated = await Invite.findById(invite._id).populate("role", "name").populate("invitedBy", "name").lean();
  return { invite: serialize(populated), link: acceptUrl(raw), emailSent: mail.sent, emailError: mail.error };
}

/**
 * Resend ROTATES the token: the old link stops working immediately.
 *
 * This is also what "Copy link" calls, and the UI says so. One invite therefore never has two
 * working links — if a link was pasted into the wrong chat, copying a fresh one is enough to
 * kill it, with no separate revoke step to remember.
 */
export async function resendInvite(id, actor) {
  const invite = await Invite.findOne({ _id: id, acceptedAt: null, revokedAt: null });
  if (!invite) throw invalidInvite();

  const role = await Role.findById(invite.role).lean();
  if (!role) throw new ApiError(400, "Invalid role");
  assertMayGrant(actor, role);

  const { raw, hash } = mintToken();
  invite.tokenHash = hash;
  // Resending also renews the window — an invite that arrives on day 6 is not useful.
  invite.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invite.save();

  const mail = await deliver(invite, role, raw, actor);
  const populated = await Invite.findById(invite._id).populate("role", "name").populate("invitedBy", "name").lean();
  return { invite: serialize(populated), link: acceptUrl(raw), emailSent: mail.sent, emailError: mail.error };
}

export async function revokeInvite(id) {
  const invite = await Invite.findOneAndUpdate(
    { _id: id, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true },
  ).populate("role", "name").populate("invitedBy", "name").lean();
  if (!invite) throw invalidInvite();
  return serialize(invite);
}

export async function listInvites() {
  const invites = await Invite.find({ acceptedAt: null, revokedAt: null })
    .populate("role", "name")
    .populate("invitedBy", "name")
    .sort({ createdAt: -1 })
    .lean();
  const now = new Date();
  return invites.map((i) => serialize(i, { now }));
}

/** Public: what the accept page shows before asking for a password. Never returns the token. */
export async function describeInvite(rawToken) {
  const invite = await Invite.findOne({
    tokenHash: hashOf(rawToken),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate("role", "name").populate("invitedBy", "name").lean();
  if (!invite) throw invalidInvite();
  return {
    email: invite.email,
    roleName: invite.role?.name ?? null,
    invitedByName: invite.invitedBy?.name ?? null,
    expiresAt: invite.expiresAt,
  };
}

/**
 * Public: redeem an invite and create the account.
 *
 * The claim is an ATOMIC findOneAndUpdate whose filter carries every validity condition, so two
 * simultaneous clicks cannot both succeed — the second matches nothing because the first already
 * stamped acceptedAt. Checking then writing would leave a window where both pass the check and
 * both create a user, and the second would then fail on the unique email index with a 500.
 */
export async function acceptInvite({ token, name, password }) {
  const claimed = await Invite.findOneAndUpdate(
    {
      tokenHash: hashOf(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { acceptedAt: new Date() } },
    { new: true },
  ).populate("role", "name").lean();
  if (!claimed) throw invalidInvite();

  // Between invite and acceptance someone may have been given an account directly.
  const existing = await User.findOne({ email: claimed.email }).lean();
  if (existing) throw new ApiError(409, "An account already exists for this email.", { code: "user_exists" });

  const user = await User.create({
    email: claimed.email,
    password: await bcrypt.hash(password, 12),
    name: String(name).trim(),
    role: claimed.role._id,
    active: true,
    // They are signing in right now — the token below is a session.
    lastLoginAt: new Date(),
  });

  const populated = await User.findById(user._id).populate("role", "name permissions").lean();
  const authToken = jwt.sign({ sub: user._id, role: populated.role?.name }, env.JWT_SECRET, { expiresIn: "7d" });
  const { password: _pw, ...safe } = populated;
  // Same { token, user } shape login returns, so the frontend stores it through one code path.
  return { token: authToken, user: safe };
}

/** Handing out the owner role — by invite or otherwise — is owner-only. */
function assertMayGrant(actor, role) {
  if (role.name !== OWNER_ROLE) return;
  if (actor?.role === OWNER_ROLE || actor?.permissions?.includes("*")) return;
  throw new ApiError(403, "Only an owner can invite another owner", { code: "owner_only" });
}

async function deliver(invite, role, raw, actor) {
  const result = await sendInviteEmail({
    to: invite.email,
    inviterName: actor?.name ?? null,
    roleLabel: role.name,
    acceptUrl: acceptUrl(raw),
    expiresAt: invite.expiresAt,
  });
  if (result.sent) {
    invite.lastSentAt = new Date();
    await Invite.updateOne({ _id: invite._id }, { $set: { lastSentAt: invite.lastSentAt } });
  }
  return result;
}
