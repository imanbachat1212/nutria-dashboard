import type { MicronutrientRow } from "@/components/micronutrient-panel";
import type { DailyValuesResponse } from "./foods-api";
import type { FoodItem, Micronutrients, ServingSize } from "./food-database-mock";

// Per-nutrient %DV rows for ONE food, feeding the shared MicronutrientPanel in Food Database's
// detail drawer (prompt-87).
//
// ── Why this lives in the frontend, and why it isn't a second copy of the FDA table ───────────
// The DV numbers and the 21 CFR 101.54 thresholds are NOT defined here — they arrive from
// GET /api/foods/daily-values, which serves nutrientClaims.js's own DAILY_VALUES /
// HIGH_MIN_PCT / GOOD_MIN_PCT objects (prompt-83). That file stays the single definition for
// foods, recipes and meal plans alike; this module only applies them.
//
// The backend computes %DV for every nutrient too (computeNutrientClaims), but discards the
// number for any nutrient below 10% DV — `nutrientClaims` stores only the qualifiers. Surfacing
// the full list therefore means recomputing the ratio somewhere, and the drawer already has
// everything it needs: per-100 g values and the food's own portions. epaDhaMgPerServing
// (food-database-mock.ts) is the existing precedent for exactly this — derive for display,
// keep the stored value for filtering.
//
// ── Staying byte-identical to the badges ─────────────────────────────────────────────────────
// The %DV shown per row must equal the %DV on the claim badge above it, so all three inputs are
// mirrored exactly, not approximately:
//   serving basis  — the first stored portion with grams > 0 (pickServingGrams)
//   scaling        — value * grams / 100, since stored values are per 100 g
//   rounding       — Math.round of the percentage, applied at the same point
// Verified against every food in the database: recomputing here reproduces all stored claim
// levels and percentages exactly.
export interface FoodDvSource {
  macros: { fiber: number | null };
  micros?: Micronutrients;
  portions?: ServingSize[];
}

// Same rule as the backend's pickServingGrams: USDA's own portion ordering, first usable entry.
// `.find(grams > 0)` rather than `[0]` so a zero-weight descriptor can't become the basis.
export function foodClaimServing(food: FoodDvSource): ServingSize | null {
  return food.portions?.find((p) => p.grams > 0) ?? null;
}

// Fiber carries a Daily Value but is a macro on a food record, not a micronutrient — the
// backend reads both off one flat document (food[nutrient]); the frontend's FoodItem splits
// them, so the lookup has to as well.
function per100g(food: FoodDvSource, nutrient: string): number | null {
  if (nutrient === "fiber") return food.macros.fiber ?? null;
  const raw = food.micros ? (food.micros as unknown as Record<string, unknown>)[nutrient] : null;
  return typeof raw === "number" ? raw : null;
}

// Vitamin A and D are stored in whichever unit USDA reported. The DV is in mcg and IU->mcg
// depends on the specific vitamer, so the backend skips those records rather than converting on
// a guess — and so does this: the value is still shown (scaling IU by weight is valid), but with
// no %DV and no claim, never a fabricated percentage.
function sourceUnitIsIu(food: FoodDvSource, nutrient: string): boolean {
  if (nutrient === "vitaminA") return food.micros?.vitaminASourceUnit === "iu";
  if (nutrient === "vitaminD") return food.micros?.vitaminDSourceUnit === "iu";
  return false;
}

// One row per nutrient in the served DV table, in that table's own order (the panel then lifts
// the priority nutrients to the top). Nutrients the food never reported are kept as rows with a
// null value so they read "No Data" — for a single food that's a fact worth showing, unlike a
// recipe or a whole day where an unreported nutrient is just noise.
export function foodMicronutrientRows(
  food: FoodDvSource,
  dvRef: DailyValuesResponse | undefined,
): MicronutrientRow[] {
  const serving = foodClaimServing(food);
  if (!dvRef || !serving) return [];

  return Object.entries(dvRef.dailyValues).map(([nutrient, entry]) => {
    const base = { nutrient, label: entry.label, unit: entry.unit };
    const value = per100g(food, nutrient);
    const exact = value == null ? null : (value * serving.grams) / 100;
    const shown = exact == null ? null : Math.round(exact * 100) / 100;

    if (sourceUnitIsIu(food, nutrient)) {
      return { ...base, unit: "IU", value: shown, dv: null, note: "IU" };
    }
    if (exact == null) return { ...base, value: null, dv: null };

    // ORDER MATTERS, and it is the backend's order: classify against the EXACT ratio, round
    // only for display. Rounding first would move nutrients across the thresholds — 9.6% DV
    // would round to 10 and claim "Good Source", 19.5% would round to 20 and claim "High".
    // Checked against the whole food database: reversing these two steps disagreed with the
    // stored claims on 167 of 1,415 foods; in this order, on none.
    //
    // The visible consequence is that a badge can legitimately read "Good Source ~20% DV"
    // (19.5% classified, then rounded for display). That's prompt-65's existing behaviour, so
    // this panel reproduces it rather than quietly disagreeing with the badge beside it.
    const pctExact = (exact / entry.dv) * 100;
    const level =
      pctExact >= dvRef.highMinPct ? "high" : pctExact >= dvRef.goodMinPct ? "good" : null;
    // pctExact rides along for display only (prompt-88) — formatDvPct adds a decimal on the
    // rows where Math.round would state a tier this nutrient doesn't hold. `pct` and `level`
    // are unchanged, so the badges and the audit against stored claims are unaffected.
    return { ...base, value: shown, dv: { pct: Math.round(pctExact), level, pctExact } };
  });
}

export function hasIuRow(rows: MicronutrientRow[]): boolean {
  return rows.some((r) => r.note === "IU");
}

// Narrowing helper so the drawer can pass a FoodItem straight through.
export type FoodDvInput = Pick<FoodItem, "macros" | "micros" | "portions">;
