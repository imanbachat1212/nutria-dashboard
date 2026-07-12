import Appointment from "./appointment.model.js";
import Client from "../clients/client.model.js";
import { getClassTypes } from "../settings/settings.service.js";
import { ApiError } from "../../lib/ApiError.js";

// Fixed category per type. try-out is deliberately absent — it works for either a
// dietitian or a trainer, so the caller supplies category explicitly (derived on the
// frontend from which staff pool the selected staffId belongs to).
const TYPE_CATEGORY = {
  "consult-initial": "diet",
  "consult-followup": "diet",
  assessment: "diet",
  "gym-machine": "gym",
  "gym-class": "gym",
};

// Types with a shared-capacity roster (attendees[]) instead of a single client.
const CAPACITY_TYPES = new Set(["gym-class", "gym-machine"]);

// Statuses that occupy a capacity slot. Waitlist/no-show/cancelled don't.
const OCCUPYING_STATUSES = new Set(["booked", "checked-in"]);

export async function createAppointment(data, actor) {
  const category = TYPE_CATEGORY[data.type] ?? data.category;

  if (data.client) {
    const client = await Client.findById(data.client).lean();
    if (!client) throw new ApiError(404, "Client not found");
  }

  // gym-class's name is validated for shape only in Zod (a runtime, Settings-driven list
  // can't be a static z.enum) — actual membership is checked here against the live list.
  if (data.type === "gym-class") {
    const classTypes = await getClassTypes();
    if (!classTypes.includes(data.name)) {
      throw new ApiError(
        400,
        `"${data.name}" is not a configured class type. Add it in Settings → Services first.`
      );
    }
  }

  // Roster can be seeded at creation (New Appointment dialog's client picker) for capacity
  // types — each entry enters as "booked", same as a fresh addAttendee call. Same capacity
  // messaging as assertCapacity() below, since this is the same invariant at a different entry point.
  let attendees = [];
  if (CAPACITY_TYPES.has(data.type) && data.attendees?.length) {
    const capacity = data.capacity ?? 8; // mirrors the `capacity` default on the Appointment model
    if (data.attendees.length > capacity) {
      throw new ApiError(
        409,
        `This slot is at capacity (${capacity}/${capacity} booked). Remove ${data.attendees.length - capacity} attendee(s) or increase capacity.`
      );
    }

    const clientIds = data.attendees.map((a) => a.clientId);
    const foundCount = await Client.countDocuments({ _id: { $in: clientIds } });
    if (foundCount !== clientIds.length) {
      throw new ApiError(404, "One or more selected clients not found");
    }

    attendees = data.attendees.map((a) => ({
      clientId: a.clientId,
      name: a.name,
      status: "booked",
      source: "dashboard",
      bookedAt: new Date(),
    }));
  }

  const appt = await Appointment.create({
    ...data,
    category,
    attendees,
  });
  return populateAppointment(appt._id);
}

export async function listAppointments({ from, to, type, category, staffId }) {
  const filter = {};
  if (from || to) {
    filter.dateTime = {};
    if (from) filter.dateTime.$gte = new Date(from);
    if (to) filter.dateTime.$lte = new Date(to);
  }
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (staffId) filter.staffId = staffId;

  const appointments = await Appointment.find(filter)
    .populate("client", "profile.firstName profile.lastName phone")
    .populate("staffId", "name")
    .sort("dateTime")
    .lean();

  return { appointments, total: appointments.length };
}

export async function getAppointmentById(id) {
  const appt = await populateAppointment(id);
  if (!appt) throw new ApiError(404, "Appointment not found");
  return appt;
}

export async function updateAppointment(id, data) {
  const appt = await Appointment.findByIdAndUpdate(id, data, { new: true });
  if (!appt) throw new ApiError(404, "Appointment not found");
  return populateAppointment(appt._id);
}

export async function deleteAppointment(id) {
  const appt = await Appointment.findByIdAndDelete(id);
  if (!appt) throw new ApiError(404, "Appointment not found");
}

// New — no prior enforcement existed anywhere in the codebase. Hard-blocks entering a
// capacity-occupying status (booked/checked-in) once the class is full; waitlist is always
// allowed and is the caller's explicit fallback, not an automatic downgrade.
export async function addAttendee(appointmentId, data, actor) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (!CAPACITY_TYPES.has(appt.type)) {
    throw new ApiError(400, "Attendees can only be added to capacity-based appointments");
  }

  const client = await Client.findById(data.clientId).lean();
  if (!client) throw new ApiError(404, "Client not found");

  const alreadyAttending = appt.attendees.some((a) => String(a.clientId) === String(data.clientId));
  if (alreadyAttending) {
    throw new ApiError(409, "This client is already on the roster");
  }

  const status = data.status ?? "booked";
  assertCapacity(appt, status);

  appt.attendees.push({
    clientId: data.clientId,
    name: data.name,
    status,
    source: data.source ?? "dashboard",
    bookedAt: new Date(),
  });
  await appt.save();
  return populateAppointment(appt._id);
}

export async function updateAttendeeStatus(appointmentId, clientId, status, actor) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (!CAPACITY_TYPES.has(appt.type)) {
    throw new ApiError(400, "Attendees can only be updated on capacity-based appointments");
  }

  const attendee = appt.attendees.find((a) => String(a.clientId) === String(clientId));
  if (!attendee) throw new ApiError(404, "Attendee not found");

  // Only re-check capacity when genuinely entering the occupied set (e.g. waitlist -> booked).
  // A lateral move within it (booked -> checked-in) doesn't change the occupied count.
  if (!OCCUPYING_STATUSES.has(attendee.status)) {
    assertCapacity(appt, status);
  }

  attendee.status = status;
  await appt.save();
  return populateAppointment(appt._id);
}

function assertCapacity(appt, incomingStatus) {
  if (!OCCUPYING_STATUSES.has(incomingStatus)) return;
  const occupied = appt.attendees.filter((a) => OCCUPYING_STATUSES.has(a.status)).length;
  if (occupied >= appt.capacity) {
    throw new ApiError(
      409,
      `This slot is at capacity (${appt.capacity}/${appt.capacity} booked). Add to waitlist instead.`
    );
  }
}

async function populateAppointment(id) {
  return Appointment.findById(id)
    .populate("client", "profile.firstName profile.lastName phone")
    .populate("staffId", "name")
    .lean();
}
