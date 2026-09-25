import mongoose from "mongoose";
import MealPlan from "../modules/mealplans/meal-plan.model.js";
import Meal from "../modules/meals/meal.model.js";

// "How often is this food/recipe actually used" — two genuinely different questions over two
// different collections, sharing one aggregation shape.
//
//   getPlanUsage("food")  — distinct MEAL PLANS referencing a food via items.food  (prompt-116)
//   getPlanUsage("meal")  — distinct MEAL PLANS referencing a recipe via items.meal
//   getRecipeIngredientUsage — distinct RECIPES using a food via ingredients.food   (prompt-117)
//
// The last one is deliberately NOT folded into a single "popularity" number with the first.
// A food that is heavy in recipes (olive oil, garlic) and a food often dropped straight into a
// plan (a snack, a supplement) are different lists, and merging them would put the wrong things
// on top in each context. Named usageCounts.js rather than planUsage.js since prompt-117, when
// the Meal collection joined the file — the counting rules below are otherwise unchanged.
//
// ── Shape ────────────────────────────────────────────────────────────────────────────────────
// ONE aggregation per call, scoped to a caller-supplied id list. Deliberately NOT the per-id
// countDocuments that getFoodUsages (foods.service.js) runs for its delete guard: that one asks
// about a single food, where one round trip is the whole job. Doing it per row on a list page
// would be one round trip per row.
//
// ── What gets counted ────────────────────────────────────────────────────────────────────────
// DISTINCT PARENT DOCUMENTS, not occurrences — $addToSet on the parent _id, so a food used in
// four slots across three days of one plan counts as 1, and a food listed twice in one recipe
// counts as 1.
//
// For plans: EVERY status — draft, active and ended alike. This is a historical fact ("has this
// ever been put into a plan"), not a measure of current activity. Judgment call.
//
// Meal plan TEMPLATES are NOT counted — MealPlanTemplate is its own collection, and a template
// is not a plan.
//
// ── lastUsed is an approximation (plans only) ────────────────────────────────────────────────
// planItemSchema carries no per-item timestamp; only the parent MealPlan has timestamps. So the
// best available signal is the most recent updatedAt among plans referencing this id. Editing
// any unrelated item in a plan bumps that plan's updatedAt, so this can overstate recency.
// Recipe-ingredient usage skips it entirely: it only ever feeds a sort key, never a display.
async function aggregateUsage({ Model, field, ids, withLastUsed }) {
  const out = new Map();
  if (!ids?.length) return out;

  // Aggregation pipelines do NOT get Mongoose's automatic casting the way find() does — a
  // string id would silently match nothing and every row would read as an honest-looking 0.
  const objectIds = ids
    .filter(Boolean)
    .map((id) =>
      id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)),
    );
  if (!objectIds.length) return out;

  const [arrayPath] = field.split(".");
  const group = {
    _id: `$${field}`,
    parentIds: { $addToSet: "$_id" },
  };
  if (withLastUsed) group.lastUsed = { $max: "$updatedAt" };

  const rows = await Model.aggregate([
    // Narrow to parents referencing at least one of these ids BEFORE unwinding. Without this
    // stage every element of every document's array is expanded just to be discarded.
    { $match: { [field]: { $in: objectIds } } },
    { $unwind: `$${arrayPath}` },
    // Re-applied post-unwind: the stage above keeps whole documents, this keeps the matching
    // array elements.
    { $match: { [field]: { $in: objectIds } } },
    { $group: group },
  ]);

  for (const row of rows) {
    out.set(String(row._id), {
      count: row.parentIds.length,
      // ISO, not a pre-formatted relative string — the frontend owns wording and timezone.
      lastUsed: row.lastUsed ? new Date(row.lastUsed).toISOString() : null,
    });
  }
  return out;
}

// Distinct meal plans per id. `itemField` is "food" or "meal" (planItemSchema's two ref fields).
// Returns Map<idString, { usedInPlans, lastUsed }>.
export async function getPlanUsage(itemField, ids) {
  const raw = await aggregateUsage({
    Model: MealPlan,
    field: `items.${itemField}`,
    ids,
    withLastUsed: true,
  });
  const out = new Map();
  for (const [id, v] of raw) out.set(id, { usedInPlans: v.count, lastUsed: v.lastUsed });
  return out;
}

// Distinct RECIPES using each food as an ingredient (prompt-117) — the batched counterpart to
// the per-id `Meal.countDocuments({ "ingredients.food": id })` that getFoodUsages already runs
// for its delete guard. Count only; this feeds a sort key, not a display.
// Returns Map<idString, { usedInRecipes }>.
export async function getRecipeIngredientUsage(ids) {
  const raw = await aggregateUsage({
    Model: Meal,
    field: "ingredients.food",
    ids,
    withLastUsed: false,
  });
  const out = new Map();
  for (const [id, v] of raw) out.set(id, { usedInRecipes: v.count });
  return out;
}

// Merges plan usage onto already-serialized docs. An id absent from the map is a genuine zero
// (this food/recipe is in no plan), which is a real answer — not a placeholder.
export function attachPlanUsage(docs, usage) {
  return docs.map((doc) => {
    const u = usage.get(String(doc._id));
    return { ...doc, usedInPlans: u?.usedInPlans ?? 0, lastUsed: u?.lastUsed ?? null };
  });
}
