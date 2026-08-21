// Client-side mirror of backend/src/lib/calc/dri.js — same pattern as the activity-level/BMR
// duplication already in clients-api.ts ("mirrors backend calc/targets.js"). Used only for the
// New Client dialog's live preview before the client exists server-side; the backend's copy is
// authoritative and is what actually gets saved via computeDriTargetsIfEligible. Source: National
// Academies of Medicine DRI tables — see the backend file for exact citations.
import type { DriTargets, LifeStage } from "./clients-mock";

type AgeBand = "9-13" | "14-18" | "19-30" | "31-50" | "51-70" | "70+";
type NutrientTable = Record<string, number>;

const VITAMIN_DRI: Record<string, Partial<Record<AgeBand, NutrientTable>>> = {
  male: {
    "9-13": { vitaminA: 600, vitaminC: 45, vitaminD: 15, vitaminE: 11, vitaminK: 60, vitaminB1: 0.9, vitaminB2: 0.9, vitaminB3: 12, vitaminB6: 1.0, folate: 300, vitaminB12: 1.8, vitaminB5: 4 },
    "14-18": { vitaminA: 900, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 75, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "19-30": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "31-50": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "51-70": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "70+": { vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, vitaminB1: 1.2, vitaminB2: 1.3, vitaminB3: 16, vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
  },
  female: {
    "9-13": { vitaminA: 600, vitaminC: 45, vitaminD: 15, vitaminE: 11, vitaminK: 60, vitaminB1: 0.9, vitaminB2: 0.9, vitaminB3: 12, vitaminB6: 1.0, folate: 300, vitaminB12: 1.8, vitaminB5: 4 },
    "14-18": { vitaminA: 700, vitaminC: 65, vitaminD: 15, vitaminE: 15, vitaminK: 75, vitaminB1: 1.0, vitaminB2: 1.0, vitaminB3: 14, vitaminB6: 1.2, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "19-30": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "31-50": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.3, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "51-70": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.5, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
    "70+": { vitaminA: 700, vitaminC: 75, vitaminD: 20, vitaminE: 15, vitaminK: 90, vitaminB1: 1.1, vitaminB2: 1.1, vitaminB3: 14, vitaminB6: 1.5, folate: 400, vitaminB12: 2.4, vitaminB5: 5 },
  },
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

const MINERAL_DRI: Record<string, Partial<Record<AgeBand, NutrientTable>>> = {
  male: {
    "9-13": { calcium: 1300, iron: 8, magnesium: 240, phosphorus: 1250, potassium: 2500, sodium: 1200, zinc: 8, copper: 700, manganese: 1.9, selenium: 40 },
    "14-18": { calcium: 1300, iron: 11, magnesium: 410, phosphorus: 1250, potassium: 3000, sodium: 1500, zinc: 11, copper: 890, manganese: 2.2, selenium: 55 },
    "19-30": { calcium: 1000, iron: 8, magnesium: 400, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 900, manganese: 2.3, selenium: 55 },
    "31-50": { calcium: 1000, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 900, manganese: 2.3, selenium: 55 },
    "51-70": { calcium: 1000, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 900, manganese: 2.3, selenium: 55 },
    "70+": { calcium: 1200, iron: 8, magnesium: 420, phosphorus: 700, potassium: 3400, sodium: 1500, zinc: 11, copper: 900, manganese: 2.3, selenium: 55 },
  },
  female: {
    "9-13": { calcium: 1300, iron: 8, magnesium: 240, phosphorus: 1250, potassium: 2300, sodium: 1200, zinc: 8, copper: 700, manganese: 1.6, selenium: 40 },
    "14-18": { calcium: 1300, iron: 15, magnesium: 360, phosphorus: 1250, potassium: 2300, sodium: 1500, zinc: 9, copper: 890, manganese: 1.6, selenium: 55 },
    "19-30": { calcium: 1000, iron: 18, magnesium: 310, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 900, manganese: 1.8, selenium: 55 },
    "31-50": { calcium: 1000, iron: 18, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 900, manganese: 1.8, selenium: 55 },
    "51-70": { calcium: 1200, iron: 8, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 900, manganese: 1.8, selenium: 55 },
    "70+": { calcium: 1200, iron: 8, magnesium: 320, phosphorus: 700, potassium: 2600, sodium: 1500, zinc: 8, copper: 900, manganese: 1.8, selenium: 55 },
  },
  pregnant: {
    "14-18": { calcium: 1300, iron: 27, magnesium: 400, phosphorus: 1250, potassium: 2600, sodium: 1500, zinc: 12, copper: 1000, manganese: 2.0, selenium: 60 },
    "19-30": { calcium: 1000, iron: 27, magnesium: 350, phosphorus: 700, potassium: 2900, sodium: 1500, zinc: 11, copper: 1000, manganese: 2.0, selenium: 60 },
    "31-50": { calcium: 1000, iron: 27, magnesium: 360, phosphorus: 700, potassium: 2900, sodium: 1500, zinc: 11, copper: 1000, manganese: 2.0, selenium: 60 },
  },
  lactating: {
    "14-18": { calcium: 1300, iron: 10, magnesium: 360, phosphorus: 1250, potassium: 2500, sodium: 1500, zinc: 13, copper: 1300, manganese: 2.6, selenium: 70 },
    "19-30": { calcium: 1000, iron: 9, magnesium: 310, phosphorus: 700, potassium: 2800, sodium: 1500, zinc: 12, copper: 1300, manganese: 2.6, selenium: 70 },
    "31-50": { calcium: 1000, iron: 9, magnesium: 320, phosphorus: 700, potassium: 2800, sodium: 1500, zinc: 12, copper: 1300, manganese: 2.6, selenium: 70 },
  },
};

const AGE_BANDS: { key: AgeBand; min: number; max: number }[] = [
  { key: "9-13", min: 9, max: 13 },
  { key: "14-18", min: 14, max: 18 },
  { key: "19-30", min: 19, max: 30 },
  { key: "31-50", min: 31, max: 50 },
  { key: "51-70", min: 51, max: 70 },
  { key: "70+", min: 71, max: Infinity },
];

function getAgeBand(age: number): AgeBand {
  if (age < AGE_BANDS[0].min) return "9-13";
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.key ?? "70+";
}

export function getDriTargets(
  age: number,
  sex: "male" | "female",
  lifeStage: LifeStage = "none",
): DriTargets | null {
  if (!age || age <= 0) return null;

  const ageBand = getAgeBand(age);
  const wantsLifeStage = sex === "female" && (lifeStage === "pregnant" || lifeStage === "lactating");

  let table = sex as string;
  if (wantsLifeStage && VITAMIN_DRI[lifeStage]?.[ageBand]) {
    table = lifeStage;
  }

  const vitamins = VITAMIN_DRI[table]?.[ageBand];
  const minerals = MINERAL_DRI[table]?.[ageBand];
  if (!vitamins || !minerals) return null;

  return { method: "auto", ...vitamins, ...minerals } as DriTargets;
}
