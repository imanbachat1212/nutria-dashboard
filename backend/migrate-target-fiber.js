import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import MealPlan from "./src/modules/mealplans/meal-plan.model.js";
import Client from "./src/modules/clients/client.model.js";

// One-time backfill for plans created before prompt-53 added MealPlan.targetFiber (populated
// today at plan create/duplicate time from client.targets.fiber, per mealplans.service.js).
// Touches only targetFiber — no item, macro, or other target field is read or written.
async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const plans = await MealPlan.find({
    $or: [{ targetFiber: { $exists: false } }, { targetFiber: null }, { targetFiber: 0 }],
  }).select("_id name client targetFiber");
  console.log(`Found ${plans.length} plan(s) needing a targetFiber backfill`);

  let backfilled = 0;
  let skipped = 0;
  for (const plan of plans) {
    const client = await Client.findById(plan.client).select("profile targets").lean();
    const fiber = client?.targets?.fiber;
    if (fiber != null && fiber !== 0) {
      await MealPlan.updateOne({ _id: plan._id }, { $set: { targetFiber: fiber } });
      console.log(`  BACKFILLED "${plan.name}" (${plan._id}): targetFiber -> ${fiber}`);
      backfilled++;
    } else {
      const clientLabel = client
        ? `${client.profile?.firstName ?? ""} ${client.profile?.lastName ?? ""}`.trim()
        : "(client not found)";
      console.log(
        `  SKIPPED "${plan.name}" (${plan._id}): client ${clientLabel} has no resolvable ` +
          `targets.fiber (client.targets=${JSON.stringify(client?.targets)}) — left targetFiber unchanged`,
      );
      skipped++;
    }
  }

  console.log(`\nMigration complete — backfilled ${backfilled}, skipped ${skipped} (no resolvable client fiber target)`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
