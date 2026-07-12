export type TeamRole = "owner" | "dietitian" | "intern" | "reception" | "accountant";
export type MemberStatus = "active" | "invited" | "suspended";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: TeamRole;
  status: MemberStatus;
  joinedAt: string;
  lastActiveAt: string;
  clients: number;
  bookings30d: number;
  initials: string;
  color: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
}

export interface AccessLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  ip: string;
  device: string;
}

export const ROLE_META: Record<
  TeamRole,
  { label: string; cls: string; description: string }
> = {
  owner: {
    label: "Owner",
    cls: "bg-violet-500/10 text-violet-700 border-violet-500/20",
    description: "Full access. Billing, team, danger-zone settings.",
  },
  dietitian: {
    label: "Dietitian",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    description: "Manage clients, plans, appointments and journal.",
  },
  intern: {
    label: "Intern",
    cls: "bg-sky-500/10 text-sky-700 border-sky-500/20",
    description: "Read-only on clients; can draft plans for review.",
  },
  reception: {
    label: "Reception",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    description: "Booking, intake forms and basic client info only.",
  },
  accountant: {
    label: "Accountant",
    cls: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    description: "Billing, invoices and financial reports.",
  },
};

export const STATUS_STYLES: Record<MemberStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  invited: { label: "Invited", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  suspended: { label: "Suspended", cls: "bg-slate-500/10 text-slate-700 border-slate-500/20" },
};

export type PermissionKey =
  | "clients.view"
  | "clients.edit"
  | "plans.create"
  | "plans.publish"
  | "appointments.manage"
  | "billing.view"
  | "billing.manage"
  | "reports.view"
  | "cms.edit"
  | "team.manage"
  | "settings.manage";

export interface PermissionGroup {
  label: string;
  items: { key: PermissionKey; label: string; hint?: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Clients",
    items: [
      { key: "clients.view", label: "View clients" },
      { key: "clients.edit", label: "Edit clients" },
    ],
  },
  {
    label: "Plans & sessions",
    items: [
      { key: "plans.create", label: "Create meal & gym plans" },
      { key: "plans.publish", label: "Publish plans to clients" },
      { key: "appointments.manage", label: "Manage appointments" },
    ],
  },
  {
    label: "Billing",
    items: [
      { key: "billing.view", label: "View invoices" },
      { key: "billing.manage", label: "Create & refund invoices" },
    ],
  },
  {
    label: "Site & insights",
    items: [
      { key: "reports.view", label: "View reports" },
      { key: "cms.edit", label: "Edit website / CMS" },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "team.manage", label: "Manage team", hint: "Invite, change role, remove" },
      { key: "settings.manage", label: "Manage workspace settings" },
    ],
  },
];

export const ROLE_PERMISSIONS: Record<TeamRole, PermissionKey[]> = {
  owner: [
    "clients.view", "clients.edit", "plans.create", "plans.publish", "appointments.manage",
    "billing.view", "billing.manage", "reports.view", "cms.edit", "team.manage", "settings.manage",
  ],
  dietitian: [
    "clients.view", "clients.edit", "plans.create", "plans.publish", "appointments.manage",
    "billing.view", "reports.view",
  ],
  intern: ["clients.view", "plans.create"],
  reception: ["clients.view", "appointments.manage"],
  accountant: ["billing.view", "billing.manage", "reports.view"],
};

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "u1", name: "Sura Hawli", email: "sura@nutria.health", phone: "+212 6 12 00 11 22", role: "owner", status: "active", joinedAt: "2024-09-01", lastActiveAt: "2026-06-21T09:30:00Z", clients: 42, bookings30d: 38, initials: "SH", color: "bg-violet-500" },
  { id: "u2", name: "Rana Eid", email: "rana@nutria.health", phone: "+212 6 23 44 55 66", role: "dietitian", status: "active", joinedAt: "2025-01-12", lastActiveAt: "2026-06-21T08:15:00Z", clients: 28, bookings30d: 24, initials: "RE", color: "bg-emerald-500" },
  { id: "u3", name: "Khalid Ben Ali", email: "khalid@nutria.health", role: "dietitian", status: "active", joinedAt: "2025-03-04", lastActiveAt: "2026-06-20T18:42:00Z", clients: 19, bookings30d: 17, initials: "KB", color: "bg-teal-500" },
  { id: "u4", name: "Imane Tazi", email: "imane@nutria.health", role: "reception", status: "active", joinedAt: "2025-06-22", lastActiveAt: "2026-06-21T07:55:00Z", clients: 0, bookings30d: 64, initials: "IT", color: "bg-amber-500" },
  { id: "u5", name: "Youssef B.", email: "youssef@nutria.health", role: "accountant", status: "active", joinedAt: "2025-10-15", lastActiveAt: "2026-06-19T16:20:00Z", clients: 0, bookings30d: 0, initials: "YB", color: "bg-rose-500" },
  { id: "u6", name: "Lina Karam", email: "lina.intern@nutria.health", role: "intern", status: "active", joinedAt: "2026-02-08", lastActiveAt: "2026-06-21T06:40:00Z", clients: 0, bookings30d: 0, initials: "LK", color: "bg-sky-500" },
  { id: "u7", name: "Omar S.", email: "omar.intern@nutria.health", role: "intern", status: "suspended", joinedAt: "2025-11-02", lastActiveAt: "2026-05-10T11:00:00Z", clients: 0, bookings30d: 0, initials: "OS", color: "bg-slate-500" },
];

export const PENDING_INVITES: PendingInvite[] = [
  { id: "i1", email: "nadia@nutria.health", role: "dietitian", invitedBy: "Sura Hawli", invitedAt: "2026-06-20", expiresAt: "2026-06-27" },
  { id: "i2", email: "samir@nutria.health", role: "reception", invitedBy: "Sura Hawli", invitedAt: "2026-06-19", expiresAt: "2026-06-26" },
];

export const ACCESS_LOGS: AccessLog[] = [
  { id: "l1", actor: "Sura Hawli", action: "Invited", target: "nadia@nutria.health (Dietitian)", at: "2026-06-20T14:22:00Z", ip: "41.92.10.4", device: "MacBook · Safari" },
  { id: "l2", actor: "Rana Eid", action: "Published plan", target: "Plan #PL-204 → Sara E.", at: "2026-06-20T11:08:00Z", ip: "41.92.10.4", device: "iPhone · Safari" },
  { id: "l3", actor: "Imane Tazi", action: "Cancelled appointment", target: "Appt #AP-871 (Karim I.)", at: "2026-06-19T16:40:00Z", ip: "196.200.5.12", device: "Windows · Chrome" },
  { id: "l4", actor: "Youssef B.", action: "Issued invoice", target: "INV-2026-0034 ($249)", at: "2026-06-19T10:14:00Z", ip: "41.92.10.4", device: "MacBook · Chrome" },
  { id: "l5", actor: "Sura Hawli", action: "Suspended user", target: "Omar S. (Intern)", at: "2026-05-10T11:02:00Z", ip: "41.92.10.4", device: "MacBook · Safari" },
  { id: "l6", actor: "Khalid Ben Ali", action: "Updated client", target: "Sofia D. — notes", at: "2026-06-21T08:30:00Z", ip: "105.66.2.18", device: "Android · Chrome" },
];

export function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - d) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
