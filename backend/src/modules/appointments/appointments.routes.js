import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction, captureBeforeState } from "../../middleware/audit.js";
import * as ctrl from "./appointments.controller.js";
import Appointment from "./appointment.model.js";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsSchema,
  addAttendeeSchema,
  updateAttendeeSchema,
} from "./appointments.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("appointments.create"),
  validate(createAppointmentSchema),
  auditAction("create", "appointment"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("appointments.read"),
  validate(listAppointmentsSchema),
  ctrl.list
);

router.get("/:id", requirePermission("appointments.read"), ctrl.getOne);

router.patch(
  "/:id",
  requirePermission("appointments.update"),
  validate(updateAppointmentSchema),
  captureBeforeState((req) => Appointment.findById(req.params.id).lean()),
  auditAction("update", "appointment"),
  ctrl.update
);

router.delete(
  "/:id",
  requirePermission("appointments.delete"),
  auditAction("delete", "appointment"),
  ctrl.remove
);

router.post(
  "/:id/attendees",
  requirePermission("appointments.update"),
  validate(addAttendeeSchema),
  auditAction("update", "appointment"),
  ctrl.addAttendee
);

router.patch(
  "/:id/attendees/:clientId",
  requirePermission("appointments.update"),
  validate(updateAttendeeSchema),
  auditAction("update", "appointment"),
  ctrl.updateAttendee
);

export default router;
