/**
 * Starter food seed for the `foods` collection.
 *
 * Each entry is per 100 g (edible portion). Values are standard reference
 * figures (USDA-based for common foods; best-available estimates for the
 * Lebanese/prepared items, which vary by recipe — verify before clinical use).
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

  // ---------- PREPARED (Lebanese dishes — values vary by recipe) ----------
  { name: "Hummus", nameAr: "حمص بطحينة", category: "prepared", source: "lebanese", calories: 166, protein: 8, carbs: 14, fat: 10, fiber: 6 },
  { name: "Foul moudammas (with oil)", nameAr: "فول مدمس", category: "prepared", source: "lebanese", calories: 120, protein: 7, carbs: 13, fat: 5, fiber: 5 },
  { name: "Baba ghanoush (mtabbal)", nameAr: "متبل باذنجان", category: "prepared", source: "lebanese", calories: 150, protein: 3, carbs: 9, fat: 12, fiber: 3 },
  { name: "Tabbouleh", nameAr: "تبولة", category: "prepared", source: "lebanese", calories: 130, protein: 2.5, carbs: 12, fat: 8, fiber: 3 },
  { name: "Falafel, fried", nameAr: "فلافل", category: "prepared", source: "lebanese", calories: 333, protein: 13, carbs: 32, fat: 18, fiber: 5 },
  { name: "Kibbeh, fried", nameAr: "كبة مقلية", category: "prepared", source: "lebanese", calories: 280, protein: 12, carbs: 20, fat: 16, fiber: 2 },
  { name: "Manakish zaatar", nameAr: "منقوشة زعتر", category: "prepared", source: "lebanese", calories: 300, protein: 8, carbs: 38, fat: 13, fiber: 4 },
  { name: "Stuffed vine leaves (warak enab)", nameAr: "ورق عنب", category: "prepared", source: "lebanese", calories: 200, protein: 3, carbs: 24, fat: 11, fiber: 3 },

  // ---------- CONDIMENTS / OTHER ----------
  { name: "Zaatar mix", nameAr: "زعتر", category: "condiments", source: "lebanese", calories: 300, protein: 9, carbs: 50, fat: 8, fiber: 20 },
  { name: "Pomegranate molasses", nameAr: "دبس رمان", category: "condiments", source: "lebanese", calories: 280, protein: 1, carbs: 70, fat: 0, fiber: 1 },
  { name: "Honey", nameAr: "عسل", category: "condiments", source: "usda", calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2 },
  { name: "Sugar, white", nameAr: "سكر", category: "condiments", source: "usda", calories: 387, protein: 0, carbs: 100, fat: 0, fiber: 0 },
];

export default foods;
