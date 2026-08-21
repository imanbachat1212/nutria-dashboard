import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Meal from "./src/modules/meals/meal.model.js";
import { computeRecipeMacros } from "./src/lib/calc/recipeMacros.js";

async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const meals = await Meal.find({}).lean();
  console.log(`Found ${meals.length} recipe(s) to recompute`);

  let updated = 0;
  for (const meal of meals) {
    if (!meal.ingredients?.length) continue;
    const macros = await computeRecipeMacros(meal.ingredients);
    await Meal.updateOne({ _id: meal._id }, { $set: macros });
    console.log(`  ${meal.name}: totalVitaminC=${macros.totalVitaminC} totalCalcium=${macros.totalCalcium} totalIron=${macros.totalIron}`);
    updated++;
  }

  console.log(`Migration complete — recomputed ${updated} recipe(s)`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
