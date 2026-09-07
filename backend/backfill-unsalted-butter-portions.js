import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { computeNutrientClaims, pickServingGrams } from "./src/modules/foods/lib/nutrientClaims.js";
import { computeEpaDhaPerServingMg } from "./src/modules/foods/lib/omega3.js";

// Third and final step for this one hand-entered food (prompt-70 fixed its four wrong macros,
// prompt-72 backfilled the rest of its nutrient profile, prompt-74 gives it real portions).
//
// SOURCE: USDA FoodData Central, SR Legacy, FDC ID 173430 "Butter, without salt" — the same
// record cited and read from in both previous steps, already imported into this database. The
// portions array is copied from it at runtime, never hand-typed.
//
// ── Ordering is load-bearing, so it is preserved exactly ──────────────────────────────────────
// nutrientClaims.js's pickServingGrams() takes the FIRST usable portion, deliberately relying on
// USDA's own ordering from its "Portions and Weights" release as a basis that is deterministic
// and traceable to the source rather than invented. So this copies the list verbatim, in order.
//
// That means the resulting claim basis is "1 pat" (5 g), not the "1 tbsp" (14.2 g) a dietitian
// might expect — and at 5 g butter earns NO nutrient content tag. Reordering the array to put a
// larger portion first would manufacture a tag by choosing the basis that produces it, which is
// exactly the fabrication prompt-65's rule exists to prevent. The reference record 173430 is in
// the identical position and likewise carries no claims; this food is now treated the same way
// every other food in the database is, which is what "tag-eligible like any other food" means.
const TARGET_ID = "6a92ea144b0e179995114ff6";
const SOURCE_FDC_ID = 173430;

async function run() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const reference = await Food.findOne({ fdcId: SOURCE_FDC_ID }).lean();
  if (!reference) throw new Error(`Reference food fdcId=${SOURCE_FDC_ID} not found.`);
  if (!reference.portions?.length) throw new Error(`Reference food has no portions to copy.`);

  const target = await Food.findById(TARGET_ID);
  if (!target) throw new Error(`Target food ${TARGET_ID} not found.`);
  if (target.source !== "custom") throw new Error(`Refusing: "${target.name}" is not a custom food.`);

  const before = {
    portions: JSON.parse(JSON.stringify(target.portions ?? [])),
    claims: JSON.parse(JSON.stringify(target.nutrientClaims ?? [])),
    epaDha: target.omega3EpaDhaPerServingMg ?? null,
    basis: pickServingGrams(target),
  };

  console.log(`Adding portions to "${target.name}" (${target._id})`);
  console.log(`Source: USDA FoodData Central, SR Legacy ${SOURCE_FDC_ID} (${reference.name})\n`);
  console.log(`  before: portions = ${JSON.stringify(before.portions)}  -> serving basis ${before.basis}`);

  // Only the two schema-declared fields are carried across (portions has _id: false), so a lean
  // read of the source can't smuggle any extra key into the target's subdocuments.
  target.portions = reference.portions.map((p) => ({ description: p.description, grams: p.grams }));

  // Recomputed from the updated record; whatever these return is what gets stored. No filtering,
  // no preferred-portion override, no floor.
  target.nutrientClaims = computeNutrientClaims(target);
  target.omega3EpaDhaPerServingMg = computeEpaDhaPerServingMg(target);

  await target.save();

  const after = await Food.findById(TARGET_ID).lean();
  console.log(`  after:`);
  after.portions.forEach((p, i) =>
    console.log(`    [${i}] ${JSON.stringify(p)}${i === 0 ? "   <- serving basis (first usable portion)" : ""}`)
  );
  console.log(`\n=== derived fields (recomputed, unfiltered) ===`);
  console.log(`  serving basis            ${before.basis} -> ${pickServingGrams(after)} g`);
  console.log(`  nutrientClaims           ${JSON.stringify(before.claims)} -> ${JSON.stringify(after.nutrientClaims)}`);
  console.log(`  omega3EpaDhaPerServingMg ${before.epaDha} -> ${after.omega3EpaDhaPerServingMg}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Portion backfill failed:", err);
  process.exit(1);
});
