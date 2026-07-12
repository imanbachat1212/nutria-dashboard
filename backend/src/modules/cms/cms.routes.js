import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./cms.controller.js";
import {
  createPageSchema,
  updatePageSchema,
  schedulePageSchema,
  listPagesSchema,
  pageParamsSchema,
} from "./cms.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/pages",
  requirePermission("cms.create"),
  validate(createPageSchema),
  auditAction("create", "cms_page"),
  ctrl.create,
);

router.get(
  "/pages",
  requirePermission("cms.read"),
  validate(listPagesSchema),
  ctrl.list,
);

router.get(
  "/pages/:id",
  requirePermission("cms.read"),
  validate(pageParamsSchema),
  ctrl.getOne,
);

// Specific actions BEFORE the generic /:id PATCH
router.patch(
  "/pages/:id/publish",
  requirePermission("cms.update"),
  validate(pageParamsSchema),
  auditAction("update", "cms_page"),
  ctrl.publish,
);

router.patch(
  "/pages/:id/unpublish",
  requirePermission("cms.update"),
  validate(pageParamsSchema),
  auditAction("update", "cms_page"),
  ctrl.unpublish,
);

router.patch(
  "/pages/:id/schedule",
  requirePermission("cms.update"),
  validate(schedulePageSchema),
  auditAction("update", "cms_page"),
  ctrl.schedule,
);

router.patch(
  "/pages/:id",
  requirePermission("cms.update"),
  validate(updatePageSchema),
  auditAction("update", "cms_page"),
  ctrl.update,
);

router.delete(
  "/pages/:id",
  requirePermission("cms.delete"),
  validate(pageParamsSchema),
  auditAction("delete", "cms_page"),
  ctrl.remove,
);

export default router;
