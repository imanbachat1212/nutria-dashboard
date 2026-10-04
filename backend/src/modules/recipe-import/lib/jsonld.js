// Schema.org Recipe extraction from a raw HTML page (prompt-120).
//
// Deliberately generic: it looks for the standard <script type="application/ld+json"> block
// that WordPress recipe plugins (WP Recipe Maker, Tasty Recipes, Create) emit to earn Google's
// recipe rich-snippet treatment. No site-specific HTML selectors — recipetineats.com and
// eatingwell.com are just two sites that happen to publish the standard, and the parser has no
// idea which site it's looking at.
//
// No HTML parser dependency: the backend has none (no cheerio/jsdom in package.json) and
// doesn't need one here. Pulling the contents of a known script tag out with a regex is the
// whole job — there's no DOM traversal, no selector matching, and the payload inside the tag is
// JSON, which gets a real parser.

// [\s\S] rather than . so the match spans newlines; non-greedy so adjacent blocks don't merge
// into one. The type attribute may carry a charset or come second, hence the loose attr match.
//
// The quotes around the attribute value are OPTIONAL: HTML5 allows bare attribute values, and
// minifiers emit them that way — loveandlemons.com ships
// `<script type=application/ld+json class=yoast-schema-graph>`, which a quotes-required pattern
// misses entirely, reporting a perfectly normal Yoast-powered recipe page as having no data.
// Caught live while checking this parser against sites other than the two in the brief.
const LD_JSON_BLOCK =
  /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function isRecipeNode(node) {
  if (!node || typeof node !== "object") return false;
  // @type is routinely an array (["Recipe","NewsArticle"]) — membership, not equality.
  return asArray(node["@type"]).some((t) => String(t).toLowerCase() === "recipe");
}

// Walks every shape a page might use: a bare object, a top-level array of objects, or the
// @graph wrapper (which is what both of Sura's example sites actually emit). Recurses into
// @graph only — arbitrary deep recursion would start matching nested sub-recipes in
// "related recipes" blocks, which are not the recipe the page is about.
function findRecipeNode(parsed) {
  for (const node of asArray(parsed)) {
    if (isRecipeNode(node)) return node;
    if (node && typeof node === "object" && node["@graph"]) {
      for (const sub of asArray(node["@graph"])) {
        if (isRecipeNode(sub)) return sub;
      }
    }
  }
  return null;
}

/** Every ld+json block on the page, parsed; unparseable blocks are skipped, not fatal. */
function parseAllBlocks(html) {
  const out = [];
  for (const m of html.matchAll(LD_JSON_BLOCK)) {
    const raw = m[1];
    if (!raw || !raw.trim()) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some plugins emit JSON with raw newlines inside string literals, which is invalid but
      // common. One cheap repair pass, then give up on this block.
      try {
        out.push(JSON.parse(raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")));
      } catch {
        /* not our block */
      }
    }
  }
  return out;
}

// ISO 8601 durations as recipe plugins emit them: PT20M, PT1H30M, P0DT0H20M. Returns whole
// minutes; days are included because some plugins emit P1D for overnight marinades.
export function iso8601ToMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return 0;
  const m = value
    .trim()
    .match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  const total =
    (parseFloat(d || 0) * 1440) +
    (parseFloat(h || 0) * 60) +
    parseFloat(min || 0) +
    (parseFloat(s || 0) / 60);
  return Math.round(total) || 0;
}

// recipeYield is wildly inconsistent across sites: 10, "10", "10 servings", "4 to 6",
// ["10", "10 slices"]. Take the first integer that appears; 0 means "couldn't tell", and the
// caller falls back rather than inventing a number.
export function parseYield(value) {
  for (const candidate of asArray(value)) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, Math.round(candidate));
    }
    const m = String(candidate ?? "").match(/\d+/);
    if (m) return Math.max(0, parseInt(m[0], 10));
  }
  return 0;
}

// image: a URL string, an array of them, an ImageObject, or an array of ImageObjects. Takes
// the first usable absolute http(s) URL.
export function parseImageUrl(value) {
  for (const candidate of asArray(value)) {
    const url =
      typeof candidate === "string"
        ? candidate
        : candidate && typeof candidate === "object"
          ? candidate.url || asArray(candidate.contentUrl)[0]
          : null;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

// recipeInstructions: a single blob string, an array of strings, an array of HowToStep objects,
// or HowToSection objects wrapping their own itemListElement arrays (multi-part recipes). All
// four flatten to one ordered list of step strings — section titles are dropped rather than
// becoming steps, since mealSchema.steps is a flat [String] with no section concept.
export function parseInstructions(value) {
  const steps = [];

  const pushText = (text) => {
    const t = stripTags(String(text ?? "")).trim();
    if (t) steps.push(t);
  };

  const walk = (node) => {
    if (node == null) return;
    if (typeof node === "string") {
      // A single blob: split on newlines if the plugin used them, else keep as one step.
      const lines = node.split(/\r?\n+/).map((l) => stripTags(l).trim()).filter(Boolean);
      if (lines.length > 1) lines.forEach((l) => steps.push(l));
      else pushText(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      const type = asArray(node["@type"]).map((t) => String(t).toLowerCase());
      if (type.includes("howtosection") || node.itemListElement) {
        walk(node.itemListElement);
        return;
      }
      pushText(node.text || node.name);
    }
  };

  walk(value);
  return steps;
}

// Instruction text frequently carries inline markup (<b>, <a href>). mealSchema.steps is plain
// text rendered as plain text, so tags would show up literally.
export function stripTags(s) {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&frac12;/gi, "1/2")
    .replace(/&frac14;/gi, "1/4")
    .replace(/&frac34;/gi, "3/4")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull a normalized recipe out of a page's HTML.
 *
 * Returns null when the page carries no Schema.org Recipe at all — the caller turns that into
 * the distinct "paste the text instead" error rather than a generic failure.
 */
export function extractRecipeFromHtml(html) {
  for (const parsed of parseAllBlocks(html)) {
    const node = findRecipeNode(parsed);
    if (!node) continue;

    const ingredientLines = asArray(node.recipeIngredient)
      .map((l) => stripTags(l))
      .filter(Boolean);

    // A "Recipe" node with no ingredient list is a stub (common on category/roundup pages that
    // mark up a teaser). Keep looking — a later block may hold the real one.
    if (!ingredientLines.length) continue;

    return {
      title: stripTags(node.name || "").slice(0, 200),
      ingredientLines,
      steps: parseInstructions(node.recipeInstructions),
      servings: parseYield(node.recipeYield),
      prepTime: iso8601ToMinutes(node.prepTime),
      cookTime: iso8601ToMinutes(node.cookTime),
      imageUrl: parseImageUrl(node.image),
      // Shown read-only in the review UI as a sanity check only. Never saved: this app's macros
      // always come from computeRecipeMacros over matched foods (see the service).
      siteNutrition: normalizeNutrition(node.nutrition),
    };
  }
  return null;
}

// Schema.org NutritionInformation values are strings with units baked in ("389 calories",
// "12 g"). Kept as the raw strings they are — this is a display-only FYI, and reformatting
// numbers the app will never compute with would only make them look authoritative.
function normalizeNutrition(n) {
  if (!n || typeof n !== "object") return null;
  const pick = (k) => (n[k] == null ? null : stripTags(String(n[k])));
  const out = {
    calories: pick("calories"),
    protein: pick("proteinContent"),
    carbs: pick("carbohydrateContent"),
    fat: pick("fatContent"),
    fiber: pick("fiberContent"),
    servingSize: pick("servingSize"),
  };
  return Object.values(out).some((v) => v) ? out : null;
}
