import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction, captureBeforeState } from "../../middleware/audit.js";
import * as ctrl from "./clients.controller.js";
import Client from "./client.model.js";
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
  createNoteSchema,
  archiveParamsSchema,
} from "./clients.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("clients.create"),
  validate(createClientSchema),
  auditAction("create", "client"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("clients.read"),
  validate(listClientsSchema),
  ctrl.list
);

// Must come before /:id — otherwise Express would match "stats" as an :id param.
router.get(
  "/stats",
  requirePermission("clients.read"),
  ctrl.stats
);

router.get(
  "/:id",
  requirePermission("clients.read"),
  ctrl.getOne
);

router.patch(
  "/:id",
  requirePermission("clients.update"),
  validate(updateClientSchema),
  captureBeforeState((req) => Client.findById(req.params.id).lean()),
  auditAction("update", "client"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("clients.delete"),
  auditAction("delete", "client"),
  ctrl.remove
);

// "Delete" in the UI is really this — archives (soft-deletes) a client, hiding them from the
// default roster while leaving every referenced record (appointments, plans, billing, journal,
// notes) untouched. Gated on clients.delete, same as the (now UI-unused but still available)
// hard-delete above. Restoring is non-destructive, so it only needs clients.update.
router.post(
  "/:id/archive",
  requirePermission("clients.delete"),
  validate(archiveParamsSchema),
  auditAction("update", "client"),
  ctrl.archive
);

router.post(
  "/:id/restore",
  requirePermission("clients.update"),
  validate(archiveParamsSchema),
  auditAction("update", "client"),
  ctrl.restore
);

router.post(
  "/:id/notes",
  requirePermission("clients.update"),
  validate(createNoteSchema),
  ctrl.addNote
);

router.get(
  "/:id/notes",
  requirePermission("clients.read"),
  ctrl.listNotes
);

export default router;
