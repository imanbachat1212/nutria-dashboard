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

// The exact 4 dataType values FDC's /foods/search actually returns — confirmed live against the
// real API, not invented labels. Mirrors USDA_DATA_TYPES in the backend's usda-client.js.
export const USDA_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"] as const;
export type UsdaDataType = (typeof USDA_DATA_TYPES)[number];

// total is USDA's real totalHits for the query (confirmed live — not capped to whatever fits on
// one page), so the frontend can paginate through the full catalog via `page`, not just the
// first 200 matches. dataTypes empty/omitted means "no filter, search every data type" — today's
// existing default behavior, unchanged for anyone who doesn't touch the new filter.
export async function searchUsda(
  query: string,
  params?: { page?: number; limit?: number; dataTypes?: UsdaDataType[] },
): Promise<{ results: UsdaSearchResult[]; total: number }> {
  const qs = new URLSearchParams({ q: query });
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.dataTypes && params.dataTypes.length > 0) {
    qs.set("dataTypes", params.dataTypes.join(","));
  }
  return api.get<{ results: UsdaSearchResult[]; total: number }>(
    `/api/foods/usda-search?${qs.toString()}`,
  );
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
