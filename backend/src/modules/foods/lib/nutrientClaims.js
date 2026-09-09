// FDA %DV-based nutrient content claims ("High Source" / "Good Source") for vitamins, minerals
// and fiber (prompt-65). Derived, read-only classification — it reads existing stored nutrition
// values and never modifies or feeds back into any macro/calorie calculation.
//
// ── Thresholds ────────────────────────────────────────────────────────────────────────────────
// 21 CFR 101.54 (verified against the regulation, and matching Sura's own reference table):
//   "high" / "rich in" / "excellent source of" : >= 20% of the RDI/DRV per serving
//   "good source" / "contains" / "provides"    : 10% to 19% of the RDI/DRV per serving
// Values of 6-9% deliberately get NO tag — the regulation leaves that band undefined, so
// inventing a label for it would be asserting something FDA doesn't. "Low" (<=5%) likewise gets
// no badge; a food simply ends up with zero qualifying tags.
export const CLAIM_HIGH = "high";
export const CLAIM_GOOD = "good";
export const HIGH_MIN_PCT = 20;
export const GOOD_MIN_PCT = 10;

// ── Daily Values ──────────────────────────────────────────────────────────────────────────────
// Source: FDA, "Daily Value on the Nutrition and Supplement Facts Labels"
// https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
// Adults and children 4+ years. Values transcribed verbatim from that table, NOT from memory.
//
// `unit` documents the unit the DV is expressed in, so a stored value in a different unit is
// never silently compared against it (see vitaminA/vitaminD handling in computeNutrientClaims).
// Only nutrients this app actually stores per food appear here; FDA also publishes DVs for
// biotin (30 mcg), choline (550 mg), iodine (150 mcg), chromium (35 mcg), molybdenum (45 mcg)
// and chloride (2300 mg), but no food record in this database carries those fields, so they
// cannot be tagged.
//
// Sodium (DV 2300 mg) is deliberately EXCLUDED. It has a DV, but "high source of sodium" is not
// a claim anyone makes — sodium claims run the other way ("low sodium"), and badging a food as
// high-sodium alongside genuinely positive claims would read as a recommendation to a dietitian.
export const DAILY_VALUES = {
  // Vitamins
  vitaminA: { dv: 900, unit: "mcg RAE", label: "Vitamin A" },
  vitaminC: { dv: 90, unit: "mg", label: "Vitamin C" },
  vitaminD: { dv: 20, unit: "mcg", label: "Vitamin D" },
  vitaminE: { dv: 15, unit: "mg alpha-tocopherol", label: "Vitamin E" },
  vitaminK: { dv: 120, unit: "mcg", label: "Vitamin K" },
  vitaminB1: { dv: 1.2, unit: "mg", label: "Thiamin (B1)" },
  vitaminB2: { dv: 1.3, unit: "mg", label: "Riboflavin (B2)" },
  vitaminB3: { dv: 16, unit: "mg NE", label: "Niacin (B3)" },
  vitaminB5: { dv: 5, unit: "mg", label: "Pantothenic acid (B5)" },
  vitaminB6: { dv: 1.7, unit: "mg", label: "Vitamin B6" },
  vitaminB12: { dv: 2.4, unit: "mcg", label: "Vitamin B12" },
  // CAVEAT: FDA's DV is expressed in mcg DFE (dietary folate equivalents). USDA nutrient 1177,
  // which is what this app stores, is "Folate, total" in plain mcg. For naturally-occurring
  // folate the two coincide; for foods fortified with folic acid, DFE is higher than total mcg,
  // so this ratio UNDER-states %DV there. Under-tagging is the safe direction for a claim, so
  // the plain value is used as-is rather than applying a conversion the source data can't support.
  folate: { dv: 400, unit: "mcg DFE", label: "Folate" },

  // Minerals
  calcium: { dv: 1300, unit: "mg", label: "Calcium" },
  iron: { dv: 18, unit: "mg", label: "Iron" },
  magnesium: { dv: 420, unit: "mg", label: "Magnesium" },
  phosphorus: { dv: 1250, unit: "mg", label: "Phosphorus" },
  potassium: { dv: 4700, unit: "mg", label: "Potassium" },
  zinc: { dv: 11, unit: "mg", label: "Zinc" },
  copper: { dv: 0.9, unit: "mg", label: "Copper" },
  manganese: { dv: 2.3, unit: "mg", label: "Manganese" },
  selenium: { dv: 55, unit: "mcg", label: "Selenium" },

  // Fiber
  fiber: { dv: 28, unit: "g", label: "Fiber" },
};

export const CLAIMABLE_NUTRIENTS = Object.keys(DAILY_VALUES);

// ── Serving basis ─────────────────────────────────────────────────────────────────────────────
// %DV is computed against the food's typical real serving, not a flat 100g — matching how real
// nutrient content claims work (FDA uses a per-category RACC, which this dataset doesn't carry).
//
// The serving is the FIRST usable portion in the food's stored `portions` array, which preserves
// USDA's own ordering from its "Portions and Weights" release (see lib/foodPortions.js). That's
// deterministic and traceable to the source rather than invented. Where USDA happens to list a
// small descriptor first (e.g. tomato's "1 slice" = 20g), the resulting %DV is conservative —
// it can under-tag, but it won't assert a claim the food doesn't earn, which is the right
// direction to err for something a dietitian will repeat to a client.
//
// Foods with NO portions get no serving basis and are excluded from tagging entirely (null),
// never silently defaulted to 100g — a fabricated basis would produce fabricated claims.
export function pickServingGrams(food) {
  const first = (food.portions ?? []).find((p) => p && p.grams > 0);
  return first ? first.grams : null;
}

// Stored nutrition values are per 100 g (see food.model.js / usda-client.js).
function perServing(per100g, servingGrams) {
  return (per100g * servingGrams) / 100;
}

export function classifyPct(pct) {
  if (pct >= HIGH_MIN_PCT) return CLAIM_HIGH;
  if (pct >= GOOD_MIN_PCT) return CLAIM_GOOD;
  return null;
}

// %DV + High/Good Source for an ALREADY-PER-SERVING nutrient map (prompt-82) — a recipe's
// per-serving totals, where computeNutrientClaims below can't be used.
//
// What is shared with the food path, and what deliberately isn't:
//   - SHARED: DAILY_VALUES, HIGH_MIN_PCT/GOOD_MIN_PCT and classifyPct — the FDA table and the
//     threshold comparison. There is exactly one copy of those numbers in this codebase and
//     both foods and recipes read it.
//   - NOT shared: how a "serving" is arrived at. computeNutrientClaims derives it from
//     pickServingGrams(food) — the food's first stored USDA portion — and scales per-100g
//     values through it. A recipe has no gram portion; its serving is totalX / servings, an
//     absolute amount that needs no scaling at all. That step is genuinely food-record-specific,
//     which is why this takes the finished per-serving values instead of a document.
//
// Returns one row per claimable nutrient the caller supplied a value for, in DAILY_VALUES order,
// each carrying enough to render a full panel: the value, its unit, %DV, and the claim level
// (null below 10% DV — the regulation defines nothing there, so neither does this).
//
// vitaminA/vitaminD in IU rather than mcg are skipped by the caller, not here — this function
// has no food record to read a source-unit tag from.
export function classifyPerServing(perServingValues) {
  const rows = [];
  for (const [nutrient, { dv, unit, label }] of Object.entries(DAILY_VALUES)) {
    const value = perServingValues?.[nutrient];
    if (value == null) continue;
    const pct = (value / dv) * 100;
    rows.push({
      nutrient,
      label,
      unit,
      value: Math.round(value * 100) / 100,
      pct: Math.round(pct),
      level: classifyPct(pct),
    });
  }
  return rows;
}

// food -> [{ nutrient, level, pct }] for every nutrient qualifying as High/Good Source.
// Returns [] when the food has no usable serving basis or no qualifying nutrient.
export function computeNutrientClaims(food) {
  const servingGrams = pickServingGrams(food);
  if (!servingGrams) return [];

  const claims = [];
  for (const [nutrient, { dv }] of Object.entries(DAILY_VALUES)) {
    const value = food[nutrient];
    if (value == null || !(value > 0)) continue;

    // Vitamin A and D are stored in whichever unit USDA reported (mcg or IU — see
    // vitaminASourceUnit/vitaminDSourceUnit). The DV is in mcg, and IU->mcg depends on the
    // specific vitamer, so an IU-based record is skipped rather than converted on a guess.
    if (nutrient === "vitaminA" && food.vitaminASourceUnit === "iu") continue;
    if (nutrient === "vitaminD" && food.vitaminDSourceUnit === "iu") continue;

    const pct = (perServing(value, servingGrams) / dv) * 100;
    const level = classifyPct(pct);
    if (level) claims.push({ nutrient, level, pct: Math.round(pct) });
  }
  return claims;
}
