import { api } from "./api";

// The Overview page's data (prompt-118), replacing the five hardcoded constants that used to
// live at the top of routes/index.tsx — `stats`, `todaysClient`, `activity`, `appointments`, and
// the literal date and greeting in the header.
//
// One endpoint, one request. `GET /api/reports/overview` returns every section, so the page has a
// single loading state instead of five that can disagree with each other about whether it's ready.

// A prior-period comparison the backend was actually able to make. `null` wherever no honest
// comparison exists — total foods barely moves week to week, and "active plans last month" isn't
// recoverable from a status field. The page renders no badge at all for null rather than a
// decorative "+0%".
export interface OverviewTrend {
  // Absolute change vs the equivalent prior window, never a percentage: a percentage needs a
  // non-zero baseline, and the mock's "+38% vs prior" over a prior of 0 is exactly the invented
  // number this replaced.
  delta: number;
  direction: "up" | "down" | "flat";
  prior: number;
}

export interface OverviewStats {
  clients: {
    active: number;
    total: number;
    // Counts clients CREATED in the window — a different quantity from `active` above it, which
    // is why the card labels it "new" rather than implying the active count moved by this much.
    trend: OverviewTrend | null;
    trendWindowDays: number;
  };
  mealPlans: { active: number; total: number; trend: OverviewTrend | null };
  foods: {
    total: number;
    bySource: { usda: number; lebanese: number; custom: number };
    trend: OverviewTrend | null;
  };
  leads: { last7Days: number; trend: OverviewTrend | null; trendWindowDays: number };
}

export interface NotLoggedClient {
  id: string;
  name: string;
  // null = has never logged anything. Sorts to the top of the list: nothing is staler than nothing.
  lastLoggedAt: string | null;
}

export interface OverviewAppointment {
  id: string;
  at: string;
  category: "diet" | "gym";
  type: string;
  status: string;
  // The client's name for 1:1 types; the session's own title for capacity types (gym-class,
  // gym-machine), which have no single client.
  title: string;
  subtitle: string;
}

export type ActivityType =
  | "journal-meal"
  | "journal-exercise"
  | "lead-new"
  | "message-inbound"
  | "appointment-booked";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  clientId: string | null;
  clientName: string;
  meta: string;
  at: string;
}

export interface Overview {
  generatedAt: string;
  // The server's local day (Asia/Beirut via lib/localDay.js) — what the meal-logging card is
  // scoped to, not the viewer's browser timezone. Appointments use `appointmentsDate` below.
  today: {
    date: string;
    timeZone: string;
    // The appointments card is scoped to the UTC calendar day instead of the Beirut one, because
    // appointment times are stored as wall-clock-in-UTC. Usually the same date as `date`.
    appointmentsDate: string;
  };
  stats: OverviewStats;
  mealLogging: {
    loggedToday: number;
    activeClients: number;
    notLoggedCount: number;
    // Capped server-side at 8; `notLoggedCount` is the true total so the card can say "+N more".
    notLogged: NotLoggedClient[];
  };
  appointmentsToday: OverviewAppointment[];
  needsAttention: {
    // Journal entries still pending with at least one AI flag — the same definition the Journal
    // page's Flagged tab uses, so the two can't disagree.
    flaggedEntries: number;
    // Conversations awaiting a reply, per messages.service.js's existing `unread` definition.
    unreadConversations: number;
    // Same 7-day window and same number as stats.leads.last7Days, read off one variable server-side.
    newLeads: number;
  };
  activity: ActivityEvent[];
}

export async function fetchOverview(): Promise<Overview> {
  return api.get<Overview>("/api/reports/overview");
}
