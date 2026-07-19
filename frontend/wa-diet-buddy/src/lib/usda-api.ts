import { api } from "./api";

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

export async function searchUsda(query: string): Promise<UsdaSearchResult[]> {
  const result = await api.get<{ results: UsdaSearchResult[] }>(
    `/api/foods/usda-search?q=${encodeURIComponent(query)}`,
  );
  return result.results;
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
