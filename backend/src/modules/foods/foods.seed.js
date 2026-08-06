/**
 * Starter food seed for the `foods` collection.
 *
 * Each entry is per 100 g (edible portion). The first block (`foods`) holds standard reference
 * figures (USDA-based for common foods; best-available HAND ESTIMATES for the Lebanese/prepared
 * items, which vary by recipe — verified: false, verify before clinical use).
 *
 * The second block (LAB_DISHES / LAB_SWEETS, appended at the bottom) holds LAB-VERIFIED data
 * from Hoteit et al. (composite dishes lab-analyzed across 5 Lebanese governorates). These are
 * marked verified: true and carry a `dataSource`. See the big comment above LAB_DISHES for the
 * source-cell conventions (Tr / NA / "<x" / NaCl→sodium) and the vitamin-unit caveat.
 *
 * source: "usda" | "lebanese" | "custom"
 */

const foods = [
  // ---------- PROTEIN ----------
  { name: "Chicken breast, raw, skinless", nameAr: "صدر دجاج", category: "protein", source: "usda", calories: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0 },
  { name: "Chicken thigh, raw, skinless", nameAr: "فخذ دجاج", category: "protein", source: "usda", calories: 121, protein: 19.7, carbs: 0, fat: 4.3, fiber: 0 },
  { name: "Beef, lean ground (90/10), raw", nameAr: "لحم بقري مفروم", category: "protein", source: "usda", calories: 176, protein: 20, carbs: 0, fat: 10, fiber: 0 },
  { name: "Lamb, lean, raw", nameAr: "لحم غنم", category: "protein", source: "usda", calories: 143, protein: 20.6, carbs: 0, fat: 6.2, fiber: 0 },
  { name: "Egg, whole, raw", nameAr: "بيض", category: "protein", source: "usda", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 },
  { name: "Egg white, raw", nameAr: "بياض البيض", category: "protein", source: "usda", calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0 },
  { name: "Salmon, raw", nameAr: "سلمون", category: "protein", source: "usda", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  { name: "Tuna, canned in water, drained", nameAr: "تونة معلبة", category: "protein", source: "usda", calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0 },
  { name: "Cod / white fish, raw", nameAr: "سمك أبيض", category: "protein", source: "usda", calories: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0 },
  { name: "Shrimp, raw", nameAr: "روبيان", category: "protein", source: "usda", calories: 85, protein: 20, carbs: 0, fat: 0.5, fiber: 0 },
  { name: "Turkey breast, raw", nameAr: "صدر حبش", category: "protein", source: "usda", calories: 114, protein: 24, carbs: 0, fat: 1.7, fiber: 0 },

  // ---------- DAIRY ----------
  { name: "Milk, whole (3%)", nameAr: "حليب كامل الدسم", category: "dairy", source: "usda", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 },
  { name: "Milk, low-fat (1%)", nameAr: "حليب قليل الدسم", category: "dairy", source: "usda", calories: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0 },
  { name: "Greek yogurt, plain 2%", nameAr: "لبن يوناني", category: "dairy", source: "usda", calories: 73, protein: 9.9, carbs: 3.8, fat: 2, fiber: 0 },
  { name: "Labneh", nameAr: "لبنة", category: "dairy", source: "lebanese", calories: 150, protein: 7, carbs: 5, fat: 11, fiber: 0 },
  { name: "Halloumi cheese", nameAr: "جبنة حلوم", category: "dairy", source: "lebanese", calories: 321, protein: 21, carbs: 2, fat: 25, fiber: 0 },
  { name: "Feta cheese", nameAr: "جبنة فيتا", category: "dairy", source: "usda", calories: 264, protein: 14, carbs: 4, fat: 21, fiber: 0 },
  { name: "White cheese (baladi)", nameAr: "جبنة بيضاء بلدية", category: "dairy", source: "lebanese", calories: 270, protein: 18, carbs: 3, fat: 21, fiber: 0 },
  { name: "Kashkaval cheese", nameAr: "جبنة قشقوان", category: "dairy", source: "lebanese", calories: 360, protein: 25, carbs: 1, fat: 28, fiber: 0 },
  { name: "Butter", nameAr: "زبدة", category: "dairy", source: "usda", calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0 },

  // ---------- GRAINS ----------
  { name: "White rice, cooked", nameAr: "أرز أبيض مطبوخ", category: "grains", source: "usda", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
  { name: "Brown rice, cooked", nameAr: "أرز بني مطبوخ", category: "grains", source: "usda", calories: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6 },
  { name: "Bulgur (burghol), cooked", nameAr: "برغل مطبوخ", category: "grains", source: "usda", calories: 83, protein: 3, carbs: 19, fat: 0.2, fiber: 4.5 },
  { name: "Bulgur, fine, dry", nameAr: "برغل ناعم", category: "grains", source: "usda", calories: 342, protein: 12, carbs: 76, fat: 1.3, fiber: 12.5 },
  { name: "Freekeh, cooked", nameAr: "فريكة مطبوخة", category: "grains", source: "lebanese", calories: 120, protein: 4, carbs: 22, fat: 1, fiber: 4 },
  { name: "Oats, rolled, dry", nameAr: "شوفان", category: "grains", source: "usda", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6 },
  { name: "Pasta, cooked", nameAr: "معكرونة مطبوخة", category: "grains", source: "usda", calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8 },
  { name: "Arabic bread / pita, white", nameAr: "خبز عربي", category: "grains", source: "lebanese", calories: 275, protein: 9, carbs: 56, fat: 1.2, fiber: 2.2 },
  { name: "Vermicelli (shaariyeh), dry", nameAr: "شعيرية", category: "grains", source: "lebanese", calories: 360, protein: 12, carbs: 74, fat: 1.5, fiber: 2 },

  // ---------- LEGUMES ----------
  { name: "Chickpeas, cooked", nameAr: "حمص مسلوق", category: "legumes", source: "usda", calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6 },
  { name: "Fava beans (foul), cooked", nameAr: "فول", category: "legumes", source: "usda", calories: 110, protein: 7.6, carbs: 19.7, fat: 0.4, fiber: 5.4 },
  { name: "Lentils, brown, cooked", nameAr: "عدس بني", category: "legumes", source: "usda", calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9 },
  { name: "Red lentils, cooked", nameAr: "عدس أحمر", category: "legumes", source: "usda", calories: 100, protein: 7.6, carbs: 17, fat: 0.4, fiber: 4 },
  { name: "White beans, cooked", nameAr: "فاصوليا بيضاء", category: "legumes", source: "usda", calories: 139, protein: 9.7, carbs: 25, fat: 0.5, fiber: 6.3 },
  { name: "Kidney beans, cooked", nameAr: "فاصوليا حمراء", category: "legumes", source: "usda", calories: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 6.4 },

  // ---------- VEGETABLES ----------
  { name: "Tomato", nameAr: "بندورة", category: "vegetables", source: "usda", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
  { name: "Cucumber", nameAr: "خيار", category: "vegetables", source: "usda", calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5 },
  { name: "Parsley", nameAr: "بقدونس", category: "vegetables", source: "usda", calories: 36, protein: 3, carbs: 6, fat: 0.8, fiber: 3.3 },
  { name: "Onion", nameAr: "بصل", category: "vegetables", source: "usda", calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7 },
  { name: "Potato, raw", nameAr: "بطاطا", category: "vegetables", source: "usda", calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 },
  { name: "Eggplant", nameAr: "باذنجان", category: "vegetables", source: "usda", calories: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3 },
  { name: "Zucchini (kousa)", nameAr: "كوسا", category: "vegetables", source: "usda", calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1 },
  { name: "Lettuce", nameAr: "خس", category: "vegetables", source: "usda", calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3 },
  { name: "Spinach", nameAr: "سبانخ", category: "vegetables", source: "usda", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 },
  { name: "Bell pepper", nameAr: "فليفلة", category: "vegetables", source: "usda", calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1 },
  { name: "Carrot", nameAr: "جزر", category: "vegetables", source: "usda", calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 },
  { name: "Cauliflower", nameAr: "قرنبيط", category: "vegetables", source: "usda", calories: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2 },

  // ---------- FRUITS ----------
  { name: "Apple", nameAr: "تفاح", category: "fruits", source: "usda", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
  { name: "Banana", nameAr: "موز", category: "fruits", source: "usda", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
  { name: "Orange", nameAr: "برتقال", category: "fruits", source: "usda", calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4 },
  { name: "Grapes", nameAr: "عنب", category: "fruits", source: "usda", calories: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9 },
  { name: "Dates, medjool", nameAr: "تمر", category: "fruits", source: "usda", calories: 277, protein: 1.8, carbs: 75, fat: 0.2, fiber: 6.7 },
  { name: "Watermelon", nameAr: "بطيخ", category: "fruits", source: "usda", calories: 30, protein: 0.6, carbs: 8, fat: 0.2, fiber: 0.4 },
  { name: "Strawberry", nameAr: "فراولة", category: "fruits", source: "usda", calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2 },

  // ---------- FATS & OILS ----------
  { name: "Olive oil", nameAr: "زيت زيتون", category: "fats_oils", source: "usda", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  { name: "Tahini", nameAr: "طحينة", category: "fats_oils", source: "lebanese", calories: 595, protein: 17, carbs: 21, fat: 54, fiber: 9 },
  { name: "Ghee (samneh)", nameAr: "سمنة", category: "fats_oils", source: "lebanese", calories: 900, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  { name: "Olives, green", nameAr: "زيتون أخضر", category: "fats_oils", source: "usda", calories: 145, protein: 1, carbs: 4, fat: 15, fiber: 3.3 },
  { name: "Avocado", nameAr: "أفوكادو", category: "fats_oils", source: "usda", calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 6.7 },

  // ---------- NUTS & SEEDS ----------
  { name: "Almonds", nameAr: "لوز", category: "nuts_seeds", source: "usda", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
  { name: "Walnuts", nameAr: "جوز", category: "nuts_seeds", source: "usda", calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7 },
  { name: "Pistachios", nameAr: "فستق حلبي", category: "nuts_seeds", source: "usda", calories: 560, protein: 20, carbs: 28, fat: 45, fiber: 10 },
  { name: "Cashews", nameAr: "كاجو", category: "nuts_seeds", source: "usda", calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3 },
  { name: "Sesame seeds", nameAr: "سمسم", category: "nuts_seeds", source: "usda", calories: 573, protein: 17, carbs: 23, fat: 50, fiber: 12 },

  // ---------- PREPARED (Lebanese dishes — HAND-ESTIMATED, values vary by recipe) ----------
  // NOTE: The five previously-listed estimates (Hummus, Foul moudammas, Tabbouleh, Falafel,
  // Stuffed vine leaves) were REMOVED from this section — they are now produced from the
  // Hoteit et al. lab-verified table below (see LAB_DISHES + DISH_NAME_OVERRIDES), which reuses
  // their exact `name` so the seed UPDATES the existing documents in place instead of
  // duplicating them. The three below have no lab counterpart in that dataset, so they remain
  // best-available estimates (verified: false). Baba ghanouj/mtabbal and baked-tray kibbeh DO
  // appear in the lab table but as distinct dishes (see the note above LAB_DISHES) — kept
  // separate on purpose, not merged.
  { name: "Baba ghanoush (mtabbal)", nameAr: "متبل باذنجان", category: "prepared", source: "lebanese", calories: 150, protein: 3, carbs: 9, fat: 12, fiber: 3 },
  { name: "Kibbeh, fried", nameAr: "كبة مقلية", category: "prepared", source: "lebanese", calories: 280, protein: 12, carbs: 20, fat: 16, fiber: 2 },
  { name: "Manakish zaatar", nameAr: "منقوشة زعتر", category: "prepared", source: "lebanese", calories: 300, protein: 8, carbs: 38, fat: 13, fiber: 4 },

  // ---------- CONDIMENTS / OTHER ----------
  // NOTE: the "condiments" category was retired (2026-08) to free up horizontal space in the
  // Food Database filter bar. None of these 4 items has a clean fit among the remaining
  // categories — reassigned as the least-wrong option, confirmed with the dietitian:
  //   - Zaatar mix, Pomegranate molasses -> "prepared" (savory pantry items, no sweets fit)
  //   - Honey, Sugar, white             -> "sweets" (pure sweeteners, no better fit)
  { name: "Zaatar mix", nameAr: "زعتر", category: "prepared", source: "lebanese", calories: 300, protein: 9, carbs: 50, fat: 8, fiber: 20 },
  { name: "Pomegranate molasses", nameAr: "دبس رمان", category: "prepared", source: "lebanese", calories: 280, protein: 1, carbs: 70, fat: 0, fiber: 1 },
  { name: "Honey", nameAr: "عسل", category: "sweets", source: "usda", calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2 },
  { name: "Sugar, white", nameAr: "سكر", category: "sweets", source: "usda", calories: 387, protein: 0, carbs: 100, fat: 0, fiber: 0 },
];

/* ============================================================================================
 * LAB-VERIFIED LEBANESE DISHES & ARABIC SWEETS — Hoteit et al.
 * ============================================================================================
 * Source: Hoteit et al., composite dishes lab-analyzed across 5 Lebanese governorates
 * (F1000Research 2020 / Nutrients 2021 / PLOS One 2024). Per 100 g edible portion.
 * These are real measured values — NOT AI/hand estimates — so they are seeded with
 * verified: true and dataSource set. Where a dish reuses the exact `name` of one of the old
 * hand-typed estimates above (via DISH_NAME_OVERRIDES), the name-keyed seed upsert UPDATES that
 * document in place rather than creating a duplicate.
 *
 * SOURCE-CELL CONVENTIONS (see helpers below):
 *  - "Tr"   → trace: detected but below the quantification limit. Stored as null, NOT 0.
 *             (0 would falsely assert "measured, confirmed absent"; the nutrient is present.)
 *  - "<0.1" / "<1" → below the stated detection limit. Also stored as null (an upper bound, not
 *             a measured quantity) — same reasoning as Tr.
 *  - "NA"   → not analyzed. Stored as null.
 *  DECISION/LIMITATION: a single nullable numeric column cannot preserve the Tr-vs-"<x"-vs-NA
 *  distinction, so all three collapse to null here. The semantic difference ("present but
 *  unquantified" vs "not measured") is recorded only in this comment + the dataSource citation.
 *  Don't read a null micronutrient on these foods as a confirmed zero.
 *
 * SODIUM: the dishes table gives NaCl (table salt) in GRAMS, not sodium. Sodium is ~39.3% of
 *  NaCl by mass, so sodium_mg = NaCl_g × 393 (see naclToSodium). The raw NaCl gram value is NOT
 *  stored directly into the mg `sodium` field. The sweets table has no NaCl column → sodium null.
 *
 * ⚠️ VITAMIN UNIT CAVEAT: the source tables did not label vitamin units. Values are stored RAW,
 *  as published. They are NOT unit-verified — see food.model.js and TODO.md before using vitamin
 *  values in any clinical/dosing calculation.
 * ============================================================================================ */

// Parse a raw source cell into a stored value. Non-quantified cells → null (see conventions).
function cell(v) {
  if (v === "NA" || v === "Tr") return null;
  if (typeof v === "string" && v.trim().startsWith("<")) return null;
  return v; // already a Number in the tables below
}

// NaCl grams → sodium mg (sodium is 39.3% of salt by mass). null/Tr NaCl → null sodium, not 0.
function naclToSodium(nacl) {
  const g = cell(nacl);
  return g == null ? null : Math.round(g * 393);
}

const DATA_SOURCE = "Hoteit et al., lab-analyzed";

// Overlaps with the hand-typed estimates above — reuse the EXACT existing `name` so the seed
// updates those documents in place (no duplicate row). Keyed by the lab dish's English name.
const DISH_NAME_OVERRIDES = {
  "Falafel": "Falafel, fried",
  "Foul moudamas": "Foul moudammas (with oil)",
  "Hommos bi tahini": "Hummus",
  "Tabboula": "Tabbouleh",
  "Warak enab": "Stuffed vine leaves (warak enab)",
};

// Traditional dishes. Columns:
// [ en, ar, carbs, protein, fat, kcal, NaCl(g), iron, fiber, vitA, vitD, vitE, vitC ]
// NOTE: "Baba ghanouj" (plain grilled eggplant, 39 kcal) and "Kebba bil saynia" (baked-tray
// kibbeh) are kept as NEW dishes — they are distinct from the hand-typed "Baba ghanoush
// (mtabbal)" (tahini dip, 150 kcal) and "Kibbeh, fried" above, not the same dish.
const LAB_DISHES = [
  ["Baba ghanouj", "بابا غنوج", 4.5, 1.1, 1.8, 39, 0.8, 0.7, 3.1, "Tr", "Tr", 0.1, "Tr"],
  ["Batata mahchi", "بطاطا محشى", 18, 5, 5.7, 143, 1, 1, 1.8, "Tr", "Tr", "Tr", "Tr"],
  ["Borgul bi banadoura", "برغل بندورة", 20.8, 3, 5.6, 146, 1.1, 1.3, 4.2, "Tr", "Tr", 1.5, "Tr"],
  ["Chichbarak", "شيش برك", 18.7, 4.8, 6.7, 154, 0.9, 2, "Tr", "Tr", "Tr", "Tr", "Tr"],
  ["Falafel", "فلافل", 36.5, 13.3, 15.6, 339, 1.5, 2.1, 8.7, "Tr", "Tr", 0.1, "Tr"],
  ["Fatayer sabanikh", "فطائر سبانخ", 27.2, 5.3, 20.1, 311, 1.7, 4.8, 2.1, "Tr", "Tr", 0.1, "Tr"],
  ["Fattat Hommos", "فتة حمص", 15.8, 6.5, 7.7, 159, 0.6, 1.2, 5.5, "Tr", "Tr", 0.5, "Tr"],
  ["Fattoush", "فتوش", 7.2, 1.5, 1.9, 52, 0.7, 1, 6, "Tr", "Tr", 0.1, 7.2],
  ["Foul moudamas", "فول مدمس", 14.2, 5.3, 4.2, 116, 1.2, 0.7, 3.5, "Tr", "Tr", 0.2, 10],
  ["Hindbe bil zet", "هندبة بالزيت", 5.9, 2.5, 22.4, 235, 1, 1.9, 5.3, "Tr", "Tr", 0.8, 2.6],
  ["Hommos bi tahini", "حمص بالطحينة", 17.2, 7.5, 5.2, 146, 0.8, 1, 5.7, "Tr", "Tr", "Tr", "Tr"],
  ["Kafta wa batata", "كفتة وبطاطا", 7, 8.8, 3.4, 94, 1, 2.4, 1.4, "Tr", "Tr", "Tr", "Tr"],
  ["Kebba bil saynia", "كبة بالصينية", 19.7, 11.3, 15.8, 266, 1.1, 1.8, 4.8, "Tr", "Tr", "Tr", "Tr"],
  ["Koussa mahchi", "كوسا محشي", 20.3, 3.8, 2.9, 123, 1.1, 1.4, 1, "Tr", "Tr", "Tr", "Tr"],
  ["Lahm bil ajin", "لحم بالعجين", 37.1, 11.2, 5.6, 244, 0.7, 2, 1, "Tr", "Tr", "Tr", "Tr"],
  ["Loubia bil zet", "لوبيا بالزيت", 7.2, 2.1, 2.8, 62, 0.9, 1.1, 1.9, "Tr", "Tr", 0.5, 2.6],
  ["Malfouf mahchi", "ملفوف محشي", 12.1, 3.8, 1.3, 75, 1.5, 1.4, 1.3, "Tr", "Tr", "Tr", "Tr"],
  ["Moujadara", "مجدرة", 21.8, 5.4, 0.5, 113, 0.8, 1.3, 5.4, "Tr", "Tr", "Tr", "Tr"],
  ["Moghrabia", "مغربية دجاج", 15.6, 6.7, 3.9, 124, 0.6, 1, "Tr", "Tr", "Tr", 0.1, "Tr"],
  ["Mousaka batinjan", "مسقعة باذنجان", 14.8, 3.2, 10.3, 165, 1.1, 1.3, 3.5, "Tr", "Tr", 0.2, 5.6],
  ["Riz a dajaj", "رز عدجاج", 18.8, 7.2, 7, 167, 0.8, 1.6, "Tr", "Tr", "Tr", "Tr", "Tr"],
  ["Riz bi lahma", "رز باللحم", 23, 7.5, 4.8, 165, 0.8, 1.3, 0.8, "Tr", "Tr", "Tr", "Tr"],
  ["Sayadia", "صيادية سمك", 22.1, 6.5, 6.3, 171, 1.1, 1.1, "Tr", "Tr", 3.2, "Tr", "Tr"],
  ["Shawarma dajaj", "شاورما دجاج دون بطاطا", 1.1, 29.7, 8.2, 197, 1.1, 1.5, "Tr", "Tr", "Tr", 0.9, "Tr"],
  ["Shawarma lahma", "شاورما لحمة دون بطاطا", 2.6, 17.5, 11, 179, 1, 1.4, "Tr", "Tr", "Tr", "Tr", 3.8],
  ["Tabboula", "تبولة", 6.1, 1.9, 2.3, 53, 1.1, 1.4, 3.2, "Tr", "Tr", 0.1, 21],
  ["Warak enab", "ورق عنب محشى", 17.7, 4.4, 1.5, 102, 1, 1.3, 6.7, "Tr", "Tr", "Tr", "Tr"],
  ["Yakhnat Bamia", "يخنة باميا", 17, 3.9, 4.3, 122, 1, 1.4, 3, "Tr", "Tr", "Tr", "Tr"],
  ["Yakhnat Fassoulia", "يخنة فاصوليا", 22.6, 8.1, 1.9, 140, 0.9, 1.2, 7.4, "Tr", "Tr", "Tr", "Tr"],
  ["Yakhnat Mouloukhia", "يخنة ملوخية", 11.9, 5.4, 4.8, 112, 1.0, 1.2, 2, "Tr", "Tr", "Tr", "Tr"],
];

// Arabic sweets. Columns: [ en, ar, carbs, protein, fat, kcal, fiber, vitA, vitE, vitC ]
// No NaCl / vitD / iron columns in the sweets source table → those stay null.
// "Maakaron" and "Mafrouka fostok" are NA across every field (see NA_ONLY_SWEETS below) and are
// intentionally omitted from this table; they're inserted name-only, all nutrition null.
// category: "sweets" (own category, mapped in the frontend's CATEGORY_MAP — no longer piggybacks
// on "prepared").
const LAB_SWEETS = [
  ["Baklava mixed", "بقلاوة مشكل", 64, 6.6, 27.3, 474, 11.8, 8.1, 1, 2],
  ["Baklava mixed light", "بقلاوة مشكل لايت", 61.9, 7.1, 28.7, 478, 11.9, 13, 1.2, "Tr"],
  ["Barazik", "برازق", 49, 15.3, 42.1, 553, 4.1, "Tr", "Tr", 8],
  ["Boundoukia", "بندقية", 64.1, 11.5, 23.2, 465, 7.4, "Tr", 4.7, 1],
  ["Daoukia", "داعوقية", 52.8, 7.3, 15.1, 347, 8.8, "Tr", "Tr", 2],
  ["Foustoukia", "فستقية", 59.7, 19.2, 18.5, 446, 8.6, "Tr", 1.3, "Tr"],
  ["Ghourayba", "غريبة", 62.9, 6.8, 32.9, 510, 2.1, "Tr", "Tr", "Tr"],
  ["Halawa", "حلاوة", 45.7, 16.8, 41, 538, 3.9, "Tr", "Tr", "Tr"],
  ["Halawa light", "حلاوة لايت", 57.5, 12.6, 35.6, 531, 3.4, "Tr", "Tr", "Tr"],
  ["Halawat El Jiben", "حلاوة الجبن", 36.7, 9.7, 8.8, 248, 6.8, "Tr", "Tr", 2],
  ["Ish el bulbul", "عش البلبل", 65.8, 7.5, 26.2, 478, 10, 8.4, 0.1, 3],
  ["Kallaj kashta", "كلاج بالقشطة", 33, 3.6, 9.7, 215, 4.6, "Tr", "Tr", "Tr"],
  ["Karabij joz maa crema", "كرابيج بالجوز مع كريما", 61.1, 7.6, 16.5, 391, 4, 15.7, "Tr", "Tr"],
  ["Katayef Kashta", "قطايف بالقشطة", 40.5, 6, 10.5, 260, 1.9, "Tr", "Tr", "Tr"],
  ["Kounafa kashta bil kaak", "كنافة بالقشطة بالكعك", 42.2, 8.1, 8.7, 262, 3.1, "Tr", "Tr", "Tr"],
  ["Kounafa bil jiben", "كنافة بالجبن", 40.4, 6.1, 13.2, 279, 3.1, "Tr", "Tr", "Tr"],
  ["Maakroun wa moushaba", "معكرون ومشبك", 77.1, 3.5, 17.9, 448, 1.5, "Tr", "Tr", "Tr"],
  ["Maamoul tamer", "معمول بالتمر", 68.4, 6.6, 15.6, 410, 7, "Tr", "Tr", 1.4],
  ["Maamoul mad Kashta", "معمول مد بالقشطة", 49.6, 5.3, 8.9, 283, 8.8, "Tr", "Tr", "Tr"],
  ["Maamoul mad joz", "معمول مد بالجوز", 58.8, 8, 25, 443, 3.9, 13.4, 2, 2],
  ["Maamoul fostok", "معمول بالفستق", 53.3, 10.4, 26.9, 444, 6.2, 12.7, "Tr", "Tr"],
  ["Maamoul joz", "معمول بالجوز", 66.2, 10, 18.3, 433, 7.5, 8.9, "Tr", "Tr"],
  ["Madlouka", "مدلوقة", 51.1, 8, 13, 328, 5.2, "Tr", "Tr", "Tr"],
  ["Mafrouka Kashta", "مفروكة بالقشطة", 71.1, 4.3, 17.5, 425, 2.8, "Tr", "Tr", "Tr"],
  ["Moufattaka", "مفتقة", 59.2, 5.9, 10.1, 332, 3, "Tr", "Tr", 2],
  ["Mouhallabiya", "مهلبية", 31.6, 6.2, 7.3, 203, 1.2, "Tr", "Tr", "Tr"],
  ["Moushabak", "مشبك", 71.5, 2.1, 16.4, 410, 0.8, "Tr", "Tr", "<0.1"],
  ["Nammoura", "نمورة", 75.4, 3, 8.8, 376, 8.4, "Tr", "Tr", "<1"],
  ["Osmaliya", "عثملية", 27, 9.3, 17.9, 271, 2.5, "Tr", "Tr", "<1"],
  ["Riz bil Hlib", "رز بالحليب", 32.7, 6.7, 6.5, 204, "Tr", "Tr", "Tr", "<1"],
  ["Saniora", "سنيورة", 68.7, 7.4, 26.4, 490, 1.8, "Tr", "Tr", "<1"],
  ["Sfouf", "صفوف", 55.2, 6.3, 22, 401, 2.5, "Tr", "Tr", "<1"],
  ["Shaaybiyat", "شعيبيات", 39.1, 9.5, 14.7, 298, 1, "Tr", "Tr", "<1"],
  ["Ward el sham", "ورد الشام", 34.4, 8.2, 11.9, 254, 2.3, "Tr", "Tr", "<1"],
  ["Znoud El Sitt", "زنود الست", 41, 4.5, 17.8, 307, 2, "Tr", "Tr", "<1"],
];

// Sweets that are "NA" across every nutrition field — inserted name-only, all nutrition null,
// verified: false. They are NOT clinically usable until real data is supplied.
const NA_ONLY_SWEETS = [
  ["Maakaron", "معكرون"],
  ["Mafrouka fostok", "مفروكة بالفستق"],
];

const dishFoods = LAB_DISHES.map(
  ([en, ar, carbs, protein, fat, kcal, nacl, iron, fiber, vitA, vitD, vitE, vitC]) => ({
    name: DISH_NAME_OVERRIDES[en] || en,
    nameAr: ar,
    category: "prepared",
    source: "lebanese",
    verified: true,
    dataSource: DATA_SOURCE,
    calories: kcal,
    protein,
    carbs,
    fat,
    fiber: cell(fiber),
    sodium: naclToSodium(nacl),
    iron: cell(iron),
    vitaminA: cell(vitA),
    vitaminD: cell(vitD),
    vitaminE: cell(vitE),
    vitaminC: cell(vitC),
  })
);

const sweetFoods = LAB_SWEETS.map(
  ([en, ar, carbs, protein, fat, kcal, fiber, vitA, vitE, vitC]) => ({
    name: en,
    nameAr: ar,
    category: "sweets",
    source: "lebanese",
    verified: true,
    dataSource: DATA_SOURCE,
    calories: kcal,
    protein,
    carbs,
    fat,
    fiber: cell(fiber),
    sodium: null, // sweets source table has no NaCl column
    iron: null,
    vitaminA: cell(vitA),
    vitaminD: null, // sweets source table has no vitamin D column
    vitaminE: cell(vitE),
    vitaminC: cell(vitC),
  })
);

// name-only, everything else null; flagged unusable via verified:false + dataSource note.
const naOnlySweetFoods = NA_ONLY_SWEETS.map(([en, ar]) => ({
  name: en,
  nameAr: ar,
  category: "sweets",
  source: "lebanese",
  verified: false,
  dataSource: "Hoteit et al. — NA (not analyzed); needs data before clinical use",
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  sodium: null,
  iron: null,
  vitaminA: null,
  vitaminD: null,
  vitaminE: null,
  vitaminC: null,
}));

export default [...foods, ...dishFoods, ...sweetFoods, ...naOnlySweetFoods];
