// Dietary Reference Intakes (DRI) — RDA/AI values from the National Academies of Medicine
// (Food and Nutrition Board), via NCBI Bookshelf:
//   - Vitamins (A, C, D, E, K, B1, B2, B3, B6, B12, folate, B5): "Dietary Reference Intakes for
//     Calcium and Vitamin D" (2011), National Academies Press — NCBI Bookshelf table NBK56068.
//   - Elements (calcium, iron, magnesium, phosphorus, potassium, sodium, zinc, copper,
//     manganese, selenium): "Dietary Reference Intakes for Sodium and Potassium" (2019),
//     National Academies Press — NCBI Bookshelf table NBK545442.
//
// Field names match the Food model's micronutrient fields 1:1 (food.model.js) so a future
// "consumed vs. target" comparison can look values up by the same key on both sides.
//
// NOT covered here — return no target for these, do not fabricate a value:
//   - Amino acids (all 11): real DRIs exist but are expressed per-kg-bodyweight, not a flat
//     daily value — needs separate bodyweight-dependent calc logic. Future work.
//   - omega3Ala / omega6La (and EPA/DHA/AA): AI values exist in the DRI Macronutrients report
//     but were not sourced in this pass. Future work.
//   - oxalate, phytate: no official DRI exists for either — not essential nutrients with a
//     government-recommended intake. This is permanent, not a gap to fill later.

const VITAMIN_DRI = {
  male: {
    "1-3": { vitaminA: 300, vitaminC: 15, vitaminD: 15, vitaminE: 6, vitaminK: 30, vitaminB1: 0.5, vitaminB2: 0.5, vitaminB3: 6, vitaminB6: 0.5, folate: 150, vitaminB12: 0.9, vitaminB5: 2 },
    "4-8": { vitaminA: 400, vitaminC: 25, vitaminD: 15, vitaminE: 7, vitaminK: 55, vitaminB1: 0.6, vitaminB2: 0.6, vitaminB3: 8, vitaminB6: 0.6, folate: 200, vitaminB12: 1.2, vitaminB5: 3 },
    "9-13": { vitaminA: 600, vitaminC: 45, vitaminD: 15, vitaminE: 11, vitaminK: 60, vitaminB1: 0.9, vitaminB2: 0.9, vitaminB3: 12, vitaminB6: 1.0, folate: 300, vitaminB12: 1.8, vitaminB5: 4 },
    "14-18": { vitaminA: 900, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 75, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "19-30": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "31-50": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "51-70": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "70+": { vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
  },
  female: {
    "1-3": { vitaminA: 300, vitaminC: 15, vitaminD: 15, vitaminE: 6, vitaminK: 30, vitaminB1: 0.5, vitaminB2: 0.5, vitaminB3: 6, vitaminB6: 0.5, folate: 150, vitaminB12: 0.9, vitaminB5: 2 },
    "4-8": { vitaminA: 400, vitaminC: 25, vitaminD: 15, vitaminE: 7, vitaminK: 55, vitaminB1: 0.6, vitaminB2: 0.6, vitaminB3: 8, vitaminB6: 0.6, folate: 200, vitaminB12: 1.2, vitaminB5: 3 },
    "9-13": { vitaminA: 600, vitaminC: 45, vitaminD: 15, vitaminE: 11, vitaminK: 60, vitaminB1: 0.9, vitaminB2: 0.9, vitaminB3: 12, vitaminB6: 1.0, folate: 300, vitaminB12: 1.8, vitaminB5: 4 },
    "14-18": { vitaminA: 700, vitaminC: 65, vitaminD: 15, vitaminE: 15, vitaminK: 75, vitaminB1: 1.0, vitaminB2: 1.0, vitaminB3: 14, vitaminB6: 1.2, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "19-30": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "31-50": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "51-70": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.5, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "70+": { vitaminA: 700, vitaminC: 75, vitaminD: 20, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.5, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
  },
  // Pregnancy/lactation tables only cover 14-18/19-30/31-50 per the source — see getDriTargets
  // for the fallback-to-standard-female behavior outside these bands.
  pregnant: {
    "14-18": { vitaminA: 750, vitaminC: 80, vitaminD: 15, vitaminE: 15, vitaminK: 75, vitaminB1: 1.4, vitaminB2: 1.4, vitaminB3: 18, vitaminB6: 1.9, folate: 600, vitaminB12: 2.6, vitaminB5: 6 },
    "19-30": { vitaminA: 770, vitaminC: 85, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.4, vitaminB2: 1.4, vitaminB3: 18, vitaminB6: 1.9, folate: 600, vitaminB12: 2.6, vitaminB5: 6 },
    "31-50": { vitaminA: 770, vitaminC: 85, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.4, vitaminB2: 1.4, vitaminB3: 18, vitaminB6: 1.9, folate: 600, vitaminB12: 2.6, vitaminB5: 6 },
  },
  lactating: {
    "14-18": { vitaminA: 1200, vitaminC: 115, vitaminD: 15, vitaminE: 19, vitaminK: 75, vitaminB1: 1.4, vitaminB2: 1.6, vitaminB3: 17, vitaminB6: 2.0, folate: 500, vitaminB12: 2.8, vitaminB5: 7 },
    "19-30": { vitaminA: 1300, vitaminC: 120, vitaminD: 15, vitaminE: 19, vitaminK: 90, vitaminB1: 1.4, vitaminB2: 1.6, vitaminB3: 17, vitaminB6: 2.0, folate: 500, vitaminB12: 2.8, vitaminB5: 7 },
    "31-50": { vitaminA: 1300, vitaminC: 120, vitaminD: 15, vitaminE: 19, vitaminK: 90, vitaminB1: 1.4, vitaminB2: 1.6, vitaminB3: 17, vitaminB6: 2.0, folate: 500, vitaminB12: 2.8, vitaminB5: 7 },
  },
};

// Copper is stored here in MILLIGRAMS, unlike the NAM source tables, which list it in mcg
// (700/890/900/1000/1300). Every other element in this table is already mg, and Food.copper
// — and so every consumed/summed copper figure in the app — is mg too (see DAILY_VALUES.copper
// = 0.9 mg in foods/lib/nutrientClaims.js). Leaving the raw mcg numbers here made the DRI
// comparison 1000x too large: 1.82 mg read as 0% of 900 while the same value was 202% of DV.
// Do not "restore" these to the source-table magnitude. Selenium IS mcg on both sides, correctly.
const MINERAL_DRI = {
  male: {
    "1-3": { calcium: 700, iron: 7, magnesium: 80, phosphorus: 460, potassium: 2000, sodium: 800, zinc: 3, copper: 0.34, manganese: 1.2, selenium: 20 },
    "4-8": { calcium: 1000, iron: 10, magnesium: 130, phosphorus: 500, potassium: 2300, sodium: 1000, zinc: 5, copper: 0.44, manganese: 1.5, selenium: 30 },
    "9-13": { calcium: 1300, iron: 8, magnesium: 240, phosphorus: 1250, potassium: 2500, sodium: 1200, zinc: 8, copper: 0.7, manganese: 1.9, selenium: 40 },
    "14-18": { calcium: 1300, iron: 11, magnesium: 410, phosphorus: 1250, potassium: 3000, sodium: 1500, zinc: 11, copper: 0.89, manganese: 2.2, selenium: 55 },
    "19-30": { calcium: 1000, iron: 8, magnesium: 400, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55 },
    "31-50": { calcium: 1000, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55 },
    "51-70": { calcium: 1000, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55 },
    "70+": { calcium: 1200, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55 },
  },
  female: {
    "1-3": { calcium: 700, iron: 7, magnesium: 80, phosphorus: 460, potassium: 2000, sodium: 800, zinc: 3, copper: 0.34, manganese: 1.2, selenium: 20 },
    "4-8": { calcium: 1000, iron: 10, magnesium: 130, phosphorus: 500, potassium: 2300, sodium: 1000, zinc: 5, copper: 0.44, manganese: 1.5, selenium: 30 },
    "9-13": { calcium: 1300, iron: 8, magnesium: 240, phosphorus: 1250, potassium: 2300, sodium: 1200, zinc: 8, copper: 0.7, manganese: 1.6, selenium: 40 },
    "14-18": { calcium: 1300, iron: 15, magnesium: 360, phosphorus: 1250, potassium: 2300, sodium: 1500, zinc: 9, copper: 0.89, manganese: 1.6, selenium: 55 },
    "19-30": { calcium: 1000, iron: 18, magnesium: 310, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 0.9, manganese: 1.8, selenium: 55 },
    "31-50": { calcium: 1000, iron: 18, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 0.9, manganese: 1.8, selenium: 55 },
    "51-70": { calcium: 1200, iron: 8, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 0.9, manganese: 1.8, selenium: 55 },
    "70+": { calcium: 1200, iron: 8, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 0.9, manganese: 1.8, selenium: 55 },
  },
  pregnant: {
    "14-18": { calcium: 1300, iron: 27, magnesium: 400, phosphorus: 1250, potassium: 2600, sodium: 1500, zinc: 12, copper: 1.0, manganese: 2.0, selenium: 60 },
    "19-30": { calcium: 1000, iron: 27, magnesium: 350, phosphorus: 700, potassium: 2900, sodium: 1500, zinc: 11, copper: 1.0, manganese: 2.0, selenium: 60 },
    "31-50": { calcium: 1000, iron: 27, magnesium: 360, phosphorus: 700, potassium: 2900, sodium: 1500, zinc: 11, copper: 1.0, manganese: 2.0, selenium: 60 },
  },
  lactating: {
    "14-18": { calcium: 1300, iron: 10, magnesium: 360, phosphorus: 1250, potassium: 2500, sodium: 1500, zinc: 13, copper: 1.3, manganese: 2.6, selenium: 70 },
    "19-30": { calcium: 1000, iron: 9, magnesium: 310, phosphorus: 700, potassium: 2800, sodium: 1500, zinc: 12, copper: 1.3, manganese: 2.6, selenium: 70 },
    "31-50": { calcium: 1000, iron: 9, magnesium: 320, phosphorus: 700, potassium: 2800, sodium: 1500, zinc: 12, copper: 1.3, manganese: 2.6, selenium: 70 },
  },
};

// Standard bands cover age 1 and up; life-stage tables only cover 14-18/19-30/31-50 (see
// getDriTargets). Ages under 1 (infants) clamp to the "1-3" band — the youngest this app's
// tables go — rather than returning nothing; log a warning since it's outside the sourced
// range. Infant DRIs (0-6mo, 7-12mo) are deliberately NOT modelled: this app tracks age in
// whole years only, and splitting those two bands needs months-level age tracking first.
const AGE_BANDS = [
  { key: "1-3", min: 1, max: 3 },
  { key: "4-8", min: 4, max: 8 },
  { key: "9-13", min: 9, max: 13 },
  { key: "14-18", min: 14, max: 18 },
  { key: "19-30", min: 19, max: 30 },
  { key: "31-50", min: 31, max: 50 },
  // IOM/NAM source tables list this band as "51-70 y" and the next as "> 70 y" — i.e. age 70
  // itself belongs to 51-70, and 70+ means strictly 71 and up.
  { key: "51-70", min: 51, max: 70 },
  { key: "70+", min: 71, max: Infinity },
];

export function getAgeBand(age) {
  if (age < AGE_BANDS[0].min) {
    const youngest = AGE_BANDS[0].key;
    console.warn(`[dri] age ${age} is below the youngest sourced DRI band (${youngest}) — clamping.`);
    return youngest;
  }
  const band = AGE_BANDS.find((b) => age >= b.min && age <= b.max);
  return band ? band.key : "70+";
}

// { age, sex: "male"|"female", lifeStage?: "none"|"pregnant"|"lactating" } -> flat object of
// every DRI-covered vitamin/mineral field (Food-model field names), or null if age/sex are
// missing. Amino acids, omega-3/6, oxalate, and phytate are never included in the result —
// callers should treat a missing key as "no DRI target set", not coerce it to 0.
export function getDriTargets({ age, sex, lifeStage = "none" }) {
  if (age == null || Number.isNaN(age) || age < 0 || (sex !== "male" && sex !== "female"))
    return null;

  const ageBand = getAgeBand(age);
  const wantsLifeStage = sex === "female" && (lifeStage === "pregnant" || lifeStage === "lactating");

  let table = sex;
  if (wantsLifeStage) {
    if (VITAMIN_DRI[lifeStage][ageBand]) {
      table = lifeStage;
    } else {
      console.warn(
        `[dri] No ${lifeStage} DRI data for age band ${ageBand} (age ${age}) — the source ` +
          `tables only cover 14-18/19-30/31-50 for pregnancy/lactation. Falling back to ` +
          `standard female values for this band.`,
      );
      table = "female";
    }
  }

  const vitamins = VITAMIN_DRI[table][ageBand];
  const minerals = MINERAL_DRI[table][ageBand];
  if (!vitamins || !minerals) return null; // should be unreachable given AGE_BANDS coverage

  return { ...vitamins, ...minerals };
}
