import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./journal.controller.js";
import {
  createEntrySchema,
  updateEntrySchema,
  listEntriesSchema,
  entryParamsSchema,
} from "./journal.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("journal.create"),
  validate(createEntrySchema),
  auditAction("create", "journal_entry"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("journal.read"),
  validate(listEntriesSchema),
  ctrl.list
);

router.get(
  "/:id",
  requirePermission("journal.read"),
  validate(entryParamsSchema),
  ctrl.getOne
);

router.patch(
  "/:id",
  requirePermission("journal.update"),
  validate(updateEntrySchema),
  auditAction("update", "journal_entry"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("journal.delete"),
  validate(entryParamsSchema),
  auditAction("delete", "journal_entry"),
  ctrl.remove
);

export default router;
