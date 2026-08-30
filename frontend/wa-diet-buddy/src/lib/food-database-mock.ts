export type FoodCategory =
  | "produce"
  | "grains"
  | "protein"
  | "dairy"
  | "legumes"
  | "fats"
  | "beverages"
  | "snacks"
  | "prepared"
  | "sweets";

export type FoodSource = "usda" | "lebanese" | "custom";

export interface FoodMacrosPer100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number; // mg
}

export interface ServingSize {
  label: string;
  grams: number;
}

// Per-food gram weight overrides for cup/tbsp/tsp/piece/ml — null means "no stored data for
// this food/unit, use the flat fallback conversion" (see UNIT_TO_GRAMS in
// new-recipe-dialog.tsx, mirroring the backend's recipeMacros.js).
export interface UnitWeights {
  cup: number | null;
  tbsp: number | null;
  tsp: number | null;
  piece: number | null;
  ml: number | null;
}

// Full micronutrient profile per 100g. Every value is null unless the source (USDA import or
// manual entry) actually provided it — null is the expected, common case, not an error state.
// Grouped to match the Food model's schema comments and the dialog/drawer's collapsible
// sections one-to-one.
export interface Micronutrients {
  // Fiber / carbs
  fiberSoluble: number | null;
  fiberInsoluble: number | null;
  starch: number | null;

  // Fats
  fatSaturated: number | null;
  fatMonounsaturated: number | null;
  fatPolyunsaturated: number | null;
  fatTrans: number | null;
  cholesterol: number | null;
  omega3Ala: number | null;
  omega3Epa: number | null;
  omega3Dha: number | null;
  omega6La: number | null;
  omega6LaApprox: boolean;
  omega6Aa: number | null;
  omega6AaApprox: boolean;

  // Amino acids
  aminoCystine: number | null;
  aminoHistidine: number | null;
  aminoIsoleucine: number | null;
  aminoLeucine: number | null;
  aminoLysine: number | null;
  aminoMethionine: number | null;
  aminoPhenylalanine: number | null;
  aminoThreonine: number | null;
  aminoTryptophan: number | null;
  aminoTyrosine: number | null;
  aminoValine: number | null;

  // Vitamins
  vitaminA: number | null;
  vitaminASourceUnit: "mcg" | "iu" | null;
  vitaminB1: number | null;
  vitaminB2: number | null;
  vitaminB3: number | null;
  vitaminB5: number | null;
  vitaminB6: number | null;
  vitaminB12: number | null;
  vitaminC: number | null;
  vitaminD: number | null;
  vitaminDSourceUnit: "mcg" | "iu" | null;
  vitaminE: number | null;
  folate: number | null;
  vitaminK: number | null;

  // Minerals. sodium is deliberately NOT one of MICRO_FIELD_GROUPS's "minerals" fields below —
  // it's a value here purely so MicronutrientSection (food-database.tsx) can render it in the
  // Minerals accordion for READ-ONLY display, sourced directly, not through the generic
  // group.fields loop. That loop is also what drives new-food-dialog.tsx's manual-entry
  // Micronutrients step and its save payload — and sodium already has its own dedicated
  // top-level field/input there (same tier as sugar), so adding it to MICRO_FIELD_GROUPS would
  // both duplicate its input in that form AND, worse, let the generic microsPayload spread
  // silently clobber the real `sodium: sodium || null` field at submit time.
  calcium: number | null;
  copper: number | null;
  iron: number | null;
  magnesium: number | null;
  manganese: number | null;
  phosphorus: number | null;
  potassium: number | null;
  selenium: number | null;
  sodium: number | null;
  zinc: number | null;

  // Other — manual-entry only, never populated from USDA
  oxalate: number | null;
  phytate: number | null;
}

// All-null placeholder — used for legacy/mock FoodItems that predate the micronutrient
// panel, so the drawer/dialog can treat "no micros object" identically to "every field null"
// instead of needing an extra optional-chaining branch at every call site.
export const EMPTY_MICROS: Micronutrients = {
  fiberSoluble: null,
  fiberInsoluble: null,
  starch: null,
  fatSaturated: null,
  fatMonounsaturated: null,
  fatPolyunsaturated: null,
  fatTrans: null,
  cholesterol: null,
  omega3Ala: null,
  omega3Epa: null,
  omega3Dha: null,
  omega6La: null,
  omega6LaApprox: false,
  omega6Aa: null,
  omega6AaApprox: false,
  aminoCystine: null,
  aminoHistidine: null,
  aminoIsoleucine: null,
  aminoLeucine: null,
  aminoLysine: null,
  aminoMethionine: null,
  aminoPhenylalanine: null,
  aminoThreonine: null,
  aminoTryptophan: null,
  aminoTyrosine: null,
  aminoValine: null,
  vitaminA: null,
  vitaminASourceUnit: null,
  vitaminB1: null,
  vitaminB2: null,
  vitaminB3: null,
  vitaminB5: null,
  vitaminB6: null,
  vitaminB12: null,
  vitaminC: null,
  vitaminD: null,
  vitaminDSourceUnit: null,
  vitaminE: null,
  folate: null,
  vitaminK: null,
  calcium: null,
  copper: null,
  iron: null,
  magnesium: null,
  manganese: null,
  phosphorus: null,
  potassium: null,
  selenium: null,
  sodium: null,
  zinc: null,
  oxalate: null,
  phytate: null,
};

// Micronutrients keys that are plain optional numbers — excludes the two boolean "approx"
// flags and the two vitamin source-unit enums, which aren't rendered as numeric inputs.
export type NumericMicroKey = Exclude<
  keyof Micronutrients,
  "omega6LaApprox" | "omega6AaApprox" | "vitaminASourceUnit" | "vitaminDSourceUnit"
>;

// Drives both the New Food dialog's Micronutrients step and the detail drawer's expanded
// micronutrient section, so field labels/units/grouping only need to be defined once.
export interface MicroFieldDef {
  key: NumericMicroKey;
  label: string;
  unit: string;
}

export interface MicroFieldGroup {
  id: string;
  label: string;
  fields: MicroFieldDef[];
}

export const MICRO_FIELD_GROUPS: MicroFieldGroup[] = [
  {
    id: "fiber",
    label: "Fiber & carbs",
    fields: [
      { key: "fiberSoluble", label: "Soluble fiber", unit: "g" },
      { key: "fiberInsoluble", label: "Insoluble fiber", unit: "g" },
      { key: "starch", label: "Starch", unit: "g" },
    ],
  },
  {
    id: "fats",
    label: "Fats",
    fields: [
      { key: "fatSaturated", label: "Saturated", unit: "g" },
      { key: "fatMonounsaturated", label: "Monounsaturated", unit: "g" },
      { key: "fatPolyunsaturated", label: "Polyunsaturated", unit: "g" },
      { key: "fatTrans", label: "Trans", unit: "g" },
      { key: "cholesterol", label: "Cholesterol", unit: "mg" },
      { key: "omega3Ala", label: "Omega-3 (ALA)", unit: "g" },
      { key: "omega3Epa", label: "Omega-3 (EPA)", unit: "g" },
      { key: "omega3Dha", label: "Omega-3 (DHA)", unit: "g" },
      { key: "omega6La", label: "Omega-6 (LA)", unit: "g" },
      { key: "omega6Aa", label: "Omega-6 (AA)", unit: "g" },
    ],
  },
  {
    id: "amino",
    label: "Amino acids",
    fields: [
      { key: "aminoCystine", label: "Cystine", unit: "g" },
      { key: "aminoHistidine", label: "Histidine", unit: "g" },
      { key: "aminoIsoleucine", label: "Isoleucine", unit: "g" },
      { key: "aminoLeucine", label: "Leucine", unit: "g" },
      { key: "aminoLysine", label: "Lysine", unit: "g" },
      { key: "aminoMethionine", label: "Methionine", unit: "g" },
      { key: "aminoPhenylalanine", label: "Phenylalanine", unit: "g" },
      { key: "aminoThreonine", label: "Threonine", unit: "g" },
      { key: "aminoTryptophan", label: "Tryptophan", unit: "g" },
      { key: "aminoTyrosine", label: "Tyrosine", unit: "g" },
      { key: "aminoValine", label: "Valine", unit: "g" },
    ],
  },
  {
    id: "vitamins",
    label: "Vitamins",
    fields: [
      { key: "vitaminA", label: "Vitamin A", unit: "mcg" },
      { key: "vitaminB1", label: "B1 (thiamine)", unit: "mg" },
      { key: "vitaminB2", label: "B2 (riboflavin)", unit: "mg" },
      { key: "vitaminB3", label: "B3 (niacin)", unit: "mg" },
      { key: "vitaminB5", label: "B5 (pantothenic acid)", unit: "mg" },
      { key: "vitaminB6", label: "B6 (pyridoxine)", unit: "mg" },
      { key: "vitaminB12", label: "B12 (cobalamin)", unit: "mcg" },
      { key: "vitaminC", label: "Vitamin C", unit: "mg" },
      { key: "vitaminD", label: "Vitamin D", unit: "mcg" },
      { key: "vitaminE", label: "Vitamin E", unit: "mg" },
      { key: "folate", label: "Folate", unit: "mcg" },
      { key: "vitaminK", label: "Vitamin K", unit: "mcg" },
    ],
  },
  {
    id: "minerals",
    label: "Minerals",
    fields: [
      { key: "calcium", label: "Calcium", unit: "mg" },
      { key: "copper", label: "Copper", unit: "mg" },
      { key: "iron", label: "Iron", unit: "mg" },
      { key: "magnesium", label: "Magnesium", unit: "mg" },
      { key: "manganese", label: "Manganese", unit: "mg" },
      { key: "phosphorus", label: "Phosphorus", unit: "mg" },
      { key: "potassium", label: "Potassium", unit: "mg" },
      { key: "selenium", label: "Selenium", unit: "mcg" },
      { key: "zinc", label: "Zinc", unit: "mg" },
    ],
  },
  {
    id: "other",
    label: "Other",
    fields: [
      { key: "oxalate", label: "Oxalate", unit: "mg" },
      { key: "phytate", label: "Phytate", unit: "mg" },
    ],
  },
];

export interface FoodItem {
  id: string;
  name: string;
  arabicName?: string;
  brand?: string;
  category: FoodCategory;
  source: FoodSource;
  macros: FoodMacrosPer100g;
  micros?: Micronutrients;
  servings: ServingSize[];
  unitWeights?: UnitWeights;
  allergens: string[];
  verified: boolean;
  usedInPlans: number;
  lastUsed: string;
  isFavorite: boolean;
  notes?: string;
}

export const CATEGORY_META: Record<FoodCategory, { label: string; emoji: string }> = {
  produce: { label: "Produce", emoji: "🥬" },
  grains: { label: "Grains", emoji: "🌾" },
  protein: { label: "Protein", emoji: "🥩" },
  dairy: { label: "Dairy", emoji: "🥛" },
  legumes: { label: "Legumes", emoji: "🫘" },
  fats: { label: "Fats & oils", emoji: "🫒" },
  beverages: { label: "Beverages", emoji: "🥤" },
  snacks: { label: "Snacks", emoji: "🍿" },
  prepared: { label: "Prepared", emoji: "🥡" },
  sweets: { label: "Sweets", emoji: "🍰" },
};

export const SOURCE_META: Record<FoodSource, { label: string; color: string }> = {
  usda: { label: "USDA", color: "bg-blue-100 text-blue-700" },
  lebanese: { label: "Lebanese DB", color: "bg-rose-100 text-rose-700" },
  custom: { label: "Custom", color: "bg-stone-100 text-stone-700" },
};

export const FOODS: FoodItem[] = [
  {
    id: "f-001",
    name: "Chicken breast, raw",
    category: "protein",
    source: "usda",
    macros: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, sodium: 45 },
    servings: [
      { label: "1 small fillet", grams: 100 },
      { label: "1 medium fillet", grams: 150 },
      { label: "1 large fillet", grams: 200 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 184,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-002",
    name: "Foul (fava beans), cooked",
    arabicName: "فول",
    category: "legumes",
    source: "lebanese",
    macros: { kcal: 110, protein: 7.6, carbs: 19.7, fat: 0.4, fiber: 5.4, sugar: 1.8, sodium: 8 },
    servings: [
      { label: "½ cup", grams: 85 },
      { label: "1 cup", grams: 170 },
      { label: "1 can (drained)", grams: 240 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 92,
    lastUsed: "Yesterday",
    isFavorite: true,
    notes: "Lebanese sohour staple. Pair with lemon + olive oil.",
  },
  {
    id: "f-003",
    name: "Greek yogurt 2%",
    brand: "Total",
    category: "dairy",
    source: "custom",

    macros: { kcal: 73, protein: 9.9, carbs: 3.8, fat: 2.0, fiber: 0, sugar: 3.8, sodium: 35 },
    servings: [
      { label: "1 small pot", grams: 150 },
      { label: "1 large pot", grams: 170 },
      { label: "1 tbsp", grams: 15 },
    ],
    allergens: ["dairy"],
    verified: true,
    usedInPlans: 156,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-004",
    name: "Bulgur, fine, dry",
    arabicName: "برغل",
    category: "grains",
    source: "lebanese",
    macros: {
      kcal: 342,
      protein: 12.3,
      carbs: 75.9,
      fat: 1.3,
      fiber: 12.5,
      sugar: 0.4,
      sodium: 17,
    },
    servings: [
      { label: "¼ cup", grams: 35 },
      { label: "½ cup", grams: 70 },
    ],
    allergens: ["gluten"],
    verified: true,
    usedInPlans: 78,
    lastUsed: "2 days ago",
    isFavorite: false,
  },
  {
    id: "f-005",
    name: "Olive oil, extra virgin",
    arabicName: "زيت زيتون",
    category: "fats",
    source: "lebanese",
    macros: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, sodium: 2 },
    servings: [
      { label: "1 tsp", grams: 5 },
      { label: "1 tbsp", grams: 14 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 312,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-006",
    name: "Salmon fillet, raw",
    category: "protein",
    source: "usda",
    macros: { kcal: 208, protein: 20.4, carbs: 0, fat: 13.4, fiber: 0, sugar: 0, sodium: 59 },
    servings: [
      { label: "Small fillet", grams: 120 },
      { label: "Medium fillet", grams: 170 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 64,
    lastUsed: "Yesterday",
    isFavorite: false,
  },
  {
    id: "f-007",
    name: "Quinoa, cooked",
    category: "grains",
    source: "usda",
    macros: { kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8, sugar: 0.9, sodium: 7 },
    servings: [
      { label: "½ cup", grams: 92 },
      { label: "1 cup", grams: 185 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 71,
    lastUsed: "3 days ago",
    isFavorite: false,
  },
  {
    id: "f-008",
    name: "Tahini",
    arabicName: "طحينة",
    category: "fats",
    source: "lebanese",
    macros: { kcal: 595, protein: 17, carbs: 21.2, fat: 53.8, fiber: 9.3, sugar: 0.5, sodium: 115 },
    servings: [
      { label: "1 tsp", grams: 6 },
      { label: "1 tbsp", grams: 15 },
    ],
    allergens: ["sesame"],
    verified: true,
    usedInPlans: 88,
    lastUsed: "Today",
    isFavorite: false,
  },
  {
    id: "f-009",
    name: "Chickpeas, cooked",
    arabicName: "حمص",
    category: "legumes",
    source: "lebanese",
    macros: { kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, sugar: 4.8, sodium: 7 },
    servings: [
      { label: "½ cup", grams: 82 },
      { label: "1 cup", grams: 164 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 102,
    lastUsed: "Yesterday",
    isFavorite: true,
  },
  {
    id: "f-010",
    name: "Whey protein, vanilla",
    brand: "Optimum Nutrition",
    category: "protein",
    source: "custom",

    macros: { kcal: 376, protein: 75, carbs: 12.5, fat: 3.1, fiber: 0, sugar: 4.7, sodium: 219 },
    servings: [
      { label: "1 scoop", grams: 32 },
      { label: "2 scoops", grams: 64 },
    ],
    allergens: ["dairy", "soy"],
    verified: true,
    usedInPlans: 134,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-011",
    name: "Banana",
    category: "produce",
    source: "usda",
    macros: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1 },
    servings: [
      { label: "1 small", grams: 90 },
      { label: "1 medium", grams: 118 },
      { label: "1 large", grams: 136 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 198,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-012",
    name: "Avocado",
    category: "produce",
    source: "usda",
    macros: { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7, sodium: 7 },
    servings: [
      { label: "½ avocado", grams: 100 },
      { label: "1 avocado", grams: 200 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 87,
    lastUsed: "Yesterday",
    isFavorite: false,
  },
  {
    id: "f-013",
    name: "Halloumi cheese",
    arabicName: "حلوم",
    category: "dairy",
    source: "lebanese",
    macros: { kcal: 321, protein: 21.8, carbs: 2.2, fat: 25.0, fiber: 0, sugar: 2.2, sodium: 1300 },
    servings: [
      { label: "1 slice", grams: 30 },
      { label: "Portion (80g)", grams: 80 },
    ],
    allergens: ["dairy"],
    verified: true,
    usedInPlans: 41,
    lastUsed: "4 days ago",
    isFavorite: false,
    notes: "High sodium. Cap to 1 serving for hypertensive clients.",
  },
  {
    id: "f-014",
    name: "Lebanese pita bread, white",
    arabicName: "خبز",
    category: "grains",
    source: "lebanese",
    macros: { kcal: 275, protein: 9.1, carbs: 55.7, fat: 1.2, fiber: 2.4, sugar: 1.2, sodium: 536 },
    servings: [
      { label: "¼ loaf", grams: 22 },
      { label: "½ loaf", grams: 45 },
      { label: "1 loaf", grams: 90 },
    ],
    allergens: ["gluten"],
    verified: true,
    usedInPlans: 167,
    lastUsed: "Today",
    isFavorite: true,
  },
  {
    id: "f-015",
    name: "Almonds, raw",
    category: "snacks",
    source: "usda",
    macros: {
      kcal: 579,
      protein: 21.2,
      carbs: 21.6,
      fat: 49.9,
      fiber: 12.5,
      sugar: 4.4,
      sodium: 1,
    },
    servings: [
      { label: "10 almonds", grams: 12 },
      { label: "¼ cup", grams: 35 },
    ],
    allergens: ["nuts"],
    verified: true,
    usedInPlans: 121,
    lastUsed: "Yesterday",
    isFavorite: true,
  },
  {
    id: "f-016",
    name: "Oat milk, unsweetened",
    brand: "Oatly",
    category: "beverages",
    source: "custom",

    macros: { kcal: 40, protein: 1.0, carbs: 6.5, fat: 1.5, fiber: 0.8, sugar: 4.0, sodium: 42 },
    servings: [
      { label: "1 cup", grams: 240 },
      { label: "1 tbsp", grams: 15 },
    ],
    allergens: [],
    verified: true,
    usedInPlans: 58,
    lastUsed: "Today",
    isFavorite: false,
  },
  {
    id: "f-017",
    name: "Tabbouleh (homemade)",
    arabicName: "تبولة",
    category: "prepared",
    source: "lebanese",
    macros: { kcal: 142, protein: 3.2, carbs: 16.5, fat: 7.8, fiber: 3.6, sugar: 2.4, sodium: 188 },
    servings: [
      { label: "Small bowl", grams: 150 },
      { label: "Large bowl", grams: 250 },
    ],
    allergens: ["gluten"],
    verified: false,
    usedInPlans: 34,
    lastUsed: "5 days ago",
    isFavorite: false,
  },
  {
    id: "f-018",
    name: "Egg, whole, large",
    category: "protein",
    source: "usda",
    macros: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, sugar: 0.4, sodium: 142 },
    servings: [
      { label: "1 egg", grams: 50 },
      { label: "2 eggs", grams: 100 },
      { label: "3 eggs", grams: 150 },
    ],
    allergens: ["eggs"],
    verified: true,
    usedInPlans: 178,
    lastUsed: "Today",
    isFavorite: true,
  },
];
