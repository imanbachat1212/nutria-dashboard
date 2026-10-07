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
  listQueueSchema,
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

// Per-client review queue (prompt-124). MUST stay above "/:id" — Express matches in
// declaration order, so registering it after would make "queue" an :id and send the request to
// getEntryById, which would 404 on a journal entry whose id is the string "queue".
//
// Same middleware as the list route: a read of the same entries by the same people, so it
// carries journal.read and nothing more. Not audited — reads never are here.
router.get(
  "/queue",
  requirePermission("journal.read"),
  validate(listQueueSchema),
  ctrl.queue,
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
