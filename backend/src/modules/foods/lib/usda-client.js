import { env } from "../../../config/env.js";
import { ApiError } from "../../../lib/ApiError.js";

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// USDA FoodData Central nutrient IDs — stable across data types (Foundation, SR Legacy,
// Branded, Survey), even though /foods/search and /food/{fdcId} nest the nutrient list
// differently (see normalizeNutrients below). Sugar has two candidate ids because older
// (SR Legacy) records use 1063 "Sugars, total" while newer records use 2000 "Sugars, total
// including NLEA".
const NUTRIENT_IDS = {
  calories: [1008],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sugar: [2000, 1063],
  sodium: [1093],
};

function requireApiKey() {
  if (!env.USDA_API_KEY) {
    throw new ApiError(
      503,
      "USDA search is not configured — set USDA_API_KEY in the backend .env (free key: https://fdc.nal.usda.gov/api-key-signup)"
    );
  }
  return env.USDA_API_KEY;
}

async function usdaFetch(path, params) {
  const apiKey = requireApiKey();
  const qs = new URLSearchParams({ ...params, api_key: apiKey });

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}?${qs}`);
  } catch {
    throw new ApiError(502, "Could not reach USDA FoodData Central — try again shortly");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(502, "USDA FoodData Central rejected the configured API key");
    }
    if (res.status === 429) {
      throw new ApiError(429, "USDA FoodData Central rate limit hit — try again shortly");
    }
    throw new ApiError(502, `USDA FoodData Central request failed (${res.status})`);
  }
  return res.json();
}

// /foods/search nutrients: [{ nutrientId, value }]. /food/{fdcId} nutrients:
// [{ nutrient: { id }, amount }]. Flatten both into one { id, value } shape so macro
// extraction below doesn't need to know which endpoint it came from.
function normalizeNutrients(foodNutrients = []) {
  return foodNutrients.map((n) => ({
    id: n.nutrientId ?? n.nutrient?.id,
    value: n.value ?? n.amount ?? 0,
  }));
}

function pickNutrient(nutrients, ids) {
  const hit = nutrients.find((n) => ids.includes(n.id));
  if (!hit) return null;
  return Math.round(hit.value * 10) / 10;
}

// USDA nutrient amounts are per 100 g for Foundation/SR Legacy/Survey data (the bulk of
// search results) — mapped 1:1 onto this app's existing per-100g Food convention (see
// foods.seed.js). Branded foods carry a separate per-label-serving breakdown we don't use
// here; their per-100g foodNutrients values are still accurate, just not what's on the
// physical label.
function toMacros(foodNutrients) {
  const nutrients = normalizeNutrients(foodNutrients);
  return {
    calories: pickNutrient(nutrients, NUTRIENT_IDS.calories) ?? 0,
    protein: pickNutrient(nutrients, NUTRIENT_IDS.protein) ?? 0,
    carbs: pickNutrient(nutrients, NUTRIENT_IDS.carbs) ?? 0,
    fat: pickNutrient(nutrients, NUTRIENT_IDS.fat) ?? 0,
    fiber: pickNutrient(nutrients, NUTRIENT_IDS.fiber) ?? 0,
    sugar: pickNutrient(nutrients, NUTRIENT_IDS.sugar),
    sodium: pickNutrient(nutrients, NUTRIENT_IDS.sodium),
  };
}

// query -> lightweight matches with a macro preview, so the frontend can show real values
// before a dietitian commits to importing one. Ephemeral — no DB write happens here.
export async function searchUsdaFoods(query, { pageSize = 20 } = {}) {
  const data = await usdaFetch("/foods/search", { query, pageSize: String(pageSize) });
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    name: f.description,
    dataType: f.dataType,
    brand: f.brandOwner || f.brandName || undefined,
    macros: toMacros(f.foodNutrients),
  }));
}

// fdcId -> full detail, mapped straight onto this app's Food fields (minus source/createdBy,
// which the caller sets — this is a pure USDA-shape-to-our-shape mapper, not a persistence
// concern; foods.service.js decides what to do with the result).
export async function getUsdaFoodDetails(fdcId) {
  const f = await usdaFetch(`/food/${fdcId}`, {});
  const macros = toMacros(f.foodNutrients);
  return {
    fdcId: f.fdcId,
    name: f.description,
    servingSize: 100,
    servingUnit: "g",
    ...macros,
  };
}
