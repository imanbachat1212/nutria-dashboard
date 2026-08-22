import { api, getToken } from "./api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
import {
  SLOT_META,
  DRI_FIELDS,
  type MealPlan,
  type DayPlan,
  type MealEntry,
  type DayKey,
  type MealSlot,
  type PlanStatus,
  type Micros,
} from "./meal-plans-mock";
import { commonServingOverride } from "./unit-conversion";

// ── API types ──

// The 22 DRI-matched micronutrient fields, as returned flat on each plan item (mirrors
// meal-plan.model.js's planItemSchema) and on client.driTargets. Read generically via
// DRI_FIELDS (extractMicros below) rather than declared individually here, since both call
// sites already share that field list with the backend — declared as an index signature would
// conflict with this interface's other, differently-typed fields.
type APIMicros = Record<string, number | null>;

interface APIPlanItem {
  _id: string;
  day: number;
  slot: string;
  type: "food" | "recipe";
  food?:
    | {
        _id: string;
        name: string;
        gramsPerCup?: number | null;
        gramsPerTbsp?: number | null;
        gramsPerTsp?: number | null;
        gramsPerPiece?: number | null;
        gramsPerMl?: number | null;
        commonServings?: { label: string; grams: number }[];
      }
    | string
    | null;
  meal?: { _id: string; name: string } | string | null;
  name: string;
  quantity: number;
  unit: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// cup/tbsp/tsp/piece/ml weigh differently per food (a cup of oats != a cup of spinach, 1ml of
// honey != 1ml of skim milk) — only g/oz are always exact regardless of which food (oz means
// weight ounce in this app, confirmed with the client). Mirrors gramsPerUnitForFood in the
// backend's lib/calc/recipeMacros.js and the equivalent map in new-recipe-dialog.tsx.
const UNIT_TO_FOOD_FIELD: Record<
  string,
  "gramsPerCup" | "gramsPerTbsp" | "gramsPerTsp" | "gramsPerPiece" | "gramsPerMl"
> = {
  cup: "gramsPerCup",
  tbsp: "gramsPerTbsp",
  tsp: "gramsPerTsp",
  piece: "gramsPerPiece",
  ml: "gramsPerMl",
};

// True when this item's macros were computed using the flat UNIT_TO_GRAMS fallback constant
// rather than this specific food's real stored weight for the unit — i.e. an estimate, not a
// verified number. Recipe items are never flagged: they're scaled by servings, not a
// per-unit gram conversion, so there's no fallback-vs-real distinction to make. Checks the
// same precedence as gramsPerUnitForFood (backend recipeMacros.js / frontend
// new-recipe-dialog.tsx) via the shared commonServingOverride helper, so a food using a
// dietitian-entered Common servings override for this unit is never flagged as approximate
// even when it has no matching structured gramsPerX field.
function isApproximateItem(i: APIPlanItem): boolean {
  if (i.type !== "food") return false;
  const fieldName = UNIT_TO_FOOD_FIELD[i.unit];
  if (!fieldName) return false;
  const food = i.food && typeof i.food === "object" ? i.food : null;
  if (!food) return true;
  if (commonServingOverride(food.commonServings, i.unit) != null) return false;
  return food[fieldName] == null;
}

interface APIPlan {
  _id: string;
  name: string;
  client: {
    _id: string;
    profile?: { firstName?: string; lastName?: string };
    targets?: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    };
    driTargets?: (APIMicros & { method?: string; computedAt?: string }) | null;
  };
  startDate: string;
  endDate: string;
  status: string;
  goal: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  // Per-slot time overrides for the whole plan (e.g. { breakfast: "08:00" }) — sparse, a slot
  // with no entry falls back to SLOT_META's default in buildDays() below. Absent entirely on
  // plans created before this field existed.
  slotTimes?: Record<string, string>;
  items?: APIPlanItem[];
  createdAt: string;
  updatedAt: string;
}

function extractMicros(source: APIMicros | null | undefined): Micros {
  const result: Micros = {};
  for (const field of DRI_FIELDS) {
    result[field] = source?.[field] ?? null;
  }
  return result;
}

interface APIListResult {
  mealPlans: APIPlan[];
  total: number;
  page: number;
  limit: number;
}

// ── Helpers ──

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_SLOTS: MealSlot[] = [
  "breakfast",
  "snack-am",
  "lunch",
  "snack-pm",
  "dinner",
];

function clientName(p: APIPlan): string {
  const f = p.client?.profile?.firstName || "";
  const l = p.client?.profile?.lastName || "";
  return [f, l].filter(Boolean).join(" ") || "Unknown";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function buildDays(items: APIPlanItem[], slotTimes?: Record<string, string>): DayPlan[] {
  return DAY_KEYS.map((dayKey, dayIdx) => {
    const dayItems = items.filter((i) => i.day === dayIdx);

    const meals: MealEntry[] = DEFAULT_SLOTS.map((slot, slotIdx) => {
      const slotItems = dayItems.filter((i) => i.slot === slot);
      return {
        id: `${dayKey}-${slotIdx}-${slot}`,
        slot,
        title: SLOT_META[slot].label,
        time: slotTimes?.[slot] ?? SLOT_META[slot].defaultTime,
        items: slotItems.map((i) => ({
          id: i._id,
          name: i.name,
          amount:
            i.type === "food"
              ? `${i.quantity} ${i.unit || "g"}`
              : `${i.servings} serving${i.servings !== 1 ? "s" : ""}`,
          macros: {
            kcal: i.calories || 0,
            protein: i.protein || 0,
            carbs: i.carbs || 0,
            fat: i.fat || 0,
          },
          micros: extractMicros(i as unknown as APIMicros),
          isApproximate: isApproximateItem(i),
        })),
      };
    });

    return { day: dayKey, meals };
  });
}

function toPlan(p: APIPlan): MealPlan {
  const name = clientName(p);
  return {
    id: p._id,
    name: p.name,
    clientId: p.client?._id || "",
    clientName: name,
    clientInitials: initials(name),
    status: p.status as PlanStatus,
    goal: p.goal as MealPlan["goal"],
    startDate: p.startDate?.split("T")[0] || "",
    endDate: p.endDate?.split("T")[0] || "",
    targets: {
      kcal: p.targetCalories || 0,
      protein: p.targetProtein || 0,
      carbs: p.targetCarbs || 0,
      fat: p.targetFat || 0,
    },
    driTargets: p.client?.driTargets ? extractMicros(p.client.driTargets) : null,
    adherencePct: 0,
    days: buildDays(p.items || [], p.slotTimes),
    updatedAt: relativeTime(p.updatedAt),
  };
}

// ── Exported API functions ──

export async function fetchMealPlans(params?: {
  page?: number;
  limit?: number;
  status?: string;
  client?: string;
}): Promise<{ plans: MealPlan[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.client) qs.set("client", params.client);
  const q = qs.toString();
  const result = await api.get<APIListResult>(
    `/api/mealplans${q ? `?${q}` : ""}`,
  );
  return {
    plans: result.mealPlans.map(toPlan),
    total: result.total,
  };
}

export async function fetchMealPlan(id: string): Promise<MealPlan> {
  const raw = await api.get<APIPlan>(`/api/mealplans/${id}`);
  return toPlan(raw);
}

export interface CreateMealPlanPayload {
  client: string;
  name: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

export async function createMealPlan(
  data: CreateMealPlanPayload,
): Promise<MealPlan> {
  const raw = await api.post<APIPlan>("/api/mealplans", data);
  return toPlan(raw);
}

export async function updateMealPlan(
  id: string,
  data: Partial<CreateMealPlanPayload> & { status?: string },
): Promise<MealPlan> {
  const raw = await api.patch<APIPlan>(`/api/mealplans/${id}`, data);
  return toPlan(raw);
}

export async function deleteMealPlan(id: string): Promise<void> {
  await api.delete(`/api/mealplans/${id}`);
}

export interface AddItemPayload {
  day: number;
  slot: string;
  type: "food" | "recipe";
  food?: string;
  meal?: string;
  quantity?: number;
  unit?: string;
  servings?: number;
}

export async function addPlanItem(
  planId: string,
  data: AddItemPayload,
): Promise<MealPlan> {
  const raw = await api.post<APIPlan>(`/api/mealplans/${planId}/items`, data);
  return toPlan(raw);
}

export async function duplicateMealPlan(
  id: string,
  opts: { name?: string; client?: string } = {},
): Promise<MealPlan> {
  const raw = await api.post<APIPlan>(`/api/mealplans/${id}/duplicate`, opts);
  return toPlan(raw);
}

export async function copyPlanDay(
  planId: string,
  data: { fromDay: number; toDays: number[] },
): Promise<MealPlan> {
  const raw = await api.post<APIPlan>(`/api/mealplans/${planId}/copy-day`, data);
  return toPlan(raw);
}

export async function copyMealSlot(
  planId: string,
  data: { fromDay: number; slot: string; toDays: number[] },
): Promise<MealPlan> {
  const raw = await api.post<APIPlan>(`/api/mealplans/${planId}/copy-meal-slot`, data);
  return toPlan(raw);
}

export async function updateSlotTime(
  planId: string,
  data: { slot: string; time: string },
): Promise<MealPlan> {
  const raw = await api.patch<APIPlan>(`/api/mealplans/${planId}/slot-time`, data);
  return toPlan(raw);
}

export async function downloadPlanPdf(planId: string, planName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/mealplans/${planId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`PDF export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${planName.replace(/[^\w\s-]/g, "").trim()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function removePlanItem(
  planId: string,
  itemId: string,
): Promise<void> {
  await api.delete(`/api/mealplans/${planId}/items/${itemId}`);
}
