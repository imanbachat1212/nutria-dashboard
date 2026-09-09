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

export interface UnitWeightsLike {
  cup: number | null;
  tbsp: number | null;
  tsp: number | null;
  piece: number | null;
  ml: number | null;
}

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  oz: 28.3495,
  piece: 50,
};

const UNIT_TO_FOOD_FIELD: Partial<Record<string, keyof UnitWeightsLike>> = {
  cup: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
  piece: "piece",
  ml: "ml",
};

// Mirrors gramsPerUnitForFood in backend/src/lib/calc/recipeMacros.js (and new-recipe-dialog.tsx's
// own copy) for callers that need the full generic-unit-list resolution, not just the
// approximate/non-approximate check above — currently plan-item-picker.tsx, which never
// supported a non-gram unit before prompt-45's MeasureSelect. `unit` may also be a real
// per-food measure's own label; resolveMeasure() in measure-options.ts always normalizes those
// to unit="g" before they'd ever reach here, so an unrecognized string just falls through to
// the flat constants exactly like `oz` already does.
// A real USDA-measured portion of this food used as a gram weight for `unit` (prompt-80).
// Mirrors portionOverride in backend/src/lib/calc/recipeMacros.js exactly — same labelToUnit
// rule, same "must describe exactly one of that unit" leading-"1" restriction, same
// skip-on-ambiguity. The two MUST agree: this side previews and labels what that side stores.
//
// Frontend portions arrive as {label, grams} (mapped from the API's {description, grams}), so
// the description is `label` here; the content is identical.
function portionOverride(portions: ServingSizeLike[] | undefined, unit: string): number | null {
  if (!portions?.length) return null;
  const matches = portions.filter(
    (p) => p?.label && /^1\s/.test(p.label) && labelToUnit(p.label) === unit,
  );
  if (!matches.length) return null;
  const grams = [...new Set(matches.map((p) => p.grams))];
  return grams.length === 1 ? grams[0] : null;
}

// The food's own real gram weight for `unit`, or null when only the flat constant would apply.
// Callers asking "is this a measured weight or a generic guess?" — the saved-row gram text
// (prompt-75) and the amber Approximate indicator — must use this rather than re-deriving the
// precedence, or they drift out of step with the conversion itself.
export function realGramsPerUnit(
  commonServings: ServingSizeLike[] | undefined,
  unitWeights: UnitWeightsLike | undefined,
  unit: string,
  portions: ServingSizeLike[] | undefined,
): number | null {
  const commonOverride = commonServingOverride(commonServings, unit);
  if (commonOverride != null) return commonOverride;

  const field = UNIT_TO_FOOD_FIELD[unit];
  const override = field ? unitWeights?.[field] : null;
  if (override != null) return override;

  return portionOverride(portions, unit);
}

export function gramsPerUnitForFood(
  commonServings: ServingSizeLike[] | undefined,
  unitWeights: UnitWeightsLike | undefined,
  unit: string,
  // Required (prompt-80), not optional: a call site that silently omitted it would quietly fall
  // back to the flat constant and disagree with the backend about what a "cup" of this food
  // weighs. Pass `undefined` explicitly when a surface genuinely has no portions data.
  portions: ServingSizeLike[] | undefined,
): number {
  return realGramsPerUnit(commonServings, unitWeights, unit, portions) ?? (UNIT_TO_GRAMS[unit] ?? 1);
}
