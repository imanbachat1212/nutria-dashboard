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
  // Foundation-type records (confirmed live on chicken breast and baby spinach) frequently
  // omit plain "Energy" (1008) entirely and carry ONLY these two Atwater-factor variants
  // instead — both id 2047 (General Factors, the generic 4/4/9-style approximation) AND id
  // 2048 (Specific Factors, food-specific empirically-derived conversion) tend to be present
  // together. Specific (2048) is preferred over General (2047) when both exist — see
  // pickCalories, which tries these in explicit priority order rather than relying on
  // pickNutrient's array-membership `find()` (which would just return whichever of the two
  // happens to appear first in USDA's list, not the more accurate one).
  caloriesAtwaterSpecific: [2048],
  caloriesAtwaterGeneral: [2047],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sugar: [2000, 1063],
  sodium: [1093],

  // Fiber / carbs
  fiberSoluble: [1082],
  // "Fiber, insoluble" (SR nutrient number 293) — id 1084 is the catalog convention, but this
  // was NOT observed on any live record checked during investigation (chicken, spinach,
  // salmon, Cheerios, wheat bran, oat bran) despite bran being where it'd be nutritionally
  // expected. Kept as a best-effort lookup; expect null on the overwhelming majority of foods.
  fiberInsoluble: [1084],
  starch: [1009],

  // Fats
  fatSaturated: [1258],
  fatMonounsaturated: [1292],
  fatPolyunsaturated: [1293],
  fatTrans: [1257],
  cholesterol: [1253],
  omega3Ala: [1404], // PUFA 18:3 n-3 c,c,c (ALA)
  omega3Epa: [1278], // PUFA 20:5 n-3 (EPA)
  omega3Dha: [1272], // PUFA 22:6 n-3 (DHA)
  // n-6-specific (stereo-labeled) ids — tried first
  omega6La: [1316], // PUFA 18:2 n-6 c,c (LA)
  omega6Aa: [1298], // PUFA 20:4 n-6 (AA)
  // Generic fallback ids. Confirmed live: an SR Legacy salmon record carried ONLY these
  // generic, non-stereo-labeled fatty acids (18:2 / 20:4) — the n-6-specific ids above were
  // absent even though the food clearly has n-6 fat content. Not guaranteed to be exclusively
  // n-6 (a trace n-3 or n-9 isomer at the same carbon:double-bond count would also match), so
  // values pulled from here are flagged approximate rather than presented as confirmed n-6.
  omega6LaGeneric: [1269], // PUFA 18:2 (generic)
  omega6AaGeneric: [1271], // PUFA 20:4 (generic)

  // Amino acids
  aminoTryptophan: [1210],
  aminoThreonine: [1211],
  aminoIsoleucine: [1212],
  aminoLeucine: [1213],
  aminoLysine: [1214],
  aminoMethionine: [1215],
  aminoCystine: [1216],
  aminoPhenylalanine: [1217],
  aminoTyrosine: [1218],
  aminoValine: [1219],
  aminoHistidine: [1221],

  // Vitamins — B-complex + K + C/E. vitaminC/vitaminE were flagged in prior comments as
  // "already covered" but were NOT actually wired to any NUTRIENT_IDS entry or extracted in
  // toFullNutrition — that was inaccurate; both are genuinely new as of this pass.
  vitaminB1: [1165], // Thiamin
  vitaminB2: [1166], // Riboflavin
  vitaminB3: [1167], // Niacin
  vitaminB5: [1170], // Pantothenic acid
  vitaminB6: [1175], // Vitamin B-6
  vitaminB12: [1178], // Vitamin B-12
  folate: [1177], // Folate, total
  vitaminK: [1185], // Vitamin K (phylloquinone)
  vitaminC: [1162], // Vitamin C, total ascorbic acid — confirmed present on every data type checked
  vitaminE: [1109], // Vitamin E, alpha-tocopherol (mg)
  // Vitamin A / D — µg form preferred, IU form is a same-field fallback tagged via
  // vitaminA/DSourceUnit (see pickVitaminWithUnit). Never averaged or converted between units.
  vitaminARae: [1106], // Vitamin A, RAE (µg) — Foundation/SR Legacy
  vitaminAIu: [1104], // Vitamin A, IU — Branded-only in every sample checked
  vitaminDMcg: [1114], // Vitamin D (D2+D3) (µg) — Foundation/SR Legacy
  vitaminDIu: [1110], // Vitamin D (D2+D3), International Units — Branded-only in every sample checked

  // Minerals. iron was flagged in a prior comment as "already covered above" — that referred
  // only to the top-level macro NUTRIENT_IDS block (calories/protein/.../sodium), which never
  // actually included iron either. Genuinely new as of this pass, same as vitaminC/E.
  iron: [1089],
  calcium: [1087],
  copper: [1098],
  magnesium: [1090],
  manganese: [1101],
  phosphorus: [1091],
  potassium: [1092],
  selenium: [1103],
  zinc: [1095],
  // oxalate/phytate intentionally have no entry — confirmed absent from FDC entirely across
  // every data type checked; manual-entry-only fields.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Confirmed live (independent of this app, by hitting USDA directly and repeating the exact
// same request): USDA's own API gateway intermittently 404s a request that succeeds moments
// later with no change on our end — observed on BOTH /foods/search and /food/{fdcId}, at
// roughly a 45-55% single-attempt failure rate, and NOT tied to any particular fdcId/dataType
// (the same id flips between 200 and 404 across consecutive calls). This is gateway-side
// flakiness upstream of us, not something a valid fdcId/query should ever legitimately 404 on
// after a search just returned it. Bounded retries paper over it cheaply; a genuinely-invalid
// fdcId will just keep 404ing across all attempts at negligible extra cost.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 350;

async function usdaFetch(path, params) {
  const apiKey = requireApiKey();
  const qs = new URLSearchParams({ ...params, api_key: apiKey });
  const url = `${BASE_URL}${path}?${qs}`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(url);
    } catch {
      lastError = new ApiError(502, "Could not reach USDA FoodData Central — try again shortly");
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (res.ok) return res.json();

    if (res.status === 401 || res.status === 403) {
      throw new ApiError(502, "USDA FoodData Central rejected the configured API key");
    }
    if (res.status === 429) {
      throw new ApiError(429, "USDA FoodData Central rate limit hit — try again shortly");
    }

    lastError = new ApiError(502, `USDA FoodData Central request failed (${res.status})`);
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }
  throw lastError;
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

// Plain Energy (1008) first; when absent (Foundation records), Atwater Specific Factors
// (2048, food-specific) before Atwater General Factors (2047, generic 4/4/9 approximation);
// null — never 0 — if no energy value exists under any of the three.
function pickCalories(nutrients) {
  const direct = pickNutrient(nutrients, NUTRIENT_IDS.calories);
  if (direct != null) return direct;
  const specific = pickNutrient(nutrients, NUTRIENT_IDS.caloriesAtwaterSpecific);
  if (specific != null) return specific;
  return pickNutrient(nutrients, NUTRIENT_IDS.caloriesAtwaterGeneral);
}

// USDA nutrient amounts are per 100 g for Foundation/SR Legacy/Survey data (the bulk of
// search results) — mapped 1:1 onto this app's existing per-100g Food convention (see
// foods.seed.js). Branded foods carry a separate per-label-serving breakdown we don't use
// here; their per-100g foodNutrients values are still accurate, just not what's on the
// physical label.
function toMacros(foodNutrients) {
  const nutrients = normalizeNutrients(foodNutrients);
  return {
    calories: pickCalories(nutrients),
    protein: pickNutrient(nutrients, NUTRIENT_IDS.protein) ?? 0,
    carbs: pickNutrient(nutrients, NUTRIENT_IDS.carbs) ?? 0,
    fat: pickNutrient(nutrients, NUTRIENT_IDS.fat) ?? 0,
    fiber: pickNutrient(nutrients, NUTRIENT_IDS.fiber) ?? 0,
    sugar: pickNutrient(nutrients, NUTRIENT_IDS.sugar),
    sodium: pickNutrient(nutrients, NUTRIENT_IDS.sodium),
  };
}

// µg form preferred; IU form is a same-field fallback, tagged with which unit was actually
// captured so a value from one never gets displayed/compared as if it were the other.
function pickVitaminWithUnit(nutrients, mcgIds, iuIds) {
  const mcgValue = pickNutrient(nutrients, mcgIds);
  if (mcgValue != null) return { value: mcgValue, unit: "mcg" };
  const iuValue = pickNutrient(nutrients, iuIds);
  if (iuValue != null) return { value: iuValue, unit: "iu" };
  return { value: null, unit: null };
}

// n-6-specific id tried first; generic (non-stereo-labeled) id as a fallback, flagged approx
// since it isn't confirmed to be exclusively the n-6 isomer.
function pickOmega6(nutrients, specificIds, genericIds) {
  const specific = pickNutrient(nutrients, specificIds);
  if (specific != null) return { value: specific, approx: false };
  const generic = pickNutrient(nutrients, genericIds);
  if (generic != null) return { value: generic, approx: true };
  return { value: null, approx: false };
}

// Full micronutrient extraction — used only by getUsdaFoodDetails (post-import detail), not
// by searchUsdaFoods (search preview stays on the cheaper toMacros so result lists don't pay
// for ~44 extra lookups per row). Every field here is null unless USDA actually reports it —
// null is the expected, correct outcome for most foods/fields, not a bug.
function toFullNutrition(foodNutrients) {
  const nutrients = normalizeNutrients(foodNutrients);
  const macros = toMacros(foodNutrients);
  const vitaminA = pickVitaminWithUnit(nutrients, NUTRIENT_IDS.vitaminARae, NUTRIENT_IDS.vitaminAIu);
  const vitaminD = pickVitaminWithUnit(nutrients, NUTRIENT_IDS.vitaminDMcg, NUTRIENT_IDS.vitaminDIu);
  const omega6La = pickOmega6(nutrients, NUTRIENT_IDS.omega6La, NUTRIENT_IDS.omega6LaGeneric);
  const omega6Aa = pickOmega6(nutrients, NUTRIENT_IDS.omega6Aa, NUTRIENT_IDS.omega6AaGeneric);

  return {
    ...macros,

    fiberSoluble: pickNutrient(nutrients, NUTRIENT_IDS.fiberSoluble),
    fiberInsoluble: pickNutrient(nutrients, NUTRIENT_IDS.fiberInsoluble),
    starch: pickNutrient(nutrients, NUTRIENT_IDS.starch),

    fatSaturated: pickNutrient(nutrients, NUTRIENT_IDS.fatSaturated),
    fatMonounsaturated: pickNutrient(nutrients, NUTRIENT_IDS.fatMonounsaturated),
    fatPolyunsaturated: pickNutrient(nutrients, NUTRIENT_IDS.fatPolyunsaturated),
    fatTrans: pickNutrient(nutrients, NUTRIENT_IDS.fatTrans),
    cholesterol: pickNutrient(nutrients, NUTRIENT_IDS.cholesterol),
    omega3Ala: pickNutrient(nutrients, NUTRIENT_IDS.omega3Ala),
    omega3Epa: pickNutrient(nutrients, NUTRIENT_IDS.omega3Epa),
    omega3Dha: pickNutrient(nutrients, NUTRIENT_IDS.omega3Dha),
    omega6La: omega6La.value,
    omega6LaApprox: omega6La.approx,
    omega6Aa: omega6Aa.value,
    omega6AaApprox: omega6Aa.approx,

    aminoCystine: pickNutrient(nutrients, NUTRIENT_IDS.aminoCystine),
    aminoHistidine: pickNutrient(nutrients, NUTRIENT_IDS.aminoHistidine),
    aminoIsoleucine: pickNutrient(nutrients, NUTRIENT_IDS.aminoIsoleucine),
    aminoLeucine: pickNutrient(nutrients, NUTRIENT_IDS.aminoLeucine),
    aminoLysine: pickNutrient(nutrients, NUTRIENT_IDS.aminoLysine),
    aminoMethionine: pickNutrient(nutrients, NUTRIENT_IDS.aminoMethionine),
    aminoPhenylalanine: pickNutrient(nutrients, NUTRIENT_IDS.aminoPhenylalanine),
    aminoThreonine: pickNutrient(nutrients, NUTRIENT_IDS.aminoThreonine),
    aminoTryptophan: pickNutrient(nutrients, NUTRIENT_IDS.aminoTryptophan),
    aminoTyrosine: pickNutrient(nutrients, NUTRIENT_IDS.aminoTyrosine),
    aminoValine: pickNutrient(nutrients, NUTRIENT_IDS.aminoValine),

    vitaminB1: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB1),
    vitaminB2: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB2),
    vitaminB3: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB3),
    vitaminB5: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB5),
    vitaminB6: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB6),
    vitaminB12: pickNutrient(nutrients, NUTRIENT_IDS.vitaminB12),
    folate: pickNutrient(nutrients, NUTRIENT_IDS.folate),
    vitaminK: pickNutrient(nutrients, NUTRIENT_IDS.vitaminK),
    vitaminC: pickNutrient(nutrients, NUTRIENT_IDS.vitaminC),
    vitaminE: pickNutrient(nutrients, NUTRIENT_IDS.vitaminE),
    vitaminA: vitaminA.value,
    vitaminASourceUnit: vitaminA.unit,
    vitaminD: vitaminD.value,
    vitaminDSourceUnit: vitaminD.unit,

    iron: pickNutrient(nutrients, NUTRIENT_IDS.iron),
    calcium: pickNutrient(nutrients, NUTRIENT_IDS.calcium),
    copper: pickNutrient(nutrients, NUTRIENT_IDS.copper),
    magnesium: pickNutrient(nutrients, NUTRIENT_IDS.magnesium),
    manganese: pickNutrient(nutrients, NUTRIENT_IDS.manganese),
    phosphorus: pickNutrient(nutrients, NUTRIENT_IDS.phosphorus),
    potassium: pickNutrient(nutrients, NUTRIENT_IDS.potassium),
    selenium: pickNutrient(nutrients, NUTRIENT_IDS.selenium),
    zinc: pickNutrient(nutrients, NUTRIENT_IDS.zinc),
    // oxalate/phytate intentionally omitted — never extracted from USDA, manual-entry-only.
  };
}

// query -> lightweight matches with a macro preview, so the frontend can show real values
// before a dietitian commits to importing one. Ephemeral — no DB write happens here.
// pageSize defaults to USDA's own max (200) — confirmed live: pageSize=201 gets rejected by USDA
// with a 400, so 200 isn't an arbitrary choice on our side, it's their real ceiling per request.
// Showing more than 200 total matches means paging via pageNumber (also confirmed live: distinct
// pageNumbers return genuinely different fdcIds, and USDA's own totalHits is the true match
// count — there's no secondary hidden cap beyond what totalHits/totalPages already report).
export async function searchUsdaFoods(query, { pageSize = 200, pageNumber = 1 } = {}) {
  const data = await usdaFetch("/foods/search", {
    query,
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
  });
  return {
    results: (data.foods ?? []).map((f) => ({
      fdcId: f.fdcId,
      name: f.description,
      dataType: f.dataType,
      brand: f.brandOwner || f.brandName || undefined,
      macros: toMacros(f.foodNutrients),
    })),
    total: data.totalHits ?? 0,
  };
}

// fdcId -> full detail, mapped straight onto this app's Food fields (minus source/createdBy,
// which the caller sets — this is a pure USDA-shape-to-our-shape mapper, not a persistence
// concern; foods.service.js decides what to do with the result).
export async function getUsdaFoodDetails(fdcId) {
  const f = await usdaFetch(`/food/${fdcId}`, {});
  const nutrition = toFullNutrition(f.foodNutrients);
  return {
    fdcId: f.fdcId,
    name: f.description,
    brand: f.brandOwner || f.brandName || undefined,
    servingSize: 100,
    servingUnit: "g",
    ...nutrition,
  };
}
