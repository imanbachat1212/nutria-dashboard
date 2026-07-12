import { ApiError } from "../lib/ApiError.js";

export function requirePermission(...required) {
  return (req, _res, next) => {
    const perms = req.user?.permissions || [];
    if (perms.includes("*")) return next();

    const missing = required.filter((p) => !perms.includes(p));
    if (missing.length) {
      throw new ApiError(403, `Missing permissions: ${missing.join(", ")}`);
    }
    next();
  };
}
