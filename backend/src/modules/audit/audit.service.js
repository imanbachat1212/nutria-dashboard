import AuditLog from "./audit-log.model.js";
import User from "../users/user.model.js";

// Read side of the audit log (prompt-125). middleware/audit.js has been writing to this
// collection since the project started — 3,081 rows at the time of writing — and nothing could
// read them back: modules/audit was an empty stub router.

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serialize(row) {
  return {
    id: String(row._id),
    action: row.action,
    entity: row.entity,
    entityId: row.entityId ? String(row.entityId) : null,
    actor: row.actor
      ? { id: String(row.actor._id), name: row.actor.name, email: row.actor.email }
      // A soft-removed user still resolves; a null actor is a service key or a deleted account.
      : null,
    actorRole: row.actorRole ?? null,
    at: row.createdAt,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    // before/after are redacted at write time (see middleware/audit.js) — never at read time, so
    // an older row written before that redaction existed cannot leak by being read through a
    // different path.
    before: row.before ?? null,
    after: row.after ?? null,
  };
}

export async function listAuditLog({ actor, entity, action, from, to, q, page = 1, limit = 50 }) {
  const filter = {};
  if (actor) filter.actor = actor;
  if (entity) filter.entity = entity;
  if (action) filter.action = action;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    // Same end-of-day stretch the journal endpoints use, so a date range means the same thing
    // everywhere in this API.
    if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  // `q` matches an actor's name OR an entity. Actor names live on another collection, so this
  // resolves them to ids first rather than trying to $lookup inside a paginated find.
  //
  // Escaped before it touches $regex: this is free text from a query string.
  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    const actorIds = await User.find({ name: rx }).select("_id").lean();
    const or = [{ entity: rx }, { action: rx }];
    if (actorIds.length) or.push({ actor: { $in: actorIds.map((u) => u._id) } });
    filter.$or = or;
  }

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    entries: rows.map(serialize),
    total,
    page,
    limit,
    // Lets the UI's "Load more" know whether to offer itself, without it having to infer from a
    // short page (which is ambiguous on an exact multiple).
    hasMore: skip + rows.length < total,
  };
}

/** Distinct actions and entities present, so the filter dropdowns offer only what exists. */
export async function auditFacets() {
  const [actions, entities] = await Promise.all([
    AuditLog.distinct("action"),
    AuditLog.distinct("entity"),
  ]);
  return { actions: actions.filter(Boolean).sort(), entities: entities.filter(Boolean).sort() };
}
