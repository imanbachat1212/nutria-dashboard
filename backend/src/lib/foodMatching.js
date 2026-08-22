// Fuzzy-matches a Food's name against USDA FNDDS's portions reference data to find real
// per-food gram weights for cup/tbsp/tsp/piece/ml — used both by the interactive
// create/update-food hook (foods.service.js) and the one-time historical backfill script
// (food-unit-weights-match-report.js), so the scoring logic lives in exactly one place.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Untouched raw source of truth — a verbatim transcription of every USDA FNDDS portion row
// per food code (no pre-filtering). All unit derivation below happens in memory at load
// time; this file is never written to.
const FNDDS_PATH = path.join(__dirname, "../data/fndds-common-servings.json");

const STOPWORDS = new Set(["with", "and", "in", "of", "a", "an", "the", "ns", "nfs", "not"]);

// Preparation/state descriptors — kept IN scoring (they still matter for matching quality
// between two entries of the same food), but excluded from the "is this food even related"
// overlap check below. Without this, two unrelated foods that are both e.g. "X, cooked" share
// only the word "cooked" and still pass as "related" ("Freekeh, cooked" ~ "Cress, cooked").
const MODIFIER_WORDS = new Set([
  "raw", "cooked", "dry", "dried", "fresh", "frozen", "canned", "whole", "prepared", "ground",
  "fine", "coarse", "boiled", "baked", "broiled", "roasted", "fried", "grilled", "steamed",
  "stewed", "sauteed", "poached", "smoked", "cured", "lean", "extra", "low", "reduced", "fat",
  "unsweetened", "sweetened", "plain", "style", "skinless", "skin", "chopped", "sliced",
  "diced", "mashed", "pureed", "cubed", "shredded", "minced", "large", "small", "medium",
]);

// Light singular/plural normalization ("dates" -> "date", "tomatoes" -> "tomato",
// "berries" -> "berry") — food names are pluralized inconsistently between our DB and FNDDS
// ("Dates, medjool" vs "Date"), and without this a same-food pair scores as if they shared no
// words at all, letting an unrelated entry win the "best match" by coincidence instead.
function singularize(word) {
  if (word.length <= 3 || word.endsWith("ss")) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function normalizeTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

function tokenSet(text) {
  return new Set(normalizeTokens(text).filter((t) => !STOPWORDS.has(t)));
}

function jaccard(a, b) {
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Levenshtein on the sorted, space-joined token lists — tolerant of word-order differences
// ("Chicken breast, raw, skinless" vs "Chicken, breast, meat only, raw") that a plain string
// diff would penalize heavily.
function levRatio(aTokens, bTokens) {
  const a = [...aTokens].sort().join(" ");
  const b = [...bTokens].sort().join(" ");
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function withoutModifiers(tokens) {
  const out = new Set();
  for (const t of tokens) if (!MODIFIER_WORDS.has(t)) out.add(t);
  return out;
}

// Substantive-word overlap is the dominant signal — it's what actually distinguishes "the same
// ingredient" from "a dish that happens to share one modifier word." Full-token jaccard and the
// Levenshtein ratio are secondary refinements/tie-breakers on top of that. Without weighting
// substantive overlap higher, "Strawberry" ties EXACTLY between "Strawberries, raw" and "Pie,
// strawberry" (both share 1 of 2 tokens).
function scoreMatch(ourTokens, fnddsTokens) {
  const substantiveJac = jaccard(withoutModifiers(ourTokens), withoutModifiers(fnddsTokens));
  const jac = jaccard(ourTokens, fnddsTokens);
  const lev = levRatio(ourTokens, fnddsTokens);
  return 0.7 * substantiveJac + 0.2 * jac + 0.1 * lev;
}

// Whether the two token sets share at least one SUBSTANTIVE word (i.e. not just a prep/state
// modifier both happen to use). Our names lead with modifiers ("White rice, cooked") while
// FNDDS descriptions lead with the noun ("Rice, white, cooked"), so comparing literal first
// tokens was unreliable; comparing full-set overlap while ignoring MODIFIER_WORDS catches both
// "these are unrelated foods" (no real overlap) and "these only share 'cooked'" cases.
function hasNoSubstantiveOverlap(a, b) {
  for (const t of a) {
    if (MODIFIER_WORDS.has(t)) continue;
    if (b.has(t)) return false;
  }
  return true;
}

function tierFor(score, coreMismatch) {
  if (coreMismatch) return "no-match";
  if (score >= 0.55) return "match";
  if (score >= 0.35) return "low-confidence";
  return "no-match";
}

// "Rice, white, with peas" / "Beans and white rice" style composite-dish descriptions can
// still score well against a plain ingredient name (they share the core word), but a mixed
// dish's cup weight isn't representative of the plain ingredient's — this dataset sometimes
// has no bare "Rice, white, cooked" entry at all, only "with X" variants. Cap those at
// low-confidence rather than auto-trusting them as a high-confidence match, unless our own
// food name is itself a composite ("Beans and rice").
function looksComposite(rawText) {
  const t = rawText.toLowerCase();
  return t.includes(" with ") || t.includes(" and ");
}

// ── Per-food unit-weight derivation ─────────────────────────────────────────────────────
// fndds-common-servings.json now carries EVERY raw FNDDS portion row per food code
// (nothing pre-filtered), e.g. both "1 cup" and "1 cup, diced" and "Guideline amount per cup
// of hot cereal" can all appear for the same food. This resolves that down to a single
// gram figure per unit, or null when there's genuinely no usable data — never a guess.
const DECOY_RE = /guideline|quantity not specified|per\s/i;

function isDecoyPortion(desc) {
  return DECOY_RE.test(desc);
}

// `contains` finds any candidate row for the unit at all; `exact` identifies an unqualified
// "1 <unit>" row, which always wins outright since it's the least ambiguous signal available.
const UNIT_CONFIG = {
  cup: { contains: /\bcups?\b/i, exact: /^1\s+cups?$/i },
  tbsp: { contains: /\btablespoons?\b|\btbsp\b/i, exact: /^1\s+(?:tablespoons?|tbsp)$/i },
  tsp: { contains: /\bteaspoons?\b|\btsp\b/i, exact: /^1\s+(?:teaspoons?|tsp)$/i },
  piece: { contains: /\bpieces?\b/i, exact: /^1\s+pieces?$/i },
  flOz: { contains: /\bfl\s*\.?\s*oz\b/i, exact: /^1\s+fl\s*\.?\s*oz$/i },
};

// A bare "1 piece/slice" (nothing after it) is a thin cross-sectional slice, not a whole
// item — confirmed on raw carrots (5g via this row vs. 60g for "1 regular carrot" on the
// same food), cucumber (10g), and mushrooms (6g). Misleading as a recipe "piece" unit, which
// a dietitian expects to mean one whole item. Deliberately narrow: only the bare form is
// excluded — "1 piece/slice, any size" (cake, beef/lamb cuts) and "1 regular or small
// piece/slice..." keep resolving exactly as before, since a slice genuinely is the natural
// "piece" serving there.
const BARE_PIECE_SLICE_DESC = "1 piece/slice";

// Resolves the gram weight for one unit of a food from its full FNDDS portion list:
//   1. An exact, unqualified "1 <unit>" row always wins — most literal, least ambiguous.
//   2. Otherwise, among non-decoy "1 <unit>, <qualifier>" rows: if they all agree on the
//      weight, use it. If they disagree (e.g. "1 cup, diced" vs "1 cup, pieces"), prefer
//      whichever has an "NFS" qualifier — the most generic/representative variant — and
//      failing that, the most common (mode) weight among them, since that's the best
//      available signal for "the typical case" without picking an arbitrary one.
//   3. No candidates at all (or only decoys/guideline/bare-slice rows) -> null, meaning "no
//      data for this unit," never a fallback guess.
function deriveUnitGrams(portions, config) {
  let candidates = portions.filter(
    (p) => config.contains.test(p.description) && !isDecoyPortion(p.description) && p.grams > 0,
  );
  if (config === UNIT_CONFIG.piece) {
    candidates = candidates.filter(
      (p) => p.description.trim().toLowerCase() !== BARE_PIECE_SLICE_DESC,
    );
  }
  if (candidates.length === 0) return null;

  const exact = candidates.filter((p) => config.exact.test(p.description.trim()));
  if (exact.length > 0) return exact[0].grams;

  const weights = new Set(candidates.map((p) => p.grams));
  if (weights.size === 1) return candidates[0].grams;

  const nfs = candidates.find((p) => /\bnfs\b/i.test(p.description));
  if (nfs) return nfs.grams;

  const freq = new Map();
  for (const p of candidates) freq.set(p.grams, (freq.get(p.grams) ?? 0) + 1);
  let modeWeight = candidates[0].grams;
  let modeCount = 0;
  for (const [weight, count] of freq) {
    if (count > modeCount) {
      modeCount = count;
      modeWeight = weight;
    }
  }
  return modeWeight;
}

const ML_PER_FL_OZ = 29.5735; // 1 US fl oz
const ML_PER_CUP = 236.588; // 1 US cup
const ML_PER_TBSP = 14.7868; // 1 US tablespoon
const ML_PER_TSP = 4.9289; // 1 US teaspoon

function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

// ml is a volume unit, so grams-per-ml genuinely varies by food density just like
// cup/tbsp/tsp (1 ml of honey != 1 ml of skim milk) — prefer a direct "1 fl oz" portion row
// (FNDDS almost always expresses fluid portions this way, never literally "ml"), falling
// back to whichever of cup/tbsp/tsp was itself resolved for this food, largest unit first
// (more reliable than a small one). null if none of those resolved either.
function deriveGramsPerMl(flOzGrams, cupGrams, tbspGrams, tspGrams) {
  if (flOzGrams != null) return flOzGrams / ML_PER_FL_OZ;
  if (cupGrams != null) return cupGrams / ML_PER_CUP;
  if (tbspGrams != null) return tbspGrams / ML_PER_TBSP;
  if (tspGrams != null) return tspGrams / ML_PER_TSP;
  return null;
}

export function deriveUnitFields(portions) {
  const cup = deriveUnitGrams(portions, UNIT_CONFIG.cup);
  const tbsp = deriveUnitGrams(portions, UNIT_CONFIG.tbsp);
  const tsp = deriveUnitGrams(portions, UNIT_CONFIG.tsp);
  const piece = deriveUnitGrams(portions, UNIT_CONFIG.piece);
  const flOz = deriveUnitGrams(portions, UNIT_CONFIG.flOz);
  const mlRaw = deriveGramsPerMl(flOz, cup, tbsp, tsp);
  return {
    cup,
    tbsp,
    tsp,
    piece,
    ml: mlRaw == null ? null : round(mlRaw, 3),
  };
}

let fnddsIndexed = null;
function loadFndds() {
  if (!fnddsIndexed) {
    const raw = JSON.parse(fs.readFileSync(FNDDS_PATH, "utf8"));
    fnddsIndexed = raw.map((f) => ({
      ...f,
      tokens: tokenSet(f.description),
      derived: deriveUnitFields(f.portions ?? []),
    }));
  }
  return fnddsIndexed;
}

// Matches `name` against the FNDDS reference, returning:
//   { tier: "no-match", score }
//   { tier: "match" | "low-confidence", score, matchedDescription, matchedCategory, foodCode,
//     coreMismatch, compositeDish, fields: { gramsPerCup?, gramsPerTbsp?, gramsPerTsp?,
//     gramsPerPiece?, gramsPerMl? } }
// `fields` only contains keys the matched FNDDS entry actually had data for.
export function matchFoodName(name) {
  const candidates = loadFndds();
  const ourTokens = tokenSet(name);

  let best = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreMatch(ourTokens, candidate.tokens);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const roundedScore = Math.round(bestScore * 1000) / 10;
  const coreMismatch = best ? hasNoSubstantiveOverlap(ourTokens, best.tokens) : true;
  const compositeDish = best ? looksComposite(best.description) && !looksComposite(name) : false;
  let tier = tierFor(bestScore, coreMismatch);
  if (tier === "match" && compositeDish) tier = "low-confidence";

  if (tier === "no-match" || !best) {
    return { tier: "no-match", score: roundedScore, coreMismatch, compositeDish };
  }

  const d = best.derived;
  const fields = {};
  if (d.cup != null) fields.gramsPerCup = d.cup;
  if (d.tbsp != null) fields.gramsPerTbsp = d.tbsp;
  if (d.tsp != null) fields.gramsPerTsp = d.tsp;
  if (d.piece != null) fields.gramsPerPiece = d.piece;
  if (d.ml != null) fields.gramsPerMl = d.ml;

  return {
    tier,
    score: roundedScore,
    matchedDescription: best.description,
    matchedCategory: best.category,
    foodCode: best.foodCode,
    coreMismatch,
    compositeDish,
    fields,
  };
}
