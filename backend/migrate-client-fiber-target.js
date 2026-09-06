import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Client from "./src/modules/clients/client.model.js";
import { calcFiberTarget } from "./src/lib/calc/targets.js";

// One-time companion to migrate-target-fiber.js (prompt-54): prompt-54's investigation found
// every real client here uses targets.method "manual" with no targets.fiber ever set, since the
// manual-entry form has no fiber field. This backfills targets.fiber on those clients using the
// same calories-only formula the auto-calc path already uses (see clients.service.js's
// fillManualFiberIfMissing, applied going forward at save time — this script covers records saved
// before that existed). Touches only targets.fiber — no other target field is read or written.
async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const clients = await Client.find({
    "targets.method": "manual",
    $or: [{ "targets.fiber": { $exists: false } }, { "targets.fiber": null }, { "targets.fiber": 0 }],
  }).select("_id profile targets");
  console.log(`Found ${clients.length} manual-method client(s) needing a targets.fiber backfill`);

  let backfilled = 0;
  let skipped = 0;
  for (const client of clients) {
    const calories = client.targets?.calories;
    const name = `${client.profile?.firstName ?? ""} ${client.profile?.lastName ?? ""}`.trim();
    if (!calories) {
      console.log(`  SKIPPED ${name} (${client._id}): no targets.calories to compute from`);
      skipped++;
      continue;
    }
    const fiber = calcFiberTarget(calories);
    await Client.updateOne({ _id: client._id }, { $set: { "targets.fiber": fiber } });
    console.log(`  BACKFILLED ${name} (${client._id}): targets.fiber -> ${fiber} (from calories=${calories})`);
    backfilled++;
  }

  console.log(`\nMigration complete — backfilled ${backfilled}, skipped ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
