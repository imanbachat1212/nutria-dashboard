import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./meals.controller.js";
import { createMealSchema, updateMealSchema, listMealsSchema } from "./meals.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("meals.create"),
  validate(createMealSchema),
  auditAction("create", "meal"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("meals.read"),
  validate(listMealsSchema),
  ctrl.list
);

router.get(
  "/:id",
  requirePermission("meals.read"),
  ctrl.getOne
);

router.patch(
  "/:id",
  requirePermission("meals.update"),
  validate(updateMealSchema),
  auditAction("update", "meal"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("meals.delete"),
  auditAction("delete", "meal"),
  ctrl.remove
);

export default router;
