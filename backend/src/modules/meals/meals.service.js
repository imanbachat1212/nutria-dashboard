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
    Meal.find(filter)
      .skip(skip)
      .limit(limit)
      .sort("-createdAt")
      // Unit weights only (prompt-75) — the recipe drawer renders each ingredient's stored
      // "0.25 cup" as a gram weight too, and a cup of oats (80 g) is not a cup of flour
      // (125 g), so it needs this food's own numbers to do that. Deliberately NOT the wider
      // set populatePlan/getTemplateById use: no portions, no macros — nothing the drawer
      // doesn't render. Mongoose collapses every ingredient ref across the page into one
      // extra $in query, so this costs a single round trip regardless of page size.
      .populate(
        "ingredients.food",
        "name gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings",
      )
      .lean(),
    Meal.countDocuments(filter),
  ]);
  return { meals: meals.map(normalizePhotos), total, page, limit };
}

export async function getMealById(id) {
  const meal = await Meal.findById(id)
    .populate(
      "ingredients.food",
      // gramsPerX/commonServings/portions added (prompt-49) so the recipe edit form's
      // MeasureSelect can offer this food's real measures — and pre-select the one originally
      // picked (measureDescription) — for an already-added ingredient, not just when first
      // adding one.
      "name calories protein carbs fat fiber gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings portions",
    )
    .lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return normalizePhotos(meal);
}

// Recipe copy (prompt-77) — deliberately the same shape as duplicatePlan in
// mealplans.service.js: strip the identity/audit fields, append " (copy)" when the caller
// doesn't supply a name, reset the review flag, and re-stamp createdBy to whoever pressed the
// button. The copy is a plain new document, so the two are independent from the moment it
// exists — nothing is shared by reference.
//
// The stored totalCalories/totalX snapshot rides along with `...rest` rather than being
// recomputed. The ingredient list is byte-identical, so recomputing could only ever produce a
// DIFFERENT number than the original — if a food's macros changed since the original was saved,
// the original still shows its old snapshot, and a freshly-computed copy would silently
// disagree with the recipe it was copied from. Carrying the snapshot keeps "a duplicate is the
// same recipe" true; the next real edit recomputes both the same way.
//
// photos are deliberately NOT copied. They're Cloudinary references ({url, key}), and
// deleteMeal below calls deleteImage(key) on every photo of the recipe being deleted — so a
// copy sharing the original's key would mean deleting EITHER recipe destroys the OTHER's image.
// Starting the copy without a photo is the only option here that keeps the two genuinely
// independent; duplicating the underlying asset would need a copy operation storage.js doesn't
// expose (its interface is uploadImage(buffer, folder) / deleteImage(key)).
export async function duplicateMeal(id, { name } = {}, actor) {
  const source = await Meal.findById(id).lean();
  if (!source) throw new ApiError(404, "Meal not found");

  // `photo` is the pre-migration single-image field — still physically present on old documents
  // (see normalizePhotos above), so it has to be dropped explicitly alongside `photos`.
  const { _id, createdAt, updatedAt, __v, photos, photo, ...rest } = source;

  const copy = await Meal.create({
    ...rest,
    name: name?.trim() || `${source.name} (copy)`,
    photos: [],
    // Mirrors duplicatePlan resetting status to "draft": a copy hasn't been reviewed by anyone,
    // so it must not inherit the original's verified badge.
    verified: false,
    createdBy: actor._id,
  });

  // Returned populated, the same way duplicatePlan returns populatePlan(copy._id) — the client
  // renders this response directly, and an unpopulated ingredients.food would make the copy's
  // rows briefly lose the gram equivalents (prompt-75) that the source's rows show, until the
  // next list refetch. Same projection listMeals uses.
  return Meal.findById(copy._id)
    .populate(
      "ingredients.food",
      "name gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings",
    )
    .lean();
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
