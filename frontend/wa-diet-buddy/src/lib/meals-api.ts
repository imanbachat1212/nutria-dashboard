import { api } from "./api";
import { relativeTime } from "./mealplans-api";
import type {
  MacroContributions,
  NutrientContribution,
  Recipe,
  RecipeCategory,
  RecipeCuisine,
} from "./meal-library-mock";
import type { ServingSize, UnitWeights } from "./food-database-mock";
import {
  formatSavedMeasureAmount,
  formatSavedGenericUnitAmount,
  gramsPerServingForSavedItem,
  type SavedItemFood,
} from "./measure-options";

// One row of the recipe micronutrient panel, exactly as the server computes it.
export interface RecipeMicronutrient {
  nutrient: string;
  label: string;
  unit: string;
  value: number;
  pct: number;
  level: "high" | "good" | null;
  // The unrounded ratio, for display precision only (prompt-88) — see formatDvPct.
  pctExact?: number;
  // Which ingredients this nutrient came from (prompt-98), highest share first. Present only on
  // the single-recipe reads (getMealById / updateMeal / duplicateMeal); listMeals skips the
  // per-recipe ingredient lookup, so a recipe straight from the list has none.
  contributions?: NutrientContribution[];
}

export interface PhotoItem {
  url: string;
  key: string;
  width?: number;
  height?: number;
}

interface APIMeal {
  _id: string;
  // Plan usage (prompt-116) from the list/detail endpoints — see backend lib/planUsage.js.
  // `lastUsed` is an ISO timestamp, or null when this recipe is in no plan.
  usedInPlans?: number;
  lastUsed?: string | null;
  name: string;
  nameAr?: string;
  category: string;
  cuisine: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  icon: string;
  coverHue: string;
  dietTags: string[];
  allergens: string[];
  ingredients: {
    // "section" rows (prompt-97) are titled dividers with only a name — no food/quantity/unit.
    // Absent on any recipe saved before sections existed; mongoose defaults those to
    // "ingredient" on read, so an undefined here means the same thing.
    type?: "ingredient" | "section";
    // Populated (prompt-75) with this food's own unit weights so the drawer can show what a
    // stored "0.25 cup" actually weighs; still a bare id string on any response predating that
    // populate, which formatSavedGenericUnitAmount treats as "no data, show nothing".
    food?: SavedItemFood & { _id: string; name: string };
    name: string;
    quantity?: number;
    unit?: string;
    // Display-only (prompt-47/49) — see meal.model.js's ingredientSchema.measureLabel/
    // measureDescription/measureCount comments.
    measureLabel?: string | null;
    measureDescription?: string | null;
    measureCount?: number | null;
  }[];
  steps: string[];
  // Per-serving micronutrient panel (prompt-82) — computed server-side in meals.service.js so
  // the FDA Daily Value table has exactly one home (nutrientClaims.js), shared with the Food
  // Database's claim badges. Absent on any response predating that decorator.
  micronutrients?: RecipeMicronutrient[];
  // Per-macro contributor lists (prompt-98). Same availability caveat as above.
  macroContributions?: MacroContributions;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  // Whole-recipe "Other"-group totals in mg (oxalate prompt-99, phytate prompt-100), summed
  // server-side from the ingredients in one pass. Tracked independently: null means no
  // ingredient reports THAT nutrient, 0 means one does and the sum is genuinely zero, and a
  // recipe can easily have a real oxalate total and a null phytate total. Absent on a response
  // predating either field — which reads the same as null here.
  totalOxalate?: number | null;
  totalPhytate?: number | null;
  verified: boolean;
  notes?: string;
  // Server normalizes legacy single-`photo` recipes into photos[0] on read — see
  // meals.service.js:normalizePhotos. This type only reflects the current (post-normalize)
  // shape; the defensive fallback below still guards against an unnormalized response.
  photos?: PhotoItem[];
  photo?: PhotoItem | null;
  createdAt: string;
}

function toPhotoArray(m: Pick<APIMeal, "photos" | "photo">): PhotoItem[] {
  if (m.photos?.length) return m.photos;
  if (m.photo) return [m.photo];
  return [];
}

// Meal.totalX on the server is the WHOLE recipe as prepared — computeRecipeMacros sums every
// ingredient and never sees `servings` (see backend lib/calc/recipeMacros.js). Recipe.macros,
// by contrast, is per-serving everywhere it's consumed: the Meal Library drawer labels it
// "Per serving", and plan-item-picker.tsx documents macrosPerUnit as "per-serving for recipe"
// and multiplies it by the number of servings being added. So the division belongs here, at
// the one place the API shape becomes the UI shape — not repeated at each display site.
//
// Rounding mirrors computeItemDetails' recipe branch in mealplans.service.js exactly (kcal to
// a whole number, the rest to one decimal, with the same servings divisor), so what the picker
// previews for 1 srv is digit-for-digit what the plan item shows once it's actually added.
function perServing(m: APIMeal): Recipe["macros"] {
  const s = m.servings || 1;
  return {
    kcal: Math.round((m.totalCalories || 0) / s),
    protein: Math.round(((m.totalProtein || 0) / s) * 10) / 10,
    carbs: Math.round(((m.totalCarbs || 0) / s) * 10) / 10,
    fat: Math.round(((m.totalFat || 0) / s) * 10) / 10,
    fiber: Math.round(((m.totalFiber || 0) / s) * 10) / 10,
  };
}

interface APIListResult {
  meals: APIMeal[];
  total: number;
  page: number;
  limit: number;
}

function toRecipe(m: APIMeal): Recipe {
  const photos = toPhotoArray(m);
  return {
    id: m._id,
    name: m.name,
    arabicName: m.nameAr,
    category: m.category as RecipeCategory,
    cuisine: m.cuisine as RecipeCuisine,
    image: m.icon || "🥗",
    coverHue: m.coverHue || "bg-emerald-100",
    photoUrl: photos[0]?.url,
    photos,
    prepMin: m.prepTime || 0,
    cookMin: m.cookTime || 0,
    servings: m.servings || 1,
    macros: perServing(m),
    // Deliberately NOT inside `macros`: that object is the five FDA macro tiles the drawer
    // renders as a row, and these are none of them — no Daily Value, no DRI, no claim tier.
    // Kept as their own top-level fields so nothing that iterates `macros` picks them up.
    //
    // Per serving, like every other number this page shows, using the same divisor perServing()
    // applies to the macros. Note the basis differs from the Food Database's "Other" filter,
    // which is per 100 g — that is on purpose, not an inconsistency: this page's figures are
    // all per serving, that page's micronutrient panel is all per 100 g, and each filter's
    // label states which one it means.
    //
    // null is preserved rather than collapsed to 0: an unmeasured recipe is not a verified
    // low-X recipe, and meal-library.tsx's filter relies on being able to tell them apart.
    oxalatePerServing:
      m.totalOxalate == null ? null : Math.round((m.totalOxalate / (m.servings || 1)) * 100) / 100,
    phytatePerServing:
      m.totalPhytate == null ? null : Math.round((m.totalPhytate / (m.servings || 1)) * 100) / 100,
    micronutrients: m.micronutrients ?? [],
    // Left undefined rather than defaulted to empty lists: "the list view didn't fetch this"
    // and "this recipe genuinely has no contributors" are different states, and the hover uses
    // the difference to decide whether to render at all.
    macroContributions: m.macroContributions,
    // A section row carries a title and nothing else — none of the amount formatters below
    // apply to it (they all read food/quantity/measure fields it doesn't have), so it branches
    // out before them rather than falling through them to an empty string by accident.
    ingredients: (m.ingredients || []).map((i) => {
      if (i.type === "section") return { type: "section" as const, name: i.name, amount: "" };
      const food = typeof i.food === "object" ? i.food : null;
      // Resolved through the same gramsPerUnitForFood precedence the stored macros were
      // computed with, NOT `i.quantity / servings` — quantity is a COUNT for a generic-unit
      // row ("0.25 cup"), only grams for a plain-gram or named-measure row. null (no weight
      // this food's data supports) is preserved as undefined rather than collapsed to 0, the
      // same convention as oxalatePerServing/phytatePerServing above.
      const grams = gramsPerServingForSavedItem(i, food, m.servings || 1);
      return {
        type: "ingredient" as const,
        name: i.name,
        amount:
          formatSavedMeasureAmount(i) ||
          formatSavedGenericUnitAmount(i, food) ||
          i.measureLabel ||
          (i.quantity ? `${i.quantity} ${i.unit || "g"}` : ""),
        gramsPerServing: grams == null ? undefined : Math.round(grams * 10) / 10,
      };
    }),
    steps: m.steps || [],
    allergens: (m.allergens || []) as Recipe["allergens"],
    diets: (m.dietTags || []) as Recipe["diets"],
    verified: m.verified ?? false,
    notes: m.notes,
    // rating/author are still unwired — no source for either yet.
    rating: 0,
    // Real values from the mealplans module (prompt-116): distinct plans whose items reference
    // this recipe via items.meal, and the latest updatedAt among them. 0 is a genuine zero.
    usedInPlans: m.usedInPlans ?? 0,
    lastUsed: m.lastUsed ? relativeTime(m.lastUsed) : "—",
    author: "—",
    isFavorite: false,
  };
}

export async function fetchMeals(params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  // A SORT hint, not a filter (prompt-109): recipes tagged with at least one of these are
  // returned ahead of the rest, nothing is excluded. Comma-encoded to match this codebase's
  // existing array-param shape (see searchUsda's dataTypes). Omitted — as Meal Library's own
  // list does — leaves the endpoint on its plain recency order.
  dietaryPrefs?: string[];
}): Promise<{ meals: Recipe[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.category) qs.set("category", params.category);
  if (params?.dietaryPrefs?.length) qs.set("dietaryPrefs", params.dietaryPrefs.join(","));
  const q = qs.toString();
  const result = await api.get<APIListResult>(`/api/meals${q ? `?${q}` : ""}`);
  return {
    meals: result.meals.map(toRecipe),
    total: result.total,
  };
}

export interface CreateMealIngredient {
  // "section" (prompt-97) sends only this and `name` — see meal.model.js's ingredientSchema.
  type?: "ingredient" | "section";
  food?: string;
  name: string;
  quantity?: number;
  unit?: string;
  // Display-only (prompt-47/49) — see meal.model.js's ingredientSchema.measureLabel/
  // measureDescription/measureCount comments.
  measureLabel?: string | null;
  measureDescription?: string | null;
  measureCount?: number | null;
}

export interface CreateMealPayload {
  name: string;
  nameAr?: string;
  category: RecipeCategory;
  cuisine?: RecipeCuisine;
  servings: number;
  prepTime: number;
  cookTime: number;
  icon?: string;
  coverHue?: string;
  dietTags: string[];
  allergens: string[];
  ingredients: CreateMealIngredient[];
  steps: string[];
  notes?: string;
  photos?: PhotoItem[];
  // Where an imported recipe came from (prompt-120); absent on hand-entered recipes.
  sourceUrl?: string;
}

export async function createMeal(data: CreateMealPayload): Promise<Recipe> {
  const raw = await api.post<APIMeal>("/api/meals", data);
  return toRecipe(raw);
}

export async function updateMeal(
  id: string,
  data: Partial<CreateMealPayload> & { verified?: boolean },
): Promise<Recipe> {
  const raw = await api.patch<APIMeal>(`/api/meals/${id}`, data);
  return toRecipe(raw);
}

// Mirrors duplicateMealPlan in mealplans-api.ts. `name` is optional — omitting it lets the
// server append " (copy)", so the naming convention lives in exactly one place.
export async function duplicateMeal(id: string, opts: { name?: string } = {}): Promise<Recipe> {
  const raw = await api.post<APIMeal>(`/api/meals/${id}/duplicate`, opts);
  return toRecipe(raw);
}

export async function deleteMeal(id: string): Promise<void> {
  await api.delete(`/api/meals/${id}`);
}

interface APIMealIngredientDetail {
  food?:
    | {
        _id: string;
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        // Added (prompt-49) so an already-added ingredient's real measures/generic-unit
        // overrides are available on edit-load, not just when first adding an ingredient.
        gramsPerCup?: number | null;
        gramsPerTbsp?: number | null;
        gramsPerTsp?: number | null;
        gramsPerPiece?: number | null;
        gramsPerMl?: number | null;
        commonServings?: ServingSize[];
        portions?: { description: string; grams: number }[];
      }
    | string
    | null;
  type?: "ingredient" | "section";
  name: string;
  quantity?: number;
  unit?: string;
  measureLabel?: string | null;
  measureDescription?: string | null;
  measureCount?: number | null;
}

interface APIMealDetail extends Omit<APIMeal, "ingredients"> {
  ingredients: APIMealIngredientDetail[];
}

export interface EditableIngredient {
  // Always set by getMeal below (defaulted to "ingredient"), so the dialog can branch on it
  // without re-deriving the default. Optional only because CreateMealIngredient's is.
  type?: "ingredient" | "section";
  foodId: string;
  name: string;
  quantity: number | "";
  unit: string;
  // Display-only (prompt-47/49) — carried through edit-mode; measureDescription/measureCount
  // let new-recipe-dialog.tsx pre-select the real measure originally picked (falls back to
  // grams if absent, or if it no longer matches one of realMeasures below).
  measureLabel?: string | null;
  measureDescription?: string | null;
  measureCount?: number | null;
  realMeasures?: ServingSize[];
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
  per100g: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } | null;
}

export interface EditableMeal {
  id: string;
  // Carried through from getMealById (prompt-98) so the Meal Plan sheet's level-2 drill-down
  // can reuse this one fetch to break a recipe item down into its own ingredients, instead of
  // needing a second endpoint. Percentages are scale-invariant, so these apply unchanged at any
  // serving count.
  micronutrients?: RecipeMicronutrient[];
  macroContributions?: MacroContributions;
  // Whole-recipe "Other"-group totals in mg (prompt-99/100) — carried through for parity with
  // the totals above. Not divided by servings here: EditableMeal is the raw edit-mode shape,
  // and `servings` is right beside it for any caller that wants the per-serving figure.
  totalOxalate?: number | null;
  totalPhytate?: number | null;
  name: string;
  nameAr?: string;
  category: RecipeCategory;
  cuisine?: RecipeCuisine;
  servings: number;
  prepTime: number;
  cookTime: number;
  dietTags: string[];
  allergens: string[];
  ingredients: EditableIngredient[];
  steps: string[];
  notes?: string;
  photos: PhotoItem[];
}

export async function getMeal(id: string): Promise<EditableMeal> {
  const raw = await api.get<APIMealDetail>(`/api/meals/${id}`);
  return {
    id: raw._id,
    micronutrients: raw.micronutrients,
    macroContributions: raw.macroContributions,
    totalOxalate: raw.totalOxalate ?? null,
    totalPhytate: raw.totalPhytate ?? null,
    name: raw.name,
    nameAr: raw.nameAr,
    category: raw.category as RecipeCategory,
    cuisine: raw.cuisine as RecipeCuisine,
    servings: raw.servings || 1,
    prepTime: raw.prepTime || 0,
    cookTime: raw.cookTime || 0,
    dietTags: raw.dietTags || [],
    allergens: raw.allergens || [],
    ingredients: (raw.ingredients || []).map((i) => {
      const food = typeof i.food === "object" && i.food ? i.food : null;
      return {
        type: i.type ?? "ingredient",
        foodId: food ? food._id : typeof i.food === "string" ? i.food : "",
        name: i.name,
        quantity: i.quantity ?? "",
        unit: i.unit || "g",
        measureLabel: i.measureLabel ?? null,
        measureDescription: i.measureDescription ?? null,
        measureCount: i.measureCount ?? null,
        realMeasures: food?.portions?.map((p) => ({ label: p.description, grams: p.grams })),
        unitWeights: food
          ? {
              cup: food.gramsPerCup ?? null,
              tbsp: food.gramsPerTbsp ?? null,
              tsp: food.gramsPerTsp ?? null,
              piece: food.gramsPerPiece ?? null,
              ml: food.gramsPerMl ?? null,
            }
          : undefined,
        commonServings: food?.commonServings,
        per100g: food
          ? {
              kcal: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber ?? 0,
            }
          : null,
      };
    }),
    steps: raw.steps || [],
    notes: raw.notes,
    photos: toPhotoArray(raw),
  };
}
