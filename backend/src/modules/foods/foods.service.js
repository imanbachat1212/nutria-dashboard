import Food from "./food.model.js";
import Meal from "../meals/meal.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
import MealPlanBlock from "../mealplans/meal-plan-block.model.js";
import JournalEntry from "../journal/journal-entry.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";
import { searchUsdaFoods, getUsdaFoodDetails } from "./lib/usda-client.js";
import { guessFoodCategory } from "./lib/food-category.js";
import { matchFoodName } from "../../lib/foodMatching.js";

// Shapes a foodMatching.js result into what the API/frontend actually needs — never returned
// for "no-match" (nothing to show), and never exposes the internal coreMismatch/compositeDish
// debug flags that only the historical CSV report cares about.
function toUnitWeightMatch(match) {
  if (!match || match.tier === "no-match") return null;
  return {
    tier: match.tier,
    score: match.score,
    matchedDescription: match.matchedDescription,
    matchedCategory: match.matchedCategory,
    fields: match.fields,
  };
}

// `favoritedBy` is per-user internal state — never sent to the client as a raw id list (that
// would leak other users' ids for no reason). Replaced with a boolean scoped to whoever is
// asking. userId is null for the automation/x-api-key actor, which just always reads as false.
export function toPublicFood(food, userId) {
  if (!food) return food;
  const { favoritedBy, ...rest } = food;
  return {
    ...rest,
    isFavorite: userId ? (favoritedBy || []).some((id) => String(id) === String(userId)) : false,
  };
}

export async function createFood(data, actor) {
  const match = matchFoodName(data.name);
  // Auto-populate only on a high-confidence match — low-confidence is surfaced as a
  // suggestion for the dietitian to accept, never written without confirmation.
  const autoFields = match.tier === "match" ? match.fields : {};
  const food = await Food.create({ ...data, ...autoFields, createdBy: actor._id });
  return { food, unitWeightMatch: toUnitWeightMatch(match) };
}

// Escapes regex metacharacters in a user-typed token so e.g. a stray "(" in a search doesn't
// throw an invalid-regex error or accidentally act as a grouping construct.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Shared by listFoods and getFoodsStats so the two never drift on what "matches the current
// search/category/source/verified/favorites filter" means. `favorites` is only ever scoped to
// the requesting user's own id (never a client-supplied user) — "Favorites" means MY favorites.
//
// `search` is split into keyword tokens on whitespace AND comma (a dietitian typing "egg,wh" —
// picked up from this app's own comma-separated Allergies/Medical-history fields elsewhere —
// should search exactly like "egg wh") and every token must independently match name OR nameAr,
// combined with $and across tokens. This makes a food match on word CONTENT regardless of order/
// adjacency/punctuation in the stored name, rather than requiring the typed string to appear as
// one literal substring — "egg white" used to only match "Egg white sandwich" (the one name
// where the words happen to be adjacent in that order) and silently miss "Egg, white, raw" and
// five other real foods that plainly contain both words. A single-token search (today's only
// working case) is the trivial one-element case of this same $and, so existing single-word
// searches are unaffected.
function buildFoodFilter({ search, category, source, verified, favorites, userId }) {
  const filter = {};
  if (category) filter.category = category;
  if (source) filter.source = source;
  if (verified !== undefined) filter.verified = verified;
  if (favorites) filter.favoritedBy = userId;
  if (search) {
    const tokens = search
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) {
      filter.$and = tokens.map((token) => {
        const re = { $regex: escapeRegex(token), $options: "i" };
        return { $or: [{ name: re }, { nameAr: re }] };
      });
    }
  }
  return filter;
}

export async function listFoods({ page, limit, search, category, source, verified, favorites, userId }) {
  const filter = buildFoodFilter({ search, category, source, verified, favorites, userId });

  const skip = (page - 1) * limit;
  const [foods, total] = await Promise.all([
    // Without an explicit sort, Mongo returns natural order — once the collection exceeds
    // `limit`, a freshly created document can fall entirely outside the page-1 window and
    // never show up in the library view even though it was saved correctly. Newest-first
    // guarantees a just-created food is always visible immediately after creation.
    Food.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Food.countDocuments(filter),
  ]);
  return { foods: foods.map((f) => toPublicFood(f, userId)), total, page, limit };
}

// True counts for the KPI strip — deliberately NOT derived from a page of `listFoods` results,
// since that page is capped at `limit` (100) and the library already exceeds that, which
// silently froze the old client-side stats.total/verified/lebanese the moment the library
// crossed 100 documents. Respects the same search/category/source/verified/favorites filter as
// listFoods, so the KPIs reflect "matching the current filter," consistent with how `total`
// already behaved (e.g. verified=true&source=lebanese returns the correct intersection).
export async function getFoodsStats({ search, category, source, verified, favorites, userId }) {
  const filter = buildFoodFilter({ search, category, source, verified, favorites, userId });
  const [total, verifiedCount, lebanese] = await Promise.all([
    Food.countDocuments(filter),
    Food.countDocuments({ ...filter, verified: true }),
    Food.countDocuments({ ...filter, source: "lebanese" }),
  ]);
  return { total, verified: verifiedCount, lebanese };
}

export async function getFoodById(id, userId) {
  const food = await Food.findById(id).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return toPublicFood(food, userId);
}

export async function updateFood(id, data, userId) {
  let unitWeightMatch = null;
  let autoFields = {};

  // Only re-run when the name is actually part of this edit — an update that just flips
  // `verified` or tweaks calories shouldn't re-trigger matching.
  if (data.name) {
    const match = matchFoodName(data.name);
    unitWeightMatch = toUnitWeightMatch(match);

    if (match.tier === "match") {
      // Don't clobber a value that's already set (e.g. a prior manual correction, or a
      // previously-accepted match) just because the name was edited — only fill in gaps.
      const existing = await Food.findById(id, Object.keys(match.fields).join(" ")).lean();
      for (const [key, value] of Object.entries(match.fields)) {
        if (existing?.[key] == null) autoFields[key] = value;
      }
    }
  }

  const food = await Food.findByIdAndUpdate(id, { ...data, ...autoFields }, { new: true }).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return { food: toPublicFood(food, userId), unitWeightMatch };
}

// Idempotent — favoriting an already-favorited food (or unfavoriting one that isn't) is a no-op,
// not an error. Requires a real signed-in user; the automation/x-api-key actor has no identity
// to favorite on behalf of.
export async function addFavorite(id, userId) {
  if (!userId) throw new ApiError(400, "Favoriting requires a signed-in user");
  const food = await Food.findByIdAndUpdate(
    id,
    { $addToSet: { favoritedBy: userId } },
    { new: true },
  ).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return toPublicFood(food, userId);
}

export async function removeFavorite(id, userId) {
  if (!userId) throw new ApiError(400, "Favoriting requires a signed-in user");
  const food = await Food.findByIdAndUpdate(
    id,
    { $pull: { favoritedBy: userId } },
    { new: true },
  ).lean();
  if (!food) throw new ApiError(404, "Food not found");
  return toPublicFood(food, userId);
}

// Food is referenced by ObjectId (embedded, not top-level) from four other collections.
// Deleting out from under a real reference would leave dangling ids that populate() calls
// elsewhere silently resolve to null — block deletion instead and tell the dietitian exactly
// what's using it, rather than allowing a delete that quietly corrupts recipes/plans/logs.
// Shared by deleteFood and bulkDeleteFoods so bulk can never apply a looser rule than single.
async function getFoodUsages(id) {
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
  return usages;
}

export async function deleteFood(id) {
  const usages = await getFoodUsages(id);
  if (usages.length > 0) {
    throw new ApiError(409, `Can't delete — used in ${usages.join(", ")}`);
  }

  const food = await Food.findByIdAndDelete(id);
  if (!food) throw new ApiError(404, "Food not found");
  if (food.image?.key) deleteImage(food.image.key).catch(() => {});
}

// Best-effort, per-food — one blocked/missing food doesn't fail the whole batch. Applies the
// exact same in-use rule as deleteFood (via the shared getFoodUsages), just extended so
// selecting many foods at once can't become a way to skip that protection at scale. Sequential
// rather than Promise.all: this is a bounded, dietitian-initiated batch (selections come from
// one or two 100-row pages), not a hot path, and sequential keeps the per-id usage-check +
// delete pair atomic-looking in the DB access pattern rather than interleaving many at once.
export async function bulkDeleteFoods(ids) {
  const deleted = [];
  const blocked = [];
  const notFound = [];

  for (const id of ids) {
    const usages = await getFoodUsages(id);
    if (usages.length > 0) {
      const food = await Food.findById(id, "name").lean();
      blocked.push({ id, name: food?.name ?? null, usages });
      continue;
    }

    const food = await Food.findByIdAndDelete(id);
    if (!food) {
      notFound.push(id);
      continue;
    }
    if (food.image?.key) deleteImage(food.image.key).catch(() => {});
    deleted.push({ id, name: food.name });
  }

  return { deleted, blocked, notFound };
}

// Bulk existence check for USDA search results — one query instead of N per-row lookups.
// Returns the subset of the given fdcIds that already have a Food document.
export async function getImportedUsdaFdcIds(fdcIds) {
  const docs = await Food.find({ fdcId: { $in: fdcIds } }, { fdcId: 1, _id: 0 }).lean();
  return docs.map((d) => d.fdcId);
}

// Ephemeral — proxies USDA's live catalog, no DB write. Results carry fdcId as their
// identifier since they have no Food document (and may never get one). Returns the true
// totalHits count alongside the current page's results so the frontend can paginate through
// USDA's full catalog rather than only ever seeing the first pageSize matches.
export async function searchUsda(query, { limit, page, dataTypes } = {}) {
  return searchUsdaFoods(query, { pageSize: limit, pageNumber: page, dataTypes });
}

// The one place a USDA fdcId's full nutrient breakdown gets fetched/parsed — used by BOTH the
// "preview before importing" panel and importUsdaFood below, so the numbers a dietitian
// previews can never diverge from what actually gets stored if they go on to import that exact
// result. No DB write; safe to call repeatedly for the same fdcId.
export async function previewUsdaFood(fdcId) {
  return getUsdaFoodDetails(fdcId);
}

// Mirrors UNIT_WEIGHT_LABELS in new-food-dialog.tsx — going FROM a resolved gramsPerX field TO
// its "1 <unit>" Common servings label is a trivial fixed mapping, unlike unit-conversion.ts's
// labelToUnit (the reverse direction: parsing a dietitian's free-text label back to a unit),
// which doesn't apply here since a fresh USDA import has no pre-existing rows to dedupe against.
const UNIT_WEIGHT_LABELS = [
  ["gramsPerCup", "cup"],
  ["gramsPerTbsp", "tbsp"],
  ["gramsPerTsp", "tsp"],
  ["gramsPerPiece", "piece"],
  ["gramsPerMl", "ml"],
];

// Same shape the create dialog's applyAutoServings would insert for a fresh, unedited food —
// one row per matched unit, or [] if nothing matched.
function buildCommonServingsFromFields(fields) {
  const rows = [];
  for (const [key, unit] of UNIT_WEIGHT_LABELS) {
    const grams = fields[key];
    if (grams == null) continue;
    rows.push({ label: `1 ${unit}`, grams });
  }
  return rows;
}

// "Add to library" — the only point a USDA result becomes a real, referenceable Food
// document. Idempotent by fdcId so importing the same USDA food twice returns the existing
// document instead of creating a duplicate (the model's sparse unique index on fdcId backs
// this up at the DB level too). `created` lets the controller tell the frontend which
// happened, rather than always claiming a fresh import.
export async function importUsdaFood(fdcId, actor) {
  const existing = await Food.findOne({ fdcId }).lean();
  if (existing) return { food: existing, created: false };

  const details = await previewUsdaFood(fdcId);
  // Same FNDDS unit-weight match "Add new food" runs on create — a USDA import shouldn't be a
  // second-class path that skips it. Only a high-confidence match auto-populates, exactly like
  // createFood's own tier === "match" gate; a low-confidence/no-match result leaves every
  // gramsPerX field null and commonServings empty, never a guessed value.
  const match = matchFoodName(details.name);
  const autoFields = match.tier === "match" ? match.fields : {};
  // USDA doesn't share this app's category taxonomy directly — guessFoodCategory bridges the
  // gap (FDC's own standardized SR/Foundation category first, then name/WWEIA-category keyword
  // matching, then a macro-dominance fallback). Previously left unset entirely, which every
  // import silently inherited the frontend's blanket "unset -> protein" display fallback from
  // (mapCategory in foods-api.ts) — a dietitian could still correct this per-food afterward, same
  // as any hand-added food.
  const category = guessFoodCategory({
    usdaFoodCategory: details.usdaFoodCategory,
    usdaWweiaCategory: details.usdaWweiaCategory,
    name: details.name,
    brand: details.brand,
    protein: details.protein,
    carbs: details.carbs,
    fat: details.fat,
  });
  const food = await Food.create({
    name: details.name,
    brand: details.brand,
    category,
    source: "usda",
    servingSize: details.servingSize,
    servingUnit: details.servingUnit,
    commonServings: buildCommonServingsFromFields(autoFields),
    calories: details.calories,
    protein: details.protein,
    carbs: details.carbs,
    fat: details.fat,
    fiber: details.fiber,
    sugar: details.sugar,
    sodium: details.sodium,
    fdcId: details.fdcId,
    createdBy: actor._id,
    ...autoFields,

    // Micronutrients — all optional/nullable, null on the majority of USDA records (see
    // usda-client.js's toFullNutrition; this is expected, not a bug).
    fiberSoluble: details.fiberSoluble,
    fiberInsoluble: details.fiberInsoluble,
    starch: details.starch,

    fatSaturated: details.fatSaturated,
    fatMonounsaturated: details.fatMonounsaturated,
    fatPolyunsaturated: details.fatPolyunsaturated,
    fatTrans: details.fatTrans,
    cholesterol: details.cholesterol,
    omega3Ala: details.omega3Ala,
    omega3Epa: details.omega3Epa,
    omega3Dha: details.omega3Dha,
    omega6La: details.omega6La,
    omega6LaApprox: details.omega6LaApprox,
    omega6Aa: details.omega6Aa,
    omega6AaApprox: details.omega6AaApprox,

    aminoCystine: details.aminoCystine,
    aminoHistidine: details.aminoHistidine,
    aminoIsoleucine: details.aminoIsoleucine,
    aminoLeucine: details.aminoLeucine,
    aminoLysine: details.aminoLysine,
    aminoMethionine: details.aminoMethionine,
    aminoPhenylalanine: details.aminoPhenylalanine,
    aminoThreonine: details.aminoThreonine,
    aminoTryptophan: details.aminoTryptophan,
    aminoTyrosine: details.aminoTyrosine,
    aminoValine: details.aminoValine,

    vitaminB1: details.vitaminB1,
    vitaminB2: details.vitaminB2,
    vitaminB3: details.vitaminB3,
    vitaminB5: details.vitaminB5,
    vitaminB6: details.vitaminB6,
    vitaminB12: details.vitaminB12,
    folate: details.folate,
    vitaminK: details.vitaminK,
    vitaminC: details.vitaminC,
    vitaminE: details.vitaminE,
    vitaminA: details.vitaminA,
    vitaminASourceUnit: details.vitaminASourceUnit,
    vitaminD: details.vitaminD,
    vitaminDSourceUnit: details.vitaminDSourceUnit,

    iron: details.iron,
    calcium: details.calcium,
    copper: details.copper,
    magnesium: details.magnesium,
    manganese: details.manganese,
    phosphorus: details.phosphorus,
    potassium: details.potassium,
    selenium: details.selenium,
    zinc: details.zinc,
  });
  return { food, created: true };
}
