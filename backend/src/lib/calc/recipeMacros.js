import Food from "../../modules/foods/food.model.js";

export const UNIT_TO_GRAMS = {
  g: 1,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  oz: 28.35,
  piece: 50,
};

// cup/tbsp/tsp/piece map onto a per-food override field (food.model.js) — a "1 cup of
// almonds" and "1 cup of spinach" weigh very differently, so a food that has its own stored
// gram weight for a unit should use it instead of the flat UNIT_TO_GRAMS constant above.
// g/ml/oz are intentionally absent here: they're already exact mass/near-mass conversions
// that don't vary by food, so they always use the flat table.
const UNIT_TO_FOOD_FIELD = {
  cup: "gramsPerCup",
  tbsp: "gramsPerTbsp",
  tsp: "gramsPerTsp",
  piece: "gramsPerPiece",
};

// Resolves how many grams one `unit` of `food` weighs: prefers the food's own stored
// gram weight for that unit, falling back to the flat UNIT_TO_GRAMS constant when the food
// has no override (the common case today, since backfill hasn't run yet).
export function gramsPerUnitForFood(food, unit) {
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
