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
  foodsStatsSchema,
  favoriteParamsSchema,
  bulkDeleteFoodsSchema,
  usdaSearchSchema,
  usdaImportSchema,
  usdaImportedSchema,
  usdaDetailsSchema,
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

// Must come before /:id — otherwise Express would match "stats"/"usda-search"/"usda-imported"
// as an :id param.
router.get(
  "/stats",
  requirePermission("foods.read"),
  validate(foodsStatsSchema),
  ctrl.stats
);

router.get(
  "/usda-search",
  requirePermission("foods.read"),
  validate(usdaSearchSchema),
  ctrl.usdaSearch
);

router.get(
  "/usda-imported",
  requirePermission("foods.read"),
  validate(usdaImportedSchema),
  ctrl.usdaImported
);

// Read-only micronutrient preview for one search result, by fdcId — no DB write. Lets the
// dietitian inspect a result before deciding to import it, via the exact same
// getUsdaFoodDetails call importUsdaFood itself uses (see foods.service.js's previewUsdaFood).
router.get(
  "/usda-details/:fdcId",
  requirePermission("foods.read"),
  validate(usdaDetailsSchema),
  ctrl.usdaDetails
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

// Same permission and in-use protection as single delete (both call into
// foods.service.js's shared getFoodUsages) — this is just the batched version, never a
// looser rule. One audit entry summarizing the whole batch (deleted/blocked/notFound), same
// as any other single write action, rather than one entry per food.
router.post(
  "/bulk-delete",
  requirePermission("foods.delete"),
  validate(bulkDeleteFoodsSchema),
  auditAction("delete", "food"),
  ctrl.bulkRemove
);

// "Pin to quick-access" — personal to the requesting user, so foods.update (not foods.delete)
// gates both directions, matching the standard route -> auth -> rbac -> validate -> audit chain.
router.post(
  "/:id/favorite",
  requirePermission("foods.update"),
  validate(favoriteParamsSchema),
  auditAction("update", "food"),
  ctrl.addFavorite
);

router.delete(
  "/:id/favorite",
  requirePermission("foods.update"),
  validate(favoriteParamsSchema),
  auditAction("update", "food"),
  ctrl.removeFavorite
);

export default router;
