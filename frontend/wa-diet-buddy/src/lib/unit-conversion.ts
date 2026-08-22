// Shared by new-recipe-dialog.tsx and mealplans-api.ts so the "does this food have a real,
// non-approximate gram weight for this unit" check lives in exactly one place on the frontend
// (mirrors labelToUnit/commonServingOverride in backend/src/lib/calc/recipeMacros.js).

export type CommonServingUnit = "cup" | "tbsp" | "tsp" | "ml" | "piece";

export interface ServingSizeLike {
  label: string;
  grams: number;
}

// Maps a free-text "Common servings" label (e.g. "1 cup") to one of the 5 units a per-food
// override can apply to. Deliberately excludes g/oz — universal mass constants that can't vary
// by food, so a label like "1 oz" is left as a display-only note with no effect on conversion
// math, same as "1 handful" would be. Checked in this fixed order so a label resolves to at
// most one unit.
const COMMON_SERVING_UNIT_PATTERNS: [CommonServingUnit, RegExp][] = [
  ["cup", /\bcups?\b/i],
  ["tbsp", /\btbsp\b|\btbs\b|\btablespoons?\b/i],
  ["tsp", /\btsp\b|\bteaspoons?\b/i],
  ["ml", /\bml\b|\bmilliliters?\b|\bmillilitres?\b/i],
  ["piece", /\bpieces?\b/i],
];

export function labelToUnit(label: string): CommonServingUnit | null {
  for (const [unit, pattern] of COMMON_SERVING_UNIT_PATTERNS) {
    if (pattern.test(label)) return unit;
  }
  return null;
}

// A dietitian's manually-entered Common servings row for a unit wins over the FNDDS
// auto-matched gramsPerX value for that same unit. If more than one row maps to the same unit,
// the last one in array order wins, deterministically — no averaging.
export function commonServingOverride(
  commonServings: ServingSizeLike[] | undefined,
  unit: string,
): number | null {
  if (!commonServings?.length) return null;
  let override: number | null = null;
  for (const row of commonServings) {
    if (labelToUnit(row.label) === unit) override = row.grams;
  }
  return override;
}
