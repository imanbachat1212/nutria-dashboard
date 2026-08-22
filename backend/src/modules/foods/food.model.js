import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    source: {
      type: String,
      enum: ["usda", "lebanese", "custom"],
      default: "custom",
      index: true,
    },
    servingSize: { type: Number, required: true },
    servingUnit: { type: String, required: true, default: "g" },
    // Free-text "common servings" rows from the Add Food UI (e.g. "1 cup" -> 240g,
    // "1 tbsp" -> 15g), for display in the food drawer's per-serving macro breakdown.
    // Distinct from gramsPerCup/Tbsp/Tsp/Piece/Ml below — those are a structured,
    // unit-keyed lookup consumed by conversion logic; this is just a dietitian-entered
    // label+grams list with no fixed unit semantics.
    commonServings: [
      {
        _id: false,
        label: { type: String, trim: true, required: true },
        grams: { type: Number, required: true, min: 0 },
      },
    ],
    // ── Per-food unit weights ──────────────────────────────────────────────────────────
    // Real gram weight of 1 cup / tbsp / tsp / piece / ml of THIS specific food, for
    // recipeMacros.js's unit conversion to look up instead of applying one flat constant
    // (cup=240g, tbsp=15g, tsp=5g, piece=50g, ml=1g) to every food regardless of density —
    // see UNIT_TO_GRAMS in lib/calc/recipeMacros.js. All nullable — null means "use the
    // flat UNIT_TO_GRAMS fallback for this food," same fallback semantics as unset on
    // every existing food until backfilled.
    gramsPerCup: { type: Number, default: null },
    gramsPerTbsp: { type: Number, default: null },
    gramsPerTsp: { type: Number, default: null },
    gramsPerPiece: { type: Number, default: null },
    gramsPerMl: { type: Number, default: null },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: null },
    sodium: { type: Number, default: null },
    // Micronutrients — optional/nullable, same pattern as sugar/sodium. Currently only
    // populated on the Hoteit et al. lab-verified Lebanese dishes/sweets (source: "lebanese",
    // verified: true); every other food leaves them null.
    //
    // ⚠️ UNIT CAVEAT — NOT unit-verified. The source tables (Hoteit et al.) did not explicitly
    // label vitamin units. The stored numbers are the RAW values as published — likely mcg for
    // vitamin A and mcg for vitamin D, mg for vitamin E/C, but this is NOT confirmed. These
    // must be verified against the original papers (F1000Research 2020 / Nutrients 2021 /
    // PLOS One 2024) before use in any clinical calculation involving vitamin dosing.
    // See TODO.md → "Food micronutrient unit verification".
    vitaminA: { type: Number, default: null },
    vitaminD: { type: Number, default: null },
    vitaminE: { type: Number, default: null },
    vitaminC: { type: Number, default: null },
    iron: { type: Number, default: null },
    // Which unit the vitaminA/vitaminD value above was actually captured in. USDA FoodData
    // Central reports these two nutrients in µg (RAE / D2+D3) on Foundation/SR Legacy records
    // but ONLY in IU on many Branded records — the two units are not interchangeable by a
    // fixed multiplier without knowing the specific compound, so the raw value is stored as-is
    // and tagged here rather than silently normalized. null on lab/hand-entered foods that
    // predate this field (assume µg — see the UNIT CAVEAT above) or where no value is set.
    vitaminASourceUnit: { type: String, enum: ["mcg", "iu", null], default: null },
    vitaminDSourceUnit: { type: String, enum: ["mcg", "iu", null], default: null },

    // ── Fiber / carbs ──────────────────────────────────────────────────────────────────
    fiberSoluble: { type: Number, default: null },
    // Rarely populated — see usda-client.js comment on NUTRIENT_IDS.fiberInsoluble. Expect
    // null on the overwhelming majority of foods, including USDA imports.
    fiberInsoluble: { type: Number, default: null },
    starch: { type: Number, default: null },
    // netCarbs is NOT stored here — it's carbs minus fiber, always computed at display time
    // so it can't drift when either source value is edited independently.

    // ── Fats ───────────────────────────────────────────────────────────────────────────
    fatSaturated: { type: Number, default: null },
    fatMonounsaturated: { type: Number, default: null },
    fatPolyunsaturated: { type: Number, default: null },
    fatTrans: { type: Number, default: null },
    cholesterol: { type: Number, default: null },
    omega3Ala: { type: Number, default: null },
    omega3Epa: { type: Number, default: null },
    omega3Dha: { type: Number, default: null },
    omega6La: { type: Number, default: null },
    omega6Aa: { type: Number, default: null },
    // True when omega6La/omega6Aa came from USDA's generic, non-stereo-labeled fatty acid ids
    // (18:2 / 20:4) instead of the n-6-specific ids — see usda-client.js. Lets the frontend
    // mark these as approximate instead of presenting them with the same confidence as a
    // directly-confirmed n-6 value. Always false for manually-entered values.
    omega6LaApprox: { type: Boolean, default: false },
    omega6AaApprox: { type: Boolean, default: false },
    // omega3Total/omega6Total are NOT stored — USDA never returns a single total for either,
    // and summing only the named sub-components above would silently under-report any
    // unmeasured fatty acid in the family. Computed as a labeled "partial sum" at display time.

    // ── Amino acids ────────────────────────────────────────────────────────────────────
    aminoCystine: { type: Number, default: null },
    aminoHistidine: { type: Number, default: null },
    aminoIsoleucine: { type: Number, default: null },
    aminoLeucine: { type: Number, default: null },
    aminoLysine: { type: Number, default: null },
    aminoMethionine: { type: Number, default: null },
    aminoPhenylalanine: { type: Number, default: null },
    aminoThreonine: { type: Number, default: null },
    aminoTryptophan: { type: Number, default: null },
    aminoTyrosine: { type: Number, default: null },
    aminoValine: { type: Number, default: null },

    // ── Vitamins (vitaminA/D/E/C already declared above) ──────────────────────────────
    vitaminB1: { type: Number, default: null },
    vitaminB2: { type: Number, default: null },
    vitaminB3: { type: Number, default: null },
    vitaminB5: { type: Number, default: null },
    vitaminB6: { type: Number, default: null },
    vitaminB12: { type: Number, default: null },
    folate: { type: Number, default: null },
    vitaminK: { type: Number, default: null },

    // ── Minerals (iron/sodium already declared above) ─────────────────────────────────
    calcium: { type: Number, default: null },
    copper: { type: Number, default: null },
    magnesium: { type: Number, default: null },
    manganese: { type: Number, default: null },
    phosphorus: { type: Number, default: null },
    potassium: { type: Number, default: null },
    selenium: { type: Number, default: null },
    zinc: { type: Number, default: null },

    // ── Other ──────────────────────────────────────────────────────────────────────────
    // Manual-entry only — confirmed absent from FDC entirely (see TODO.md), never populated
    // by usda-import.
    oxalate: { type: Number, default: null },
    phytate: { type: Number, default: null },

    // Provenance/citation for the numbers on this food (e.g. "Hoteit et al., lab-analyzed").
    // Absent on hand-estimated and USDA-imported foods.
    dataSource: { type: String, trim: true, default: null },
    verified: { type: Boolean, default: false },
    // Allergen tags shown as badges in the client-facing food picker/plan views — freeform
    // strings rather than an enum since the UI's ALLERGENS list can grow without a migration.
    allergens: [{ type: String }],
    // Dietitian's free-text clinical note (e.g. swap suggestions) — distinct from dataSource
    // above, which is a citation for where the macro numbers came from, not a note about the
    // food itself.
    notes: { type: String, trim: true, default: null },
    // Per-user "pin to quick-access" — scoped to whoever favorited it, not a global property of
    // the food (two dietitians on the same account tenant can have different favorites). Small
    // array rather than a separate join collection since a food is favorited by at most a
    // handful of users in practice.
    favoritedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    image: { type: imageSchema, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // USDA FoodData Central id — set only on foods imported via usda-import. sparse lets every
    // non-USDA food omit it; unique (among documents that do have it) prevents importing the
    // same fdcId twice.
    fdcId: { type: Number, index: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

foodSchema.index({ name: "text", nameAr: "text" });
foodSchema.index({ favoritedBy: 1 });

export default mongoose.model("Food", foodSchema);
