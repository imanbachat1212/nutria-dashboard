import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const ingredientSchema = new mongoose.Schema(
  {
    // What this row IS (prompt-97). A "section" is a titled divider the dietitian inserts
    // between ingredients ("Batter", "Frosting") so a multi-component recipe reads in groups.
    // It lives in THIS array rather than a parallel sections structure on purpose: array order
    // stays the single source of display order, headers and ingredients interleave naturally,
    // and nothing that already iterates `ingredients` needs new grouping logic. A section row
    // carries only `name` (its title) — no food/quantity/unit — so computeRecipeMacros skips it
    // for free through its existing `if (!ing.food) continue`, with no calc changes at all.
    // Documents written before this field read back as "ingredient" via the default below, so
    // this is non-breaking and needs no migration.
    type: { type: String, enum: ["ingredient", "section"], default: "ingredient" },
    food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", default: null },
    name: { type: String, required: true },
    quantity: { type: Number },
    unit: { type: String },
    // Display-only (prompt-47) — the real per-food measure the dietitian actually picked (e.g.
    // "3 pitted dates"), when one was picked via MeasureSelect. quantity/unit above are always
    // the already-resolved gram total ("g"), which is what every calculation (computeRecipeMacros
    // in recipeMacros.js, unchanged) reads — this field is never read by any calculation, purely
    // a nicer label for item rows to show instead of a bare gram amount. null/absent for a
    // generic-unit selection (cup/tbsp/tsp/piece/ml/g) or any item created before this field
    // existed — display falls back to `${quantity} ${unit}` in that case.
    measureLabel: { type: String, default: null },
    // Structured counterparts to measureLabel (prompt-49) — measureLabel alone (a single
    // fully-composed string) can't be reliably reversed back into "which portions option" +
    // "what count" for re-opening an edit UI pre-selected correctly. measureDescription is the
    // exact raw description as it appears in that food's own `portions` list (e.g. "1 date,
    // pitted") — matched against it verbatim to pre-select, never fuzzy-matched. measureCount is
    // the count picked (e.g. 3). Both null/absent exactly when measureLabel is: a generic-unit
    // selection, or any item created before this field existed. Also display-only/purely
    // additive — never read by computeRecipeMacros' calculation, same as measureLabel.
    measureDescription: { type: String, default: null },
    measureCount: { type: Number, default: null },
  },
  { _id: false }
);

const mealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    category: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "dessert", "drink"],
      default: "lunch",
    },
    cuisine: {
      type: String,
      enum: ["lebanese", "mediterranean", "levantine", "international", "asian", "italian"],
      // No default on purpose: a recipe stays unset until the dietitian picks a cuisine. A silent
      // "lebanese" default labelled every imported recipe as Lebanese, which polluted the
      // WhatsApp coach's cuisine-based meal-library search.
    },
    servings: { type: Number, default: 1 },
    prepTime: { type: Number, default: 0 },
    cookTime: { type: Number, default: 0 },
    icon: { type: String, default: "🥗" },
    coverHue: { type: String, default: "bg-emerald-100" },
    // photos[0] is the cover shown on the card/grid — the card only has room for one image.
    photos: { type: [imageSchema], default: [] },
    dietTags: [{ type: String }],
    allergens: [{ type: String }],
    ingredients: [ingredientSchema],
    steps: [{ type: String }],
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    totalFiber: { type: Number, default: 0 },
    // DRI-matched micronutrient totals — same 22 fields as Client.driTargets (see
    // lib/calc/dri.js), computed by recipeMacros.js alongside the macros above. Nullable: null
    // means "no ingredient had verified data for this nutrient", not "zero" — see
    // computeRecipeMacros for the partial-sum-vs-null rule. Lets the Meal Plan micronutrient
    // breakdown sum recipe items the same way it sums direct food items.
    totalVitaminA: { type: Number, default: null },
    totalVitaminC: { type: Number, default: null },
    totalVitaminD: { type: Number, default: null },
    totalVitaminE: { type: Number, default: null },
    totalVitaminK: { type: Number, default: null },
    totalVitaminB1: { type: Number, default: null },
    totalVitaminB2: { type: Number, default: null },
    totalVitaminB3: { type: Number, default: null },
    totalVitaminB5: { type: Number, default: null },
    totalVitaminB6: { type: Number, default: null },
    totalVitaminB12: { type: Number, default: null },
    totalFolate: { type: Number, default: null },
    totalCalcium: { type: Number, default: null },
    totalIron: { type: Number, default: null },
    totalMagnesium: { type: Number, default: null },
    totalPhosphorus: { type: Number, default: null },
    totalPotassium: { type: Number, default: null },
    totalSodium: { type: Number, default: null },
    totalZinc: { type: Number, default: null },
    totalCopper: { type: Number, default: null },
    totalManganese: { type: Number, default: null },
    totalSelenium: { type: Number, default: null },
    // Food's "Other" group (OTHER_NUTRIENT_FIELDS in food.model.js), totalled for the whole
    // recipe in mg — oxalate prompt-99, phytate prompt-100. Deliberately NOT part of the
    // DRI-matched block above and NOT in recipeMacros.js's MICRO_FIELDS: neither has a DRI or
    // an FDA Daily Value, so neither carries a target, a %DV or a High/Good Source tier —
    // they're raw amounts a dietitian may want to keep low. Both summed in one pass by
    // computeRecipeOtherNutrients (lib/calc/nutrientContributions.js).
    //
    // Same nullability rule as the micronutrients, tracked per nutrient and independently:
    // null means no ingredient reported THAT one, 0 means one did and the sum is genuinely
    // zero. A recipe can have a real oxalate total and a null phytate total.
    totalOxalate: { type: Number, default: null },
    totalPhytate: { type: Number, default: null },
    verified: { type: Boolean, default: false },
    notes: { type: String },
    // Where an imported recipe came from (prompt-120). Its own field rather than a line appended
    // to `notes`: notes is dietitian-authored free text shown in the recipe form, and burying a
    // URL in it would mean anything wanting the attribution back (an "Imported from
    // recipetineats.com" link, a re-import, a duplicate check) would have to parse prose. Absent
    // on every hand-entered recipe and on everything created before this field existed, which is
    // exactly the signal "this was typed in by hand".
    sourceUrl: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mealSchema.index({ name: "text", nameAr: "text" });
mealSchema.index({ category: 1 });

export default mongoose.model("Meal", mealSchema);
