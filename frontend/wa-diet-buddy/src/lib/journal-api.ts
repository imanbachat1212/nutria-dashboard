import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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
  // Meal photo on a WhatsApp-sourced entry (prompt-91). null for dashboard entries, which
  // have never had one. The backend has stored this since the journal model was written; it
  // simply had no producer until the WhatsApp intake endpoint existed, so nothing read it.
  photo:           { url: string; width?: number; height?: number } | null;
  // Activity on an exercise entry (prompt-95); null on every meal. Kept entirely out of
  // `totals`, which stays food-only — an exercise entry has no items to total.
  exercise:        { type: string; minutes: number | null; intensity: string | null; burnedCalories: number | null } | null;
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
  photo?:      { url: string; key: string; width?: number; height?: number } | null;
  exercise?:   { type: string; minutes?: number | null; intensity?: string | null; burnedCalories?: number | null } | null;
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
    photo:          raw.photo?.url ? { url: raw.photo.url, width: raw.photo.width, height: raw.photo.height } : null,
    exercise:       raw.exercise?.type
      ? {
          type: raw.exercise.type,
          minutes: raw.exercise.minutes ?? null,
          intensity: raw.exercise.intensity ?? null,
          burnedCalories: raw.exercise.burnedCalories ?? null,
        }
      : null,
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

// ── Review queue (prompt-124) ──────────────────────────────────────────────
//
// One row per CLIENT with server-computed counts, plus grand totals. The page used to derive
// both from `fetchJournalEntries({ from, limit: 200 })`, but that endpoint sorts newest-first
// and the backend caps `limit` at 200 — so past 200 entries in the window the rows that silently
// vanished were the OLDEST pending ones, i.e. exactly the entries that had waited longest, and
// every count above the queue was short by the same amount.

/** One client's standing in the review queue. Counts are of PENDING entries. */
export interface JournalQueueClient {
  clientId:        string;
  clientName:      string;
  clientInitials:  string;
  /** Every entry this client has in the window — what the queue badge shows on the Approved tab. */
  entryCount:      number;
  pending:         number;
  /** Approved entries this client has in the window. */
  approved:        number;
  /** Pending entries carrying at least one flag. */
  flagged:         number;
  /** Pending entries the AI marked low-confidence. */
  lowConf:         number;
  /** Pending, unflagged, and not low-confidence — the bulk-approvable set. */
  cleanPending:    number;
  /** Oldest pending entry's timestamp; null when this client has nothing pending. */
  oldestPendingAt: string | null;
  lastEntryAt:     string | null;
}

/**
 * Totals across the whole window — NOT across the returned rows, which the `q` search narrows.
 * This mirrors how the page already behaved: the stat cards describe the queue, the search box
 * filters only the list beneath them.
 */
export interface JournalQueueTotals {
  pending:      number;
  flagged:      number;
  lowConf:      number;
  cleanPending: number;
  /** Number of clients with at least one pending entry. */
  clients:      number;
  approved:     number;
}

export interface JournalQueue {
  clients: JournalQueueClient[];
  totals:  JournalQueueTotals;
}

export async function fetchJournalQueue(params?: {
  from?: string;
  to?: string;
  /** "all" = no status filter (every client with any entry in the window). */
  status?: JournalStatus | "all";
  /** Client-name search, applied server-side to the joined profile name. */
  q?: string;
}): Promise<JournalQueue> {
  const qs = new URLSearchParams();
  if (params?.from)   qs.set("from", params.from);
  if (params?.to)     qs.set("to", params.to);
  if (params?.status) qs.set("status", params.status);
  if (params?.q)      qs.set("q", params.q);
  const q = qs.toString();
  // No `limit`: the response is one row per client, so there is nothing to truncate.
  return api.get<JournalQueue>(`/api/journal/queue${q ? `?${q}` : ""}`);
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

// ── Display labels ───────────────────────────────────────────────────────────────────────────
//
// These three maps are now the canonical list of KEYS. Their English values are kept as the
// fallback for any caller not yet localised, but the Journal screens read the text through
// `useJournalLabels()` below. The keys themselves are API values ("snack-am",
// "whatsapp-photo", "portion-uncertain") and must never be translated — the backend sends and
// receives exactly these strings.
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
  // ── The values n8n's Groq analysis actually writes ────────────────────────────────────────
  // Confirmed by aggregating journalentries.flags in the live database. The previous list
  // ("portion-uncertain", "missing-detail", "macro-outlier", "duplicate", "image-unclear",
  // "off-plan") matched NONE of them — the model writes snake_case and a different vocabulary —
  // so every flag has always rendered as its raw key in the UI, in English too. Found by
  // reading the rendered Arabic page, not the code.
  no_db_match: "No database match",
  portion_uncertain: "Portion uncertain",
  over_daily_target: "Over daily target",
  pending_entry: "Pending entry",
  pending_entries: "Pending entries",
  activity_only: "Activity only",
  ai_parse_failed: "AI could not parse",
  ai_estimated_items: "Items estimated by AI",
  ai_estimate: "AI estimate",
  photo_unclear: "Photo unclear",

  // ── Legacy hyphenated keys ────────────────────────────────────────────────────────────────
  // Kept so any entry written before the current analysis prompt still renders a label.
  "portion-uncertain": "Portion uncertain",
  "missing-detail": "Missing detail",
  "macro-outlier": "Macro outlier",
  duplicate: "Possible duplicate",
  "image-unclear": "Image unclear",
  "off-plan": "Off plan",
};

/**
 * Localised labels + the compact "2h ago" used across the review queue.
 *
 * One hook rather than three so a screen cannot end up with a translated slot name next to an
 * English flag reason. `timeAgo` stays abbreviated in both languages — it renders in an 11px
 * column beside every row, where the full `common:time.*` phrasing does not fit.
 */
export function useJournalLabels() {
  const { t } = useTranslation("journal");

  return useMemo(
    () => ({
      slot: (key: MealSlot | null | undefined, fallback = "") =>
        key && key in SLOT_LABEL ? t(`slot.${key}`) : fallback,
      source: (key: JournalSource) => (key in SOURCE_LABEL ? t(`source.${key}`) : key),
      // An unrecognised flag is shown verbatim: it came from the backend and the raw key is
      // more useful to Sura than silence.
      flag: (key: string) => (key in FLAG_LABEL ? t(`flag.${key}`) : key),
      kind: (key: "meal" | "exercise") => t(`kind.${key}`),
      timeAgo: (iso: string): string => {
        const diff = (Date.now() - new Date(iso).getTime()) / 60_000;
        if (diff < 1) return t("ago.justNow");
        if (diff < 60) return t("ago.minutes", { count: Math.round(diff) });
        const h = diff / 60;
        if (h < 24) return t("ago.hours", { count: Math.round(h) });
        return t("ago.days", { count: Math.round(h / 24) });
      },
    }),
    [t],
  );
}
