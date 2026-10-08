import AuditLog from "../modules/audit/audit-log.model.js";

// Fields that must never reach the audit log, at any depth (prompt-125).
//
// The log records `after: body.data` — whatever the route sent back. That was safe only by
// accident: User.password is `select: false`, so it happened not to be in those responses. The
// invite routes break that luck wide open, because the whole point of their response is a
// one-time credential — POST /api/users/invites returns { invite, link } where `link` embeds the
// raw token. Logging that would put a working "become this person" URL into a collection that is
// deliberately long-lived, readable by anyone with audit.read, and never expires.
//
// So redaction is explicit and structural rather than a promise that each route will remember to
// strip its own secrets. A new route that returns a token gets this for free.
const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "token",
  "tokenHash",
  "rawToken",
  "link",
  "acceptUrl",
  "inviteLink",
  "jwt",
  "secret",
  "apiKey",
]);

// Depth cap: audit payloads are API responses, not arbitrary graphs, and an unbounded walk over
// a cyclic object would hang the request that triggered it.
const MAX_DEPTH = 8;

function redact(value, depth = 0) {
  if (value == null || depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  // Dates, ObjectIds and Buffers are objects but must be stored as-is, not walked into.
  if (typeof value !== "object" || value instanceof Date || value._bsontype || Buffer.isBuffer(value)) {
    return value;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.has(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export function auditAction(action, entity) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only log what actually succeeded. res.json also carries 4xx/5xx error envelopes, and
      // recording those as though the action happened makes the log claim things that did not.
      if (res.statusCode >= 400) return originalJson(body);
      AuditLog.create({
        actor: req.user?._id || null,
        actorRole: req.user?.role || "unknown",
        action,
        entity,
        entityId: body?.data?._id || body?.data?.id || req.params.id || null,
        before: redact(req._auditBefore ?? null),
        after: redact(body?.data ?? null),
        ip: req.ip,
        // Who/what the action came from. Capped: a header is attacker-controlled free text and
        // this row is read back into a dashboard.
        userAgent: typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"].slice(0, 300)
          : null,
      }).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}

export function captureBeforeState(loader) {
  return async (req, _res, next) => {
    try {
      req._auditBefore = await loader(req);
    } catch {
      req._auditBefore = null;
    }
    next();
  };
}

// Writes one audit row directly, for things that aren't a plain "the route returned the entity"
// shape — invite resend/revoke, role changes, suspensions (prompt-125). Same redaction.
export async function recordAudit(req, { action, entity, entityId = null, before = null, after = null }) {
  try {
    await AuditLog.create({
      actor: req.user?._id || null,
      actorRole: req.user?.role || "unknown",
      action,
      entity,
      entityId,
      before: redact(before),
      after: redact(after),
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null,
    });
  } catch {
    // Never let bookkeeping fail the operation it is describing.
  }
}
