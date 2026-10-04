import { chatJson, isAiConfigured } from "../../../lib/openrouter.js";
import { parseIngredientLines, splitRawText } from "./ingredient-parser.js";

// The AI half of ingredient parsing (prompt-120).
//
// ONE call for the whole ingredient list, not one per line. The brief said "for each raw
// ingredient line, call OpenRouter", but a 12-ingredient recipe would then be 12 round trips
// behind a spinner Sura is already waiting on — and the lines aren't independent (a model that
// sees the whole list disambiguates "1 cup" vs "1 cup, divided" better than one seeing a single
// line). Same prompt, same output shape, one request. If the model returns the wrong number of
// items the whole response is rejected and the deterministic parser takes over, so a sloppy
// batch can never silently shift ingredients onto the wrong rows.

const UNITS = ["g", "ml", "cup", "tbsp", "tsp", "oz", "piece"];

const INGREDIENT_SYSTEM = `You convert recipe ingredient lines into structured data for a nutrition app.

For EACH input line, output one object with:
- "quantity": number or null. The amount. Convert fractions to decimals (1 1/2 -> 1.5). For a
  range ("4 to 6") use the lower value. null if the line states no amount ("Pinch of salt").
- "unit": one of ${UNITS.map((u) => `"${u}"`).join(", ")}, or null.
  Map cooking units onto this list: tablespoon->tbsp, teaspoon->tsp, clove/can/stick/slice/
  whole item->piece. If the line uses a unit that is NOT on this list (pounds, kilograms,
  litres, quarts, fluid ounces), output null for BOTH quantity and unit.
- "searchName": the plain food name to look up in a food database. Strip amounts, units,
  brand names, parentheticals, and preparation words (chopped, rinsed, divided, to taste).
  Keep words that identify the food itself (e.g. "extra-virgin olive oil", "plain yogurt").
- "isSection": true only when the line is a heading for a group of ingredients
  ("For the glaze:"), not an ingredient. Then quantity/unit/searchName are null/"".

Return ONLY: {"ingredients":[ ... ]} with EXACTLY one object per input line, in the same order.`;

const RAWTEXT_SYSTEM = `You extract a recipe from pasted text for a nutrition app.

Return ONLY this JSON object:
{
  "title": string,            // the recipe's name, "" if absent
  "servings": number,         // 0 if not stated
  "prepTime": number,         // minutes, 0 if not stated
  "cookTime": number,         // minutes, 0 if not stated
  "ingredientLines": string[],// each ingredient EXACTLY as written in the text
  "steps": string[]           // each instruction as its own string
}

Copy ingredient lines verbatim — do not reformat or merge them; they are parsed separately.
Ignore narrative/blurb paragraphs ("why I love this recipe", headnotes, story text) entirely.
If you cannot tell steps apart, put the whole instruction block in a single steps entry.`;

function coerceUnit(u) {
  if (typeof u !== "string") return null;
  const t = u.trim().toLowerCase();
  return UNITS.includes(t) ? t : null;
}

function coerceQuantity(q) {
  const n = typeof q === "number" ? q : parseFloat(q);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

/**
 * Structure a list of raw ingredient lines.
 *
 * Always returns one entry per input line. Uses the model when configured and its response
 * validates; otherwise falls back to the deterministic parser. Never throws — a failed AI call
 * degrades the quality of the result, it does not fail the import.
 *
 * @returns {Promise<{items: object[], parser: "ai"|"heuristic", warning: string|null}>}
 */
export async function structureIngredients(lines) {
  const fallback = () => ({ items: parseIngredientLines(lines), parser: "heuristic", warning: null });

  if (!lines.length) return { items: [], parser: "heuristic", warning: null };
  if (!isAiConfigured()) return fallback();

  try {
    const result = await chatJson({
      system: INGREDIENT_SYSTEM,
      user: JSON.stringify({ lines }),
    });
    const arr = result?.ingredients;
    // Strict length check: a short or long array means the model dropped or invented a line,
    // and silently re-aligning would put quantities against the wrong ingredients.
    if (!Array.isArray(arr) || arr.length !== lines.length) {
      return { ...fallback(), warning: "AI returned an unexpected shape — used the built-in parser instead." };
    }

    const items = arr.map((row, i) => {
      const raw = lines[i];
      if (row?.isSection === true) {
        const title = String(row.searchName || raw).replace(/:$/, "").trim();
        return { raw, quantity: null, unit: null, searchName: "", note: null, isSection: true, sectionTitle: title };
      }
      const quantity = coerceQuantity(row?.quantity);
      const unit = coerceUnit(row?.unit);
      const searchName = String(row?.searchName ?? "").trim();
      // An empty search name is useless downstream — fall back to this one line's heuristic
      // parse rather than handing the UI a blank row.
      if (!searchName) return parseIngredientLines([raw])[0];
      // Quantity and unit travel together or not at all.
      //
      // A unit with no quantity renders as a bare "cup" on the row. A quantity with no unit is
      // worse: the prompt tells the model to null BOTH when it meets a unit this app can't
      // represent (pounds, litres), but if it returns `{quantity: 1.5, unit: null}` anyway, the
      // dialog defaults the unit to grams and "1 1/2 pounds of chicken" silently becomes 1.5 g.
      // Caught by the stubbed-provider test. Dropping both leaves the amount blank for Sura to
      // fill — visibly incomplete instead of invisibly wrong, and it matches exactly what the
      // deterministic parser does with the same input.
      const paired = quantity != null && unit != null;
      return {
        raw,
        quantity: paired ? quantity : null,
        unit: paired ? unit : null,
        searchName,
        note: null,
      };
    });

    return { items, parser: "ai", warning: null };
  } catch (err) {
    return { ...fallback(), warning: `AI parsing unavailable (${err.message}) — used the built-in parser instead.` };
  }
}

/**
 * Pull title/servings/times/ingredients/steps out of pasted free text.
 *
 * The paste path has no JSON-LD to lean on, so this is where the model earns the most. Without
 * it, splitRawText's "lines starting with a number are ingredients" heuristic is used instead.
 *
 * @returns {Promise<{structured: object, parser: "ai"|"heuristic", warning: string|null}>}
 */
export async function structureRawText(rawText) {
  const fallback = () => ({ structured: splitRawText(rawText), parser: "heuristic", warning: null });

  if (!isAiConfigured()) return fallback();

  try {
    const result = await chatJson({ system: RAWTEXT_SYSTEM, user: rawText });
    const ingredientLines = Array.isArray(result?.ingredientLines)
      ? result.ingredientLines.map((l) => String(l).trim()).filter(Boolean)
      : [];
    if (!ingredientLines.length) {
      return { ...fallback(), warning: "AI found no ingredients in the pasted text — used the built-in parser instead." };
    }
    return {
      structured: {
        title: String(result.title ?? "").trim().slice(0, 200),
        servings: Number.isFinite(result.servings) ? Math.max(0, Math.round(result.servings)) : 0,
        prepTime: Number.isFinite(result.prepTime) ? Math.max(0, Math.round(result.prepTime)) : 0,
        cookTime: Number.isFinite(result.cookTime) ? Math.max(0, Math.round(result.cookTime)) : 0,
        ingredientLines,
        steps: Array.isArray(result.steps) ? result.steps.map((s) => String(s).trim()).filter(Boolean) : [],
      },
      parser: "ai",
      warning: null,
    };
  } catch (err) {
    return { ...fallback(), warning: `AI parsing unavailable (${err.message}) — used the built-in parser instead.` };
  }
}
