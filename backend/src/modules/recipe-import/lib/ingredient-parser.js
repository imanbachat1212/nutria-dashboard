// Deterministic ingredient-line parser (prompt-120).
//
// WHY THIS EXISTS alongside the AI path: the brief specified an OpenRouter call per the
// WhatsApp coach's pattern, on the understanding that provider config already existed here. It
// doesn't — there is no AI key configured anywhere in this repo (see lib/openrouter.js). An
// import feature that 503s whenever the key is absent would be untestable and unusable today,
// so this runs as the fallback: the AI path is used when configured, this when it isn't, and
// the response says which ran. It is also the safety net when the model times out or returns
// a shape that fails validation — a recipe still imports, just with more rows for Sura to fix.
//
// Scope is deliberately narrow: split "1 1/2 tbsp lemon zest" into {quantity, unit, searchName}.
// It does not try to understand food, only the shape of a recipe line, which is highly regular.

// The only units the rest of the app accepts — GENERIC_UNITS in measure-options.ts and
// UNIT_TO_GRAMS in calc/recipeMacros.js agree on exactly these seven. Anything parsed off a
// page has to land on one of them or on null; inventing a unit here would produce a row the
// New Recipe dialog's measure picker can't represent.
const CANONICAL_UNITS = ["g", "ml", "cup", "tbsp", "tsp", "oz", "piece"];

// Longest-first within each group so "tablespoon" is tested before "tbsp" can match a prefix,
// and so "fluid ounce" never falls through to the weight-ounce rule.
const UNIT_SYNONYMS = [
  ["cup", /^(?:cups?|c)\b/i],
  ["tbsp", /^(?:tablespoons?|tablespoonfuls?|tbsps?|tbs|tbl)\b/i],
  ["tsp", /^(?:teaspoons?|teaspoonfuls?|tsps?|tspn)\b/i],
  ["g", /^(?:grams?|gr|g)\b/i],
  ["ml", /^(?:millilit(?:re|er)s?|mls?|ml)\b/i],
  ["oz", /^(?:ounces?|ozs?|oz)\b/i],
  // Countable nouns all collapse to "piece" — the dialog has no "clove"/"can" unit, and
  // UNIT_TO_GRAMS.piece (50g) is the generic fallback a per-food gramsPerPiece can override.
  ["piece", /^(?:pieces?|cloves?|cans?|tins?|jars?|packets?|packs?|sticks?|slices?|sprigs?|stalks?|heads?|bunch(?:es)?|large|medium|small|whole)\b/i],
];

// Units this app has no representation for. Matching one means "a quantity was present but it
// isn't expressible here" — better to drop the unit and leave grams blank for Sura than to
// silently convert a pound into a wrong number of pieces.
const UNSUPPORTED_UNITS = /^(?:kilograms?|kgs?|kg|pounds?|lbs?|lb|lit(?:re|er)s?|l|quarts?|qt|pints?|pt|gallons?|gal|fl\.?\s?oz|fluid\s+ounces?)\b/i;

const VULGAR_FRACTIONS = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

// Preparation/qualifier words that describe what to DO with an ingredient, not what it is.
// Removing them is what turns "no-salt-added cannellini beans, rinsed" into a term the food
// search can actually match.
const PREP_WORDS = new RegExp(
  "\\b(?:" +
    [
      "finely", "freshly", "roughly", "thinly", "coarsely", "lightly", "well",
      "chopped", "minced", "diced", "sliced", "grated", "shredded", "crushed",
      "rinsed", "drained", "peeled", "trimmed", "halved", "quartered", "cubed",
      "melted", "softened", "divided", "packed", "sifted", "beaten", "whisked",
      "room temperature", "at room temperature", "plus more", "to taste",
      "optional", "for serving", "for garnish", "cut into wedges", "cut into",
      "no-salt-added", "low-sodium", "reduced-sodium", "unsalted", "salted",
    ].join("|") +
    ")\\b",
  "gi",
);

function fractionsToNumber(text) {
  // "1 1/2" / "1/2" / "1½" / "½"
  let t = text;
  for (const [glyph, value] of Object.entries(VULGAR_FRACTIONS)) {
    t = t.replace(new RegExp(glyph, "g"), ` ${value} `);
  }
  t = t.trim();

  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);

  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);

  // "1 0.5" — what a mixed vulgar fraction ("1½") becomes after the substitution above.
  const sum = t.match(/^(\d+(?:\.\d+)?)\s+(\d*\.\d+)$/);
  if (sum) return parseFloat(sum[1]) + parseFloat(sum[2]);

  const plain = t.match(/^\d+(?:\.\d+)?$/);
  if (plain) return parseFloat(t);

  return null;
}

// Pulls every parenthetical aside off the line. RecipeTin doubles them (`((Note 1))`), and
// they hold things like "(15-ounce)" or "(~50-55g each)" that would otherwise be read as the
// ingredient's own quantity. Kept as a note so the review UI can still show the original.
function stripParentheticals(line) {
  let out = line;
  let notes = [];
  let prev;
  do {
    prev = out;
    out = out.replace(/\(([^()]*)\)/g, (_, inner) => {
      if (inner.trim()) notes.push(inner.trim());
      return " ";
    });
  } while (out !== prev);
  return { text: out.replace(/\s+/g, " ").trim(), note: notes.join("; ") || null };
}

function cleanSearchName(text) {
  let t = text;
  // Everything after the first comma is almost always preparation ("beans, rinsed and drained").
  t = t.split(",")[0];
  t = t.replace(PREP_WORDS, " ");
  // "2 cups of flour" -> drop the connective left behind by the unit match.
  t = t.replace(/^\s*(?:of|or)\b/i, " ");
  // "vegetable or canola oil" -> "vegetable oil": take the first alternative, keeping the
  // trailing noun that the alternatives share.
  t = t.replace(/\b(\w+)\s+or\s+\w+\s+(\w+)\s*$/i, "$1 $2");
  t = t.replace(/[.;:]+\s*$/, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Parse one raw recipe ingredient line.
 * @returns {{raw:string, quantity:number|null, unit:string|null, searchName:string, note:string|null}}
 */
export function parseIngredientLine(raw) {
  const original = String(raw ?? "").trim();
  const { text, note } = stripParentheticals(original);

  // A section header in a pasted list ("For the glaze:") has no quantity and ends in a colon.
  if (/^[A-Za-z][^:]{0,40}:$/.test(text)) {
    return { raw: original, quantity: null, unit: null, searchName: "", note, isSection: true,
             sectionTitle: text.replace(/:$/, "").trim() };
  }

  let rest = text;
  let quantity = null;
  let unit = null;

  // Leading amount, including ranges ("4 to 6", "2-3") — take the low end, which is what a
  // cook measuring once would use, and leave the range in the note via the raw line.
  const amount = rest.match(
    /^((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[¼-¾⅐-⅞])(?:\s*(?:-|–|to)\s*(?:\d+(?:\.\d+)?|[¼-¾⅐-⅞]))?/,
  );
  if (amount) {
    quantity = fractionsToNumber(amount[1]);
    rest = rest.slice(amount[0].length).trim();
  } else {
    // "½ cup" with no leading digit is caught above; "Pinch of salt" is not — no quantity.
    const glyph = rest.match(/^[¼-¾⅐-⅞]/);
    if (glyph) {
      quantity = VULGAR_FRACTIONS[glyph[0]] ?? null;
      rest = rest.slice(1).trim();
    }
  }

  if (UNSUPPORTED_UNITS.test(rest)) {
    // Consume the unit token so it doesn't pollute the search name, but emit no unit — the
    // row arrives with a blank measure for Sura to set, rather than a wrong one.
    rest = rest.replace(UNSUPPORTED_UNITS, " ").trim();
    quantity = null;
  } else {
    for (const [canonical, re] of UNIT_SYNONYMS) {
      const m = rest.match(re);
      if (!m) continue;
      // "large"/"medium"/"small"/"whole" are size words, not units: they imply a countable
      // piece but must stay in the search name ("2 large eggs" -> piece, "large eggs").
      const isSizeWord = /^(?:large|medium|small|whole)$/i.test(m[0]);
      unit = canonical;
      if (!isSizeWord) rest = rest.slice(m[0].length).trim();
      break;
    }
  }

  // A bare count with no unit at all ("2 eggs") is a piece count.
  if (quantity != null && !unit && /^[a-z]/i.test(rest)) unit = "piece";

  const searchName = cleanSearchName(rest);
  return {
    raw: original,
    quantity: quantity != null && Number.isFinite(quantity) ? Math.round(quantity * 1000) / 1000 : null,
    unit: unit && CANONICAL_UNITS.includes(unit) ? unit : null,
    searchName,
    note,
  };
}

export function parseIngredientLines(lines) {
  return lines.map(parseIngredientLine);
}

/**
 * Best-effort structure extraction from pasted free text, used only when the AI path is
 * unavailable. Splits a block into an ingredient list and everything else, on the observation
 * that ingredient lines start with a number and instruction lines don't.
 */
export function splitRawText(rawText) {
  const lines = String(rawText ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*‣]\s*/, "").trim())
    .filter(Boolean);

  // A pasted recipe almost always carries its own section headings. Using them as a mode switch
  // beats guessing line by line: it catches the ingredients a "starts with a digit" rule misses
  // ("Pinch of salt", "Salt and pepper to taste") and keeps the headings themselves out of the
  // step list. The digit heuristic stays as the fallback for text with no headings at all.
  const INGREDIENT_HEADING = /^(?:ingredients?|you(?:'| )?ll need|what you need)\b[:\s]*$/i;
  const STEP_HEADING = /^(?:instructions?|method|directions?|steps?|preparation|how to make[^:]*)\b[:\s]*$/i;
  const OTHER_HEADING = /^(?:notes?|nutrition|equipment|tips?|storage)\b[:\s]*$/i;

  const looksLikeIngredient = (l) => /^(?:\d|[¼-¾⅐-⅞])/.test(l) && l.length < 160;

  const ingredientLines = [];
  const stepLines = [];
  let title = "";
  let servings = 0;
  let prepTime = 0;
  let cookTime = 0;
  // null = no heading seen yet, so fall back to the digit heuristic.
  let mode = null;

  for (const line of lines) {
    if (INGREDIENT_HEADING.test(line)) { mode = "ingredients"; continue; }
    if (STEP_HEADING.test(line)) { mode = "steps"; continue; }
    if (OTHER_HEADING.test(line)) { mode = "skip"; continue; }

    const serv = line.match(/\b(?:serves|servings?|yield)\b[^0-9]{0,10}(\d+)/i);
    if (serv && !servings) { servings = parseInt(serv[1], 10); continue; }

    // "Prep: 15 minutes   Cook: 50 minutes" — often one line carrying both.
    //
    // Only in the header block (mode === null) and only on a short line. Without those guards
    // this swallows instructions: "Pour into pan and bake for 50 minutes or until a skewer comes
    // out clean" matches the cook pattern and the whole step vanishes from the method. Caught
    // live on the RecipeTin paste test, which lost exactly that step.
    if (mode === null && line.length <= 80) {
      const prep = line.match(/\bprep(?:aration)?(?:\s*time)?\b[^0-9]{0,12}(\d+)\s*(h|hr|hour|m|min)/i);
      const cook = line.match(/\b(?:cook|bake|total)(?:\s*time)?\b[^0-9]{0,12}(\d+)\s*(h|hr|hour|m|min)/i);
      if (prep && !prepTime) prepTime = parseInt(prep[1], 10) * (/^h/i.test(prep[2]) ? 60 : 1);
      if (cook && !cookTime) cookTime = parseInt(cook[1], 10) * (/^h/i.test(cook[2]) ? 60 : 1);
      if (prep || cook) continue;
    }

    if (mode === "skip") continue;
    if (mode === "ingredients") { ingredientLines.push(line); continue; }
    if (mode === "steps") { stepLines.push(line); continue; }

    if (looksLikeIngredient(line)) ingredientLines.push(line);
    else if (!title && ingredientLines.length === 0 && line.length < 90) title = line;
    else stepLines.push(line);
  }

  return { title, servings, prepTime, cookTime, ingredientLines, steps: stepLines };
}
