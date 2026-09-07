// Shared by new-recipe-dialog.tsx (Meal Library ingredient picker) and plan-item-picker.tsx
// (Meal Plan item picker) — see measure-select.tsx for the shared UI and the full rationale.
// Pure/no-React so both the live macro preview and the final submit mapping can call the exact
// same resolution logic without depending on component state.

import { commonServingOverride, gramsPerUnitForFood } from "./unit-conversion";

export interface RealMeasure {
  label: string;
  grams: number;
}

// The app-wide fallback list — only used for a food with no real per-food portions at all.
export const GENERIC_UNITS = ["g", "ml", "cup", "tbsp", "tsp", "oz", "piece"] as const;
export type GenericUnit = (typeof GENERIC_UNITS)[number];

// "g" is always a valid selection (exact manual entry, works for every food) whether or not
// real measures exist — everything else is either the food's own real measures, or the generic
// list, never both (prompt-45: "real portions first, generic list only when a food has none").
// `currentUnit` (prompt-79) is the unit the item being edited is ACTUALLY stored in. It has to
// be in the list or the dropdown cannot represent the item it is editing: a food that has real
// portions offers only ["g", ...its portions], so an item stored as a plain "tbsp" — which 34 of
// this database's 44 non-gram rows are — had no selectable option at all and silently rendered
// as "Grams (g)". Appending it keeps the item's own unit selectable and truthfully displayed
// until the dietitian deliberately picks something else.
export function measureOptionLabels(
  realMeasures: RealMeasure[] | undefined,
  currentUnit?: string | null,
): string[] {
  const base = realMeasures?.length ? ["g", ...realMeasures.map((m) => m.label)] : [...GENERIC_UNITS];
  if (currentUnit && !base.includes(currentUnit)) return [...base, currentUnit];
  return base;
}

// "1 date, pitted" + 3 -> "3 date, pitted"; most FNDDS/SR-Legacy descriptions start with "1 ",
// so swapping that leading digit for the actual count reads naturally without attempting real
// singular/plural English grammar (unreliable across ~13k different descriptions). Falls back to
// "3 × <description>" for the rare description that doesn't start with "1 " at all.
function formatMeasureLabel(count: number, description: string): string {
  const n = Number.isInteger(count) ? String(count) : String(Math.round(count * 100) / 100);
  if (/^1\b/.test(description)) return description.replace(/^1\b/, n);
  return `${n} × ${description}`;
}

// Resolves a {selectedOption, count} pair — as driven by MeasureSelect — into the {quantity,
// unit} shape every existing conversion path (backend recipeMacros.js's gramsPerUnitForFood,
// and its frontend mirrors in new-recipe-dialog.tsx/plan-item-picker.tsx) already knows how to
// consume unchanged. A real measure is resolved to an exact gram total right here (count ×
// that measure's own grams) and reported as unit="g", since none of those conversion paths have
// a schema slot for an arbitrary per-food label like "1 pitted date" — see measure-select.tsx's
// module comment for the full reasoning.
//
// `measureLabel` (prompt-47) is one additional, purely-cosmetic piece of information this
// returns — the human-readable phrasing of what was actually picked (e.g. "3 date, pitted"),
// non-null only when a real measure (not "g"/generic unit) was selected. `measureDescription`/
// `measureCount` (prompt-49) are its structured counterparts — the exact raw portion description
// ("1 date, pitted") and the count (3) — kept separately because measureLabel's fully-composed
// string can't be reliably reversed back into "which option" + "what count" for an edit UI to
// re-select. All three ride alongside `quantity`/`unit` in the same call so a caller never has
// to re-derive them separately, but none of them are EVER read by any macro/calorie calculation
// — those always use `quantity`+`unit` only.
export function resolveMeasure(
  realMeasures: RealMeasure[] | undefined,
  selectedOption: string,
  count: number,
): {
  quantity: number;
  unit: string;
  measureLabel: string | null;
  measureDescription: string | null;
  measureCount: number | null;
} {
  if (realMeasures?.length && selectedOption !== "g") {
    const m = realMeasures.find((x) => x.label === selectedOption);
    if (m) {
      return {
        quantity: count * m.grams,
        unit: "g",
        measureLabel: formatMeasureLabel(count, m.label),
        measureDescription: m.label,
        measureCount: count,
      };
    }
  }
  return { quantity: count, unit: selectedOption, measureLabel: null, measureDescription: null, measureCount: null };
}

// Display-only (prompt-69): renders the gram weight a non-gram selection already resolves to,
// so a dietitian entering "1 tbsp" can see the metric weight their client will think in.
//
// This formats a gram value the CALLER has already computed — every call site passes the exact
// same number its own macro math is using (see ingredientGrams in new-recipe-dialog.tsx and
// foodGrams in plan-item-picker.tsx), so the text can never claim a weight the calculation
// didn't use. It deliberately takes a plain number rather than resolving anything itself: a
// second resolution path here is exactly what would let the two drift apart.
//
// Returns null — nothing rendered — when the equivalent would be noise or a lie: a "g"
// selection ("15 g ≈ 15 g"), or an empty/zero/not-yet-typed count.
export function formatGramEquivalent(
  selectedOption: string,
  count: number | "",
  grams: number,
): string | null {
  if (selectedOption === "g") return null;
  if (typeof count !== "number" || !(count > 0)) return null;
  if (!Number.isFinite(grams) || grams <= 0) return null;
  // Rounding is presentational only and never feeds back into anything. One decimal, matching
  // the precision the portion data itself carries ("1 date, pitted" = 7.1 g), so 3 of them
  // reads "21.3 g" rather than contradicting the source with "21 g"; JS's own float noise
  // (3 × 7.1 = 21.299999999999997) rounds away at the same time. A trailing ".0" is dropped so
  // exact whole-gram measures still read "≈ 14 g", not "≈ 14.0 g".
  return `≈ ${Math.round(grams * 10) / 10} g`;
}

// Display-only (prompt-71): the same gram equivalent, for an ALREADY-SAVED item row whose
// amount currently reads as a bare measure label ("3 date, pitted") with no weight on it.
//
// No resolution happens here, and none is needed. resolveMeasure() above converts a real-measure
// pick to an exact gram total and reports unit="g" before it is ever stored, so on a saved item
// with a measureLabel the stored `quantity` IS the gram weight — prompt-45's "grams are the
// always-correct source of truth" design paying off. This just reads it back.
//
// Returns null (caller keeps its existing fallback text untouched) for every other row:
//   - no measureLabel — a plain-grams row, or a generic-unit row like "1.5 cup". A generic-unit
//     row stores a COUNT, not grams, so there is deliberately nothing to read back here; showing
//     a weight for one would need gramsPerUnitForFood, i.e. real resolution, which is entry-time
//     work (prompt-69) and not this function's job.
//   - unit is anything but "g". That combination shouldn't exist — resolveMeasure only ever
//     emits a measureLabel together with unit="g" — but if some future path ever wrote one,
//     `quantity` would be a count and printing it as grams would be flatly wrong. Guarding is
//     free; guessing is not.
export function formatSavedMeasureAmount(item: {
  measureLabel?: string | null;
  measureDescription?: string | null;
  measureCount?: number | null;
  quantity?: number | null;
  unit?: string | null;
}): string | null {
  if (!item.measureLabel) return null;
  if ((item.unit || "g") !== "g") return null;

  const grams = item.quantity;
  if (typeof grams !== "number") return null;

  // measureDescription is the raw portion ("1 date, pitted"), never "g", so it satisfies
  // formatGramEquivalent's non-gram check; measureLabel is the composed "3 date, pitted"
  // fallback for a legacy row saved before prompt-49 added the structured fields.
  const option = item.measureDescription || item.measureLabel;
  const count = item.measureCount ?? 1;
  const equivalent = formatGramEquivalent(option, count, grams);

  return equivalent ? `${item.measureLabel} ${equivalent}` : null;
}

// The food-side data a generic-unit row needs to be resolved: whatever the populate on that
// surface returns. All three surfaces populate the identical field set, so one shape covers them.
// cup/tbsp/tsp/piece/ml vary by food density, so each needs this food's own stored weight;
// g/oz are universal masses. Same split as UNIT_TO_FOOD_FIELD in unit-conversion.ts and
// isApproximateItem in mealplans-api.ts.
const DENSITY_UNIT_FIELD = {
  cup: "gramsPerCup",
  tbsp: "gramsPerTbsp",
  tsp: "gramsPerTsp",
  piece: "gramsPerPiece",
  ml: "gramsPerMl",
} as const;

function isDensityUnit(unit: string): unit is keyof typeof DENSITY_UNIT_FIELD {
  return unit in DENSITY_UNIT_FIELD;
}

function unitWeightFor(food: SavedItemFood, unit: keyof typeof DENSITY_UNIT_FIELD) {
  return food[DENSITY_UNIT_FIELD[unit]] ?? null;
}

export interface SavedItemFood {
  commonServings?: { label: string; grams: number }[];
  gramsPerCup?: number | null;
  gramsPerTbsp?: number | null;
  gramsPerTsp?: number | null;
  gramsPerPiece?: number | null;
  gramsPerMl?: number | null;
}

// Display-only (prompt-75): the gram weight of a saved row stored as a COUNT of a generic unit
// ("1.5 cup", "2 tbsp", "2 piece"), which is what 44 of the app's real saved rows actually look
// like today.
//
// Unlike prompt-71's measure-label case — where the grams were resolved before storage and this
// module only reads them back — a generic-unit row stores a count, so the weight has to be
// resolved here. It is resolved through gramsPerUnitForFood, the same function (and the same
// commonServings-then-gramsPerX precedence) that the macros for this very row were computed
// with, so the text can't disagree with the numbers beside it.
//
// ── The fail-safe ────────────────────────────────────────────────────────────────────────────
// gramsPerUnitForFood ALWAYS returns something: when a food has no real weight for the unit it
// falls back to a flat constant (cup=240 g for every food alike). That fallback is fine as a
// macro estimate — it is what the stored calories were computed from either way — but printing
// it as "≈ 120 g" would state a specific weight this food's data does not support. Oats are
// 80 g/cup, not 240. So a row whose unit has no real per-food weight gets NO gram text at all,
// exactly as prompt-71 shows nothing rather than guessing.
//
// That check is deliberately the same condition as isApproximateItem in mealplans-api.ts, whose
// amber "Approximate" indicator already marks those rows. The two stay complementary: a row
// either shows a real resolved weight, or it shows the approximate warning — never a fabricated
// weight, and never both.
//
// g is excluded (the row already reads "150 g"). oz is included and needs no per-food data: it
// is a weight ounce in this app, a universal mass constant like g.
export function formatSavedGenericUnitAmount(
  item: { measureLabel?: string | null; quantity?: number | null; unit?: string | null },
  food: SavedItemFood | null | undefined,
): string | null {
  if (item.measureLabel) return null; // prompt-71's case owns those rows
  const unit = item.unit || "g";
  if (unit === "g") return null;

  const count = item.quantity;
  if (typeof count !== "number" || !(count > 0)) return null;

  // No real per-food weight for this unit -> the resolution below would be the flat constant.
  if (isDensityUnit(unit)) {
    if (!food) return null;
    if (commonServingOverride(food.commonServings, unit) == null && unitWeightFor(food, unit) == null) {
      return null;
    }
  }

  const grams =
    count *
    gramsPerUnitForFood(
      food?.commonServings,
      food
        ? {
            cup: food.gramsPerCup ?? null,
            tbsp: food.gramsPerTbsp ?? null,
            tsp: food.gramsPerTsp ?? null,
            piece: food.gramsPerPiece ?? null,
            ml: food.gramsPerMl ?? null,
          }
        : undefined,
      unit,
    );

  const equivalent = formatGramEquivalent(unit, count, grams);
  return equivalent ? `${count} ${unit} ${equivalent}` : null;
}

// Reverse direction of the above — given a stored item's measureDescription/measureCount (or
// their absence) and the food's CURRENT real measures, decides what an edit UI should show
// pre-selected: the exact real measure if its description still matches one of the food's
// current portions verbatim (never fuzzy — a food's portions can change between app updates, so
// a stale/renamed description should fall back rather than silently pick the wrong one), else
// plain grams with the item's current raw quantity — identical to today's pre-fix behavior.
export function pickInitialMeasureSelection(
  realMeasures: RealMeasure[] | undefined,
  measureDescription: string | null | undefined,
  measureCount: number | null | undefined,
  rawQuantity: number,
  // Required (prompt-79), not optional, so a future call site cannot forget it and silently
  // reintroduce the data-corrupting bug below.
  rawUnit: string | null | undefined,
): { option: string; count: number } {
  if (measureDescription != null && measureCount != null && realMeasures?.length) {
    const match = realMeasures.find((m) => m.label === measureDescription);
    if (match) return { option: match.label, count: measureCount };
  }
  // The item's stored unit IS its selection. This used to hardcode "g" while still returning
  // rawQuantity, which for anything but a gram item reinterpreted a COUNT as a WEIGHT — a
  // stored "2 tbsp" loaded as "2 g", and saving from that state wrote the wrong amount back
  // (prompt-79). Falling back to "g" is only correct when the stored unit really is grams,
  // which is exactly what this now says.
  return { option: rawUnit || "g", count: rawQuantity };
}
