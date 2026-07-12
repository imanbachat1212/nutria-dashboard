export type AppointmentType =
  | "consult-initial"
  | "consult-followup"
  | "try-out"
  | "assessment"
  | "gym-machine"
  | "gym-class";
export type AppointmentStatus = "confirmed" | "pending" | "completed" | "no-show" | "cancelled";
export type AttendeeStatus = "booked" | "waitlist" | "checked-in" | "no-show" | "cancelled";
export type AttendeeSource = "dashboard" | "whatsapp" | "instagram" | "web";

export interface AttendeeRecord {
  clientId: string;
  name: string;
  status: AttendeeStatus;
  source: AttendeeSource;
  bookedAtIso: string;
}

export interface AppointmentRecord {
  id: string;
  type: AppointmentType;
  category: "diet" | "gym";
  status: AppointmentStatus;
  startIso: string;
  durationMin: number;
  // 1:1 types only — null for the capacity types (gym-class, gym-machine), which use
  // attendees[] instead
  client: { id: string; name: string; phone: string; initials: string } | null;
  // capacity-type title (e.g. "HIIT"); unset for 1:1 types, which display the client's name
  name?: string;
  staffId: string;
  staffName: string;
  room?: string;
  notes?: string;
  // capacity types only (gym-class, gym-machine)
  capacity: number;
  attendees: AttendeeRecord[];
}

// "flexible" (try-out only) works with either a dietitian or a trainer — the actual
// category is decided per-appointment by which staff pool was picked, not fixed by type.
type TypeGroup = "diet" | "gym" | "flexible";

const TYPE_META: Record<AppointmentType, { label: string; tone: string; group: TypeGroup }> = {
  "consult-initial": { label: "Initial consult", tone: "bg-primary/15 text-primary border-primary/30", group: "diet" },
  "consult-followup": { label: "Follow-up", tone: "bg-accent/40 text-accent-foreground border-accent", group: "diet" },
  "try-out": { label: "Try out", tone: "bg-muted text-foreground border-border", group: "flexible" },
  assessment: { label: "Assessment", tone: "bg-sky-100 text-sky-900 border-sky-200", group: "diet" },
  "gym-machine": { label: "Gym machine", tone: "bg-emerald-100 text-emerald-900 border-emerald-200", group: "gym" },
  "gym-class": { label: "Group class", tone: "bg-amber-100 text-amber-900 border-amber-200", group: "gym" },
};

export const typeMeta = (t: AppointmentType) => TYPE_META[t];

// Types with a shared-capacity roster (attendees[]) instead of a single client —
// gym-machine and gym-class are structurally identical, only the label/icon differ.
export function isCapacityType(t: AppointmentType): boolean {
  return t === "gym-class" || t === "gym-machine";
}

// ── Staff — two separate pools. The New Appointment dialog picks which one to show based
// on the selected type's group (diet -> dietitians, gym -> trainers, flexible -> both).
// IDs are fixed and match the staff Users seeded in backend/seed.js (STAFF array) so
// `staffId` round-trips to a real ObjectId ref instead of an ad hoc mock code.
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  color: string;
  specialties?: string[];
}

export const DIETITIANS: StaffMember[] = [
  { id: "6a0000000000000000000001", name: "Sura Hawli", role: "Lead Dietitian", color: "bg-primary" },
  { id: "6a0000000000000000000002", name: "Rim Khoury", role: "Dietitian", color: "bg-sky-500" },
];

export const TRAINERS: StaffMember[] = [
  { id: "6a0000000000000000000003", name: "Marwan Zein", role: "Head Trainer", color: "bg-emerald-500", specialties: ["Strength", "HIIT"] },
  { id: "6a0000000000000000000004", name: "Nour Saliba", role: "Trainer", color: "bg-amber-500", specialties: ["Mobility", "Pilates"] },
  { id: "6a0000000000000000000005", name: "Jad Aoun", role: "Trainer", color: "bg-violet-500", specialties: ["Spin", "HIIT"] },
  { id: "6a0000000000000000000006", name: "Rita Sleiman", role: "Trainer", color: "bg-rose-500", specialties: ["Boxing", "Strength"] },
];

export const ALL_STAFF: StaffMember[] = [...DIETITIANS, ...TRAINERS];

export function getStaff(id: string) {
  return ALL_STAFF.find((s) => s.id === id);
}

export function staffPoolForType(type: AppointmentType): StaffMember[] {
  const group = typeMeta(type).group;
  if (group === "flexible") return ALL_STAFF;
  return group === "gym" ? TRAINERS : DIETITIANS;
}

// For flexible types (try-out): which category a given staff pick implies.
export function categoryForStaff(staffId: string): "diet" | "gym" {
  return TRAINERS.some((t) => t.id === staffId) ? "gym" : "diet";
}

// ── Combined sidebar feed — reminders (passive, no backend) and booking requests
// (AI-reviewed inbound requests, no backend either) are different shapes on purpose;
// they render as two distinct row types inside one shared scrollable list via `kind`.
export interface ReminderItem {
  kind: "reminder";
  id: string;
  clientName: string;
  whenLabel: string;
  status: "confirmed" | "pending";
}

export const REMINDERS: ReminderItem[] = [
  { kind: "reminder", id: "R-1", clientName: "Lara Hachem", whenLabel: "in 2h", status: "confirmed" },
  { kind: "reminder", id: "R-2", clientName: "Yara Saab", whenLabel: "in 3h", status: "pending" },
  { kind: "reminder", id: "R-3", clientName: "Rana Eid", whenLabel: "in 7h", status: "pending" },
];

export type BookingChannel = "whatsapp" | "instagram" | "web";

export interface BookingRequest {
  kind: "booking-request";
  id: string;
  contactName: string;
  initials: string;
  sessionName: string;
  channel: BookingChannel;
  receivedIso: string;
  preview: string;
  aiConfidence: number; // 0–100
  status: "pending" | "auto-booked" | "declined";
}

export const BOOKING_REQUESTS: BookingRequest[] = [
  { kind: "booking-request", id: "BR-1", contactName: "Joelle Aoun", initials: "JA", sessionName: "7:30 HIIT", channel: "whatsapp", receivedIso: "2026-07-08T04:50:00Z", preview: "Can I jump into the 7:30 HIIT? It's my first class.", aiConfidence: 92, status: "auto-booked" },
  { kind: "booking-request", id: "BR-2", contactName: "Mira Bou Khalil", initials: "MB", sessionName: "3pm Spin", channel: "whatsapp", receivedIso: "2026-07-08T05:00:00Z", preview: "Reserve my spot in spin at 3pm please 🚴‍♀️", aiConfidence: 98, status: "auto-booked" },
  { kind: "booking-request", id: "BR-3", contactName: "Anthony Wehbe", initials: "AW", sessionName: "Strength (evening)", channel: "instagram", receivedIso: "2026-07-08T05:35:00Z", preview: "Is there room in strength tonight? I'm a new lead.", aiConfidence: 71, status: "pending" },
  { kind: "booking-request", id: "BR-4", contactName: "Layal Touma", initials: "LT", sessionName: "8pm Boxing", channel: "whatsapp", receivedIso: "2026-07-08T05:42:00Z", preview: "Can I book boxing at 8pm with Rita?", aiConfidence: 88, status: "pending" },
  { kind: "booking-request", id: "BR-5", contactName: "Carla Habib", initials: "CH", sessionName: "Reformer waitlist", channel: "web", receivedIso: "2026-07-08T05:55:00Z", preview: "Reformer waitlist — happy to take any opening.", aiConfidence: 64, status: "pending" },
];

export type SidebarFeedItem = ReminderItem | BookingRequest;

export const SIDEBAR_FEED: SidebarFeedItem[] = [...REMINDERS, ...BOOKING_REQUESTS].sort((a, b) => {
  const aTime = a.kind === "booking-request" ? a.receivedIso : "";
  const bTime = b.kind === "booking-request" ? b.receivedIso : "";
  return bTime.localeCompare(aTime);
});

// ── Date/time helpers ──

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function apptDateKey(iso: string): string {
  return utcDateKey(new Date(iso));
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDayHeading(d: Date): string {
  return `${DAY_NAMES_LONG[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatShortDay(d: Date): { weekday: string; date: number } {
  return { weekday: DAY_NAMES[d.getUTCDay()], date: d.getUTCDate() };
}

export function formatMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatMonthShort(d: Date): string {
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtRelative(iso: string, nowIso: string = new Date().toISOString()): string {
  const diffMin = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const TODAY_KEY = new Date().toISOString().split("T")[0];
