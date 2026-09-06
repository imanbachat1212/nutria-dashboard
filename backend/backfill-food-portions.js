// One-time backfill (prompt-45): populates Food.portions — the real, food-specific measure
// descriptions from the complete FNDDS+SR-Legacy dataset (fndds-common-servings-combined.json)
// — for every existing Food document that doesn't have any yet. Reuses matchFoodName exactly as
// createFood/updateFood/importUsdaFood already do (same tier==="match" trust gate, same
// already-reviewed scoring logic — never re-implemented here), so this only ever writes data a
// dietitian would already be trusting via the normal create/import flow. Only touches documents
// with an empty portions array — never overwrites anything, dietitian-entered or otherwise
// (portions itself is never dietitian-editable, but this guard also makes the script safely
// re-runnable).
import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import Food from "./src/modules/foods/food.model.js";
import { matchFoodName } from "./src/lib/foodMatching.js";
import { getPortionsByFoodCode } from "./src/lib/foodPortions.js";

// Names manually reviewed and rejected as wrong matches during the original gramsPerX backfill
// (see apply-food-unit-weights.js) — skipped here too, since a wrong matchFoodName result means
// a wrong foodCode, which means wrong portions, not just a wrong single gram value.
const EXCLUDED_NAMES = new Set([
  "Zaatar mix",
  "Bread, naan",
  "Zucchini (kousa)",
  "OREO CONES, OREO",
  "Halawa light",
  "Quinoa, fat added",
  "Quinoa, no added fat",
  "Carrot juice, 100%",
  "Apple juice, 100%",
  "Watermelon juice, 100%",
  "Bread, multigrain",
  "Cranberry juice, unsweetened",
  "Chicken, breast, meat and skin, raw",
  "Orange Blossom",
  "TOMATO CONCENTRATE",
  "Carrot, dehydrated",
  "Rice cake",
  "Apple cider",
  "Croissant, cheese",
  "Chicken skin",
  "Bread, potato",
  "ZUCCHINI",
  "Walnuts",
  "CHOCOLATE",
  "CHICKEN",
  "Vanilla extract",
  "Lentils, sprouted, raw",
  "Yogurt, Greek, vanilla, lowfat",
  "Lamb, lean, raw",
  "Orange juice, 100%, NFS",
]);

async function main() {
  await connectDB();

  const foods = await Food.find({
    $or: [{ portions: { $exists: false } }, { portions: { $size: 0 } }],
  })
    .select("name portions")
    .lean();

  console.log(`Checking ${foods.length} foods with no portions data yet...`);

  let written = 0;
  let skippedExcluded = 0;
  let skippedNoMatch = 0;
  let skippedNoPortions = 0;

  for (const food of foods) {
    if (EXCLUDED_NAMES.has(food.name)) {
      skippedExcluded++;
      continue;
    }
    const match = matchFoodName(food.name);
    if (match.tier !== "match") {
      skippedNoMatch++;
      continue;
    }
    const portions = getPortionsByFoodCode(match.foodCode);
    if (!portions.length) {
      skippedNoPortions++;
      continue;
    }
    await Food.updateOne({ _id: food._id }, { $set: { portions } });
    written++;
    console.log(`WRITE  ${food.name} -> ${portions.length} portions (${match.matchedDescription})`);
  }

  console.log("\n--- Summary ---");
  console.log(`Checked: ${foods.length}`);
  console.log(`Written: ${written}`);
  console.log(`Skipped (manually excluded, known-bad match): ${skippedExcluded}`);
  console.log(`Skipped (no confident match): ${skippedNoMatch}`);
  console.log(`Skipped (matched but no usable portions in dataset): ${skippedNoPortions}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
