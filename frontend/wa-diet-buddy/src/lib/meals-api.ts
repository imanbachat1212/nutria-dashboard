import { api } from "./api";
import type { Recipe, RecipeCategory, RecipeCuisine } from "./meal-library-mock";
import type { ServingSize, UnitWeights } from "./food-database-mock";
import {
  formatSavedMeasureAmount,
  formatSavedGenericUnitAmount,
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
}

export interface PhotoItem {
  url: string;
  key: string;
  width?: number;
  height?: number;
}

interface APIMeal {
  _id: string;
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
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
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
    micronutrients: m.micronutrients ?? [],
    ingredients: (m.ingredients || []).map((i) => ({
      name: i.name,
      amount:
        formatSavedMeasureAmount(i) ||
        formatSavedGenericUnitAmount(i, typeof i.food === "object" ? i.food : null) ||
        i.measureLabel ||
        (i.quantity ? `${i.quantity} ${i.unit || "g"}` : ""),
    })),
    steps: m.steps || [],
    allergens: (m.allergens || []) as Recipe["allergens"],
    diets: (m.dietTags || []) as Recipe["diets"],
    verified: m.verified ?? false,
    notes: m.notes,
    // from mealplans module — not wired yet
    rating: 0,
    usedInPlans: 0,
    lastUsed: "—",
    author: "—",
    isFavorite: false,
  };
}

export async function fetchMeals(params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<{ meals: Recipe[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.category) qs.set("category", params.category);
  const q = qs.toString();
  const result = await api.get<APIListResult>(`/api/meals${q ? `?${q}` : ""}`);
  return {
    meals: result.meals.map(toRecipe),
    total: result.total,
  };
}

export interface CreateMealIngredient {
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
  cuisine: RecipeCuisine;
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
  name: string;
  nameAr?: string;
  category: RecipeCategory;
  cuisine: RecipeCuisine;
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
