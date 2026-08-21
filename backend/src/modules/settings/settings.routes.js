import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./settings.controller.js";
import {
  updateClassTypesSchema,
  updateDietaryPreferencesSchema,
} from "./settings.validation.js";

const router = Router();

router.use(authenticate);

router.get("/class-types", requirePermission("settings.read"), ctrl.getClassTypes);

router.patch(
  "/class-types",
  requirePermission("settings.update"),
  validate(updateClassTypesSchema),
  auditAction("update", "setting"),
  ctrl.updateClassTypes
);

router.get(
  "/dietary-preferences",
  requirePermission("settings.read"),
  ctrl.getDietaryPreferences
);

router.patch(
  "/dietary-preferences",
  requirePermission("settings.update"),
  validate(updateDietaryPreferencesSchema),
  auditAction("update", "setting"),
  ctrl.updateDietaryPreferences
);

export default router;
