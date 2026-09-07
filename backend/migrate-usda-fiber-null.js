import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { USDA_BULK_CHUNK_SIZE } from "./src/modules/foods/lib/usda-client.js";

// One-time backfill (prompt-76) for USDA foods imported before toMacros stopped doing
// `fiber: pickNutrient(...) ?? 0`. That coercion stored a confident 0 for foods FDC never
// measured fiber on, which the Food Database then displayed as "0 g" — indistinguishable from
// a real measured zero.
//
// The correction can only be made per food, against the source: FDC reporting fiber as
// present-with-value-0 (butter really is 0 g fiber) is a different fact from FDC omitting the
// nutrient entirely. So every candidate is re-fetched and its raw nutrient list inspected;
// nothing is inferred in bulk.
//
// Only ever writes fiber: 0 -> null, and only when the source has no fiber datum. A food whose
// source reports any fiber value (0 included) is left exactly as it is.
//
// Run with --apply to write; defaults to a dry run.
const FIBER_ID = 1079;
// For the read-only macro audit below (investigation step 3) — NOT written by this script.
const MACRO_IDS = { protein: [1003], carbs: [1005], fat: [1004], calories: [1008, 2048, 2047] };
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const APPLY = process.argv.includes("--apply");

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POST /foods must be format:"full" — the "abridged" shape omits nutrient ids entirely (its
// entries carry only the legacy `number` field), so fiber can't be located in it at all.
async function fetchBatch(fdcIds) {
  const res = await fetch(`${BASE_URL}/foods?api_key=${env.USDA_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fdcIds, format: "full" }),
  });
  if (!res.ok) throw new Error(`FDC bulk lookup failed (${res.status})`);
  return res.json();
}

const hasNutrient = (food, ids) =>
  (food.foodNutrients ?? []).some((n) => ids.includes(n.nutrientId ?? n.nutrient?.id));

async function migrate() {
  if (!env.USDA_API_KEY) throw new Error("USDA_API_KEY is not set — cannot verify against the source.");
  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to MongoDB${APPLY ? "" : "   (DRY RUN — pass --apply to write)"}\n`);

  // Candidates: any USDA food storing a 0 that could have come from the coercion. fiber is what
  // gets corrected; the macro zeros are fetched alongside purely so the same round trips can
  // answer whether protein/carbs/fat have the same problem.
  const candidates = await Food.find({
    source: "usda",
    fdcId: { $ne: null },
    $or: [{ fiber: 0 }, { protein: 0 }, { carbs: 0 }, { fat: 0 }, { calories: 0 }],
  })
    .select("name fdcId fiber protein carbs fat calories")
    .lean();

  const unverifiable = await Food.countDocuments({
    source: "usda",
    fiber: 0,
    $or: [{ fdcId: null }, { fdcId: { $exists: false } }],
  });
  console.log(`Candidates to check against FDC: ${candidates.length}`);
  console.log(`USDA foods with fiber 0 but no fdcId (unverifiable, left alone): ${unverifiable}\n`);

  const byId = new Map(candidates.map((f) => [f.fdcId, f]));
  const batches = chunk([...byId.keys()], USDA_BULK_CHUNK_SIZE);

  const toNull = [];
  let genuineZero = 0;
  let notReturned = 0;
  const macroAudit = { protein: { absent: 0, present: 0 }, carbs: { absent: 0, present: 0 }, fat: { absent: 0, present: 0 }, calories: { absent: 0, present: 0 } };

  for (const [i, ids] of batches.entries()) {
    const foods = await fetchBatch(ids);
    const returned = new Set();
    for (const remote of foods) {
      const fdcId = Number(remote.fdcId);
      returned.add(fdcId);
      const local = byId.get(fdcId);
      if (!local) continue;

      if (local.fiber === 0) {
        if (hasNutrient(remote, [FIBER_ID])) genuineZero++;
        else toNull.push({ ...local, remoteName: remote.description });
      }
      for (const [field, ids2] of Object.entries(MACRO_IDS)) {
        if (local[field] !== 0) continue;
        macroAudit[field][hasNutrient(remote, ids2) ? "present" : "absent"]++;
      }
    }
    notReturned += ids.filter((id) => !returned.has(id)).length;
    process.stdout.write(`\r  fetched ${Math.min((i + 1) * USDA_BULK_CHUNK_SIZE, byId.size)}/${byId.size}   `);
    await sleep(150); // courtesy pacing against the FDC rate limit
  }
  console.log("\n");

  console.log(`fiber === 0 in this database, checked against FDC:`);
  console.log(`  source reports fiber (a real measured 0) -> left alone : ${genuineZero}`);
  console.log(`  source has NO fiber datum -> correct to null           : ${toNull.length}`);
  if (notReturned) console.log(`  ids FDC did not return (left alone)                   : ${notReturned}`);

  if (toNull.length) {
    console.log(`\n  examples:`);
    for (const f of toNull.slice(0, 10)) console.log(`    ${f.fdcId}  "${f.name}"  fiber 0 -> null`);
  }

  console.log(`\nRead-only macro audit (investigation step 3 — NOT modified by this script):`);
  for (const [field, a] of Object.entries(macroAudit)) {
    console.log(`  ${field.padEnd(9)} stored 0: source reports it ${String(a.present).padStart(4)}   source omits it ${String(a.absent).padStart(4)}`);
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. Re-run with --apply.`);
  } else if (toNull.length) {
    const ops = toNull.map((f) => ({ updateOne: { filter: { _id: f._id }, update: { $set: { fiber: null } } } }));
    for (const slice of chunk(ops, 500)) await Food.bulkWrite(slice);
    console.log(`\nWrote ${ops.length} correction(s): fiber 0 -> null.`);
  } else {
    console.log(`\nNothing to correct.`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
