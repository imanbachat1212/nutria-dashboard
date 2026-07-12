import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./mealplans.controller.js";
import {
  createPlanSchema,
  updatePlanSchema,
  listPlansSchema,
  copyDaySchema,
  duplicatePlanSchema,
  addItemSchema,
  removeItemSchema,
} from "./mealplans.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("mealplans.create"),
  validate(createPlanSchema),
  auditAction("create", "mealplan"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("mealplans.read"),
  validate(listPlansSchema),
  ctrl.list
);

router.get("/:id", requirePermission("mealplans.read"), ctrl.getOne);

router.patch(
  "/:id",
  requirePermission("mealplans.update"),
  validate(updatePlanSchema),
  auditAction("update", "mealplan"),
  ctrl.update
);

router.get("/:id/pdf", requirePermission("mealplans.read"), ctrl.pdfExport);

router.post(
  "/:id/copy-day",
  requirePermission("mealplans.update"),
  validate(copyDaySchema),
  auditAction("update", "mealplan"),
  ctrl.copyDay
);

router.post(
  "/:id/duplicate",
  requirePermission("mealplans.create"),
  validate(duplicatePlanSchema),
  auditAction("create", "mealplan"),
  ctrl.duplicate
);

router.delete(
  "/:id",
  requirePermission("mealplans.delete"),
  auditAction("delete", "mealplan"),
  ctrl.remove
);

router.post(
  "/:id/items",
  requirePermission("mealplans.update"),
  validate(addItemSchema),
  auditAction("update", "mealplan"),
  ctrl.addItem
);

router.delete(
  "/:id/items/:itemId",
  requirePermission("mealplans.update"),
  validate(removeItemSchema),
  auditAction("update", "mealplan"),
  ctrl.removeItem
);

export default router;
