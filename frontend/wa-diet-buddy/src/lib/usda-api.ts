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
