import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./audit.controller.js";
import { listAuditSchema } from "./audit.validation.js";

const router = Router();

router.use(authenticate);

// audit.read — owner-only in role-definitions.js. The audit log records who did what to whose
// records, so reading it is itself a privileged act: it is the one place where a reception user
// could see that a clinical note was edited, and which client it belonged to.
//
// Reads, so not audited. Auditing reads of the audit log is a well-known way to produce a
// collection that grows by looking at it.
router.get("/facets", requirePermission("audit.read"), ctrl.facets);

router.get("/", requirePermission("audit.read"), validate(listAuditSchema), ctrl.list);

export default router;
