import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./mealplantemplates.controller.js";
import {
  listTemplatesSchema,
  createTemplateSchema,
  updateTemplateSchema,
  templateParamsSchema,
  addTemplateItemSchema,
  updateTemplateItemSchema,
  removeTemplateItemSchema,
} from "./mealplantemplates.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("mealplantemplates.read"),
  validate(listTemplatesSchema),
  ctrl.list,
);

router.get("/:id", requirePermission("mealplantemplates.read"), ctrl.getOne);

router.post(
  "/",
  requirePermission("mealplantemplates.create"),
  validate(createTemplateSchema),
  auditAction("create", "mealplantemplate"),
  ctrl.create,
);

router.patch(
  "/:id",
  requirePermission("mealplantemplates.update"),
  validate(updateTemplateSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.update,
);

// Archive/restore (soft delete) — same convention as clients.routes.js, so a template used to
// build past plans can be retired from the wizard without touching those already-created plans.
router.post(
  "/:id/archive",
  requirePermission("mealplantemplates.delete"),
  validate(templateParamsSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.archive,
);

router.post(
  "/:id/restore",
  requirePermission("mealplantemplates.update"),
  validate(templateParamsSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.restore,
);

// Genuine permanent removal (prompt-44) — gated on the same mealplantemplates.delete permission
// as archive above, matching clients.routes.js's own hard-delete route in both shape (204, no
// body) and permission choice. Never affects a real MealPlan already created from this template
// (see deleteTemplate's comment in the service) — only archive/restore ever needed that guard
// before, since neither actually removed the underlying document.
router.delete(
  "/:id",
  requirePermission("mealplantemplates.delete"),
  auditAction("delete", "mealplantemplate"),
  ctrl.remove,
);

// Item-level content editing (prompt-41) — mirrors mealplans.routes.js's item routes in shape.
router.post(
  "/:id/items",
  requirePermission("mealplantemplates.update"),
  validate(addTemplateItemSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.addItem,
);

router.patch(
  "/:id/items/:itemId",
  requirePermission("mealplantemplates.update"),
  validate(updateTemplateItemSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.updateItem,
);

router.delete(
  "/:id/items/:itemId",
  requirePermission("mealplantemplates.update"),
  validate(removeTemplateItemSchema),
  auditAction("update", "mealplantemplate"),
  ctrl.removeItem,
);

export default router;
