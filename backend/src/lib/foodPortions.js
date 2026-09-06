// Looks up a food's REAL, food-specific measure descriptions (e.g. "1 pitted date" -> 7.1g,
// "1 stick" -> 113g for butter) by USDA foodCode, from the complete combined FNDDS + SR-Legacy
// portions dataset. Distinct from foodMatching.js: that file owns the fuzzy name-matching
// algorithm and derives only 5 generic gramsPerX fields from it (cup/tbsp/tsp/piece/ml) — this
// file does the separate, additive job of fetching a matched food's FULL raw portion list once
// its foodCode is already known (foodMatching.js's matchFoodName already returns foodCode on a
// tier==="match"/"low-confidence" result), so the two never duplicate the matching logic itself.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The complete, corrected dataset (13,188 foods: 5,395 FNDDS — every food in USDA's official
// 2021-2023 "Portions and Weights" release — plus 7,793 SR-Legacy), NOT the older
// fndds-common-servings.json foodMatching.js reads (that file only had 3,413 of the 5,395 real
// FNDDS foods; this one closes that gap). Never written to.
const COMBINED_PATH = path.join(__dirname, "../data/fndds-common-servings-combined.json");

// A bare "Quantity not specified" row (always grams: 0 in this dataset) carries no usable
// measure — excluded, along with any other non-positive-gram row, so the picker never offers a
// selectable option that would silently resolve to a 0g/negative item.
function isUsablePortion(p) {
  return p.grams > 0 && p.description.trim().toLowerCase() !== "quantity not specified";
}

let indexed = null;
function loadIndex() {
  if (!indexed) {
    const raw = JSON.parse(fs.readFileSync(COMBINED_PATH, "utf8"));
    indexed = new Map(raw.map((f) => [f.foodCode, f]));
  }
  return indexed;
}

// Returns [{ description, grams }] for the given foodCode, filtered to usable rows only —
// or [] if the code isn't in the dataset (shouldn't happen for a foodCode that itself came
// from matching against this same combined file, but defensive regardless).
export function getPortionsByFoodCode(foodCode) {
  if (foodCode == null) return [];
  const entry = loadIndex().get(foodCode);
  if (!entry) return [];
  return entry.portions
    .filter(isUsablePortion)
    .map((p) => ({ description: p.description, grams: p.grams }));
}
