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
  copyMealSlotSchema,
  copySlotToSlotSchema,
  updateSlotTimeSchema,
  duplicatePlanSchema,
  addItemSchema,
  updateItemSchema,
  removeItemSchema,
  saveAsTemplateSchema,
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
  "/:id/copy-meal-slot",
  requirePermission("mealplans.update"),
  validate(copyMealSlotSchema),
  auditAction("update", "mealplan"),
  ctrl.copyMealSlot
);

router.post(
  "/:id/copy-slot-to-slot",
  requirePermission("mealplans.update"),
  validate(copySlotToSlotSchema),
  auditAction("update", "mealplan"),
  ctrl.copySlotToSlot
);

router.patch(
  "/:id/slot-time",
  requirePermission("mealplans.update"),
  validate(updateSlotTimeSchema),
  auditAction("update", "mealplan"),
  ctrl.updateSlotTime
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

router.patch(
  "/:id/items/:itemId",
  requirePermission("mealplans.update"),
  validate(updateItemSchema),
  auditAction("update", "mealplan"),
  ctrl.updateItem
);

router.delete(
  "/:id/items/:itemId",
  requirePermission("mealplans.update"),
  validate(removeItemSchema),
  auditAction("update", "mealplan"),
  ctrl.removeItem
);

// The primary template-authoring path — build a real plan first, then snapshot it into a
// reusable template. Gated on mealplantemplates.create (the permission for the thing being
// created), not mealplans.*, since reading the source plan only requires mealplans.read-level
// access to view it in the first place (already implied by the dietitian being on this page).
router.post(
  "/:id/save-as-template",
  requirePermission("mealplantemplates.create"),
  validate(saveAsTemplateSchema),
  auditAction("create", "mealplantemplate"),
  ctrl.saveAsTemplate
);

export default router;
