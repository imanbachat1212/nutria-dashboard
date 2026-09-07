import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { computeNutrientClaims } from "./src/modules/foods/lib/nutrientClaims.js";
import { computeEpaDhaPerServingMg } from "./src/modules/foods/lib/omega3.js";

// Follow-up to fix-unsalted-butter-macros.js (prompt-70 corrected the four wrong macros and
// deliberately left the rest null; prompt-72 is the decision to fill the rest in).
//
// SOURCE: USDA FoodData Central, SR Legacy, FDC ID 173430 "Butter, without salt", per 100 g —
// the same record prompt-70 cited, and already imported into this database. Values are read
// from it at runtime, never hand-typed, so the backfill provably matches the citation.
//
// Only fields that are currently NULL on the target are written: an existing value is never
// overwritten, so this can't silently undo prompt-70's macro correction or a dietitian's own
// later edit. Non-nutrient fields are untouched — source stays "custom", and the serving data
// (portions/commonServings/gramsPerX), `verified` and the identity fields are left exactly as
// they are, per the same scope rule prompt-70 followed.
const TARGET_ID = "6a92ea144b0e179995114ff6";
const SOURCE_FDC_ID = 173430;
const CITATION = "USDA FoodData Central, SR Legacy 173430 (Butter, without salt)";

// Listed explicitly rather than derived from the schema so that adding a future non-nutrient
// field to Food can't quietly widen what this script copies.
const NUTRIENT_FIELDS = [
  "sugar", "sodium",
  "fiberSoluble", "fiberInsoluble", "starch",
  "fatSaturated", "fatMonounsaturated", "fatPolyunsaturated", "fatTrans", "cholesterol",
  "omega3Ala", "omega3Epa", "omega3Dha", "omega6La", "omega6Aa",
  "aminoCystine", "aminoHistidine", "aminoIsoleucine", "aminoLeucine", "aminoLysine",
  "aminoMethionine", "aminoPhenylalanine", "aminoThreonine", "aminoTryptophan",
  "aminoTyrosine", "aminoValine",
  "vitaminA", "vitaminC", "vitaminD", "vitaminE", "vitaminK",
  "vitaminB1", "vitaminB2", "vitaminB3", "vitaminB5", "vitaminB6", "vitaminB12", "folate",
  "calcium", "copper", "iron", "magnesium", "manganese", "phosphorus", "potassium",
  "selenium", "zinc",
  "oxalate", "phytate",
];

// Metadata that qualifies a nutrient value and must travel with it. vitaminA/D can be reported
// in mcg or IU and the claim code refuses to compare an IU value against a mcg DV; omega6La/Aa
// carry a flag for whether they came from USDA's generic non-stereo-specific fatty acid ids.
// Copying a value without its qualifier would present an approximate or differently-united
// number as a confirmed one — so these are copied whenever their parent field is.
const COMPANION_META = {
  vitaminA: "vitaminASourceUnit",
  vitaminD: "vitaminDSourceUnit",
  omega6La: "omega6LaApprox",
  omega6Aa: "omega6AaApprox",
};

const isUnset = (v) => v === null || v === undefined;

async function run() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const reference = await Food.findOne({ fdcId: SOURCE_FDC_ID }).lean();
  if (!reference) throw new Error(`Reference food fdcId=${SOURCE_FDC_ID} not found.`);

  const target = await Food.findById(TARGET_ID);
  if (!target) throw new Error(`Target food ${TARGET_ID} not found.`);
  if (target.source !== "custom") throw new Error(`Refusing: ${target.name} is not a custom food.`);

  console.log(`Backfilling "${target.name}" (${target._id})`);
  console.log(`Source: ${CITATION}\n`);

  const before = {
    claims: JSON.parse(JSON.stringify(target.nutrientClaims ?? [])),
    epaDha: target.omega3EpaDhaPerServingMg ?? null,
  };

  const filled = [];
  const skippedSet = [];
  const skippedNoSource = [];

  for (const field of NUTRIENT_FIELDS) {
    if (!isUnset(target[field])) { skippedSet.push(field); continue; }
    if (isUnset(reference[field])) { skippedNoSource.push(field); continue; }

    target[field] = reference[field];
    const entry = { field, value: reference[field], meta: null };

    const metaField = COMPANION_META[field];
    if (metaField && !isUnset(reference[metaField])) {
      target[metaField] = reference[metaField];
      entry.meta = `${metaField}=${reference[metaField]}`;
    }
    filled.push(entry);
  }

  for (const { field, value, meta } of filled) {
    console.log(`  ${field.padEnd(22)} null -> ${String(value).padEnd(6)}${meta ? `  (${meta})` : ""}`);
  }
  console.log(`\n  backfilled: ${filled.length}   already had a value: ${skippedSet.length}   no value in source: ${skippedNoSource.length}`);
  if (skippedNoSource.length) console.log(`  left null (source has none): ${skippedNoSource.join(", ")}`);

  // Derived fields, recomputed from the now-accurate record. Whatever these return is what gets
  // stored — no filtering, no floor, no override. Both are driven by pickServingGrams(), which
  // reads the food's `portions` array; this record has none, so both correctly yield "no basis"
  // rather than a claim invented from a fabricated serving size.
  target.nutrientClaims = computeNutrientClaims(target);
  target.omega3EpaDhaPerServingMg = computeEpaDhaPerServingMg(target);
  target.dataSource = CITATION;

  await target.save();

  const after = await Food.findById(TARGET_ID).lean();
  console.log(`\n=== derived fields (recomputed, unfiltered) ===`);
  console.log(`  nutrientClaims           before=${JSON.stringify(before.claims)}  after=${JSON.stringify(after.nutrientClaims)}`);
  console.log(`  omega3EpaDhaPerServingMg before=${before.epaDha}  after=${after.omega3EpaDhaPerServingMg}`);
  console.log(`  serving basis (portions) ${JSON.stringify(after.portions)} -> no basis, so no tags are asserted`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
