import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./foods.controller.js";
import {
  createFoodSchema,
  updateFoodSchema,
  listFoodsSchema,
  usdaSearchSchema,
  usdaImportSchema,
} from "./foods.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("foods.create"),
  validate(createFoodSchema),
  auditAction("create", "food"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("foods.read"),
  validate(listFoodsSchema),
  ctrl.list
);

// Must come before /:id — otherwise Express would match "usda-search" as an :id param.
router.get(
  "/usda-search",
  requirePermission("foods.read"),
  validate(usdaSearchSchema),
  ctrl.usdaSearch
);

router.post(
  "/usda-import",
  requirePermission("foods.create"),
  validate(usdaImportSchema),
  auditAction("create", "food"),
  ctrl.usdaImport
);

router.get(
  "/:id",
  requirePermission("foods.read"),
  ctrl.getOne
);

router.patch(
  "/:id",
  requirePermission("foods.update"),
  validate(updateFoodSchema),
  auditAction("update", "food"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("foods.delete"),
  auditAction("delete", "food"),
  ctrl.remove
);

export default router;
