import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";

// One-off data correction (prompt-70) for a single hand-entered food.
//
// The custom "unsalted butter" record was saved with calories: 10, protein: 0, carbs: 0,
// fat: 0 — a data-entry error. Butter is ~717 kcal / 81 g fat per 100 g, so the record was
// understating a recipe's calories by roughly 100 kcal per tablespoon and hiding its fat
// entirely. Nothing referenced it yet (verified across meals, mealplans, mealplantemplates,
// mealplanblocks and journal entries, by both food id and denormalized name), so no existing
// recipe or plan total changes as a result of this.
//
// SOURCE: USDA FoodData Central, SR Legacy, FDC ID 173430 "Butter, without salt", per 100 g.
// That exact record is ALREADY imported into this database, so the corrected values are read
// from it at runtime rather than typed in by hand — a transcription typo is precisely the
// failure mode being fixed here, and this way the numbers provably match the cited source.
//
// Deliberately narrow: only the four macro fields that hold a wrong value are written. The
// nutrient fields that are currently null (sugar, sodium, fatSaturated, cholesterol, vitaminA,
// …) are left null — on this schema null means "not measured", which is honest for a
// hand-entered food, whereas copying the full USDA profile across would turn a correction into
// an unrequested enrichment and would newly qualify the food for FDA nutrient-content claims.
// fiber stays 0, which is already correct for butter.
const TARGET_NAME = "unsalted butter";
const SOURCE_FDC_ID = 173430;
const CITATION = "USDA FoodData Central, SR Legacy 173430 (Butter, without salt)";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const reference = await Food.findOne({ fdcId: SOURCE_FDC_ID }).lean();
  if (!reference) {
    throw new Error(`Reference food fdcId=${SOURCE_FDC_ID} not found — cannot source values.`);
  }

  // source: "custom" guards against ever matching one of the USDA butter records by name.
  const target = await Food.findOne({
    name: new RegExp(`^\\s*${TARGET_NAME}\\s*$`, "i"),
    source: "custom",
  });
  if (!target) {
    console.log(`No custom food named "${TARGET_NAME}" found — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const corrected = {
    calories: reference.calories,
    protein: reference.protein,
    carbs: reference.carbs,
    fat: reference.fat,
    dataSource: CITATION,
  };

  console.log(`Correcting "${target.name}" (${target._id})`);
  console.log(`Source: ${CITATION}\n`);
  for (const [field, value] of Object.entries(corrected)) {
    const before = target[field] ?? "null";
    console.log(`  ${field.padEnd(11)} ${String(before).padStart(6)}  ->  ${value}`);
  }

  target.set(corrected);
  await target.save();

  const after = await Food.findById(target._id).lean();
  console.log(
    `\nVerified stored: ${after.calories} kcal · P${after.protein} C${after.carbs} F${after.fat} Fib${after.fiber} per ${after.servingSize} ${after.servingUnit}`
  );
  console.log(`dataSource: ${after.dataSource}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Correction failed:", err);
  process.exit(1);
});
