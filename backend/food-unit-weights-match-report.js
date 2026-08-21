// REVIEW-ONLY — historical record of the one-time per-food unit-weight backfill (see
// food.model.js's gramsPerCup/Tbsp/Tsp/Piece fields, recipeMacros.js's gramsPerUnitForFood,
// and apply-food-unit-weights.js, which consumed this script's CSV output). Matching now runs
// automatically on food create/update (see foods.service.js + lib/foodMatching.js) — this
// script is kept only to regenerate the historical CSV against the full Food Database if ever
// needed again. Does NOT write to the database.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import Food from "./src/modules/foods/food.model.js";
import { matchFoodName } from "./src/lib/foodMatching.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(__dirname, "food-unit-weights-match-report.csv");

function csvEscape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  await connectDB();

  const foods = await Food.find().select("name category source").lean();

  const rows = foods.map((food) => {
    const match = matchFoodName(food.name);
    const fields = match.fields ?? {};
    return {
      ourName: food.name,
      ourCategory: food.category ?? "",
      ourSource: food.source ?? "",
      matchedDescription: match.matchedDescription ?? "",
      matchedCategory: match.matchedCategory ?? "",
      foodCode: match.foodCode ?? "",
      score: match.score,
      tier: match.tier,
      coreMismatch: match.coreMismatch ? "yes" : "no",
      compositeDish: match.compositeDish ? "yes" : "no",
      cup: fields.gramsPerCup ?? "",
      tbsp: fields.gramsPerTbsp ?? "",
      tsp: fields.gramsPerTsp ?? "",
      piece: fields.gramsPerPiece ?? "",
    };
  });

  // Lowest-confidence / flagged rows first, so they're the first thing reviewed.
  rows.sort((a, b) => a.score - b.score);

  const header = [
    "ourName",
    "ourCategory",
    "ourSource",
    "matchedDescription",
    "matchedCategory",
    "foodCode",
    "score",
    "tier",
    "coreMismatch",
    "compositeDish",
    "cup",
    "tbsp",
    "tsp",
    "piece",
  ];
  const csvLines = [header.join(",")];
  for (const r of rows) {
    csvLines.push(header.map((h) => csvEscape(r[h])).join(","));
  }
  fs.writeFileSync(REPORT_PATH, csvLines.join("\n") + "\n");

  const tierCounts = rows.reduce((acc, r) => {
    acc[r.tier] = (acc[r.tier] ?? 0) + 1;
    return acc;
  }, {});
  const lebanese = rows.filter((r) => r.ourSource === "lebanese");
  const lebaneseNoMatch = lebanese.filter((r) => r.tier === "no-match").length;
  const usda = rows.filter((r) => r.ourSource === "usda");
  const usdaMatch = usda.filter((r) => r.tier === "match").length;

  console.log(`\nTotal foods: ${rows.length}`);
  console.log(`Tiers:`, tierCounts);
  console.log(
    `Lebanese-source: ${lebanese.length} total, ${lebaneseNoMatch} flagged no-match (${Math.round((lebaneseNoMatch / lebanese.length) * 100)}%)`,
  );
  console.log(
    `USDA-source: ${usda.length} total, ${usdaMatch} flagged match (${Math.round((usdaMatch / usda.length) * 100)}%)`,
  );
  console.log(`\nReport written to ${REPORT_PATH}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
