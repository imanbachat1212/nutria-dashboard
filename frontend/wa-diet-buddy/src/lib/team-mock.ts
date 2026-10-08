// Team & Access display helpers.
//
// prompt-125 made this page real: TEAM_MEMBERS, PENDING_INVITES, ACCESS_LOGS, ROLE_PERMISSIONS,
// PERMISSION_GROUPS and PermissionKey are GONE. The first three were arrays the page loaded into
// useState, so inviting or suspending someone rearranged the screen and saved nothing. The last
// three described eleven permissions — clients.view, plans.publish and friends — that exist
// nowhere in the backend; the real registry is `resource.action` keys served by GET /api/roles.
//
// What remains is purely presentational: colours, labels and date formatting. Data now comes from
// src/lib/team-api.ts.

export type MemberStatus = "active" | "suspended";

/**
 * Keyed by ROLE NAME as the backend spells it, so a role added server-side needs no change here —
 * `roleMeta()` falls back for anything unknown rather than rendering undefined.
 */
export const ROLE_META: Record<string, { label: string; cls: string; description: string }> = {
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
  // The retired role. Still listed so an install that hasn't run the migration yet renders it
  // with a label instead of a blank badge.
  assistant: {
    label: "Assistant (legacy)",
    cls: "bg-slate-500/10 text-slate-700 border-slate-500/20",
    description: "Retired role — migrate these users to reception.",
  },
};

const FALLBACK_ROLE_META = {
  label: "Unknown",
  cls: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  description: "",
};

export function roleMeta(name: string | null | undefined) {
  if (!name) return FALLBACK_ROLE_META;
  return ROLE_META[name] ?? { ...FALLBACK_ROLE_META, label: name };
}

export const STATUS_STYLES: Record<MemberStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  suspended: { label: "Suspended", cls: "bg-slate-500/10 text-slate-700 border-slate-500/20" },
};

export function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - d) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
