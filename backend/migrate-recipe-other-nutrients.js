import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Meal from "./src/modules/meals/meal.model.js";
import { OTHER_NUTRIENT_FIELDS } from "./src/modules/foods/food.model.js";
import { microTotalKey } from "./src/lib/calc/recipeMacros.js";
import { computeRecipeOtherNutrients } from "./src/lib/calc/nutrientContributions.js";

// One-time backfill of Meal's "Other"-group totals — totalOxalate (prompt-99) and totalPhytate
// (prompt-100) — for existing recipes, so the Meal Library can filter on them without
// recomputing per request. New and edited recipes get them at write time (createMeal /
// updateMeal).
//
// Touches only those fields, and only the ones OTHER_NUTRIENT_FIELDS names — adding a third
// "Other" nutrient there makes this script cover it with no edit. Nothing here is a nutrient
// claim or a DRI target: these nutrients have neither, which is exactly why they aren't in
// recipeMacros.js's MICRO_FIELDS.
//
// null vs 0 is preserved end to end and tracked per nutrient: null means no ingredient in the
// recipe reports that one, 0 means at least one does and the sum is genuinely zero.
// Re-runnable: it recomputes from ingredients every time.
async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const meals = await Meal.find({}).select("name servings ingredients").lean();
  console.log(`Scanning ${meals.length} recipe(s) for: ${OTHER_NUTRIENT_FIELDS.join(", ")}\n`);

  const ops = [];
  const withValue = {};
  const nulled = {};
  const found = [];

  for (const m of meals) {
    const totals = await computeRecipeOtherNutrients(m.ingredients);
    let any = false;
    for (const field of OTHER_NUTRIENT_FIELDS) {
      const v = totals[microTotalKey(field)];
      if (v == null) nulled[field] = (nulled[field] || 0) + 1;
      else {
        withValue[field] = (withValue[field] || 0) + 1;
        any = true;
      }
    }
    if (any) found.push({ name: m.name, servings: m.servings || 1, totals });
    ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: totals } } });
  }

  for (let i = 0; i < ops.length; i += 500) {
    await Meal.bulkWrite(ops.slice(i, i + 500));
    process.stdout.write(`\r  writing: ${Math.min(i + 500, ops.length)}/${ops.length}   `);
  }

  console.log("\n");
  for (const field of OTHER_NUTRIENT_FIELDS) {
    console.log(
      `  ${field.padEnd(9)} recipes with a value: ${withValue[field] || 0}   ` +
        `set to null (no ingredient reports it): ${nulled[field] || 0}`,
    );
  }

  if (found.length) {
    console.log("\nRecipes carrying an 'Other' nutrient (whole recipe / per serving, mg):");
    const head = OTHER_NUTRIENT_FIELDS.map((f) => f.padStart(20)).join("");
    console.log(`  ${"".padEnd(38)}${head}`);
    for (const f of found) {
      const cells = OTHER_NUTRIENT_FIELDS.map((field) => {
        const v = f.totals[microTotalKey(field)];
        if (v == null) return "null".padStart(20);
        return `${v} / ${Math.round((v / f.servings) * 100) / 100}`.padStart(20);
      }).join("");
      console.log(`  ${f.name.slice(0, 36).padEnd(38)}${cells}`);
    }
  } else {
    console.log(
      "\nNo recipe carries oxalate or phytate yet — no food in the library has either value\n" +
        "entered. Enter one on a food (New/Edit Food -> Micronutrients -> Other) and re-run.",
    );
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
