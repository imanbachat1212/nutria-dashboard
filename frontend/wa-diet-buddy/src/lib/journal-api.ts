import { api } from "./api";

// ── Types ───────────────────────────────────────────────────────────────────

export type JournalKind       = "meal" | "exercise";
export type JournalSource     = "dashboard" | "whatsapp-text" | "whatsapp-photo";
export type JournalStatus     = "pending" | "approved" | "edited" | "rejected";
export type JournalConfidence = "high" | "medium" | "low" | null;
export type MealSlot          = "breakfast" | "snack-am" | "lunch" | "snack-pm" | "dinner";

export interface JournalItemMacros {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
  fiber:    number;
}

export interface JournalItem {
  food:   string | null;
  label:  string;
  grams:  number | null;
  macros: JournalItemMacros | null;
}

export interface JournalEntry {
  id:              string;
  clientId:        string;
  clientName:      string;
  clientInitials:  string;
  kind:            JournalKind;
  mealSlot:        MealSlot | null;
  source:          JournalSource;
  date:            string;        // ISO — maps to mock's receivedAt
  rawMessage:      string;
  items:           JournalItem[];
  totals:          { kcal: number; protein: number; carbs: number; fat: number };
  confidence:      JournalConfidence;
  status:          JournalStatus;
  flags:           string[];
  note:            string;
}

// ── API shape ──────────────────────────────────────────────────────────────

interface APIEntry {
  _id:         string;
  client:      { _id: string; profile?: { firstName?: string; lastName?: string } } | string;
  date:        string;
  kind:        string;
  mealSlot:    string | null;
  source:      string;
  rawMessage?: string;
  items:       {
    food?:   string | null;
    label:   string;
    grams?:  number | null;
    macros?: { calories: number; protein: number; carbs: number; fat: number; fiber: number } | null;
  }[];
  totals:      { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  confidence:  string | null;
  status:      string;
  flags:       string[];
  note?:       string;
  clientName?:     string;
  clientInitials?: string;
}

// ── Mapping ────────────────────────────────────────────────────────────────

function toEntry(raw: APIEntry): JournalEntry {
  const clientObj = typeof raw.client === "string"
    ? { _id: raw.client }
    : raw.client;

  const clientName = raw.clientName
    || [clientObj?.profile?.firstName, clientObj?.profile?.lastName]
        .filter(Boolean).join(" ")
    || "Unknown";

  const clientInitials = raw.clientInitials
    || clientName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return {
    id:             raw._id,
    clientId:       clientObj?._id || "",
    clientName,
    clientInitials,
    kind:           raw.kind as JournalKind,
    mealSlot:       (raw.mealSlot as MealSlot) || null,
    source:         (raw.source as JournalSource) || "dashboard",
    date:           raw.date,
    rawMessage:     raw.rawMessage || "",
    items:          (raw.items || []).map((i) => ({
      food:   i.food || null,
      label:  i.label,
      grams:  i.grams ?? null,
      macros: i.macros
        ? {
            calories: i.macros.calories,
            protein:  i.macros.protein,
            carbs:    i.macros.carbs,
            fat:      i.macros.fat,
            fiber:    i.macros.fiber,
          }
        : null,
    })),
    totals: {
      kcal:    raw.totals?.calories || 0,
      protein: raw.totals?.protein  || 0,
      carbs:   raw.totals?.carbs    || 0,
      fat:     raw.totals?.fat      || 0,
    },
    confidence: (raw.confidence as JournalConfidence) ?? null,
    status:     (raw.status as JournalStatus) || "approved",
    flags:      raw.flags || [],
    note:       raw.note || "",
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchJournalEntries(params?: {
  client?: string;
  from?: string;
  to?: string;
  kind?: JournalKind;
  status?: JournalStatus;
  limit?: number;
}): Promise<JournalEntry[]> {
  const qs = new URLSearchParams();
  if (params?.client) qs.set("client", params.client);
  if (params?.from)   qs.set("from", params.from);
  if (params?.to)     qs.set("to", params.to);
  if (params?.kind)   qs.set("kind", params.kind);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit)  qs.set("limit", String(params.limit));
  const q = qs.toString();
  const raw = await api.get<APIEntry[]>(`/api/journal${q ? `?${q}` : ""}`);
  return raw.map(toEntry);
}

export async function fetchJournalEntry(id: string): Promise<JournalEntry> {
  const raw = await api.get<APIEntry>(`/api/journal/${id}`);
  return toEntry(raw);
}

export interface CreateEntryPayload {
  client:     string;
  date:       string;
  kind:       JournalKind;
  mealSlot?:  MealSlot | null;
  source?:    JournalSource;
  items?:     { food?: string | null; label: string; grams?: number | null }[];
  note?:      string;
}

export async function createJournalEntry(data: CreateEntryPayload): Promise<JournalEntry> {
  const raw = await api.post<APIEntry>("/api/journal", data);
  return toEntry(raw);
}

export async function updateJournalEntry(
  id: string,
  data: {
    status?:  JournalStatus;
    items?:   { food?: string | null; label: string; grams?: number | null }[];
    note?:    string;
  },
): Promise<JournalEntry> {
  const raw = await api.patch<APIEntry>(`/api/journal/${id}`, data);
  return toEntry(raw);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await api.delete(`/api/journal/${id}`);
}

// ── Display helpers ────────────────────────────────────────────────────────

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  "snack-am": "AM Snack",
  lunch:      "Lunch",
  "snack-pm": "PM Snack",
  dinner:     "Dinner",
};

export const SOURCE_LABEL: Record<JournalSource, string> = {
  dashboard:        "Dashboard",
  "whatsapp-text":  "WhatsApp · text",
  "whatsapp-photo": "WhatsApp · photo",
};

export const FLAG_LABEL: Record<string, string> = {
  "portion-uncertain": "Portion uncertain",
  "missing-detail":    "Missing detail",
  "macro-outlier":     "Macro outlier",
  duplicate:           "Possible duplicate",
  "image-unclear":     "Image unclear",
  "off-plan":          "Off plan",
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (diff < 1)  return "just now";
  if (diff < 60) return `${Math.round(diff)}m ago`;
  const h = diff / 60;
  if (h < 24)   return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
