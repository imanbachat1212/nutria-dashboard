import Food from "../../modules/foods/food.model.js";

const UNIT_TO_GRAMS = {
  g: 1,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  oz: 28.35,
  // TODO: unit conversion — "piece" and others need per-food gram weights
  piece: 50,
};

export async function computeRecipeMacros(ingredients) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

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
    // TODO: unit conversion — for non-gram units without per-food data, this is a rough fallback
    const gramsPerUnit = UNIT_TO_GRAMS[ing.unit] ?? 1;
    const grams = qty * gramsPerUnit;
    const factor = grams / 100;

    totalCalories += food.calories * factor;
    totalProtein += food.protein * factor;
    totalCarbs += food.carbs * factor;
    totalFat += food.fat * factor;
    totalFiber += (food.fiber || 0) * factor;
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein),
    totalCarbs: Math.round(totalCarbs),
    totalFat: Math.round(totalFat),
    totalFiber: Math.round(totalFiber),
  };
}
