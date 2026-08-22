import { api } from "./api";
import type { Micronutrients } from "./food-database-mock";

// Ephemeral USDA FoodData Central result — no _id, not a real Food document until imported.
// fdcId is the only stable identifier available for these.
export interface UsdaSearchResult {
  fdcId: number;
  name: string;
  dataType?: string;
  brand?: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number | null;
    sodium: number | null;
  };
}

// Full nutrient breakdown for one USDA result, fetched lazily on demand (see
// fetchUsdaFoodDetails) — the exact same shape/values importUsdaFood itself stores, since both
// go through foods.service.js's previewUsdaFood. Micronutrient fields are a Partial since USDA
// rarely populates every one; missing means "not available", not zero.
export interface UsdaFoodDetails extends Partial<Micronutrients> {
  fdcId: number;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number | null;
  sodium: number | null;
}

export async function searchUsda(query: string): Promise<UsdaSearchResult[]> {
  const result = await api.get<{ results: UsdaSearchResult[] }>(
    `/api/foods/usda-search?q=${encodeURIComponent(query)}`,
  );
  return result.results;
}

// Read-only preview — no DB write, safe to call as often as a dietitian expands/collapses a
// result while comparing near-duplicates.
export async function fetchUsdaFoodDetails(fdcId: number): Promise<UsdaFoodDetails> {
  return api.get<UsdaFoodDetails>(`/api/foods/usda-details/${fdcId}`);
}

export async function importUsdaFood(fdcId: number): Promise<{ name: string }> {
  return api.post<{ name: string }>("/api/foods/usda-import", { fdcId });
}

// Bulk existence check — one request for a whole page of search results instead of an
// N-query fan-out. Returns the subset of the given fdcIds that already have a Food document.
export async function fetchImportedUsdaFdcIds(fdcIds: number[]): Promise<number[]> {
  if (fdcIds.length === 0) return [];
  const result = await api.get<{ fdcIds: number[] }>(
    `/api/foods/usda-imported?fdcIds=${fdcIds.join(",")}`,
  );
  return result.fdcIds;
}
