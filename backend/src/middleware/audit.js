import AuditLog from "../modules/audit/audit-log.model.js";

export function auditAction(action, entity) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      AuditLog.create({
        actor: req.user?._id || null,
        actorRole: req.user?.role || "unknown",
        action,
        entity,
        entityId: body?.data?._id || req.params.id || null,
        before: req._auditBefore || null,
        after: body?.data || null,
        ip: req.ip,
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
