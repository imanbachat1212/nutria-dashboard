import { api } from "./api";
import type { Recipe, RecipeCategory, RecipeCuisine } from "./meal-library-mock";

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
  ingredients: { food?: string; name: string; quantity?: number; unit?: string }[];
  steps: string[];
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
    macros: {
      kcal: m.totalCalories || 0,
      protein: m.totalProtein || 0,
      carbs: m.totalCarbs || 0,
      fat: m.totalFat || 0,
      fiber: m.totalFiber || 0,
    },
    ingredients: (m.ingredients || []).map((i) => ({
      name: i.name,
      amount: i.quantity ? `${i.quantity} ${i.unit || "g"}` : "",
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
      }
    | string
    | null;
  name: string;
  quantity?: number;
  unit?: string;
}

interface APIMealDetail extends Omit<APIMeal, "ingredients"> {
  ingredients: APIMealIngredientDetail[];
}

export interface EditableIngredient {
  foodId: string;
  name: string;
  quantity: number | "";
  unit: string;
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
