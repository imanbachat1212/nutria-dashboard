import Food, { OTHER_NUTRIENT_FIELDS } from "../../modules/foods/food.model.js";
import { gramsPerUnitForFood, MICRO_FIELDS, microTotalKey } from "./recipeMacros.js";

// Per-ingredient nutrient math that can't live in recipeMacros.js. Two things so far:
// the breakdown behind a recipe's totals — "which ingredient did this nutrient come from?"
// (prompt-98) — and the recipe's "Other"-group totals, oxalate and phytate (prompt-99/100).
//
// ── Why this lives here and not in recipeMacros.js ───────────────────────────────────────────
// recipeMacros.js is a standing do-not-modify file; it may be imported from. Everything the
// loops below need is already exported from it — gramsPerUnitForFood (the whole four-step
// unit-resolution precedence) and MICRO_FIELDS (the nutrient list) — so the only thing this
// module restates is `factor = grams / 100`, and it gets its grams from that same shared
// function. The two therefore cannot disagree about what "120 g of X" means, which is the
// drift that actually mattered.
//
// ── Absolute amounts, not percentages ────────────────────────────────────────────────────────
// computeIngredientContributions returns raw per-ingredient amounts for the WHOLE recipe, the
// same basis computeRecipeMacros sums. Percentages are a separate step (contributionsFor) so
// the same rows can be divided by whatever total the caller is actually displaying.

const MACRO_FIELDS = ["calories", "protein", "carbs", "fat", "fiber"];

// Every field a contribution row carries. Exported so a caller can iterate them without
// re-deriving the union.
export const CONTRIBUTION_FIELDS = [...MACRO_FIELDS, ...MICRO_FIELDS];

// An ingredient's food reference, whichever shape it arrives in: a raw ObjectId (findByIdAndUpdate
// in updateMeal), a populated document (getMealById/duplicateMeal), or a plain string. Section
// header rows (prompt-97) have no food at all and fall out here, exactly as they do in
// computeRecipeMacros' own `if (!ing.food) continue`.
function ingredientFoodId(ing) {
  const ref = ing?.food;
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  // A populated lean document is a plain object with _id; a bare ObjectId has no _id of its own.
  return (ref._id ?? ref).toString();
}

// ingredients -> one row per ingredient that has a real food behind it:
//   { name, calories, protein, carbs, fat, fiber, ...MICRO_FIELDS }
//
// Micronutrients keep the null-vs-zero distinction the rest of the app is careful about: null
// means "this food never reported this nutrient", which contributionsFor drops rather than
// counting as a measured zero contribution.
// id -> food, for every ingredient in `list` that has a real food behind it. Shared by both
// functions below so they can never resolve the same ingredient to different foods.
async function loadIngredientFoods(list) {
  const foodIds = list.map(ingredientFoodId).filter(Boolean);
  const foods = foodIds.length ? await Food.find({ _id: { $in: foodIds } }).lean() : [];
  return new Map(foods.map((f) => [f._id.toString(), f]));
}

export async function computeIngredientContributions(ingredients) {
  const list = ingredients || [];
  const foodMap = await loadIngredientFoods(list);

  const rows = [];
  for (const ing of list) {
    const id = ingredientFoodId(ing);
    if (!id) continue;
    const food = foodMap.get(id);
    if (!food) continue;

    // Identical to computeRecipeMacros' per-ingredient math, through the same shared
    // gramsPerUnitForFood — see the header note above.
    const qty = ing.quantity || 0;
    const factor = (qty * gramsPerUnitForFood(food, ing.unit)) / 100;

    // The ingredient's own stored name wins over the food's: it's what the recipe's own
    // ingredient list shows, so the hover names things the way the drawer does.
    const row = { name: ing.name || food.name };
    row.calories = (food.calories || 0) * factor;
    row.protein = (food.protein || 0) * factor;
    row.carbs = (food.carbs || 0) * factor;
    row.fat = (food.fat || 0) * factor;
    row.fiber = (food.fiber || 0) * factor;
    for (const field of MICRO_FIELDS) {
      row[field] = food[field] == null ? null : food[field] * factor;
    }
    rows.push(row);
  }
  return rows;
}

// Contribution rows + one nutrient field -> [{ name, pct }], highest share first.
//
// `total` is an optional explicit denominator; when absent or non-positive, the exact sum of
// the contributing rows is used instead.
//
// CALLERS SHOULD ALMOST ALWAYS OMIT IT. Passing a ROUNDED total — which every stored
// Meal.totalX is (computeRecipeMacros applies Math.round) — distorts the percentages by half a
// unit of that rounding, which is invisible on calories and ruinous on anything small: a
// recipe with 4.4 g of fiber stores `totalFiber: 4`, and its one fiber-bearing ingredient then
// reports 110% of it. Deriving the denominator from the rows keeps the list internally
// consistent and summing to 100 by construction. Only pass `total` when you hold an exact,
// unrounded figure and specifically want shares of that.
//
// Two ingredient rows can share a name (the same food added under two sections, or simply
// twice). They're merged into one entry by summing BEFORE the division, so the hover lists one
// "Olive oil — 30%" rather than two rows of 15% the reader has to add up themselves.
export function contributionsFor(rows, field, total) {
  const merged = new Map();
  for (const row of rows || []) {
    const value = row?.[field];
    // null = never reported, 0 = reported but contributes nothing. Neither belongs in a list
    // answering "where did this come from".
    if (value == null || value === 0) continue;
    merged.set(row.name, (merged.get(row.name) ?? 0) + value);
  }
  if (!merged.size) return [];

  const denominator =
    typeof total === "number" && total > 0
      ? total
      : [...merged.values()].reduce((a, b) => a + b, 0);
  if (!(denominator > 0)) return [];

  return [...merged.entries()]
    .map(([name, value]) => ({ name, pct: Math.round((value / denominator) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct);
}

// ingredients -> { totalOxalate, totalPhytate } in mg for the WHOLE recipe, the same basis as
// every other Meal.totalX (prompt-99, generalized in prompt-100).
//
// These are Food's "Other" group (OTHER_NUTRIENT_FIELDS — see food.model.js). They are
// deliberately NOT in recipeMacros.js's MICRO_FIELDS and must not be added to it: that list is
// specifically "nutrients with a matching DRI target" (it mirrors Client.driTargets 1:1), and
// neither of these has a DRI, an FDA Daily Value, or a claim tier. They are simply raw
// per-100 g numbers a dietitian may want to keep low.
//
// Both nutrients are summed in ONE pass over ONE Food lookup — adding phytate cost no extra
// query. null vs 0 is tracked per nutrient, following finalizeMicronutrients' `seen` rule
// exactly: null means no ingredient reported THAT nutrient, while 0 means at least one did and
// the sum is genuinely zero. The two are independent — a recipe can easily have a real oxalate
// total and a null phytate total. Both max filters treat them as different answers: an
// unmeasured recipe is not a verified low-anything recipe.
//
// Keys come from the shared microTotalKey(), so "oxalate" -> "totalOxalate" the same way every
// other stored total is named, and a third "Other" nutrient needs no change here beyond the
// list in food.model.js.
//
// Costs one extra Food.find per save, alongside the one computeRecipeMacros already does on
// the same ids. Folding the two into a single lookup would mean editing recipeMacros.js, which
// is the do-not-modify file named at the top — a query per recipe save is the cheaper trade.
export async function computeRecipeOtherNutrients(ingredients) {
  const list = ingredients || [];
  const foodMap = await loadIngredientFoods(list);

  const totals = {};
  const seen = {};
  for (const ing of list) {
    const id = ingredientFoodId(ing);
    if (!id) continue;
    const food = foodMap.get(id);
    if (!food) continue;
    // Same per-ingredient math as everywhere else in this file, through the same shared
    // gramsPerUnitForFood. Computed once and reused for every "Other" nutrient.
    const factor = ((ing.quantity || 0) * gramsPerUnitForFood(food, ing.unit)) / 100;
    for (const field of OTHER_NUTRIENT_FIELDS) {
      const value = food[field];
      if (value == null) continue;
      seen[field] = true;
      totals[field] = (totals[field] ?? 0) + value * factor;
    }
  }

  const result = {};
  for (const field of OTHER_NUTRIENT_FIELDS) {
    // 2dp, matching finalizeMicronutrients' rounding for the mg-scale nutrients.
    result[microTotalKey(field)] = seen[field] ? Math.round(totals[field] * 100) / 100 : null;
  }
  return result;
}
