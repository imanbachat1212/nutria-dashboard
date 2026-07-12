import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./users.controller.js";
import { createUserSchema, updateUserSchema, listUsersSchema } from "./users.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("users.create"),
  validate(createUserSchema),
  auditAction("create", "user"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("users.read"),
  validate(listUsersSchema),
  ctrl.list
);

router.get(
  "/:id",
  requirePermission("users.read"),
  ctrl.getOne
);

router.patch(
  "/:id",
  requirePermission("users.update"),
  validate(updateUserSchema),
  auditAction("update", "user"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("users.delete"),
  auditAction("delete", "user"),
  ctrl.remove
);

export default router;
