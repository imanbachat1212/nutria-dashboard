import { api } from "./api";
import type { FoodItem, FoodCategory, FoodSource } from "./food-database-mock";

interface APIFood {
  _id: string;
  name: string;
  nameAr?: string;
  brand?: string;
  category?: string;
  source?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number | null;
  sodium: number | null;
  verified?: boolean;
  createdAt: string;
}

interface APIListResult {
  foods: APIFood[];
  total: number;
  page: number;
  limit: number;
}

const CATEGORY_MAP: Record<string, FoodCategory> = {
  protein: "protein",
  dairy: "dairy",
  grains: "grains",
  legumes: "legumes",
  vegetables: "produce",
  fruits: "produce",
  fats_oils: "fats",
  nuts_seeds: "snacks",
  prepared: "prepared",
  condiments: "condiments",
};

function mapCategory(cat?: string): FoodCategory {
  if (!cat) return "protein";
  return CATEGORY_MAP[cat] || "protein";
}

function mapSource(src?: string): FoodSource {
  if (src === "usda" || src === "lebanese" || src === "custom") return src;
  return "custom";
}

const CATEGORY_REVERSE: Record<string, string[]> = {
  produce: ["vegetables", "fruits"],
  fats: ["fats_oils"],
  snacks: ["nuts_seeds"],
};

const CATEGORY_TO_BACKEND: Record<string, string> = {
  produce: "vegetables",
  fats: "fats_oils",
  snacks: "nuts_seeds",
  beverages: "condiments",
};

function toFoodItem(f: APIFood): FoodItem {
  return {
    id: f._id,
    name: f.name,
    arabicName: f.nameAr,
    brand: f.brand,
    category: mapCategory(f.category),
    source: mapSource(f.source),
    macros: {
      kcal: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber ?? 0,
      sugar: f.sugar ?? 0,
      sodium: f.sodium ?? 0,
    },
    servings: [{ label: `${f.servingSize} ${f.servingUnit}`, grams: f.servingSize }],
    allergens: [],
    verified: f.verified ?? false,
    // from mealplans module — not wired yet
    usedInPlans: 0,
    lastUsed: "—",
    isFavorite: false,
  };
}

export async function fetchFoods(params?: {
  search?: string;
  category?: string;
  source?: FoodSource;
  page?: number;
  limit?: number;
}): Promise<{ foods: FoodItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.source) qs.set("source", params.source);

  if (params?.category) {
    const backendCats = CATEGORY_REVERSE[params.category];
    if (backendCats) {
      qs.set("category", backendCats[0]);
    } else {
      qs.set("category", params.category);
    }
  }

  const q = qs.toString();
  const result = await api.get<APIListResult>(`/api/foods${q ? `?${q}` : ""}`);
  return {
    foods: result.foods.map(toFoodItem),
    total: result.total,
  };
}

export interface CreateFoodPayload {
  name: string;
  arabicName?: string;
  brand?: string;
  category: FoodCategory;
  source: FoodSource;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number | null;
  sodium: number | null;
  servingSize: number;
  servingUnit: string;
}

export async function createFood(data: CreateFoodPayload): Promise<FoodItem> {
  const backendCat = CATEGORY_TO_BACKEND[data.category] || data.category;
  const body = {
    name: data.name,
    nameAr: data.arabicName || undefined,
    brand: data.brand || undefined,
    category: backendCat,
    source: data.source,
    servingSize: data.servingSize,
    servingUnit: data.servingUnit,
    calories: data.kcal,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    fiber: data.fiber,
    sugar: data.sugar,
    sodium: data.sodium,
  };
  const raw = await api.post<APIFood>("/api/foods", body);
  return toFoodItem(raw);
}

export async function updateFood(id: string, data: { verified?: boolean }): Promise<FoodItem> {
  const raw = await api.patch<APIFood>(`/api/foods/${id}`, data);
  return toFoodItem(raw);
}

export async function deleteFood(id: string): Promise<void> {
  await api.delete(`/api/foods/${id}`);
}
