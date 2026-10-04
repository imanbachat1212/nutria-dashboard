import { api, type ApiRequestError } from "./api";
import { toFoodItem, type APIFood } from "./foods-api";
import type { FoodItem } from "./food-database-mock";

// Recipe import (prompt-120) — POST a URL (or pasted text) and get back a DRAFT recipe that
// pre-fills the existing New Recipe dialog. Nothing is saved until Sura presses save there.

export interface ImportedIngredient {
  /** The ingredient line exactly as the site wrote it — shown so Sura can check the parse. */
  raw: string;
  quantity: number | null;
  /** One of the dialog's generic units, or null when the line stated none. */
  unit: string | null;
  /** What the backend searched the food library for; pre-filled into the row's search box. */
  searchName: string;
  /** A parenthetical the line carried ("~50-55g each"), kept for display. */
  note: string | null;
  isSection?: boolean;
  sectionTitle?: string;
  /**
   * The matched library food, or null. Null is the normal, expected case for anything the
   * backend wasn't confident about — the row then arrives unmatched with `searchName`
   * pre-filled, which is exactly the state a hand-typed row is in before a food is picked.
   */
  food: APIFood | null;
  confidence: "high" | "low" | "none";
}

/** The site's own nutrition panel. Display-only — never saved. See the service for why. */
export interface SiteNutrition {
  calories: string | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  fiber: string | null;
  servingSize: string | null;
}

export interface ImportedRecipe {
  source: { kind: "url"; url: string; site: string } | { kind: "text" };
  verified: false;
  title: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  steps: string[];
  photo: { url: string; key: string; width?: number; height?: number } | null;
  ingredients: ImportedIngredient[];
  siteNutrition: SiteNutrition | null;
  /** Which parser produced the ingredient split — "heuristic" when no AI key is configured. */
  parser: "ai" | "heuristic";
  warnings: string[];
}

/** Error codes the backend tags a failed import with (recipe-import.service.js IMPORT_ERRORS). */
export type ImportErrorCode = "INVALID_URL" | "FETCH_FAILED" | "NO_RECIPE_DATA" | "NO_INGREDIENTS";

/**
 * Pulls the structured code off a failed import so the UI can offer the paste fallback for the
 * failures it actually helps with, rather than showing "paste instead" for a typo'd URL.
 */
export function importErrorCode(err: unknown): ImportErrorCode | null {
  const details = (err as ApiRequestError)?.details as { code?: ImportErrorCode } | undefined;
  return details?.code ?? null;
}

export function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  return api.post<ImportedRecipe>("/api/recipe-import", { url });
}

export function importRecipeFromText(rawText: string): Promise<ImportedRecipe> {
  return api.post<ImportedRecipe>("/api/recipe-import", { rawText });
}

/**
 * Normalizes a matched food through foods-api's own `toFoodItem`, so an imported row is built
 * from exactly the same shape the dialog's food-search dropdown produces when Sura picks a food
 * by hand. Two mappings would eventually disagree about units or macros.
 */
export function importedFoodToItem(food: APIFood): FoodItem {
  return toFoodItem(food);
}
