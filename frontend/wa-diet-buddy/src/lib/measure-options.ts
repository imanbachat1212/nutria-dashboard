// Shared by new-recipe-dialog.tsx (Meal Library ingredient picker) and plan-item-picker.tsx
// (Meal Plan item picker) — see measure-select.tsx for the shared UI and the full rationale.
// Pure/no-React so both the live macro preview and the final submit mapping can call the exact
// same resolution logic without depending on component state.

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
export function measureOptionLabels(realMeasures: RealMeasure[] | undefined): string[] {
  if (realMeasures?.length) return ["g", ...realMeasures.map((m) => m.label)];
  return [...GENERIC_UNITS];
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
): { option: string; count: number } {
  if (measureDescription != null && measureCount != null && realMeasures?.length) {
    const match = realMeasures.find((m) => m.label === measureDescription);
    if (match) return { option: match.label, count: measureCount };
  }
  return { option: "g", count: rawQuantity };
}
