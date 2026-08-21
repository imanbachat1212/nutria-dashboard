// Applies the per-food unit-weight backfill (step 3 follow-up) using the already-reviewed
// food-unit-weights-match-report.csv as-is — does NOT re-run the matching in
// food-unit-weights-match-report.js. Writes gramsPerCup/gramsPerTbsp/gramsPerTsp/gramsPerPiece
// directly via Mongoose (see food.model.js step 1, recipeMacros.js step 2). Skips "no-match"
// rows and a manually-reviewed exclusion list, then applies 3 manual corrections on top.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./src/config/db.js";
import mongoose from "mongoose";
import Food from "./src/modules/foods/food.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "food-unit-weights-match-report.csv");

// Names manually reviewed and rejected as wrong matches despite scoring "match" or
// "low-confidence" — skipped even though they'd otherwise qualify for a write.
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

// Applied after the main backfill, overriding whatever the CSV said for these names.
const MANUAL_CORRECTIONS = [
  { name: "Walnuts", gramsPerCup: 120, reason: "real USDA value; CSV wrongly matched walnut oil" },
  {
    name: "Brown rice, cooked",
    gramsPerCup: 188,
    reason: "no plain FNDDS entry; brown-rice-with-X variants cluster around this value",
  },
  {
    name: "White rice, cooked",
    gramsPerCup: 160,
    reason: "no plain FNDDS entry; white-rice-with-X variants cluster around this value",
  },
];

// Minimal CSV parser matching this project's own csvEscape (fields quoted only when they
// contain a comma/quote/newline, internal quotes doubled) — not a general RFC4180 parser.
function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function buildUnitWeightFields(row) {
  const fields = {};
  if (row.cup !== "") fields.gramsPerCup = Number(row.cup);
  if (row.tbsp !== "") fields.gramsPerTbsp = Number(row.tbsp);
  if (row.tsp !== "") fields.gramsPerTsp = Number(row.tsp);
  if (row.piece !== "") fields.gramsPerPiece = Number(row.piece);
  return fields;
}

async function main() {
  await connectDB();

  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));

  // Dedupe by ourName — a handful of names (e.g. "Olive oil", "Dates, medjool") have 2 Food
  // documents sharing the same name, so Food.find() in the original report produced 2
  // identical CSV rows for them. One updateMany per unique name (matching by name) covers
  // every document with that name in a single write instead of writing the same value twice.
  const byName = new Map();
  for (const row of rows) {
    if (!byName.has(row.ourName)) byName.set(row.ourName, row);
  }

  let written = 0;
  let skippedNoMatch = 0;
  let skippedExcluded = 0;
  const notFound = [];

  for (const [name, row] of byName) {
    if (row.tier === "no-match") {
      skippedNoMatch++;
      continue;
    }
    if (EXCLUDED_NAMES.has(name)) {
      skippedExcluded++;
      continue;
    }

    const fields = buildUnitWeightFields(row);
    const result = await Food.updateMany({ name }, { $set: fields });
    if (result.matchedCount === 0) {
      notFound.push(name);
      continue;
    }
    written += result.modifiedCount;
    console.log(
      `WRITE  ${name} -> ${JSON.stringify(fields)} (${result.matchedCount} doc${result.matchedCount === 1 ? "" : "s"})`,
    );
  }

  console.log("\n--- Manual corrections ---");
  const corrections = [];
  for (const c of MANUAL_CORRECTIONS) {
    const result = await Food.updateMany({ name: c.name }, { $set: { gramsPerCup: c.gramsPerCup } });
    console.log(
      `CORRECT ${c.name} -> gramsPerCup: ${c.gramsPerCup} (${result.matchedCount} doc${result.matchedCount === 1 ? "" : "s"}) — ${c.reason}`,
    );
    corrections.push({ ...c, matchedCount: result.matchedCount });
  }

  console.log("\n--- Summary ---");
  console.log(`Unique names in CSV: ${byName.size}`);
  console.log(`Written (non-excluded, non-no-match): ${written} documents`);
  console.log(`Skipped (no-match): ${skippedNoMatch}`);
  console.log(`Skipped (manually excluded): ${skippedExcluded} of ${EXCLUDED_NAMES.size} excluded names`);
  console.log(`Manual corrections applied: ${corrections.length}`);
  if (notFound.length) {
    console.log(`Names in CSV with no matching Food document now: ${notFound.length}`);
    notFound.forEach((n) => console.log("  -", n));
  } else {
    console.log("All non-skipped CSV names matched a current Food document.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
