import Meal from "./meal.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";
import { computeRecipeMacros, MICRO_FIELDS, microTotalKey } from "../../lib/calc/recipeMacros.js";
import { classifyPerServing, DAILY_VALUES } from "../foods/lib/nutrientClaims.js";
import {
  computeIngredientContributions,
  computeRecipeOtherNutrients,
  contributionsFor,
} from "../../lib/calc/nutrientContributions.js";
import { getPlanUsage, attachPlanUsage } from "../../lib/usageCounts.js";

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

// Per-serving micronutrient panel for a recipe (prompt-82), computed on read rather than
// stored. A recipe's micros are entirely a function of its ingredients and serving count, both
// of which already live on the document — persisting a derived copy would just create something
// that can go stale when computeRecipeMacros recomputes totals on the next save.
//
// The division by `servings` is the same one prompt-68 established for this recipe's macros:
// Meal.totalX is the WHOLE recipe as prepared, and everything the dietitian sees is per serving.
//
// fiber is included alongside the 21 MICRO_FIELDS that have a Daily Value — it has one (28 g)
// and recipes track it, just as `totalFiber` rather than as one of the DRI micro fields.
// sodium is tracked but deliberately absent from DAILY_VALUES (see nutrientClaims.js: a
// "high source of sodium" badge would read as a recommendation), so it simply never matches.
function withMicronutrients(meal) {
  if (!meal) return meal;
  const servings = meal.servings || 1;
  const perServing = { fiber: (meal.totalFiber ?? 0) / servings };
  for (const field of MICRO_FIELDS) {
    const total = meal[microTotalKey(field)];
    // null means "no ingredient reported this nutrient" — dividing it would invent a measured
    // zero, the exact null-vs-zero conflation prompt-73 removed elsewhere.
    if (total == null) continue;
    perServing[field] = total / servings;
  }
  // classifyPerServing owns the tier and the rounded percentage, exactly as before. `pctExact`
  // is added alongside for display only (prompt-88): the panel needs one more digit of
  // precision to avoid printing a whole number that states a tier this nutrient doesn't hold
  // (19.71% DV of selenium rendering as "20% DV" next to a Good Source badge, on greek yogurt
  // pancake among others). Computed from the same unrounded per-serving map classifyPerServing
  // itself divides, so the two can't drift; nothing here is stored, classified or re-tiered.
  const rows = classifyPerServing(perServing).map((row) => ({
    ...row,
    pctExact: (perServing[row.nutrient] / DAILY_VALUES[row.nutrient].dv) * 100,
  }));
  return { ...meal, micronutrients: rows };
}

// withMicronutrients + "which ingredient did each number come from" (prompt-98).
//
// Deliberately a SEPARATE, async wrapper rather than folding this into withMicronutrients:
// listMeals renders a page of recipe cards and would pay one extra Food.find per card for a
// breakdown the card never shows. Only the three single-recipe reads (getMealById, updateMeal,
// duplicateMeal) call this; listMeals keeps the cheap synchronous path unchanged.
//
// Percentages are scale-invariant — dividing every ingredient by `servings` scales numerator
// and denominator alike — so these are computed on the whole-recipe basis and are equally valid
// against the per-serving figures the drawer actually prints.
async function withNutrientBreakdown(meal) {
  if (!meal) return meal;
  const base = withMicronutrients(meal);
  const rows = await computeIngredientContributions(meal.ingredients);
  if (!rows.length) return base;

  return {
    ...base,
    // No explicit denominator: every stored total is rounded (Math.round for macros, 2dp for
    // micros), and dividing by the rounded figure makes the shares stop adding to 100 —
    // dramatically so where the total is small. A 4.4 g fiber recipe stores totalFiber: 4 and
    // its single fiber source would read "110%". Letting contributionsFor sum the exact rows
    // keeps each list consistent with itself; see its own note.
    macroContributions: {
      calories: contributionsFor(rows, "calories"),
      protein: contributionsFor(rows, "protein"),
      carbs: contributionsFor(rows, "carbs"),
      fat: contributionsFor(rows, "fat"),
      fiber: contributionsFor(rows, "fiber"),
    },
    micronutrients: base.micronutrients.map((row) => ({
      ...row,
      contributions: contributionsFor(rows, row.nutrient),
    })),
  };
}

export async function createMeal(data, actor) {
  if (data.ingredients?.length) {
    // The "Other" nutrients (oxalate, phytate) are summed separately from the macros
    // (prompt-99/100) — neither has a DRI or a Daily Value, so neither is one of
    // recipeMacros.js's MICRO_FIELDS and neither ever will be. Same whole-recipe basis,
    // returned already keyed as totalOxalate/totalPhytate, merged into the same save.
    const [macros, other] = await Promise.all([
      computeRecipeMacros(data.ingredients),
      computeRecipeOtherNutrients(data.ingredients),
    ]);
    Object.assign(data, macros, other);
  }
  return Meal.create({ ...data, createdBy: actor._id });
}

// Shared by both branches of listMeals below so the two can never populate different fields.
// Unit weights only (prompt-75) — the recipe drawer renders each ingredient's stored
// "0.25 cup" as a gram weight too, and a cup of oats (80 g) is not a cup of flour
// (125 g), so it needs this food's own numbers to do that. Deliberately NOT the wider
// set populatePlan/getTemplateById use: no portions, no macros — nothing the drawer
// doesn't render. Mongoose collapses every ingredient ref across the page into one
// extra $in query, so this costs a single round trip regardless of page size.
// portions added (prompt-80): a food with no gramsPerX of its own can still have a real
// USDA "1 cup" / "1 tbsp" portion, which is now the next fallback in gramsPerUnitForFood
// — without it here the drawer would resolve these rows differently from the server.
const LIST_INGREDIENT_FOOD_FIELDS =
  "name gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings portions";

export async function listMeals({ page, limit, search, category, dietaryPrefs }) {
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { nameAr: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  // ── Diet-aware ordering (prompt-109) ────────────────────────────────────────────────────
  // Recipes carrying at least one of the client's own dietary preferences sort ahead of the
  // rest; -createdAt breaks ties inside each group, exactly as before. Nothing is filtered
  // out — a dietitian can still reach every recipe, the relevant ones are just first.
  //
  // Done server-side on purpose: sorting a page client-side would only reorder whatever the
  // recency query already returned, so an older matching recipe that fell past the page
  // boundary would stay invisible no matter how well it matched.
  //
  // Needs an aggregation because the sort key is computed, which a find().sort() can't do —
  // and an aggregation can't .populate(), so it resolves the ORDER first and then re-reads
  // those documents through the normal populated query, restoring the order in JS. Matching
  // is exact string equality: dietTags and Client.dietaryPrefs are filled from the one
  // shared Settings list (see settings.service.js's DIETARY_PREFERENCES comment), so there
  // is no casing to reconcile.
  if (dietaryPrefs?.length) {
    const [ordered, total] = await Promise.all([
      Meal.aggregate([
        { $match: filter },
        {
          $addFields: {
            dietMatch: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        // $ifNull guards recipes saved before dietTags existed — a missing
                        // field would make $setIntersection return null and $size throw.
                        $setIntersection: [{ $ifNull: ["$dietTags", []] }, dietaryPrefs],
                      },
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
        { $sort: { dietMatch: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _id: 1 } },
      ]),
      Meal.countDocuments(filter),
    ]);

    const ids = ordered.map((d) => d._id);
    const docs = ids.length
      ? await Meal.find({ _id: { $in: ids } })
          .populate("ingredients.food", LIST_INGREDIENT_FOOD_FIELDS)
          .lean()
      : [];
    // $in returns documents in arbitrary order — re-impose the aggregation's ordering.
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const meals = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const usage = await getPlanUsage("meal", meals.map((m) => m._id));
    return {
      meals: attachPlanUsage(
        meals.map((m) => withMicronutrients(normalizePhotos(m))),
        usage,
      ),
      total,
      page,
      limit,
    };
  }

  // No preferences supplied (Meal Library's own list, or a client with none recorded):
  // byte-for-byte the query this endpoint has always run.
  const [meals, total] = await Promise.all([
    Meal.find(filter)
      .skip(skip)
      .limit(limit)
      .sort("-createdAt")
      .populate("ingredients.food", LIST_INGREDIENT_FOOD_FIELDS)
      .lean(),
    Meal.countDocuments(filter),
  ]);
  // One aggregation for the page (prompt-116): a recipe is "used" when a plan item references
  // it via items.meal. See lib/usageCounts.js for the batching and counting rules.
  const usage = await getPlanUsage("meal", meals.map((m) => m._id));
  return {
    meals: attachPlanUsage(
      meals.map((m) => withMicronutrients(normalizePhotos(m))),
      usage,
    ),
    total,
    page,
    limit,
  };
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
  // withNutrientBreakdown is async, so it must be awaited before the usage merge.
  const usage = await getPlanUsage("meal", [meal._id]);
  return attachPlanUsage([await withNutrientBreakdown(normalizePhotos(meal))], usage)[0];
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
  const populated = await Meal.findById(copy._id)
    .populate(
      "ingredients.food",
      "name gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings portions",
    )
    .lean();
  return withNutrientBreakdown(populated);
}

export async function updateMeal(id, data) {
  if (data.ingredients?.length) {
    // See createMeal — the "Other" totals ride along with the macro recompute so an edited
    // recipe's totalOxalate/totalPhytate can never lag its ingredient list.
    const [macros, other] = await Promise.all([
      computeRecipeMacros(data.ingredients),
      computeRecipeOtherNutrients(data.ingredients),
    ]);
    Object.assign(data, macros, other);
  }
  const meal = await Meal.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!meal) throw new ApiError(404, "Meal not found");
  return withNutrientBreakdown(normalizePhotos(meal));
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
