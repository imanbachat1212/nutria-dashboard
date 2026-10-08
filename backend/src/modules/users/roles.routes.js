import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./users.controller.js";
import { updateRoleSchema } from "./users.validation.js";

const router = Router();

router.use(authenticate);

// Roles live in the users module (they are part of team administration and share its service
// layer) but are mounted at /api/roles because they are their own resource — a role is not a
// sub-object of a user.
//
// Gated by users.read / users.update rather than a new roles.* permission: being able to
// administer the team and being able to define what the team can do are the same job, and the
// brief's five roles are fixed. A separate permission would be two things to grant for one job.
router.get("/", requirePermission("users.read"), ctrl.listRoles);

// Audited in the controller as "role permissions changed", with the before/after permission
// lists — the single most consequential write in this module.
router.patch(
  "/:id",
  requirePermission("users.update"),
  validate(updateRoleSchema),
  ctrl.updateRole
);

export default router;
