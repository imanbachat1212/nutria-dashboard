import Food from "./food.model.js";
import Meal from "../meals/meal.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
import MealPlanBlock from "../mealplans/meal-plan-block.model.js";
import JournalEntry from "../journal/journal-entry.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";
import { searchUsdaFoods, getUsdaFoodDetails } from "./lib/usda-client.js";

export async function createFood(data, actor) {
  return Food.create({ ...data, createdBy: actor._id });
}

export async function listFoods({ page, limit, search, category, source }) {
  const filter = {};
  if (category) filter.category = category;
  if (source) filter.source = source;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { nameAr: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [foods, total] = await Promise.all([
    Food.find(filter).skip(skip).limit(limit).lean(),
    Food.countDocuments(filter),
  ]);
  return { foods, total, page, limit };
}

export async function getFoodById(id) {
  const food = await Food.findById(id).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return food;
}

export async function updateFood(id, data) {
  const food = await Food.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return food;
}

// Food is referenced by ObjectId (embedded, not top-level) from four other collections.
// Deleting out from under a real reference would leave dangling ids that populate() calls
// elsewhere silently resolve to null — block deletion instead and tell the dietitian exactly
// what's using it, rather than allowing a delete that quietly corrupts recipes/plans/logs.
export async function deleteFood(id) {
  const [recipeCount, planItemCount, blockCount, journalCount] = await Promise.all([
    Meal.countDocuments({ "ingredients.food": id }),
    MealPlan.countDocuments({ "items.food": id }),
    MealPlanBlock.countDocuments({ "foods.food": id }),
    JournalEntry.countDocuments({ "items.food": id }),
  ]);

  const usages = [];
  if (recipeCount > 0) usages.push(`${recipeCount} recipe${recipeCount === 1 ? "" : "s"}`);
  if (planItemCount > 0)
    usages.push(`${planItemCount} meal plan item${planItemCount === 1 ? "" : "s"}`);
  if (blockCount > 0) usages.push(`${blockCount} meal plan block${blockCount === 1 ? "" : "s"}`);
  if (journalCount > 0)
    usages.push(`${journalCount} journal entr${journalCount === 1 ? "y" : "ies"}`);

  if (usages.length > 0) {
    throw new ApiError(409, `Can't delete — used in ${usages.join(", ")}`);
  }

  const food = await Food.findByIdAndDelete(id);
  if (!food) throw new ApiError(404, "Food not found");
  if (food.image?.key) deleteImage(food.image.key).catch(() => {});
}

// Bulk existence check for USDA search results — one query instead of N per-row lookups.
// Returns the subset of the given fdcIds that already have a Food document.
export async function getImportedUsdaFdcIds(fdcIds) {
  const docs = await Food.find({ fdcId: { $in: fdcIds } }, { fdcId: 1, _id: 0 }).lean();
  return docs.map((d) => d.fdcId);
}

// Ephemeral — proxies USDA's live catalog, no DB write. Results carry fdcId as their
// identifier since they have no Food document (and may never get one).
export async function searchUsda(query) {
  return searchUsdaFoods(query);
}

// "Add to library" — the only point a USDA result becomes a real, referenceable Food
// document. Idempotent by fdcId so importing the same USDA food twice returns the existing
// document instead of creating a duplicate (the model's sparse unique index on fdcId backs
// this up at the DB level too). `created` lets the controller tell the frontend which
// happened, rather than always claiming a fresh import.
export async function importUsdaFood(fdcId, actor) {
  const existing = await Food.findOne({ fdcId }).lean();
  if (existing) return { food: existing, created: false };

  const details = await getUsdaFoodDetails(fdcId);
  const food = await Food.create({
    name: details.name,
    brand: details.brand,
    // USDA doesn't map onto our 10-value category taxonomy — left unset (frontend already
    // defaults an unset category to "protein" for display; a dietitian can correct it after
    // import same as any hand-added food).
    source: "usda",
    servingSize: details.servingSize,
    servingUnit: details.servingUnit,
    calories: details.calories,
    protein: details.protein,
    carbs: details.carbs,
    fat: details.fat,
    fiber: details.fiber,
    sugar: details.sugar,
    sodium: details.sodium,
    fdcId: details.fdcId,
    createdBy: actor._id,
  });
  return { food, created: true };
}
