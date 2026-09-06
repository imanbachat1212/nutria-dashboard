import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Food from "./src/modules/foods/food.model.js";
import { getUsdaDataTypesBulk, USDA_BULK_CHUNK_SIZE } from "./src/modules/foods/lib/usda-client.js";

// One-time backfill (prompt-64): foods imported from USDA before usdaDataType existed stored
// their fdcId but discarded FDC's dataType, so My Library could only show a blanket "USDA".
// Re-fetches the real type by fdcId via FDC's bulk endpoint and writes it back.
// Touches only usdaDataType — no macro, portion, or name data is read or written.
//
// Only source: "usda" foods with an fdcId are eligible. Lebanese/custom foods are deliberately
// skipped (they have no USDA provenance and must never display a fabricated one), as are USDA
// foods with no stored fdcId — there's nothing to look them up by, so they keep the generic label.
const SLEEP_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const eligible = await Food.find({
    source: "usda",
    fdcId: { $exists: true, $ne: null },
    $or: [{ usdaDataType: { $exists: false } }, { usdaDataType: null }],
  })
    .select("_id name fdcId")
    .lean();

  const skippedNoFdcId = await Food.countDocuments({
    source: "usda",
    $or: [{ fdcId: { $exists: false } }, { fdcId: null }],
  });
  const nonUsda = await Food.countDocuments({ source: { $ne: "usda" } });

  console.log(`Eligible (source=usda, has fdcId, no dataType yet): ${eligible.length}`);
  console.log(`Skipped — usda but no fdcId (nothing to look up by): ${skippedNoFdcId}`);
  console.log(`Skipped — non-USDA foods (lebanese/custom, no USDA type by design): ${nonUsda}`);

  const byId = new Map(eligible.map((f) => [f.fdcId, f]));
  const ids = [...byId.keys()];

  let updated = 0;
  const counts = {};
  const notReturned = [];

  for (let i = 0; i < ids.length; i += USDA_BULK_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + USDA_BULK_CHUNK_SIZE);
    let found;
    try {
      found = await getUsdaDataTypesBulk(chunk);
    } catch (e) {
      console.log(`  chunk ${i}-${i + chunk.length - 1} FAILED: ${e.message}`);
      notReturned.push(...chunk);
      continue;
    }

    const ops = [];
    for (const fdcId of chunk) {
      const dataType = found.get(fdcId);
      if (!dataType) {
        notReturned.push(fdcId);
        continue;
      }
      counts[dataType] = (counts[dataType] || 0) + 1;
      ops.push({
        updateOne: { filter: { _id: byId.get(fdcId)._id }, update: { $set: { usdaDataType: dataType } } },
      });
    }
    if (ops.length) {
      const res = await Food.bulkWrite(ops);
      updated += res.modifiedCount ?? ops.length;
    }
    process.stdout.write(`\r  progress: ${Math.min(i + USDA_BULK_CHUNK_SIZE, ids.length)}/${ids.length} (updated ${updated})   `);
    await sleep(SLEEP_MS);
  }

  console.log(`\n\nBackfilled ${updated} food(s).`);
  console.log("By dataType:", JSON.stringify(counts));
  if (notReturned.length) {
    console.log(`\nFDC returned no dataType for ${notReturned.length} fdcId(s) — left as-is (generic "USDA"):`);
    console.log("  " + notReturned.slice(0, 25).join(", ") + (notReturned.length > 25 ? ", …" : ""));
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
