import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import Client from "./src/modules/clients/client.model.js";
import MealPlan from "./src/modules/mealplans/meal-plan.model.js";
import JournalEntry from "./src/modules/journal/journal-entry.model.js";
const run = async () => {
  await connectDB();
  const cs = await Client.find({}).lean();
  console.log("=== CLIENTS ===");
  for (const c of cs) console.log(" ", c.phone, "|", [c.profile?.firstName,c.profile?.lastName].filter(Boolean).join(" "), "| status:", c.status, "| archived:", !!c.archived, "| targets:", c.targets ? `${c.targets.method} ${c.targets.calories}kcal` : "NULL", "| driTargets:", c.driTargets ? "set" : "NULL");
  console.log("\n=== PLANS ===");
  const ps = await MealPlan.find({}).select("client name status startDate endDate items").lean();
  for (const p of ps) console.log(" ", p.name, "| client:", String(p.client), "| status:", p.status, "| start:", p.startDate?.toISOString().slice(0,10), "| end:", p.endDate?.toISOString().slice(0,10), "| items:", p.items.length, "| days present:", [...new Set(p.items.map(i=>i.day))].sort().join(","));
  console.log("\n=== JOURNAL ===");
  const js = await JournalEntry.find({}).select("client date source status items").lean();
  for (const j of js) console.log(" ", j.date.toISOString(), "| client:", String(j.client), "|", j.source, j.status, "| items:", j.items.length);
  await mongoose.disconnect();
};
run().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
