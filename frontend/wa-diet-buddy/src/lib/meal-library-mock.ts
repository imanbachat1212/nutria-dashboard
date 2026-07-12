export type RecipeCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "dessert"
  | "drink";

export type RecipeCuisine =
  | "lebanese"
  | "mediterranean"
  | "levantine"
  | "international"
  | "asian"
  | "italian";

export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "eggs"
  | "soy"
  | "shellfish"
  | "sesame";

export type DietTag =
  | "vegan"
  | "vegetarian"
  | "high-protein"
  | "low-carb"
  | "keto"
  | "gluten-free"
  | "dairy-free"
  | "pcos-friendly"
  | "ramadan";

export interface Ingredient {
  name: string;
  amount: string;
}

export interface RecipeMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  arabicName?: string;
  category: RecipeCategory;
  cuisine: RecipeCuisine;
  image: string; // emoji placeholder
  coverHue: string; // tailwind bg class for card cover
  photoUrl?: string; // uploaded cover photo URL
  prepMin: number;
  cookMin: number;
  servings: number;
  macros: RecipeMacros;
  ingredients: Ingredient[];
  steps: string[];
  allergens: Allergen[];
  diets: DietTag[];
  rating: number; // 0-5
  usedInPlans: number;
  lastUsed: string;
  author: string;
  isFavorite: boolean;
  verified: boolean;
  notes?: string;
}

export const CATEGORY_META: Record<RecipeCategory, { label: string; emoji: string }> = {
  breakfast: { label: "Breakfast", emoji: "🌅" },
  lunch: { label: "Lunch", emoji: "🥗" },
  dinner: { label: "Dinner", emoji: "🍽️" },
  snack: { label: "Snack", emoji: "🥜" },
  dessert: { label: "Dessert", emoji: "🍰" },
  drink: { label: "Drink", emoji: "🥤" },
};

export const DIET_LABEL: Record<DietTag, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  "high-protein": "High protein",
  "low-carb": "Low carb",
  keto: "Keto",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "pcos-friendly": "PCOS-friendly",
  ramadan: "Ramadan",
};

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Dairy",
  nuts: "Nuts",
  eggs: "Eggs",
  soy: "Soy",
  shellfish: "Shellfish",
  sesame: "Sesame",
};

export const RECIPES: Recipe[] = [
  {
    id: "r-001",
    name: "Foul Moudammas Bowl",
    arabicName: "فول مدمس",
    category: "breakfast",
    cuisine: "lebanese",
    image: "🫘",
    coverHue: "bg-amber-100",
    prepMin: 5,
    cookMin: 10,
    servings: 1,
    macros: { kcal: 310, protein: 16, carbs: 38, fat: 9, fiber: 11 },
    ingredients: [
      { name: "Fava beans, cooked", amount: "150 g" },
      { name: "Lemon juice", amount: "1 tbsp" },
      { name: "Olive oil", amount: "1 tsp" },
      { name: "Garlic, crushed", amount: "1 clove" },
      { name: "Cumin", amount: "¼ tsp" },
      { name: "Tomato, diced", amount: "60 g" },
      { name: "Parsley", amount: "2 tbsp" },
    ],
    steps: [
      "Warm fava beans with 2 tbsp cooking liquid.",
      "Mash lightly, stir in garlic, lemon, cumin, olive oil.",
      "Top with tomato and parsley. Serve with ¼ pita.",
    ],
    allergens: [],
    diets: ["vegan", "high-protein", "ramadan", "dairy-free", "gluten-free"],
    rating: 4.8,
    usedInPlans: 42,
    lastUsed: "2 days ago",
    author: "Sura Hawli",
    isFavorite: true,
    verified: true,
    notes: "Client favorite for Ramadan sohour. Pairs with cucumber salad.",
  },
  {
    id: "r-002",
    name: "Grilled Chicken Tabbouleh",
    arabicName: "تبولة دجاج",
    category: "lunch",
    cuisine: "lebanese",
    image: "🥗",
    coverHue: "bg-emerald-100",
    prepMin: 15,
    cookMin: 12,
    servings: 1,
    macros: { kcal: 480, protein: 49, carbs: 22, fat: 19, fiber: 6 },
    ingredients: [
      { name: "Chicken breast", amount: "150 g" },
      { name: "Bulgur, fine", amount: "30 g" },
      { name: "Parsley, chopped", amount: "1 cup" },
      { name: "Mint", amount: "2 tbsp" },
      { name: "Tomato", amount: "100 g" },
      { name: "Lemon juice", amount: "2 tbsp" },
      { name: "Olive oil", amount: "1 tbsp" },
    ],
    steps: [
      "Marinate chicken with lemon, garlic, sumac. Grill 5 min/side.",
      "Soak bulgur 10 min, drain.",
      "Toss bulgur with parsley, mint, tomato, lemon, oil.",
      "Slice chicken over tabbouleh.",
    ],
    allergens: ["gluten"],
    diets: ["high-protein", "dairy-free"],
    rating: 4.9,
    usedInPlans: 67,
    lastUsed: "Today",
    author: "Sura Hawli",
    isFavorite: true,
    verified: true,
  },
  {
    id: "r-003",
    name: "Baked Salmon & Quinoa",
    category: "dinner",
    cuisine: "mediterranean",
    image: "🐟",
    coverHue: "bg-rose-100",
    prepMin: 8,
    cookMin: 18,
    servings: 1,
    macros: { kcal: 520, protein: 38, carbs: 32, fat: 24, fiber: 5 },
    ingredients: [
      { name: "Salmon fillet", amount: "140 g" },
      { name: "Quinoa, cooked", amount: "½ cup" },
      { name: "Zucchini", amount: "100 g" },
      { name: "Bell pepper", amount: "100 g" },
      { name: "Olive oil", amount: "1 tbsp" },
      { name: "Lemon", amount: "½" },
    ],
    steps: [
      "Heat oven to 200°C.",
      "Toss veg with oil, salt, roast 15 min.",
      "Add salmon, lemon slices on top, bake 10 min.",
      "Serve over quinoa.",
    ],
    allergens: [],
    diets: ["high-protein", "gluten-free", "dairy-free", "pcos-friendly"],
    rating: 4.7,
    usedInPlans: 38,
    lastUsed: "Yesterday",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
  {
    id: "r-004",
    name: "Greek Yogurt Berry Bowl",
    category: "snack",
    cuisine: "international",
    image: "🫐",
    coverHue: "bg-violet-100",
    prepMin: 3,
    cookMin: 0,
    servings: 1,
    macros: { kcal: 220, protein: 19, carbs: 24, fat: 5, fiber: 4 },
    ingredients: [
      { name: "Greek yogurt 2%", amount: "170 g" },
      { name: "Mixed berries", amount: "80 g" },
      { name: "Honey", amount: "1 tsp" },
      { name: "Crushed almonds", amount: "10 g" },
    ],
    steps: ["Layer yogurt, berries, drizzle honey, top with almonds."],
    allergens: ["dairy", "nuts"],
    diets: ["vegetarian", "high-protein", "gluten-free"],
    rating: 4.6,
    usedInPlans: 91,
    lastUsed: "Today",
    author: "Sura Hawli",
    isFavorite: true,
    verified: true,
  },
  {
    id: "r-005",
    name: "Lentil Mjadara",
    arabicName: "مجدرة",
    category: "dinner",
    cuisine: "lebanese",
    image: "🍲",
    coverHue: "bg-orange-100",
    prepMin: 10,
    cookMin: 35,
    servings: 4,
    macros: { kcal: 380, protein: 14, carbs: 60, fat: 10, fiber: 11 },
    ingredients: [
      { name: "Brown lentils", amount: "200 g" },
      { name: "Bulgur, coarse", amount: "150 g" },
      { name: "Onion, sliced", amount: "2 large" },
      { name: "Olive oil", amount: "3 tbsp" },
      { name: "Cumin", amount: "1 tsp" },
    ],
    steps: [
      "Boil lentils until tender, 20 min.",
      "Caramelize onions in olive oil, low heat 20 min.",
      "Add bulgur, half the onions, cumin, simmer 15 min.",
      "Top with remaining onions. Serve with yogurt or salad.",
    ],
    allergens: ["gluten"],
    diets: ["vegan", "dairy-free", "high-protein"],
    rating: 4.9,
    usedInPlans: 54,
    lastUsed: "3 days ago",
    author: "Sura Hawli",
    isFavorite: true,
    verified: true,
  },
  {
    id: "r-006",
    name: "Shakshuka",
    category: "breakfast",
    cuisine: "mediterranean",
    image: "🍳",
    coverHue: "bg-red-100",
    prepMin: 5,
    cookMin: 15,
    servings: 2,
    macros: { kcal: 290, protein: 18, carbs: 14, fat: 18, fiber: 4 },
    ingredients: [
      { name: "Eggs", amount: "4" },
      { name: "Tomato, crushed", amount: "400 g" },
      { name: "Onion", amount: "1" },
      { name: "Bell pepper", amount: "1" },
      { name: "Paprika, cumin", amount: "1 tsp each" },
      { name: "Olive oil", amount: "1 tbsp" },
    ],
    steps: [
      "Sauté onion + pepper 5 min.",
      "Add tomato and spices, simmer 8 min.",
      "Crack eggs into wells, cover, cook 5 min.",
    ],
    allergens: ["eggs"],
    diets: ["vegetarian", "high-protein", "gluten-free", "low-carb"],
    rating: 4.8,
    usedInPlans: 31,
    lastUsed: "1 week ago",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
  {
    id: "r-007",
    name: "Hummus & Veggie Platter",
    arabicName: "حمص",
    category: "snack",
    cuisine: "lebanese",
    image: "🫛",
    coverHue: "bg-lime-100",
    prepMin: 10,
    cookMin: 0,
    servings: 2,
    macros: { kcal: 260, protein: 9, carbs: 28, fat: 13, fiber: 8 },
    ingredients: [
      { name: "Chickpeas, cooked", amount: "200 g" },
      { name: "Tahini", amount: "2 tbsp" },
      { name: "Lemon juice", amount: "2 tbsp" },
      { name: "Garlic", amount: "1 clove" },
      { name: "Carrot, cucumber sticks", amount: "150 g" },
    ],
    steps: [
      "Blend chickpeas, tahini, lemon, garlic, 2 tbsp ice water until smooth.",
      "Serve with veggie sticks.",
    ],
    allergens: ["sesame"],
    diets: ["vegan", "dairy-free", "gluten-free"],
    rating: 4.7,
    usedInPlans: 48,
    lastUsed: "Today",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
  {
    id: "r-008",
    name: "Overnight Oats & Whey",
    category: "breakfast",
    cuisine: "international",
    image: "🥣",
    coverHue: "bg-yellow-100",
    prepMin: 5,
    cookMin: 0,
    servings: 1,
    macros: { kcal: 410, protein: 32, carbs: 49, fat: 9, fiber: 8 },
    ingredients: [
      { name: "Rolled oats", amount: "50 g" },
      { name: "Whey protein", amount: "1 scoop" },
      { name: "Almond milk", amount: "200 ml" },
      { name: "Chia seeds", amount: "10 g" },
      { name: "Banana", amount: "½" },
    ],
    steps: ["Mix all, refrigerate overnight. Top with banana before serving."],
    allergens: ["dairy", "nuts"],
    diets: ["high-protein", "vegetarian"],
    rating: 4.5,
    usedInPlans: 73,
    lastUsed: "Yesterday",
    author: "Sura Hawli",
    isFavorite: true,
    verified: true,
  },
  {
    id: "r-009",
    name: "Grilled Halloumi Salad",
    category: "lunch",
    cuisine: "mediterranean",
    image: "🧀",
    coverHue: "bg-sky-100",
    prepMin: 8,
    cookMin: 6,
    servings: 1,
    macros: { kcal: 440, protein: 24, carbs: 14, fat: 32, fiber: 5 },
    ingredients: [
      { name: "Halloumi", amount: "80 g" },
      { name: "Mixed greens", amount: "100 g" },
      { name: "Cherry tomato", amount: "80 g" },
      { name: "Cucumber", amount: "60 g" },
      { name: "Olive oil + lemon", amount: "1 tbsp" },
    ],
    steps: ["Grill halloumi 2 min/side.", "Toss salad, top with halloumi."],
    allergens: ["dairy"],
    diets: ["vegetarian", "low-carb", "gluten-free", "keto"],
    rating: 4.6,
    usedInPlans: 22,
    lastUsed: "4 days ago",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
  {
    id: "r-010",
    name: "Beef Kafta Skewers",
    arabicName: "كفتة",
    category: "dinner",
    cuisine: "lebanese",
    image: "🍢",
    coverHue: "bg-stone-200",
    prepMin: 15,
    cookMin: 12,
    servings: 3,
    macros: { kcal: 360, protein: 28, carbs: 4, fat: 26, fiber: 1 },
    ingredients: [
      { name: "Lean ground beef", amount: "400 g" },
      { name: "Onion, grated", amount: "1" },
      { name: "Parsley, chopped", amount: "½ cup" },
      { name: "7-spice", amount: "1 tsp" },
    ],
    steps: [
      "Mix all, form around skewers.",
      "Grill 5–6 min/side. Serve with salad + ¼ pita.",
    ],
    allergens: [],
    diets: ["high-protein", "low-carb", "dairy-free", "gluten-free"],
    rating: 4.8,
    usedInPlans: 29,
    lastUsed: "5 days ago",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
  {
    id: "r-011",
    name: "Chia Pudding & Mango",
    category: "dessert",
    cuisine: "international",
    image: "🥭",
    coverHue: "bg-orange-100",
    prepMin: 5,
    cookMin: 0,
    servings: 1,
    macros: { kcal: 240, protein: 7, carbs: 28, fat: 11, fiber: 10 },
    ingredients: [
      { name: "Chia seeds", amount: "25 g" },
      { name: "Coconut milk, light", amount: "180 ml" },
      { name: "Mango", amount: "80 g" },
      { name: "Vanilla", amount: "¼ tsp" },
    ],
    steps: ["Whisk chia + milk + vanilla. Chill 4 h. Top with mango."],
    allergens: [],
    diets: ["vegan", "gluten-free", "dairy-free"],
    rating: 4.4,
    usedInPlans: 18,
    lastUsed: "1 week ago",
    author: "Sura Hawli",
    isFavorite: false,
    verified: false,
  },
  {
    id: "r-012",
    name: "Iced Matcha Latte",
    category: "drink",
    cuisine: "international",
    image: "🍵",
    coverHue: "bg-emerald-100",
    prepMin: 4,
    cookMin: 0,
    servings: 1,
    macros: { kcal: 90, protein: 5, carbs: 11, fat: 3, fiber: 1 },
    ingredients: [
      { name: "Matcha powder", amount: "1 tsp" },
      { name: "Hot water", amount: "30 ml" },
      { name: "Oat milk", amount: "200 ml" },
      { name: "Ice", amount: "1 cup" },
    ],
    steps: ["Whisk matcha + hot water.", "Pour over ice + oat milk."],
    allergens: [],
    diets: ["vegan", "gluten-free", "dairy-free"],
    rating: 4.3,
    usedInPlans: 12,
    lastUsed: "2 weeks ago",
    author: "Sura Hawli",
    isFavorite: false,
    verified: true,
  },
];

