import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { computeNutrientClaims, pickServingGrams } from "./src/modules/foods/lib/nutrientClaims.js";

// One-time backfill (prompt-65) of FDA %DV nutrient content claims onto every existing food.
// New foods get these at write time (createFood / importUsdaFood); this covers the library as
// it stands today. Touches only `nutrientClaims` — no macro, micro, portion or name data is
// modified, and nothing here feeds back into any calorie/macro calculation.
//
// Foods with no portions have no serving basis, so they get an empty claim list rather than a
// fabricated 100g-based one: no basis, no claim.
async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const foods = await Food.find({}).lean();
  console.log(`Scanning ${foods.length} food(s)\n`);

  const bySource = {};
  const byNutrient = {};
  let tagged = 0;
  let totalClaims = 0;
  let noServingBasis = 0;
  const ops = [];

  for (const f of foods) {
    const key = f.source === "usda" ? `usda / ${f.usdaDataType || "(no dataType)"}` : f.source;
    bySource[key] ??= { n: 0, tagged: 0, noBasis: 0, claims: 0 };
    bySource[key].n++;

    const hasBasis = pickServingGrams(f) != null;
    const claims = hasBasis ? computeNutrientClaims(f) : [];

    if (!hasBasis) {
      noServingBasis++;
      bySource[key].noBasis++;
    }
    if (claims.length) {
      tagged++;
      totalClaims += claims.length;
      bySource[key].tagged++;
      bySource[key].claims += claims.length;
      for (const c of claims) {
        byNutrient[c.nutrient] ??= { high: 0, good: 0 };
        byNutrient[c.nutrient][c.level]++;
      }
    }
    ops.push({ updateOne: { filter: { _id: f._id }, update: { $set: { nutrientClaims: claims } } } });
  }

  for (let i = 0; i < ops.length; i += 500) {
    await Food.bulkWrite(ops.slice(i, i + 500));
    process.stdout.write(`\r  writing: ${Math.min(i + 500, ops.length)}/${ops.length}   `);
  }

  console.log(`\n\n=== coverage by source ===`);
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1].n - a[1].n)) {
    console.log(
      `  ${k.padEnd(26)} n=${String(v.n).padStart(5)}  tagged=${String(v.tagged).padStart(5)}  ` +
      `excluded(no serving basis)=${String(v.noBasis).padStart(5)}  claims=${v.claims}`,
    );
  }

  console.log(`\n=== claims per nutrient (high / good) ===`);
  for (const [n, v] of Object.entries(byNutrient).sort((a, b) => (b[1].high + b[1].good) - (a[1].high + a[1].good)))
    console.log(`  ${n.padEnd(12)} high=${String(v.high).padStart(4)}  good=${String(v.good).padStart(4)}`);

  console.log(`\nFoods with >=1 claim: ${tagged}/${foods.length}   total claims: ${totalClaims}`);
  console.log(`Excluded for having no portions/serving basis: ${noServingBasis}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
