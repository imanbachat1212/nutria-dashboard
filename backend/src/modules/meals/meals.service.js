import Meal from "./meal.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";
import { computeRecipeMacros } from "../../lib/calc/recipeMacros.js";

// Recipes saved before the single-photo → photos[] migration still have a raw `photo` field
// in Mongo (schema no longer declares it, but .lean() reads are unaffected by that — the field
// is still physically present on old documents). Normalize it into photos[0] at read time
// rather than running a destructive migration, so old recipes keep their image with no data
// loss and no separate backfill step.
function normalizePhotos(meal) {
  if (meal.photos?.length) return meal;
  if (meal.photo) return { ...meal, photos: [meal.photo] };
  return meal;
}

export async function createMeal(data, actor) {
  if (data.ingredients?.length) {
    const macros = await computeRecipeMacros(data.ingredients);
    Object.assign(data, macros);
  }
  return Meal.create({ ...data, createdBy: actor._id });
}

export async function listMeals({ page, limit, search, category }) {
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { nameAr: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [meals, total] = await Promise.all([
    Meal.find(filter).skip(skip).limit(limit).sort("-createdAt").lean(),
    Meal.countDocuments(filter),
  ]);
  return { meals: meals.map(normalizePhotos), total, page, limit };
}

export async function getMealById(id) {
  const meal = await Meal.findById(id)
    .populate("ingredients.food", "name calories protein carbs fat fiber")
    .lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return normalizePhotos(meal);
}

export async function updateMeal(id, data) {
  if (data.ingredients?.length) {
    const macros = await computeRecipeMacros(data.ingredients);
    Object.assign(data, macros);
  }
  const meal = await Meal.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return normalizePhotos(meal);
}

export async function deleteMeal(id) {
  // .lean() so a legacy single `photo` field (pre-migration recipes) is still visible for
  // cleanup even though the current schema only declares `photos` — a hydrated Mongoose
  // document would hide it since it's not a declared path.
  const meal = await Meal.findByIdAndDelete(id).lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  const photos = meal.photos?.length ? meal.photos : meal.photo ? [meal.photo] : [];
  for (const p of photos) {
    if (p?.key) deleteImage(p.key).catch(() => {});
  }
}
