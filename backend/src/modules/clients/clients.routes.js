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
