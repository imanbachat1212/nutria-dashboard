import Meal from "./meal.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";
import { computeRecipeMacros } from "../../lib/calc/recipeMacros.js";

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
  return { meals, total, page, limit };
}

export async function getMealById(id) {
  const meal = await Meal.findById(id)
    .populate("ingredients.food", "name calories protein carbs fat fiber")
    .lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return meal;
}

export async function updateMeal(id, data) {
  if (data.ingredients?.length) {
    const macros = await computeRecipeMacros(data.ingredients);
    Object.assign(data, macros);
  }
  const meal = await Meal.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return meal;
}

export async function deleteMeal(id) {
  const meal = await Meal.findByIdAndDelete(id);
  if (!meal) throw new ApiError(404, "Meal not found");
  if (meal.photo?.key) deleteImage(meal.photo.key).catch(() => {});
}
