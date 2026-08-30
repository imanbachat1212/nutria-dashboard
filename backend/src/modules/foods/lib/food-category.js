// Guesses one of this app's 11 category strings (see foods-api.ts's CATEGORY_MAP on the
// frontend — protein/dairy/grains/legumes/vegetables/fruits/fats_oils/nuts_seeds/prepared/
// sweets/beverages) for a USDA import. USDA's own catalog doesn't share this taxonomy, so this
// is a best-effort cascade, most-reliable signal first:
//
//   1. `usdaFoodCategory` (SR Legacy/Foundation's `foodCategory.description`) — a fixed,
//      standardized set of exactly 25 names, confirmed live against the real API. Exact-match
//      lookup, no guessing.
//   2. Keyword match against whichever free-form text is available — `usdaWweiaCategory`
//      (Survey/FNDDS's `wweiaFoodCategoryDescription`, ~150+ compound descriptions, no fixed
//      enum to exact-match) and/or the food's own name/brand (the only signal Branded records
//      carry at all on the detail endpoint). Multi-word/specific phrases are checked before
//      generic single words to avoid known collisions (e.g. "peanut butter" containing "butter").
//   3. Macro-dominance heuristic — only reached when neither of the above produced a match.
//
// Never returns null/undefined — "prepared" is the final catch-all default for a genuinely
// ambiguous food (a far safer generic guess than the old always-"protein" default, since most
// unclassifiable foods are mixed dishes, not literally protein-dominant).

// USDA SR Legacy / Foundation's 25 standardized food-group names, confirmed live (see
// usda-client.js's getUsdaFoodDetails). "Baked Products" and "Dairy and Egg Products" are
// special-cased below rather than given one fixed value, since each spans two of our
// categories (bread vs. cake/cookie; dairy vs. egg).
const SR_FOOD_CATEGORY_MAP = {
  "American Indian/Alaska Native Foods": "prepared",
  "Baby Foods": "prepared",
  "Beef Products": "protein",
  Beverages: "beverages",
  "Breakfast Cereals": "grains",
  "Cereal Grains and Pasta": "grains",
  "Fast Foods": "prepared",
  "Fats and Oils": "fats_oils",
  "Finfish and Shellfish Products": "protein",
  "Fruits and Fruit Juices": "fruits",
  "Lamb, Veal, and Game Products": "protein",
  "Legumes and Legume Products": "legumes",
  "Meals, Entrees, and Side Dishes": "prepared",
  "Nut and Seed Products": "nuts_seeds",
  "Pork Products": "protein",
  "Poultry Products": "protein",
  "Restaurant Foods": "prepared",
  "Sausages and Luncheon Meats": "protein",
  Snacks: "prepared",
  "Soups, Sauces, and Gravies": "prepared",
  "Spices and Herbs": "prepared",
  Sweets: "sweets",
  "Vegetables and Vegetable Products": "vegetables",
};

const SWEET_BAKED_GOODS = ["cookie", "cake", "pie", "brownie", "donut", "doughnut", "pastry"];

function categorizeSrFoodCategory(description, name) {
  const lowerName = name.toLowerCase();
  if (description === "Baked Products") {
    return SWEET_BAKED_GOODS.some((w) => lowerName.includes(w)) ? "sweets" : "grains";
  }
  if (description === "Dairy and Egg Products") {
    // Confirmed live: USDA files butter itself under "Dairy and Egg Products" (its dairy
    // origin), but for this app's taxonomy butter/margarine belong with fats_oils, not dairy —
    // checked before the plainer dairy/egg split below.
    if (lowerName.includes("butter") && !lowerName.includes("buttermilk")) return "fats_oils";
    if (lowerName.includes("margarine")) return "fats_oils";
    return lowerName.includes("egg") ? "protein" : "dairy";
  }
  return SR_FOOD_CATEGORY_MAP[description];
}

// Ordered [phrase, category] pairs — checked in order, first match wins. Multi-word/specific
// phrases are listed before the generic single words they'd otherwise collide with.
const KEYWORD_RULES = [
  // Specific phrases that would otherwise be misread by a generic word below.
  ["peanut butter", "nuts_seeds"],
  ["almond butter", "nuts_seeds"],
  ["cashew butter", "nuts_seeds"],
  ["buttermilk", "dairy"],
  ["cocoa butter", "fats_oils"],
  ["eggplant", "vegetables"], // contains "egg" — must precede the protein rule below
  // Plant-based "milks" are not dairy — must precede the generic "milk" -> dairy rule below.
  ["almond milk", "beverages"],
  ["soy milk", "beverages"],
  ["oat milk", "beverages"],
  ["coconut milk", "beverages"],
  ["rice milk", "beverages"],
  ["cashew milk", "beverages"],
  // A named grain/produce food that happens to also contain a generic word matched much later
  // in this list (sauce/cracker) — must precede those generic rules.
  ["applesauce", "fruits"],
  ["cracker", "grains"],

  // Herbs & spices — USDA's own SR "Spices and Herbs" category (see SR_FOOD_CATEGORY_MAP)
  // maps to "prepared"; this is the fast-path (name-only) equivalent for Branded/Survey
  // records, which otherwise fall through to the macro heuristic and can misfire on a
  // low-calorie herb (e.g. "Basil, raw" tripping the protein-share threshold on noise-level
  // gram amounts).
  ["basil", "prepared"],
  ["oregano", "prepared"],
  ["thyme", "prepared"],
  ["cumin", "prepared"],
  // "cinnamon" deliberately omitted — far more often a flavor descriptor on bread/cereal/
  // dessert names ("Bread, cinnamon") than a standalone spice in this population; the false
  // positives it caused (dragging bread/dessert items into "prepared") outweighed the benefit.
  ["paprika", "prepared"],
  ["parsley", "prepared"],
  ["cilantro", "prepared"],
  ["rosemary", "prepared"],
  // "sage" deliberately omitted — it's a substring of "sausage", which must stay protein.
  ["turmeric", "prepared"],

  // Protein
  ["chicken", "protein"],
  ["turkey", "protein"],
  ["beef", "protein"],
  ["pork", "protein"],
  ["bacon", "protein"],
  ["sausage", "protein"],
  ["ham", "protein"],
  ["salami", "protein"],
  ["bologna", "protein"],
  ["pepperoni", "protein"],
  ["pastrami", "protein"],
  ["prosciutto", "protein"],
  ["hot dog", "protein"],
  ["liver", "protein"],
  ["brain", "protein"],
  ["lamb", "protein"],
  ["veal", "protein"],
  ["salmon", "protein"],
  ["tuna", "protein"],
  ["shrimp", "protein"],
  ["shellfish", "protein"],
  ["seafood", "protein"],
  ["fish", "protein"],
  ["egg", "protein"],
  ["tofu", "protein"],
  ["wurst", "protein"], // bratwurst, knockwurst, etc. — liverwurst already covered by "liver"
  ["meat", "protein"], // generic — after the specific meats above

  // Dairy
  ["milk", "dairy"],
  ["cheese", "dairy"],
  ["yogurt", "dairy"],
  ["yoghurt", "dairy"],

  // Fats & oils
  ["butter", "fats_oils"],
  ["margarine", "fats_oils"],
  [" oil", "fats_oils"],
  ["lard", "fats_oils"],
  ["shortening", "fats_oils"],
  ["mayonnaise", "fats_oils"],

  // Nuts & seeds
  ["almond", "nuts_seeds"],
  ["walnut", "nuts_seeds"],
  ["cashew", "nuts_seeds"],
  ["pistachio", "nuts_seeds"],
  ["pecan", "nuts_seeds"],
  ["macadamia", "nuts_seeds"],
  ["hazelnut", "nuts_seeds"],
  ["peanut", "nuts_seeds"],
  ["nut", "nuts_seeds"], // generic — after the specific names above, catches e.g. "Brazil nuts"
  ["seed", "nuts_seeds"],

  // Legumes
  ["lentil", "legumes"],
  ["chickpea", "legumes"],
  ["bean", "legumes"],
  ["peas", "legumes"], // plural, deliberately not bare "pea" — collides with "peach" otherwise

  // Grains
  ["bread", "grains"],
  ["rice", "grains"],
  ["pasta", "grains"],
  ["noodle", "grains"],
  ["cereal", "grains"],
  ["oat", "grains"],
  ["wheat", "grains"],
  ["quinoa", "grains"],

  // Sweets
  ["candy", "sweets"],
  ["chocolate", "sweets"],
  ["cookie", "sweets"],
  ["cake", "sweets"],
  ["pie", "sweets"],
  ["cobbler", "sweets"],
  ["ice cream", "sweets"],
  ["dessert", "sweets"],
  ["sweetener", "sweets"],
  ["syrup", "sweets"],
  ["agave", "sweets"],
  ["honey", "sweets"],
  ["flan", "sweets"],
  ["vanilla", "sweets"],
  ["freezer pop", "sweets"],
  ["popsicle", "sweets"],

  // Beverages
  ["juice", "beverages"],
  ["cider", "beverages"],
  ["soda", "beverages"],
  ["coffee", "beverages"],
  [" tea", "beverages"],
  ["beverage", "beverages"],
  ["drink", "beverages"],
  ["beer", "beverages"],
  ["wine", "beverages"],
  ["cocktail", "beverages"],
  ["champagne", "beverages"],
  ["brandy", "beverages"],
  ["vodka", "beverages"],
  ["whiskey", "beverages"],
  // Named cocktails that don't literally say the alcohol/beverage word.
  ["bloody mary", "beverages"],
  ["margarita", "beverages"],
  ["mojito", "beverages"],
  ["martini", "beverages"],
  ["daiquiri", "beverages"],
  ["pina colada", "beverages"],
  ["mimosa", "beverages"],
  ["sangria", "beverages"],
  ["screwdriver", "beverages"],
  ["liqueur", "beverages"],

  // Prepared / mixed dishes — a pure sauce/soup/etc. with no other stronger food-type keyword
  // (checked above, e.g. "beef ... sauce" already matched "beef" first) isn't a produce item
  // just because it lists a vegetable, so this is checked before the produce catch-alls below.
  ["popcorn", "prepared"],
  ["fritter", "prepared"],
  ["sauce", "prepared"],
  ["gravy", "prepared"],
  ["soup", "prepared"],
  ["stew", "prepared"],
  ["casserole", "prepared"],

  // Produce. Named fruits/vegetables are listed individually — a food's name is almost always
  // the specific produce item ("Banana, raw"), not the generic word "fruit"/"vegetable" — with
  // the generic words themselves as a final catch-all. Checked after the more specific groups
  // above, since e.g. "fruit juice" is a beverage first, and "bean"/"corn"(via popcorn) already
  // matched a legume/prepared rule above where relevant.
  //
  // Berry names use the stem before the "-y" (e.g. "berr" not "berry") since USDA overwhelmingly
  // uses the plural form ("Blackberries") and English pluralizes "-y" to "-ies", which a bare
  // "-y" keyword would NOT match as a substring — confirmed live: "blueberry" never matched
  // "Blueberries, raw" until switched to the "blueberr" stem.
  ["apple", "fruits"],
  ["banana", "fruits"],
  ["orange", "fruits"],
  ["grape", "fruits"],
  ["strawberr", "fruits"],
  ["blueberr", "fruits"],
  ["raspberr", "fruits"],
  ["blackberr", "fruits"],
  ["cranberr", "fruits"],
  ["berr", "fruits"], // generic fallback for any other named berry (e.g. plain "Berries, NFS")
  ["watermelon", "fruits"],
  ["cantaloupe", "fruits"],
  ["melon", "fruits"],
  ["mango", "fruits"],
  ["pineapple", "fruits"],
  ["peach", "fruits"],
  ["pear", "fruits"],
  ["plum", "fruits"],
  ["cherr", "fruits"], // stem, not "cherry" — same pluralization issue as the berries above
  ["kiwi", "fruits"],
  ["lemon", "fruits"],
  ["lime", "fruits"],
  ["avocado", "fruits"],
  ["apricot", "fruits"],
  ["papaya", "fruits"],
  ["guava", "fruits"],
  ["pomegranate", "fruits"],
  ["raisin", "fruits"],
  ["fig", "fruits"],
  ["plantain", "fruits"],
  ["carrot", "vegetables"],
  ["spinach", "vegetables"],
  ["broccoli", "vegetables"],
  ["lettuce", "vegetables"],
  ["tomato", "vegetables"],
  ["potato", "vegetables"],
  ["onion", "vegetables"],
  ["garlic", "vegetables"],
  ["cucumber", "vegetables"],
  ["zucchini", "vegetables"],
  ["cabbage", "vegetables"],
  ["cauliflower", "vegetables"],
  ["kale", "vegetables"],
  ["celery", "vegetables"],
  ["asparagus", "vegetables"],
  ["eggplant", "vegetables"],
  ["mushroom", "vegetables"],
  ["bamboo", "vegetables"],
  ["pumpkin", "vegetables"],
  ["squash", "vegetables"],
  ["corn", "vegetables"],
  ["beet", "vegetables"],
  ["artichoke", "vegetables"],
  ["sprout", "vegetables"],
  ["vegetable", "vegetables"],
  ["fruit", "fruits"],
];

// Cooking-method modifiers that mention a fat/oil/dairy word without the food actually BEING
// that thing — e.g. "Asparagus, fresh, cooked with oil" is a vegetable, not fats_oils; "Beets,
// canned, cooked, fat added" would slip through if "fat" were itself a keyword (it isn't, but
// "with butter"/"with oil" are common enough FNDDS phrasing to need stripping explicitly).
// Confirmed live: without this, every "<vegetable>, cooked with oil/butter/margarine" FNDDS
// entry was miscategorized, since the generic oil/butter rules are checked before any produce
// name later in KEYWORD_RULES.
const COOKING_METHOD_MODIFIERS = [
  // Compound forms first — "cooked with butter or margarine" contains "with butter", but
  // stripping only that would still leave the trailing "margarine" to match its own rule.
  "with butter or margarine",
  "with oil or margarine",
  "with oil or butter",
  "cooked with oil",
  "cooked with butter",
  "cooked with margarine",
  "with added fat",
  "no added fat",
  "fat added",
  "no butter added",
  "no oil added",
  "no fat added",
  "popped in oil",
  "butter flavored",
  "oil flavored",
  "with oil",
  "with butter",
  "with margarine",
];

function categorizeByKeyword(text) {
  let lower = ` ${text.toLowerCase()} `;
  for (const modifier of COOKING_METHOD_MODIFIERS) {
    lower = lower.replaceAll(modifier, " ");
  }
  for (const [phrase, category] of KEYWORD_RULES) {
    if (lower.includes(phrase)) return category;
  }
  return null;
}

// Coarse last resort when neither FDC's own category nor any keyword matched (typically a
// Branded product with a generic/brand-only name and no recognizable food-type word) — compares
// which macro contributes the most calories, using each macro's own definitive kcal/g
// (protein 4, carbs 4, fat 9), NOT gram-for-gram comparison (which would wrongly favor fat on
// nearly any food since it's the most calorie-dense per gram).
function categorizeByMacros({ protein, carbs, fat }) {
  const proteinKcal = (protein || 0) * 4;
  const carbsKcal = (carbs || 0) * 4;
  const fatKcal = (fat || 0) * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;
  if (totalKcal === 0) return "prepared";

  if (fatKcal >= proteinKcal && fatKcal >= carbsKcal && fatKcal / totalKcal > 0.6) {
    return "fats_oils";
  }
  if (proteinKcal >= carbsKcal && proteinKcal >= fatKcal && proteinKcal / totalKcal > 0.4) {
    return "protein";
  }
  if (carbsKcal >= proteinKcal && carbsKcal >= fatKcal) {
    return "grains";
  }
  return "prepared";
}

export function guessFoodCategory({
  usdaFoodCategory,
  usdaWweiaCategory,
  name,
  brand,
  protein,
  carbs,
  fat,
}) {
  if (usdaFoodCategory) {
    const fromSr = categorizeSrFoodCategory(usdaFoodCategory, name || "");
    if (fromSr) return fromSr;
  }

  const keywordText = [usdaWweiaCategory, name, brand].filter(Boolean).join(" ");
  const fromKeyword = categorizeByKeyword(keywordText);
  if (fromKeyword) return fromKeyword;

  return categorizeByMacros({ protein, carbs, fat });
}
