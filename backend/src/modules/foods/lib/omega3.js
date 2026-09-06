import { pickServingGrams } from "./nutrientClaims.js";

// EPA+DHA per the food's typical real serving, in mg (prompt-66 display, prompt-67 stored field).
//
// Deliberately kept OUT of nutrientClaims.js and out of its vocabulary. FDA has established no
// Daily Value for omega-3 and its final rule specifically prohibits "high in"/"rich in"/
// "excellent source of" claims for EPA/DHA, so this is a plain measured quantity — no tier, no
// percentage, no claim language — and must never be presented like the FDA %DV badges.
//
// The serving basis is imported from nutrientClaims.js rather than reimplemented, so the number
// stored here can never drift from the serving the FDA claims are computed against (the first
// stored portion, in USDA's own ordering).
//
// Why EPA+DHA specifically, and not the "total omega-3" shown elsewhere in the drawer: that
// figure also includes ALA (the plant-source omega-3), which is a different nutritional story.
// This field is the marine long-chain fraction only.
//
// Returns null — never 0 — when the food has no serving basis, or when EPA/DHA are absent or
// measured as zero. USDA genuinely distinguishes "not measured" (null) from "measured zero", but
// both mean "nothing worth showing or filtering on" here.
export function computeEpaDhaPerServingMg(food) {
  const servingGrams = pickServingGrams(food);
  if (!servingGrams) return null;

  // Both stored in g per 100 g (USDA ids 1278 EPA / 1272 DHA), so they're directly summable.
  const gPer100g = (food.omega3Epa || 0) + (food.omega3Dha || 0);
  if (!(gPer100g > 0)) return null;

  const mg = Math.round(gPer100g * (servingGrams / 100) * 1000);
  return mg > 0 ? mg : null;
}
