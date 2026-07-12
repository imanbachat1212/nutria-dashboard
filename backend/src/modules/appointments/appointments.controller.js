import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./appointments.service.js";

export const create = asyncHandler(async (req, res) => {
  const appt = await svc.createAppointment(req.validated.body, req.user);
  res.status(201).json({ data: appt });
});

export const list = asyncHandler(async (req, res) => {
  const result = await svc.listAppointments(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const appt = await svc.getAppointmentById(req.params.id);
  res.json({ data: appt });
});

export const update = asyncHandler(async (req, res) => {
  const appt = await svc.updateAppointment(req.params.id, req.validated.body);
  res.json({ data: appt });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteAppointment(req.params.id);
  res.status(204).end();
});

export const addAttendee = asyncHandler(async (req, res) => {
  const appt = await svc.addAttendee(req.params.id, req.validated.body, req.user);
  res.status(201).json({ data: appt });
});

export const updateAttendee = asyncHandler(async (req, res) => {
  const appt = await svc.updateAttendeeStatus(
    req.params.id,
    req.params.clientId,
    req.validated.body.status,
    req.user
  );
  res.json({ data: appt });
});
