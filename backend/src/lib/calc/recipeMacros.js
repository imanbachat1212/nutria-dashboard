import Food from "../../modules/foods/food.model.js";

export const UNIT_TO_GRAMS = {
  g: 1,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  // Weight ounce, not fluid ounce — confirmed with the client this app's "oz" always means
  // mass, so unlike ml/cup/tbsp/tsp it never varies by food (28.3495g is exact; the previous
  // 28.35 was just a rounded approximation of the same weight-oz constant, not the wrong
  // fluid-oz one — no unit confusion to fix there, just added precision).
  oz: 28.3495,
  piece: 50,
};

// cup/tbsp/tsp/piece/ml map onto a per-food override field (food.model.js) — a "1 cup of
// almonds" and "1 cup of spinach" weigh very differently, so a food that has its own stored
// gram weight for a unit should use it instead of the flat UNIT_TO_GRAMS constant above.
// ml is a volume unit like the others (1 ml of honey != 1 ml of skim milk), so it belongs
// here too now that foodMatching.js derives it per food — only g/oz are absent, since those
// are true mass units that never vary by food.
const UNIT_TO_FOOD_FIELD = {
  cup: "gramsPerCup",
  tbsp: "gramsPerTbsp",
  tsp: "gramsPerTsp",
  piece: "gramsPerPiece",
  ml: "gramsPerMl",
};

// Maps a free-text "Common servings" label (e.g. "1 cup", "half a tablespoon") to one of the
// 5 units a per-food override can apply to. Deliberately excludes g/oz — those are universal
// mass constants that can't vary by food, so a label like "1 oz" or "100g" is left as a
// display-only reference note with no effect on conversion math, same as "1 handful" would be.
// Checked in this fixed order so a label can only ever resolve to one unit.
const COMMON_SERVING_UNIT_PATTERNS = [
  ["cup", /\bcups?\b/i],
  ["tbsp", /\btbsp\b|\btbs\b|\btablespoons?\b/i],
  ["tsp", /\btsp\b|\bteaspoons?\b/i],
  ["ml", /\bml\b|\bmilliliters?\b|\bmillilitres?\b/i],
  ["piece", /\bpieces?\b/i],
];

function labelToUnit(label) {
  for (const [unit, pattern] of COMMON_SERVING_UNIT_PATTERNS) {
    if (pattern.test(label)) return unit;
  }
  return null;
}

// A dietitian's manually-entered Common servings row for a unit wins over the FNDDS
// auto-matched gramsPerX field for that same unit — the auto-match is a starting point, not
// the final word, and this keeps both stored separately (no write-time merge) while letting
// the manual entry win at usage time. If more than one row maps to the same unit (shouldn't
// normally happen), the last one in array order wins, deterministically — no averaging.
function commonServingOverride(food, unit) {
  if (!food?.commonServings?.length) return null;
  let override = null;
  for (const row of food.commonServings) {
    if (labelToUnit(row.label) === unit) override = row.grams;
  }
  return override;
}

// Resolves how many grams one `unit` of `food` weighs: a matching Common servings row wins
// first, then the food's own stored gramsPerX override, then the flat UNIT_TO_GRAMS constant
// when the food has neither (the common case today, since backfill hasn't run yet).
export function gramsPerUnitForFood(food, unit) {
  const commonOverride = commonServingOverride(food, unit);
  if (commonOverride != null) return commonOverride;

  const fieldName = UNIT_TO_FOOD_FIELD[unit];
  const override = fieldName ? food?.[fieldName] : null;
  if (override != null) return override;
  return UNIT_TO_GRAMS[unit] ?? 1;
}

// The 22 Food-model micronutrient fields that have a matching Client.driTargets field (see
// dri.js) — the only nutrients the app can show "% of target" for. Shared by recipe totals
// (below) and meal-plan item totals (mealplans.service.js) so both sum the identical set the
// same way, instead of two lists drifting apart.
export const MICRO_FIELDS = [
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  "vitaminB1",
  "vitaminB2",
  "vitaminB3",
  "vitaminB5",
  "vitaminB6",
  "vitaminB12",
  "folate",
  "calcium",
  "iron",
  "magnesium",
  "phosphorus",
  "potassium",
  "sodium",
  "zinc",
  "copper",
  "manganese",
  "selenium",
];

export function microTotalKey(field) {
  return `total${field[0].toUpperCase()}${field.slice(1)}`;
}

// Adds one food's contribution (scaled by `factor`, a per-100g multiplier) into `totals`/`seen`.
// `seen[field]` tracks whether ANY contributing food had a non-null value for that nutrient —
// the final result stays null for a field nothing contributed real data to, rather than
// silently reporting 0 for "no ingredient has this micronutrient verified" (see meal.model.js
// and food.model.js's micronutrient-nullability comments).
export function addMicronutrients(totals, seen, food, factor) {
  for (const field of MICRO_FIELDS) {
    const value = food[field];
    if (value == null) continue;
    seen[field] = true;
    totals[field] = (totals[field] ?? 0) + value * factor;
  }
}

// Returns UNPREFIXED keys (vitaminA, calcium, ...) matching MICRO_FIELDS/Food/driTargets
// naming exactly — callers that need a "total"-prefixed key (Meal's totalVitaminA etc.) apply
// microTotalKey() themselves. Keeps this helper reusable for plan-item snapshots too, which
// store the unprefixed names.
export function finalizeMicronutrients(totals, seen) {
  const result = {};
  for (const field of MICRO_FIELDS) {
    result[field] = seen[field] ? Math.round(totals[field] * 100) / 100 : null;
  }
  return result;
}

export async function computeRecipeMacros(ingredients) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  const microTotals = {};
  const microSeen = {};

  const foodIds = ingredients
    .filter((i) => i.food)
    .map((i) => i.food);

  const foods = foodIds.length
    ? await Food.find({ _id: { $in: foodIds } }).lean()
    : [];

  const foodMap = new Map(foods.map((f) => [f._id.toString(), f]));

  for (const ing of ingredients) {
    if (!ing.food) continue;
    const food = foodMap.get(ing.food.toString());
    if (!food) continue;

    const qty = ing.quantity || 0;
    const gramsPerUnit = gramsPerUnitForFood(food, ing.unit);
    const grams = qty * gramsPerUnit;
    const factor = grams / 100;

    totalCalories += food.calories * factor;
    totalProtein += food.protein * factor;
    totalCarbs += food.carbs * factor;
    totalFat += food.fat * factor;
    totalFiber += (food.fiber || 0) * factor;
    addMicronutrients(microTotals, microSeen, food, factor);
  }

  const micros = finalizeMicronutrients(microTotals, microSeen);
  const totalMicros = {};
  for (const field of MICRO_FIELDS) {
    totalMicros[microTotalKey(field)] = micros[field];
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein),
    totalCarbs: Math.round(totalCarbs),
    totalFat: Math.round(totalFat),
    totalFiber: Math.round(totalFiber),
    ...totalMicros,
  };
}
