export type FoodCategory =
  | "produce"
  | "grains"
  | "protein"
  | "dairy"
  | "legumes"
  | "fats"
  | "beverages"
  | "snacks"
  | "condiments"
  | "prepared";

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

export interface FoodItem {
  id: string;
  name: string;
  arabicName?: string;
  brand?: string;
  category: FoodCategory;
  source: FoodSource;
  macros: FoodMacrosPer100g;
  servings: ServingSize[];
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
  condiments: { label: "Condiments", emoji: "🧂" },
  prepared: { label: "Prepared", emoji: "🥡" },
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
    category: "condiments",
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
