import { api } from "./api";
import type { FoodItem, FoodCategory, FoodSource, Micronutrients } from "./food-database-mock";

// Raw micronutrient shape as stored on the backend Food document — mirrors food.model.js
// field-for-field. Separate from the frontend's Micronutrients type (same fields, but that
// one's keys are always present/non-optional) because the API can omit any of these on older
// documents that predate a given field.
interface APIMicronutrients {
  fiberSoluble?: number | null;
  fiberInsoluble?: number | null;
  starch?: number | null;
  fatSaturated?: number | null;
  fatMonounsaturated?: number | null;
  fatPolyunsaturated?: number | null;
  fatTrans?: number | null;
  cholesterol?: number | null;
  omega3Ala?: number | null;
  omega3Epa?: number | null;
  omega3Dha?: number | null;
  omega6La?: number | null;
  omega6LaApprox?: boolean;
  omega6Aa?: number | null;
  omega6AaApprox?: boolean;
  aminoCystine?: number | null;
  aminoHistidine?: number | null;
  aminoIsoleucine?: number | null;
  aminoLeucine?: number | null;
  aminoLysine?: number | null;
  aminoMethionine?: number | null;
  aminoPhenylalanine?: number | null;
  aminoThreonine?: number | null;
  aminoTryptophan?: number | null;
  aminoTyrosine?: number | null;
  aminoValine?: number | null;
  vitaminA?: number | null;
  vitaminASourceUnit?: "mcg" | "iu" | null;
  vitaminB1?: number | null;
  vitaminB2?: number | null;
  vitaminB3?: number | null;
  vitaminB5?: number | null;
  vitaminB6?: number | null;
  vitaminB12?: number | null;
  vitaminC?: number | null;
  vitaminD?: number | null;
  vitaminDSourceUnit?: "mcg" | "iu" | null;
  vitaminE?: number | null;
  folate?: number | null;
  vitaminK?: number | null;
  calcium?: number | null;
  copper?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  manganese?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  selenium?: number | null;
  zinc?: number | null;
  oxalate?: number | null;
  phytate?: number | null;
}

interface APIFood extends APIMicronutrients {
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
  gramsPerCup?: number | null;
  gramsPerTbsp?: number | null;
  gramsPerTsp?: number | null;
  gramsPerPiece?: number | null;
  verified?: boolean;
  createdAt: string;
  // Only present on create/update responses (see foods.service.js's matchFoodName hook) —
  // never on list/get responses.
  unitWeightMatch?: UnitWeightMatch | null;
}

// Result of matching this food's name against USDA's FNDDS reference data. "match" means the
// 4 gramsPerX fields were already auto-populated server-side; "low-confidence" means they were
// NOT written — `fields` is only a suggestion the dietitian can choose to apply.
export interface UnitWeightMatch {
  tier: "match" | "low-confidence";
  score: number;
  matchedDescription: string;
  matchedCategory?: string;
  fields: {
    gramsPerCup?: number;
    gramsPerTbsp?: number;
    gramsPerTsp?: number;
    gramsPerPiece?: number;
  };
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
  sweets: "sweets",
  beverages: "beverages",
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
  // Was "condiments" — that backend category was retired (2026-08). "beverages" has no distinct
  // backend bucket of its own; store/read it as a literal "beverages" string so it at least
  // round-trips correctly (see matching CATEGORY_MAP entry above), instead of silently aliasing
  // onto a category that no longer exists.
  beverages: "beverages",
};

function toMicronutrients(f: APIMicronutrients): Micronutrients {
  return {
    fiberSoluble: f.fiberSoluble ?? null,
    fiberInsoluble: f.fiberInsoluble ?? null,
    starch: f.starch ?? null,
    fatSaturated: f.fatSaturated ?? null,
    fatMonounsaturated: f.fatMonounsaturated ?? null,
    fatPolyunsaturated: f.fatPolyunsaturated ?? null,
    fatTrans: f.fatTrans ?? null,
    cholesterol: f.cholesterol ?? null,
    omega3Ala: f.omega3Ala ?? null,
    omega3Epa: f.omega3Epa ?? null,
    omega3Dha: f.omega3Dha ?? null,
    omega6La: f.omega6La ?? null,
    omega6LaApprox: f.omega6LaApprox ?? false,
    omega6Aa: f.omega6Aa ?? null,
    omega6AaApprox: f.omega6AaApprox ?? false,
    aminoCystine: f.aminoCystine ?? null,
    aminoHistidine: f.aminoHistidine ?? null,
    aminoIsoleucine: f.aminoIsoleucine ?? null,
    aminoLeucine: f.aminoLeucine ?? null,
    aminoLysine: f.aminoLysine ?? null,
    aminoMethionine: f.aminoMethionine ?? null,
    aminoPhenylalanine: f.aminoPhenylalanine ?? null,
    aminoThreonine: f.aminoThreonine ?? null,
    aminoTryptophan: f.aminoTryptophan ?? null,
    aminoTyrosine: f.aminoTyrosine ?? null,
    aminoValine: f.aminoValine ?? null,
    vitaminA: f.vitaminA ?? null,
    vitaminASourceUnit: f.vitaminASourceUnit ?? null,
    vitaminB1: f.vitaminB1 ?? null,
    vitaminB2: f.vitaminB2 ?? null,
    vitaminB3: f.vitaminB3 ?? null,
    vitaminB5: f.vitaminB5 ?? null,
    vitaminB6: f.vitaminB6 ?? null,
    vitaminB12: f.vitaminB12 ?? null,
    vitaminC: f.vitaminC ?? null,
    vitaminD: f.vitaminD ?? null,
    vitaminDSourceUnit: f.vitaminDSourceUnit ?? null,
    vitaminE: f.vitaminE ?? null,
    folate: f.folate ?? null,
    vitaminK: f.vitaminK ?? null,
    calcium: f.calcium ?? null,
    copper: f.copper ?? null,
    iron: f.iron ?? null,
    magnesium: f.magnesium ?? null,
    manganese: f.manganese ?? null,
    phosphorus: f.phosphorus ?? null,
    potassium: f.potassium ?? null,
    selenium: f.selenium ?? null,
    zinc: f.zinc ?? null,
    oxalate: f.oxalate ?? null,
    phytate: f.phytate ?? null,
  };
}

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
    micros: toMicronutrients(f),
    servings: [{ label: `${f.servingSize} ${f.servingUnit}`, grams: f.servingSize }],
    unitWeights: {
      cup: f.gramsPerCup ?? null,
      tbsp: f.gramsPerTbsp ?? null,
      tsp: f.gramsPerTsp ?? null,
      piece: f.gramsPerPiece ?? null,
    },
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
  // Sparse — only fields the dietitian actually filled in in the Micronutrients step need to
  // be present; omitted keys just stay null on the created document (schema default).
  micros?: Partial<Micronutrients>;
}

export async function createFood(
  data: CreateFoodPayload,
): Promise<{ food: FoodItem; unitWeightMatch: UnitWeightMatch | null }> {
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
    ...data.micros,
  };
  const raw = await api.post<APIFood>("/api/foods", body);
  return { food: toFoodItem(raw), unitWeightMatch: raw.unitWeightMatch ?? null };
}

export async function updateFood(
  id: string,
  data: {
    verified?: boolean;
    name?: string;
    gramsPerCup?: number | null;
    gramsPerTbsp?: number | null;
    gramsPerTsp?: number | null;
    gramsPerPiece?: number | null;
  },
): Promise<{ food: FoodItem; unitWeightMatch: UnitWeightMatch | null }> {
  const raw = await api.patch<APIFood>(`/api/foods/${id}`, data);
  return { food: toFoodItem(raw), unitWeightMatch: raw.unitWeightMatch ?? null };
}

export async function deleteFood(id: string): Promise<void> {
  await api.delete(`/api/foods/${id}`);
}
