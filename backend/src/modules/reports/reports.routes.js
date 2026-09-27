import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as ctrl from "./reports.controller.js";

const router = Router();

router.use(authenticate);

// The Overview page's single read. No `validate()` — it takes no params, and the app's other
// no-input GETs (appointments' /:id, messages' conversation list) skip it the same way rather
// than declaring an empty schema. reports.validation.js is left as the stub it was; the first
// endpoint here that accepts a date range is the one that will need it.
//
// `reports.read` was already in the Permission collection and already on the dietitian role
// before this route existed — nothing needed seeding. No audit middleware: auditAction logs
// mutations, and this writes nothing.
router.get("/overview", requirePermission("reports.read"), ctrl.overview);

export default router;
