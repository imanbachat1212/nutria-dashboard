import bcrypt from "bcryptjs";
import User from "./user.model.js";
import Role from "./role.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { OWNER_ROLE } from "./role-definitions.js";

// ── Guards (prompt-125) ─────────────────────────────────────────────────────────────────────
//
// Every one of these is enforced HERE, in the service, not in the UI. The Team page disables the
// buttons it knows will fail, but that is a courtesy — the rules have to hold for a hand-written
// curl request too, and the messages are written to be shown to the user verbatim.

/** The internal SERVICE_API_KEY authenticates with ["*"] and no _id. Owners are humans. */
function actorIsOwner(actor) {
  return actor?.role === OWNER_ROLE || actor?.permissions?.includes("*");
}

function isSelf(actor, targetId) {
  return actor?._id && String(actor._id) === String(targetId);
}

async function ownerRoleId() {
  const role = await Role.findOne({ name: OWNER_ROLE }).select("_id").lean();
  return role?._id ?? null;
}

/**
 * How many active, non-removed owners exist — optionally ignoring one user.
 *
 * `excludeId` is how "would this leave zero owners?" is asked: count the owners who would remain
 * if this one stopped being one. Counting first and subtracting would race with a concurrent
 * change; this is a single query against current state.
 */
async function countActiveOwners(excludeId = null) {
  const roleId = await ownerRoleId();
  if (!roleId) return 0;
  const filter = { role: roleId, active: true, removedAt: null };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

async function assertNotLastOwner(target, action) {
  const roleId = await ownerRoleId();
  if (!roleId || String(target.role?._id ?? target.role) !== String(roleId)) return;
  if (!target.active || target.removedAt) return; // already not an active owner
  const remaining = await countActiveOwners(target._id);
  if (remaining === 0) {
    throw new ApiError(
      409,
      `${target.name} is the only active owner — ${action} would leave the practice with no one who can manage the team. Promote another owner first.`,
      { code: "last_owner" },
    );
  }
}

/** Only an owner may touch an owner, or hand the owner role to anyone. */
async function assertOwnerAuthority(actor, { targetRoleId, newRoleId }) {
  if (actorIsOwner(actor)) return;
  const roleId = await ownerRoleId();
  if (!roleId) return;
  if (newRoleId && String(newRoleId) === String(roleId)) {
    throw new ApiError(403, "Only an owner can grant the owner role", { code: "owner_only" });
  }
  if (targetRoleId && String(targetRoleId) === String(roleId)) {
    throw new ApiError(403, "Only an owner can modify an owner", { code: "owner_only" });
  }
}

// ── Serialisation ───────────────────────────────────────────────────────────────────────────
//
// The shape the Team page reads. Note what is NOT here: password (select:false anyway, but never
// assembled into a response either way) and the raw role permission array, which the roles
// endpoint owns.
function serialize(u) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role ? { id: String(u.role._id), name: u.role.name } : null,
    status: u.active === false ? "suspended" : "active",
    joinedAt: u.createdAt,
    lastActiveAt: u.lastActiveAt ?? null,
    // null means "has never signed in". The six seeded staff-directory accounts
    // (sura.hawli@nutri.app and friends) are referenced by appointments.staffId but were created
    // with random passwords and nobody logs into them — the UI tags these "No login" so they
    // aren't mistaken for real team members. Derived rather than a flag on the model, so it stays
    // true automatically the moment one of them does sign in.
    lastLoginAt: u.lastLoginAt ?? null,
  };
}

export async function createUser(data) {
  const role = await Role.findById(data.role);
  if (!role) throw new ApiError(400, "Invalid role");

  const exists = await User.findOne({ email: data.email });
  if (exists) throw new ApiError(409, "Email already in use");

  const hashed = await bcrypt.hash(data.password, 12);
  const user = await User.create({ ...data, password: hashed });

  const { password, ...safe } = user.toObject();
  return safe;
}

/**
 * Team members. Removed users are excluded — they are soft-removed rather than deleted so that
 * appointments.staffId and AuditLog.actor still resolve, but they are no longer team.
 */
export async function listUsers({ page = 1, limit = 100 } = {}) {
  const skip = (page - 1) * limit;
  const filter = { removedAt: null };
  const [users, total] = await Promise.all([
    User.find(filter).populate("role", "name").sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { users: users.map(serialize), total, page, limit };
}

export async function getUserById(id) {
  const user = await User.findOne({ _id: id, removedAt: null }).populate("role", "name permissions").lean();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

/**
 * Name, phone, role and active state. Role changes come through HERE and only here — no separate
 * "change role" endpoint to keep in sync, and the guards below therefore cannot be bypassed by
 * picking a different route.
 */
export async function updateUser(id, data, actor) {
  const target = await User.findOne({ _id: id, removedAt: null }).populate("role", "name").lean();
  if (!target) throw new ApiError(404, "User not found");

  const changingRole = data.role != null && String(data.role) !== String(target.role?._id);
  const suspending = data.active === false && target.active !== false;

  // Self-protection. Deliberately covers role change and suspension but NOT name/phone: editing
  // your own name is fine, demoting or disabling yourself is how an owner strands the practice.
  if (isSelf(actor, id)) {
    if (changingRole) {
      throw new ApiError(409, "You cannot change your own role — ask another owner to do it.", { code: "self_role" });
    }
    if (suspending) {
      throw new ApiError(409, "You cannot suspend your own account.", { code: "self_suspend" });
    }
  }

  await assertOwnerAuthority(actor, {
    targetRoleId: target.role?._id,
    newRoleId: changingRole ? data.role : null,
  });

  if (changingRole) {
    const role = await Role.findById(data.role);
    if (!role) throw new ApiError(400, "Invalid role");
    await assertNotLastOwner(target, "moving them off the owner role");
  }
  if (suspending) {
    await assertNotLastOwner(target, "suspending them");
  }

  const user = await User.findByIdAndUpdate(id, data, { new: true })
    .populate("role", "name")
    .lean();
  return serialize(user);
}

/**
 * Soft remove: active:false + removedAt, never a delete.
 *
 * appointments.staffId and AuditLog.actor both reference User. Hard-deleting the row would leave
 * a booking whose staff member cannot be rendered and an audit trail whose actor is an unresolved
 * id — erasing the identity behind every action that person ever took, which is the opposite of
 * what an audit log is for. The email stays on the document and therefore stays reserved by the
 * unique index, so the address can't later be re-registered to a different person and inherit the
 * old one's history.
 */
export async function removeUser(id, actor) {
  const target = await User.findOne({ _id: id, removedAt: null }).populate("role", "name").lean();
  if (!target) throw new ApiError(404, "User not found");

  if (isSelf(actor, id)) {
    throw new ApiError(409, "You cannot remove your own account.", { code: "self_remove" });
  }
  await assertOwnerAuthority(actor, { targetRoleId: target.role?._id, newRoleId: null });
  await assertNotLastOwner(target, "removing them");

  const user = await User.findByIdAndUpdate(
    id,
    { active: false, removedAt: new Date() },
    { new: true },
  ).populate("role", "name").lean();
  return serialize(user);
}

export { countActiveOwners, serialize as serializeUser };
