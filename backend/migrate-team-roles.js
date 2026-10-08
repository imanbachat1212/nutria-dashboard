import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Role from "./src/modules/users/role.model.js";
import User from "./src/modules/users/user.model.js";
import Permission from "./src/modules/users/permission.model.js";
import Invite from "./src/modules/users/invite.model.js";
import { ROLE_DEFINITIONS, ASSIGNABLE_PERMISSIONS, OWNER_ROLE } from "./src/modules/users/role-definitions.js";

// Moves an existing install onto the five-role model (prompt-125).
//
// DRY RUN BY DEFAULT. Nothing is written without --apply. The reason for that default is the
// failure this script can cause: today every user holds "dietitian", and "dietitian" currently
// carries EVERY permission including users.*. After the new definitions land, "dietitian" no
// longer has users.* — so if this runs without promoting anyone to owner, the result is a
// database where NOBODY can administer the team, and no amount of logging in fixes it.
//
//   node migrate-team-roles.js --owner=admin@nutri.app            # dry run, writes nothing
//   node migrate-team-roles.js --owner=admin@nutri.app --apply    # writes
//
// Flags:
//   --owner=a@b.com[,c@d.com]   REQUIRED. Promoted to owner. Must resolve to >=1 active user.
//   --apply                     Actually write. Without it, every change is only printed.
//   --assistant-role=<name>     Where to move users holding the legacy "assistant" role.
//                               Default "reception".
//   --drop-assistant            After remapping, delete the legacy "assistant" role.

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const hit = args.find((a) => a.startsWith(`${f}=`));
  return hit ? hit.slice(f.length + 1) : null;
};

const APPLY = has("--apply");
const OWNER_EMAILS = (val("--owner") || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ASSISTANT_TARGET = val("--assistant-role") || "reception";
const DROP_ASSISTANT = has("--drop-assistant");

const pad = (s, n) => String(s ?? "").padEnd(n);
let willWrite = 0;

function section(t) {
  console.log(`\n${"─".repeat(78)}\n${t}\n${"─".repeat(78)}`);
}

async function main() {
  if (!OWNER_EMAILS.length) {
    console.error("REFUSING: --owner=<email>[,<email>] is required.\n" +
      "It names who keeps the ability to administer the team after dietitian loses users.*.");
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);

  // Which database this is actually about to change. Printed before anything else, every run,
  // because the local .env and the deployed service may well point at the same cluster — in which
  // case --apply is a production change, not a rehearsal.
  section("TARGET");
  const conn = mongoose.connection;
  console.log(`  host     : ${conn.host}`);
  console.log(`  database : ${conn.name}`);
  console.log(`  mode     : ${APPLY ? "!!! APPLY — WILL WRITE !!!" : "dry run (no writes)"}`);

  // ── 1. Permissions registry ───────────────────────────────────────────────────────────────
  section("1. PERMISSIONS");
  const existing = new Set((await Permission.find().select("key").lean()).map((p) => p.key));
  const missing = ASSIGNABLE_PERMISSIONS.filter((k) => !existing.has(k));
  console.log(`  registered: ${existing.size}   referenced by roles: ${ASSIGNABLE_PERMISSIONS.length}   missing: ${missing.length}`);
  if (missing.length) {
    console.log(`  would insert: ${missing.join(", ")}`);
    willWrite += missing.length;
    if (APPLY) {
      for (const key of missing) await Permission.findOneAndUpdate({ key }, { key }, { upsert: true });
      console.log("  inserted.");
    }
  }

  // ── 2. Roles ──────────────────────────────────────────────────────────────────────────────
  section("2. ROLES");
  console.log(`  ${pad("ROLE", 12)} ${pad("NOW", 7)} ${pad("AFTER", 7)} CHANGE`);
  for (const def of ROLE_DEFINITIONS) {
    const current = await Role.findOne({ name: def.name }).lean();
    const now = current ? current.permissions.length : null;
    const after = def.permissions.length;
    const label = !current ? "CREATE" : now === after && sameSet(current.permissions, def.permissions) ? "unchanged" : "UPDATE";
    console.log(`  ${pad(def.name, 12)} ${pad(now ?? "—", 7)} ${pad(after, 7)} ${label}`);
    if (label !== "unchanged") {
      willWrite += 1;
      if (current) {
        const lost = current.permissions.filter((p) => !def.permissions.includes(p));
        const gained = def.permissions.filter((p) => !current.permissions.includes(p));
        if (lost.length) console.log(`      loses  (${lost.length}): ${lost.join(", ")}`);
        if (gained.length) console.log(`      gains  (${gained.length}): ${gained.join(", ")}`);
      }
      if (APPLY) {
        await Role.findOneAndUpdate(
          { name: def.name },
          { name: def.name, permissions: def.permissions },
          { upsert: true, new: true },
        );
      }
    }
  }

  // Roles must exist before users can be pointed at them. On a dry run they may not, so every
  // lookup below tolerates a null and reports "would be created above".
  const roleByName = {};
  for (const def of ROLE_DEFINITIONS) {
    roleByName[def.name] = await Role.findOne({ name: def.name }).lean();
  }

  // ── 3. Legacy "assistant" ─────────────────────────────────────────────────────────────────
  section("3. LEGACY ROLE");
  const assistant = await Role.findOne({ name: "assistant" }).lean();
  let assistantHolders = [];
  if (!assistant) {
    console.log("  no \"assistant\" role present — nothing to migrate.");
  } else {
    assistantHolders = await User.find({ role: assistant._id }).select("email name").lean();
    console.log(`  "assistant" exists, held by ${assistantHolders.length} user(s)` +
      (assistantHolders.length ? `: ${assistantHolders.map((u) => u.email).join(", ")}` : " — nobody."));
    if (assistantHolders.length) {
      const target = roleByName[ASSISTANT_TARGET];
      console.log(`  would remap all of them to "${ASSISTANT_TARGET}"${target ? "" : " (role will be created above)"}`);
      willWrite += assistantHolders.length;
      if (APPLY) {
        if (!target) throw new Error(`--assistant-role "${ASSISTANT_TARGET}" does not exist`);
        await User.updateMany({ role: assistant._id }, { $set: { role: target._id } });
        console.log("  remapped.");
      }
    }
    if (DROP_ASSISTANT) {
      console.log("  --drop-assistant: would delete the role after remapping.");
      willWrite += 1;
      if (APPLY) {
        const left = await User.countDocuments({ role: assistant._id });
        if (left) throw new Error(`refusing to drop "assistant": ${left} user(s) still hold it`);
        await Role.deleteOne({ _id: assistant._id });
        console.log("  dropped.");
      }
    } else if (assistant) {
      console.log("  (pass --drop-assistant to delete it once nobody holds it)");
    }
  }

  // ── 4. Owners ─────────────────────────────────────────────────────────────────────────────
  section("4. OWNER PROMOTION");
  const ownerRole = roleByName[OWNER_ROLE];
  const promoted = [];
  for (const email of OWNER_EMAILS) {
    const u = await User.findOne({ email }).populate("role", "name").lean();
    if (!u) {
      console.log(`  ${pad(email, 30)} NOT FOUND — cannot promote`);
      continue;
    }
    const blocked = u.active === false || u.removedAt;
    console.log(`  ${pad(email, 30)} ${pad(u.role?.name ?? "(none)", 12)} -> owner${blocked ? "   [INACTIVE/REMOVED]" : ""}`);
    if (!blocked) promoted.push(u);
  }

  // THE LOCKOUT GUARD. Counts owners as they WOULD BE after this run: anyone already holding an
  // active owner role, plus the promotions above. Refusing here is the whole reason --owner is
  // mandatory.
  const alreadyOwners = ownerRole
    ? await User.countDocuments({ role: ownerRole._id, active: true, removedAt: null })
    : 0;
  const ownersAfter = new Set([
    ...(ownerRole ? (await User.find({ role: ownerRole._id, active: true, removedAt: null }).select("_id").lean()).map((u) => String(u._id)) : []),
    ...promoted.map((u) => String(u._id)),
  ]).size;
  console.log(`\n  active owners now: ${alreadyOwners}   after this migration: ${ownersAfter}`);
  if (ownersAfter < 1) {
    console.error("\n  REFUSING: this would leave ZERO active owners, and no other role has users.*.\n" +
      "  Nobody would be able to administer the team or undo it. Pass a --owner that resolves\n" +
      "  to an existing active user.");
    await mongoose.disconnect();
    process.exit(1);
  }
  willWrite += promoted.length;
  if (APPLY && promoted.length) {
    if (!ownerRole) throw new Error("owner role missing");
    await User.updateMany({ _id: { $in: promoted.map((u) => u._id) } }, { $set: { role: ownerRole._id } });
    console.log("  promoted.");
  }

  // ── 5. Stale invite index ─────────────────────────────────────────────────────────────────
  section("5. INVITE SCHEMA");
  const idx = await Invite.collection.indexes().catch(() => []);
  const legacy = idx.find((i) => i.key?.token === 1);
  if (legacy) {
    console.log(`  legacy unique index on raw token present ("${legacy.name}") — would drop it.`);
    console.log("  (the raw token column is gone; only tokenHash is stored now)");
    willWrite += 1;
    if (APPLY) {
      await Invite.collection.dropIndex(legacy.name);
      console.log("  dropped.");
    }
  } else {
    console.log("  no legacy token index — nothing to drop.");
  }
  console.log(`  invite documents: ${await Invite.countDocuments()}`);

  // ── 6. Every user, before -> after ────────────────────────────────────────────────────────
  section("6. USERS (before -> after)");
  const ownerIds = new Set(promoted.map((u) => String(u._id)));
  const assistantId = assistant ? String(assistant._id) : null;
  const users = await User.find().populate("role", "name").sort({ email: 1 }).lean();
  console.log(`  ${pad("EMAIL", 28)} ${pad("ROLE NOW", 12)} ${pad("ROLE AFTER", 12)} ${pad("ACTIVE", 7)} NOTE`);
  for (const u of users) {
    let after = u.role?.name ?? "(none)";
    let note = "";
    if (ownerIds.has(String(u._id))) { after = "owner"; note = "promoted by --owner"; }
    else if (assistantId && String(u.role?._id) === assistantId) { after = ASSISTANT_TARGET; note = "remapped from assistant"; }
    else if (after === "dietitian") note = "keeps dietitian (now narrower: loses users.*)";
    console.log(`  ${pad(u.email, 28)} ${pad(u.role?.name ?? "(none)", 12)} ${pad(after, 12)} ${pad(u.active === false ? "no" : "yes", 7)} ${note}`);
  }

  section("SUMMARY");
  console.log(`  ${willWrite} write operation(s) ${APPLY ? "performed" : "would be performed"}.`);
  if (!APPLY) {
    console.log("\n  This was a DRY RUN. Nothing was written.");
    console.log(`  To apply:  node migrate-team-roles.js --owner=${OWNER_EMAILS.join(",")} --apply`);
  }
  await mongoose.disconnect();
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

main().catch(async (err) => {
  console.error("\nFAILED:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
