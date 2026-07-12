import Food from "./food.model.js";
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

export async function deleteFood(id) {
  const food = await Food.findByIdAndDelete(id);
  if (!food) throw new ApiError(404, "Food not found");
  if (food.image?.key) deleteImage(food.image.key).catch(() => {});
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
