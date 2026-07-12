import { api } from "./api";
import {
  getStaff,
  type AppointmentRecord,
  type AppointmentType,
  type AppointmentStatus,
  type AttendeeRecord,
  type AttendeeStatus,
  type AttendeeSource,
} from "./appointments-mock";

// ── API types ──

interface APIClientRef {
  _id: string;
  phone: string;
  profile?: { firstName?: string; lastName?: string };
}

interface APIStaffRef {
  _id: string;
  name: string;
}

interface APIAttendee {
  clientId: string;
  name: string;
  status: AttendeeStatus;
  source: AttendeeSource;
  bookedAt: string;
}

interface APIAppointment {
  _id: string;
  client: APIClientRef | null;
  staffId: APIStaffRef | string;
  type: AppointmentType;
  category: "diet" | "gym";
  name?: string;
  status: AppointmentStatus;
  dateTime: string;
  durationMin: number;
  room?: string;
  notes?: string;
  capacity: number;
  attendees: APIAttendee[];
  createdAt: string;
  updatedAt: string;
}

interface APIListResult {
  appointments: APIAppointment[];
  total: number;
}

// ── Helpers ──

function clientName(c: APIClientRef): string {
  const f = c.profile?.firstName || "";
  const l = c.profile?.lastName || "";
  return [f, l].filter(Boolean).join(" ") || "Unnamed";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function staffName(staffId: APIStaffRef | string): string {
  if (typeof staffId === "string") return getStaff(staffId)?.name ?? "Unassigned";
  return staffId.name;
}

function staffIdOf(staffId: APIStaffRef | string): string {
  return typeof staffId === "string" ? staffId : staffId._id;
}

function toAppointmentRecord(a: APIAppointment): AppointmentRecord {
  return {
    id: a._id,
    type: a.type,
    category: a.category,
    status: a.status,
    startIso: a.dateTime,
    durationMin: a.durationMin,
    client: a.client
      ? {
          id: a.client._id,
          name: clientName(a.client),
          phone: a.client.phone,
          initials: initials(clientName(a.client)),
        }
      : null,
    name: a.name,
    staffId: staffIdOf(a.staffId),
    staffName: staffName(a.staffId),
    room: a.room,
    notes: a.notes,
    capacity: a.capacity,
    attendees: a.attendees.map(
      (att): AttendeeRecord => ({
        clientId: att.clientId,
        name: att.name,
        status: att.status,
        source: att.source,
        bookedAtIso: att.bookedAt,
      }),
    ),
  };
}

// ── Create/update payloads (mirror the backend's type-discriminated validation) ──

interface OneToOnePayload {
  type: Exclude<AppointmentType, "gym-class" | "gym-machine">;
  client: string;
  staffId: string;
  dateTime: string;
  durationMin?: number;
  status?: AppointmentStatus;
  room?: string;
  notes?: string;
  // try-out only — flexible category, derived from which staff pool was picked
  category?: "diet" | "gym";
}

// gym-class and gym-machine share a capacity + roster shape (roster optionally seeded at
// creation via the client picker, built up further afterward via the attendees sub-resource).
// `name` is gym-class only (its class type) — gym-machine has no name field at all.
interface CapacityPayload {
  type: "gym-class" | "gym-machine";
  name?: string;
  staffId: string;
  dateTime: string;
  durationMin?: number;
  status?: AppointmentStatus;
  room?: string;
  notes?: string;
  capacity?: number;
  attendees?: { clientId: string; name: string }[];
}

export type CreateAppointmentPayload = OneToOnePayload | CapacityPayload;

export interface UpdateAppointmentPayload {
  client?: string;
  staffId?: string;
  name?: string;
  category?: "diet" | "gym";
  status?: AppointmentStatus;
  dateTime?: string;
  durationMin?: number;
  room?: string;
  notes?: string;
  capacity?: number;
}

// ── Exported API functions ──

export async function fetchAppointments(params?: {
  from?: string;
  to?: string;
  type?: AppointmentType;
  category?: "diet" | "gym";
  staffId?: string;
}): Promise<{ appointments: AppointmentRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.type) qs.set("type", params.type);
  if (params?.category) qs.set("category", params.category);
  if (params?.staffId) qs.set("staffId", params.staffId);
  const q = qs.toString();
  const result = await api.get<APIListResult>(`/api/appointments${q ? `?${q}` : ""}`);
  return {
    appointments: result.appointments.map(toAppointmentRecord),
    total: result.total,
  };
}

export async function fetchAppointment(id: string): Promise<AppointmentRecord> {
  const raw = await api.get<APIAppointment>(`/api/appointments/${id}`);
  return toAppointmentRecord(raw);
}

export async function createAppointment(
  data: CreateAppointmentPayload,
): Promise<AppointmentRecord> {
  const raw = await api.post<APIAppointment>("/api/appointments", data);
  return toAppointmentRecord(raw);
}

export async function updateAppointment(
  id: string,
  data: UpdateAppointmentPayload,
): Promise<AppointmentRecord> {
  const raw = await api.patch<APIAppointment>(`/api/appointments/${id}`, data);
  return toAppointmentRecord(raw);
}

export async function deleteAppointment(id: string): Promise<void> {
  await api.delete(`/api/appointments/${id}`);
}

export async function addAttendee(
  appointmentId: string,
  data: { clientId: string; name: string; status?: AttendeeStatus; source?: AttendeeSource },
): Promise<AppointmentRecord> {
  const raw = await api.post<APIAppointment>(`/api/appointments/${appointmentId}/attendees`, data);
  return toAppointmentRecord(raw);
}

export async function updateAttendeeStatus(
  appointmentId: string,
  clientId: string,
  status: AttendeeStatus,
): Promise<AppointmentRecord> {
  const raw = await api.patch<APIAppointment>(
    `/api/appointments/${appointmentId}/attendees/${clientId}`,
    { status },
  );
  return toAppointmentRecord(raw);
}
