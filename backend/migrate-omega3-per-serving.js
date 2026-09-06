import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { computeEpaDhaPerServingMg } from "./src/modules/foods/lib/omega3.js";

// One-time backfill (prompt-67) of omega3EpaDhaPerServingMg for existing foods, so the Food
// Database can filter on it via an index rather than recomputing per request. New foods get it
// at write time (createFood / importUsdaFood).
//
// Touches only that one field. Nothing here is a nutrient claim: no tier, no %DV, no
// "high/good source" language — FDA prohibits omega-3 content claims of that kind.
async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const foods = await Food.find({})
    .select("name source usdaDataType portions omega3Epa omega3Dha")
    .lean();
  console.log(`Scanning ${foods.length} food(s)\n`);

  const ops = [];
  let withValue = 0;
  let nulled = 0;
  const bySource = {};
  const buckets = { "1-99": 0, "100-199": 0, "200-499": 0, "500+": 0 };

  for (const f of foods) {
    const mg = computeEpaDhaPerServingMg(f);
    if (mg == null) {
      nulled++;
    } else {
      withValue++;
      const key = f.source === "usda" ? `usda / ${f.usdaDataType || "-"}` : f.source;
      bySource[key] = (bySource[key] || 0) + 1;
      if (mg >= 500) buckets["500+"]++;
      else if (mg >= 200) buckets["200-499"]++;
      else if (mg >= 100) buckets["100-199"]++;
      else buckets["1-99"]++;
    }
    ops.push({ updateOne: { filter: { _id: f._id }, update: { $set: { omega3EpaDhaPerServingMg: mg } } } });
  }

  for (let i = 0; i < ops.length; i += 500) {
    await Food.bulkWrite(ops.slice(i, i + 500));
    process.stdout.write(`\r  writing: ${Math.min(i + 500, ops.length)}/${ops.length}   `);
  }

  console.log(`\n\nFoods with a value: ${withValue}   set to null (no serving basis / no measured EPA-DHA): ${nulled}`);
  console.log("\nBy source:");
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log("\nDistribution (mg EPA+DHA per serving):");
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(10)} ${v}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
