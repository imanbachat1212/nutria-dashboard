import { ApiError } from "../../lib/ApiError.js";
import { uploadImage } from "../../lib/storage.js";
import { listFoods, toPublicFood } from "../foods/foods.service.js";
import { extractRecipeFromHtml } from "./lib/jsonld.js";
import { structureIngredients, structureRawText } from "./lib/ai.js";

// Recipe import (prompt-120) — turns a URL or a block of pasted text into a DRAFT recipe.
//
// Nothing here writes a Meal. The one thing it does persist is the cover image (into the same
// R2 bucket every other image goes to), because a draft that carried a hotlinked third-party
// URL would either break later or quietly leech another site's bandwidth. Everything else is
// returned to the browser, shown in the New Recipe dialog's normal review UI, and saved only
// when Sura presses save — through meals.service.js's ordinary createMeal, unchanged.
//
// MACROS ARE NEVER IMPORTED. A recipe page's own nutrition panel is carried through as
// `siteNutrition` for display only; the saved numbers come from computeRecipeMacros over the
// matched Food documents, exactly as they do for a hand-entered recipe. This is the whole
// reason the import lands in the review UI instead of saving directly: an unmatched ingredient
// has to become a real Food reference before it can contribute anything.

// Some recipe sites 403 an empty or non-browser User-Agent outright. This is the same
// "identify ourselves so general-purpose hosts don't reject us" move webhooks/whatsapp.service.js
// already makes when it pulls a photo.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGE_FETCH_TIMEOUT_MS = 20_000;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PAGE_BYTES = 6 * 1024 * 1024;

// Error codes the frontend switches on. They travel in ApiError's `details` (see
// middleware/error.js, which already serialises it) so the response stays the app's normal
// { error, details } envelope rather than a bespoke shape for this one feature.
export const IMPORT_ERRORS = {
  INVALID_URL: "INVALID_URL",
  FETCH_FAILED: "FETCH_FAILED",
  NO_RECIPE_DATA: "NO_RECIPE_DATA",
  NO_INGREDIENTS: "NO_INGREDIENTS",
};

function importError(code, message) {
  // 422 rather than 500: the request was well-formed, the page just wasn't usable. A 5xx would
  // read as "the app is broken" in logs and monitoring, which this isn't.
  return new ApiError(422, message, { code, fallback: "rawText" });
}

function assertHttpUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw importError(IMPORT_ERRORS.INVALID_URL, "That doesn't look like a valid web address.");
  }
  // The server fetches a caller-supplied URL, so pin the scheme — same cheap guard as the
  // WhatsApp photo path. The endpoint itself is authenticated and gated on meals.create, which
  // is the real control: only staff who can create recipes can reach it at all.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw importError(IMPORT_ERRORS.INVALID_URL, "Only http(s) web addresses can be imported.");
  }
  return parsed;
}

async function fetchPage(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    throw importError(
      IMPORT_ERRORS.FETCH_FAILED,
      timedOut
        ? "That site took too long to respond."
        : `Couldn't reach that site (${err.message}).`,
    );
  }

  if (!res.ok) {
    // 403/402/429 are the bot-protection statuses in practice. The message names the status so
    // a support conversation can tell "the site blocked us" from "the page is gone".
    throw importError(
      IMPORT_ERRORS.FETCH_FAILED,
      `That site refused the request (HTTP ${res.status}).`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_PAGE_BYTES) {
    throw importError(IMPORT_ERRORS.FETCH_FAILED, "That page is unexpectedly large.");
  }
  return buf.toString("utf8");
}

// Pulls the recipe's own photo into our bucket. Never fatal: a recipe with no cover image is a
// perfectly good import, and failing the whole thing because a CDN hiccuped would be worse than
// landing in the dialog with the photo slot empty.
async function importCoverImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    assertHttpUrl(imageUrl);
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > MAX_IMAGE_BYTES) return null;
    // Same folder every meal photo already goes to via /api/media.
    return await uploadImage(buf, "nutri");
  } catch {
    return null;
  }
}

// --- food matching -------------------------------------------------------------------------

const STOPWORDS = new Set(["of", "the", "a", "an", "and", "or", "fresh", "plain", "raw", "large", "medium", "small", "whole"]);

function tokens(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

// "Is this result good enough to attach without Sura looking at it?"
//
// Conservative on purpose. A wrong auto-match is worse than no match: an unmatched row shows up
// empty with the search term pre-filled and is obvious, whereas a confidently-wrong food silently
// contributes wrong macros to a saved recipe. So "high" requires either an exact name match or
// that the food's name accounts for every meaningful word in the search term.
function scoreMatch(searchName, foodName) {
  const a = searchName.trim().toLowerCase();
  const b = String(foodName ?? "").trim().toLowerCase();
  if (!a || !b) return "none";
  if (a === b) return "high";

  const want = tokens(a);
  const haveList = tokens(b);
  const have = new Set(haveList);
  if (!want.length || !haveList.length) return "none";
  const covered = want.filter((t) => have.has(t)).length;
  if (covered !== want.length) return covered / want.length >= 0.5 ? "low" : "none";

  // All search words are present — but that alone is too weak when the search is a SINGLE word,
  // because USDA front-loads a generic noun and then narrows it: searching "eggs" covers every
  // word of "Eggs, Grade A, Large, egg white", which is an egg white, not an egg (0g fat vs
  // ~9.5g). Caught live on the RecipeTin import. So for a one-word search, also require that
  // word to account for a real share of the food's own name; a long trail of qualifiers the
  // search never asked for means the food has been narrowed to something more specific.
  //
  // Multi-word searches ("lemon juice", "baking powder") carry their own specificity and keep
  // the plain all-covered rule.
  if (want.length === 1 && covered / haveList.length < 0.5) return "low";
  return "high";
}

async function matchIngredient(item, userId) {
  if (item.isSection || !item.searchName) return { ...item, food: null, confidence: "none" };

  let foods = [];
  try {
    // The same search the New Recipe dialog's own ingredient box runs (foods.service.listFoods
    // with sortBy "usedInRecipes", prompt-117) — one food-matching path, not two. Staples the
    // practice already cooks with therefore win ties, which is the right bias for a recipe.
    const res = await listFoods({
      page: 1,
      limit: 5,
      search: item.searchName,
      userId,
      sortBy: "usedInRecipes",
    });
    foods = res.foods || [];
  } catch {
    foods = [];
  }

  if (!foods.length) return { ...item, food: null, confidence: "none" };

  // Pick the best-scoring result rather than blindly taking the first: relevance order is by
  // usage, so a "high"-scoring exact name further down should still beat a popular partial.
  let best = null;
  let bestScore = "none";
  const rank = { high: 2, low: 1, none: 0 };
  for (const f of foods) {
    const s = scoreMatch(item.searchName, f.name);
    if (rank[s] > rank[bestScore]) {
      best = f;
      bestScore = s;
    }
  }

  // Only a high-confidence hit is attached. A "low" one is deliberately dropped to null so the
  // row arrives unmatched with its search term pre-filled, which is exactly the state a
  // hand-typed row is in before Sura picks a food — isSavableIngredient() then keeps it out of
  // the save until she does.
  if (bestScore !== "high") return { ...item, food: null, confidence: bestScore };
  return { ...item, food: toPublicFood(best, userId), confidence: "high" };
}

async function matchAll(items, userId) {
  // Sequential rather than Promise.all: each call is a Mongo text search, and a 20-ingredient
  // recipe firing 20 at once on a shared-tier cluster is how you turn a slow import into a
  // timed-out one. Measured cost is dominated by the page fetch and the AI call anyway.
  const out = [];
  for (const item of items) out.push(await matchIngredient(item, userId));
  return out;
}

// --- public API ----------------------------------------------------------------------------

function buildDraft({ source, title, servings, prepTime, cookTime, steps, photo, ingredients, siteNutrition, parser, warnings }) {
  return {
    source,
    // `verified: false` is set by the frontend on save (it's the Meal's field, not the draft's)
    // — flagged here so the shape is self-documenting for whoever reads the response.
    verified: false,
    title: title || "",
    servings: servings || 0,
    prepTime: prepTime || 0,
    cookTime: cookTime || 0,
    steps: steps || [],
    photo: photo || null,
    ingredients,
    siteNutrition: siteNutrition || null,
    parser,
    warnings: warnings.filter(Boolean),
  };
}

export async function importFromUrl({ url, userId }) {
  const parsed = assertHttpUrl(url);
  const html = await fetchPage(parsed.toString());

  const recipe = extractRecipeFromHtml(html);
  if (!recipe) {
    throw importError(
      IMPORT_ERRORS.NO_RECIPE_DATA,
      "That page doesn't publish structured recipe data.",
    );
  }

  const { items, parser, warning } = await structureIngredients(recipe.ingredientLines);
  const [ingredients, photo] = await Promise.all([
    matchAll(items, userId),
    importCoverImage(recipe.imageUrl),
  ]);

  const warnings = [warning];
  if (recipe.imageUrl && !photo) warnings.push("Couldn't download the recipe's photo — add one yourself if you want a cover.");
  if (!recipe.servings) warnings.push("The page didn't state a serving count — set it before saving.");

  return buildDraft({
    source: { kind: "url", url: parsed.toString(), site: parsed.hostname.replace(/^www\./, "") },
    title: recipe.title,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    // Narrative/blurb text is never imported (confirmed out of scope) — `steps` comes only from
    // recipeInstructions, and the recipe's description/headnote fields are not read at all.
    steps: recipe.steps,
    photo,
    ingredients,
    siteNutrition: recipe.siteNutrition,
    parser,
    warnings,
  });
}

export async function importFromText({ rawText, userId }) {
  const { structured, parser: textParser, warning: textWarning } = await structureRawText(rawText);

  if (!structured.ingredientLines.length) {
    throw importError(
      IMPORT_ERRORS.NO_INGREDIENTS,
      "Couldn't find an ingredient list in that text — check it was pasted in full.",
    );
  }

  const { items, parser: ingParser, warning: ingWarning } = await structureIngredients(structured.ingredientLines);
  const ingredients = await matchAll(items, userId);

  return buildDraft({
    source: { kind: "text" },
    title: structured.title,
    servings: structured.servings,
    prepTime: structured.prepTime || 0,
    cookTime: structured.cookTime || 0,
    steps: structured.steps,
    photo: null,
    ingredients,
    siteNutrition: null,
    // The text path runs two passes; report the weaker one, since that's what limits the result.
    parser: textParser === "ai" && ingParser === "ai" ? "ai" : "heuristic",
    warnings: [textWarning, ingWarning, !structured.servings && "Set a serving count before saving."],
  });
}
