import Client from "../clients/client.model.js";
import JournalEntry from "../journal/journal-entry.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
import Meal from "../meals/meal.model.js";
import Message from "../messages/message.model.js";
import { computeTotals } from "../journal/journal.service.js";
import * as foodsService from "../foods/foods.service.js";
import { normalizePhone } from "../../lib/phone.js";
import { localDayRange, localTimeHHMM } from "../../lib/localDay.js";
import { ApiError } from "../../lib/ApiError.js";

// Read side of the WhatsApp coach (prompt-94). The intake endpoint could already write; this is
// what lets a reply say "you have 850 kcal left" instead of something generic.
//
// Everything returned is PRE-COMPUTED. The AI must never do arithmetic to produce a number a
// client reads back — a language model subtracting 950 from 1800 is a plausible way to tell
// someone the wrong thing about their own day.

const MACROS = ["calories", "protein", "carbs", "fat", "fiber"];
const ZERO = Object.fromEntries(MACROS.map((k) => [k, 0]));

// Default slot times, mirroring SLOT_META in the frontend's meal-plans-mock.ts. A plan's own
// slotTimes map wins; this is the same fallback the dashboard shows for a slot the dietitian
// never set a time on, so the AI and the app quote the same time.
const DEFAULT_SLOT_TIMES = {
  breakfast: "08:00",
  "snack-am": "10:30",
  lunch: "13:00",
  "snack-pm": "16:30",
  dinner: "20:00",
};
const SLOT_ORDER = Object.keys(DEFAULT_SLOT_TIMES);

const round1 = (n) => Math.round(n * 10) / 10;

// Sums per-ENTRY totals rather than pooling every item and totalling once. The difference is
// only rounding, but it's the difference that matters here: each entry's total is exactly the
// number shown on its card in Journal Review, so a day total built this way is what the
// dietitian gets if she adds up what she can see. Anything else invites "the app says 951, the
// coach said 950".
function sumEntries(entries) {
  const acc = { ...ZERO };
  for (const entry of entries) {
    const t = computeTotals(entry.items || []);
    for (const k of MACROS) acc[k] += t[k] || 0;
  }
  return {
    calories: Math.round(acc.calories),
    protein: round1(acc.protein),
    carbs: round1(acc.carbs),
    fat: round1(acc.fat),
    fiber: round1(acc.fiber),
  };
}

function subtract(target, consumed) {
  if (!target) return null;
  return Object.fromEntries(
    MACROS.map((k) => {
      const t = target[k];
      if (t == null) return [k, null];
      return [k, k === "calories" ? Math.round(t - consumed[k]) : round1(t - consumed[k])];
    }),
  );
}

// A slot's effective time: the plan's own override, else the built-in default, else null for a
// slot that has neither — an item sitting in a slot that was never registered in slotTimes.
// Mirrors slotDisplayTime() in the frontend's mealplans-api.ts, so the coach and the dashboard
// can't disagree about when a slot happens.
function slotDisplayTime(slot, slotTimes) {
  return slotTimes[slot] ?? DEFAULT_SLOT_TIMES[slot] ?? null;
}

// Orders slots the way the dashboard does (prompt-113): ascending by effective time, built-ins
// and custom slots interleaved rather than the built-ins first and everything else swept to the
// end. Same rule as buildDays()/planSlots() in the frontend's mealplans-api.ts, expressed for
// this file's shape. Ties and untimed slots fall back to the caller's own order via an explicit
// index, so the result never depends on Array.prototype.sort's stability or on Map insertion
// order.
function sortSlotsByTime(slots, slotTimes) {
  return slots
    .map((slot, idx) => ({ slot, idx, time: slotDisplayTime(slot, slotTimes) }))
    .sort((a, b) => {
      // Both are zero-padded 24h "HH:mm" (the PATCH /slot-time regex rejects anything else, and
      // DEFAULT_SLOT_TIMES are literals of the same shape), so a plain compare is chronological.
      if (a.time && b.time) {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return a.idx - b.idx;
      }
      if (a.time) return -1;
      if (b.time) return 1;
      return a.idx - b.idx;
    })
    .map((entry) => entry.slot);
}

// Which slot the client is in right now, by local wall clock: the latest slot whose start time
// has passed. Before breakfast that's null rather than a guess — "you're in dinner" at 6am
// would be worse than saying nothing.
//
// Candidates are every slot the plan actually has (prompt-113) — the 5 built-ins, which always
// have a time, UNION whatever custom slots the dietitian registered in slotTimes. A custom
// "Pre-workout" at 07:00 is as much the meal happening now as breakfast is, and used to be
// unnameable here.
//
// Sorting first also fixes a latent bug in iterating SLOT_ORDER directly: it walked the
// built-ins in DECLARATION order and kept the last match, which is only chronological while
// nobody overrides a time. Retime breakfast to 23:00 and at 23:30 the old loop returned dinner,
// because dinner came later in the list — not because it was later in the day.
function currentSlot(nowHHMM, slotTimes) {
  const candidates = [...new Set([...SLOT_ORDER, ...Object.keys(slotTimes)])];
  let found = null;
  for (const slot of sortSlotsByTime(candidates, slotTimes)) {
    const time = slotDisplayTime(slot, slotTimes);
    if (time != null && time <= nowHHMM) found = slot;
  }
  return found;
}

// Which plan is "today's" when a client has several overlapping ones — and they do: two of the
// four real clients currently have two plans covering the same dates.
//
// 1. Must cover today. A missing startDate/endDate is treated as open-ended rather than
//    disqualifying, since both fields are optional on the model.
// 2. "ended" is excluded outright. "active" ranks above "draft".
// 3. Ties break on most-recently-updated — the one she's been working in.
//
// Draft plans ARE included, which is a judgement call worth knowing about: every plan in the
// database is currently a draft, so excluding them would make todaysPlan permanently empty and
// the coach permanently unable to reference a plan. The trade is that a draft may be half-built,
// so the plan's own `status` is returned alongside it — n8n can decline to quote a draft without
// this endpoint having to decide that for it.
function pickTodaysPlan(plans, now) {
  const covering = plans.filter(
    (p) => (!p.startDate || p.startDate <= now) && (!p.endDate || p.endDate >= now) && p.status !== "ended",
  );
  if (!covering.length) return null;
  const rank = (p) => (p.status === "active" ? 0 : 1);
  covering.sort((a, b) => rank(a) - rank(b) || new Date(b.updatedAt) - new Date(a.updatedAt));
  return covering[0];
}

function planSlotsForDay(plan, dayIndex) {
  if (!plan) return [];
  const slotTimes = plan.slotTimes instanceof Map ? Object.fromEntries(plan.slotTimes) : plan.slotTimes || {};
  const bySlot = new Map();
  for (const item of plan.items || []) {
    if (item.day !== dayIndex) continue;
    if (!bySlot.has(item.slot)) bySlot.set(item.slot, []);
    bySlot.get(item.slot).push(item);
  }
  // Chronological, custom slots interleaved (prompt-113) — was SLOT_ORDER.indexOf(), which
  // swept every custom slot to the end regardless of its time. The set of slots returned is
  // unchanged: still exactly the ones holding food on this day, since bySlot is built from
  // items. Only their order changes.
  return sortSlotsByTime([...bySlot.keys()], slotTimes)
    .map((slot) => [slot, bySlot.get(slot)])
    .map(([slot, items]) => ({
      slot,
      time: slotDisplayTime(slot, slotTimes),
      // measureLabel is the dietitian's own wording ("3 pitted dates") where she picked a real
      // measure; otherwise the resolved quantity+unit. Both are display strings the AI can read
      // back verbatim without recomputing anything.
      items: items.map((i) => i.measureLabel || `${i.name} ${i.quantity}${i.unit}`),
      calories: Math.round(items.reduce((s, i) => s + (i.calories || 0), 0)),
    }));
}

// Phone -> active client, shared by every automation read (extracted in prompt-121 so a second
// endpoint cannot drift from the first). n8n STRING-MATCHES `code` on both failures, so these two
// payloads are a contract: same codes, same fields, same HTTP statuses, wherever they're thrown.
//
// `select` narrows the projection for callers that need only part of the document. `archived` is
// forced into every projection regardless — selecting it away would leave `client.archived`
// undefined and make the 403 below silently stop firing, quietly handing an archived client's
// data back out.
async function resolveActiveClient(rawPhone, { select } = {}) {
  const phone = normalizePhone(rawPhone);
  const query = phone ? Client.findOne({ phone }) : null;
  const client = query ? await (select ? query.select(`archived ${select}`) : query).lean() : null;

  // Same 404 shape the intake endpoint returns, so n8n branches on one convention.
  if (!client) {
    throw new ApiError(404, `No client matches the WhatsApp number ${phone ?? rawPhone}`, {
      code: "client_not_found",
      normalizedPhone: phone,
      receivedPhone: rawPhone,
    });
  }
  // Archived means removed from the roster. The number is known, which is why this isn't a 404 —
  // n8n needs to tell "never a client" apart from "no longer coached" to reply appropriately.
  // `inactive` (paused but current) is NOT refused; `client.status` is returned so the flow can
  // decide for itself.
  if (client.archived) {
    throw new ApiError(403, "This client is archived and is not receiving coaching", {
      code: "client_archived",
      clientId: String(client._id),
    });
  }
  return client;
}

export async function getClientContext({ phone: rawPhone, now = new Date() }) {
  const client = await resolveActiveClient(rawPhone);

  const day = localDayRange(now);
  const nowHHMM = localTimeHHMM(now);

  // Two separate queries, not one read then split in memory (prompt-95). Food totals and
  // activity never share a collection of documents at any point in this function, so there is
  // no line of code where an exercise entry could reach sumEntries() by accident — which is the
  // failure this design is guarding against: an AI reading a wrong food number out loud to a
  // client, in her own language, with no human in the loop.
  const [entries, exerciseEntries, plans] = await Promise.all([
    JournalEntry.find({ client: client._id, date: { $gte: day.start, $lt: day.end }, kind: "meal" })
      .select("items status source date")
      .lean(),
    JournalEntry.find({ client: client._id, date: { $gte: day.start, $lt: day.end }, kind: "exercise" })
      .select("exercise status date")
      .lean(),
    MealPlan.find({ client: client._id }).select("name status startDate endDate slotTimes items updatedAt").lean(),
  ]);

  // Rejected entries are excluded everywhere: the dietitian looked at them and said this didn't
  // happen. Everything else counts — see the `consumed` split below.
  const counted = entries.filter((e) => e.status !== "rejected");
  const confirmed = counted.filter((e) => e.status !== "pending");
  const pending = counted.filter((e) => e.status === "pending");

  const consumedToday = sumEntries(counted);
  const targets = client.targets || null;
  const dailyTargets = targets
    ? Object.fromEntries(MACROS.map((k) => [k, targets[k] ?? null]))
    : null;

  const profile = client.profile || {};
  const plan = pickTodaysPlan(plans, now);

  return {
    client: {
      id: String(client._id),
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      status: client.status,
      // Whether the AI should reply on its own (prompt-96). The backend only reports it;
      // skipping the AI call when this is false is n8n's job.
      aiAutopilot: client.aiAutopilot !== false,
      weightKg: profile.weight ?? null,
      heightCm: profile.height ?? null,
      goal: profile.goal ?? null,
      allergies: profile.allergies ?? [],
      intolerances: profile.intolerances ?? [],
      foodsToAvoid: profile.foodsToAvoid ?? [],
      dietaryPreferences: profile.dietaryPreferences ?? [],
    },
    // Local date/time the rest of this response is computed against, so a reply can say
    // "so far today" and mean the client's today (see lib/localDay.js).
    today: { date: day.date, timeZone: day.timeZone, localTime: nowHHMM, dayIndex: day.dayIndex },

    // null when the client was never fully profiled — targets is `default: null` on the model.
    // Returned as null rather than zeros so a reply can't claim a 0 kcal budget.
    dailyTargets,

    // consumedToday INCLUDES entries still pending the dietitian's review. See the report: a
    // client who logged three meals by WhatsApp being told she has eaten nothing is the worse
    // failure. The split is returned so a reply can be honest about it.
    consumedToday,
    consumedConfirmed: sumEntries(confirmed),
    consumedPending: sumEntries(pending),
    pendingEntryCount: pending.length,

    // null when there are no targets to subtract from.
    //
    // NOTE for anyone extending this: `remainingToday` is targets minus FOOD only. Burned
    // calories are reported separately in exerciseToday below and are never added back here.
    // Whether exercise earns a client more food is a clinical judgement that belongs to the
    // dietitian, not a side effect of this plumbing — see the report for what making it an
    // explicit per-client setting would take.
    remainingToday: dailyTargets ? subtract(dailyTargets, consumedToday) : null,

    // Activity logged today, kept structurally apart from every food figure above so the number
    // cannot leak into one. A prompt instruction telling a model not to add these together is a
    // request; separate fields are a guarantee.
    exerciseToday: {
      // null rather than 0 when no session reported a burn: "you burned 0 today" and "nobody
      // estimated a burn" are different statements, and only one of them is true.
      burnedCalories: exerciseEntries.some((e) => e.exercise?.burnedCalories != null)
        ? Math.round(exerciseEntries.reduce((sum, e) => sum + (e.exercise?.burnedCalories || 0), 0))
        : null,
      sessions: exerciseEntries.map((e) => ({
        type: e.exercise?.type ?? null,
        minutes: e.exercise?.minutes ?? null,
        intensity: e.exercise?.intensity ?? null,
        burnedCalories: e.exercise?.burnedCalories ?? null,
        // Same review caveat the meal figures carry: an unreviewed estimate is still an
        // estimate, and a reply can say so.
        status: e.status,
      })),
    },

    currentSlot: currentSlot(nowHHMM, plan?.slotTimes instanceof Map ? Object.fromEntries(plan.slotTimes) : plan?.slotTimes || {}),

    // null when no plan covers today; todaysPlan is then [] rather than the request 404ing.
    plan: plan
      ? {
          id: String(plan._id),
          name: plan.name,
          status: plan.status,
          startDate: plan.startDate ?? null,
          endDate: plan.endDate ?? null,
        }
      : null,
    todaysPlan: planSlotsForDay(plan, day.dayIndex),
  };
}

// Food lookup for the coach (prompt-94). Deliberately its own route rather than granting the
// intake key `foods.read`: that permission also opens the USDA proxy routes, which spend the
// practice's FDC API quota, and the full paginated dump of the library. This returns only what
// a "name -> macros" lookup needs, from foodsService.listFoods — the same search the dashboard
// uses, not a second implementation.
export async function lookupFoods({ q, limit }) {
  const { foods, total } = await foodsService.listFoods({ page: 1, limit, search: q });
  return {
    query: q,
    total,
    foods: foods.map((f) => ({
      id: String(f._id),
      name: f.name,
      nameAr: f.nameAr ?? null,
      source: f.source,
      verified: !!f.verified,
      per100g: {
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber ?? null,
      },
      // The dietitian's own real portions, so the AI can size "a plate of tabbouleh" against
      // something measured instead of inventing a gram weight.
      portions: (f.portions ?? []).map((p) => ({ description: p.description, grams: p.grams })),
    })),
  };
}

// ── Meal Library lookup for the coach (prompt-121) ───────────────────────────────────────────
//
// "Can you give me a recipe with shrimp?" used to go straight to the reply AI, which invented a
// dish from general knowledge while the dietitian's own recipes sat unread in the Meal Library.
// This is the same principle lookupFoods already applies to ingredient macros: HER data wins,
// and the AI only invents when there is genuinely nothing to quote.
//
// There is NO model call anywhere in this function. Ranking is deterministic, so the same
// question twice gets the same recipes, and nothing here can hallucinate a dish that isn't in
// the library.

// Queried straight off WhatsApp, so the string is written by an untrusted stranger.
//
// meals.service.js's listMeals interpolates its `search` argument into $regex UNESCAPED. That is
// reachable only from the authenticated dashboard, where the "attacker" is the dietitian typing
// in her own search box, so it is not a live hole — but this endpoint's input is a stranger's
// chat message, and it deliberately does not inherit that pattern. Every token below is escaped
// before it becomes a regex. (listMeals itself is left alone — see the report.)
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Filler a request arrives wrapped in. Only words that carry no food meaning: question verbs,
// pronouns, articles, prepositions, and the recipe-request vocabulary itself ("recipe", "idea",
// "something"). Nothing that could name or qualify a food — "light", "quick", "cold" and "sweet"
// are deliberately NOT here, because they can legitimately hit a recipe name.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "with", "without", "for", "from", "in", "on", "to", "at",
  "by", "as", "is", "are", "am", "be", "was", "were", "do", "does", "did", "can", "could",
  "would", "will", "shall", "should", "may", "might", "have", "has", "had", "get", "got", "give",
  "gives", "send", "show", "tell", "make", "want", "need", "like", "love", "please", "pls", "thanks",
  "thank", "hi", "hello", "hey", "i", "me", "my", "mine", "you", "your", "yours", "we", "us",
  "our", "it", "its", "this", "that", "these", "those", "some", "any", "what", "which", "who",
  "how", "when", "where", "why", "recipe", "recipes", "meal", "meals", "dish", "dishes", "food",
  "foods", "idea", "ideas", "suggestion", "suggestions", "receipe", "receipes", "recepie", "recepies", "recipie", "something", "anything", "eat", "eating",
  "cook", "cooking", "today", "tonight", "now", "good", "nice", "best", "more", "much", "many",
  "about", "there", "here", "also", "just", "maybe", "ok", "okay", "yes", "no", "not",
]);

// A chat message is a sentence, not a search box. Bounds the $or the filter builds.
const MAX_TOKENS = 8;

// Lowercase, split on anything that isn't a letter or a digit, drop filler.
//
// \p{L} rather than [a-z] so Arabic survives: meals carry `nameAr` ("تبولة") and a client may
// well ask in Arabic. An [a-z]-based split would reduce an entire Arabic message to zero tokens.
//
// If stripping stopwords empties the list the UNFILTERED tokens are used instead. A bare "any
// ideas?" then searches for "ideas" and honestly finds nothing, rather than searching for
// nothing and returning a top-3 of arbitrary recipes — n8n reads an empty result as "the library
// has nothing, invent something", and that has to mean what it says.
function tokenize(q) {
  const raw = String(q)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
  const meaningful = raw.filter((t) => !STOPWORDS.has(t));
  const tokens = meaningful.length ? meaningful : raw;
  return [...new Set(tokens)].slice(0, MAX_TOKENS);
}

// The meal's own LABELS — cuisine ("lebanese"), category ("dinner") and dietTags — are searchable
// too, not just names and ingredients. A client who asks for "a Lebanese recipe" is asking about a
// label: no recipe NAME has to contain the word, and matching only names and ingredients answered
// that question with silence while several Lebanese recipes sat in the library.
//
// Whole-word equality against the label, never substring: "an" must not hit "italian". Each
// token is also tried without a trailing "s" ("desserts" -> "dessert") and through a few country
// words the cuisine enum doesn't spell ("lebanon" -> "lebanese").
const LABEL_SYNONYMS = {
  lebanon: "lebanese",
  italy: "italian",
  asia: "asian",
  levant: "levantine",
  snacks: "snack",
  desserts: "dessert",
  drinks: "drink",
  beverage: "drink",
  beverages: "drink",
};

function facetForms(tokens) {
  const out = new Set();
  for (const t of tokens) {
    out.add(t);
    if (t.endsWith("s")) out.add(t.slice(0, -1));
    if (LABEL_SYNONYMS[t]) out.add(LABEL_SYNONYMS[t]);
  }
  return [...out];
}

// Scored OR, not AND — the judgement call this endpoint most depends on.
//
// AND reads better on paper ("chicken salad" should mean both) but on this library it returns
// nothing: no recipe contains both "chicken" and "salad", so an AND query answers a perfectly
// answerable question with silence and n8n falls through to the AI — even though "Pasta Bechamel
// with chicken" and "Sweet potato salad" are both sitting right there. OR surfaces both, and
// because the ranking below sorts on how MANY tokens each meal matched, a recipe that does hit
// both still comes out on top. That is AND's precision where it matters (the first result) with
// no empty-result cliff, which for a 3-result reply is the whole game.
function buildFilter(tokens) {
  const forms = facetForms(tokens);
  return {
    $or: [...tokens.flatMap((t) => {
      const rx = { $regex: escapeRegex(t), $options: "i" };
      return [
        { name: rx },
        { nameAr: rx },
        // Section rows are titled dividers ("Batter", "For the glaze"), not foods — matching a
        // query against one would be matching against the dietitian's formatting. `$ne` also
        // matches documents where `type` is absent, which is every ingredient saved before
        // prompt-97 added the field.
        { ingredients: { $elemMatch: { name: rx, type: { $ne: "section" } } } },
      ];
    }),
    // cuisine and category are lowercase enums; dietTags are free labels, so those match
    // case-insensitively. $in with whole-string regexes is exact-word, not substring.
    { cuisine: { $in: forms } },
    { category: { $in: forms } },
    { dietTags: { $in: forms.map((f) => new RegExp(`^${escapeRegex(f)}$`, "i")) } },
    ],
  };
}

// Allergen strings vs allergy strings — reconciled by WORD-SET INTERSECTION, after lowercasing.
//
// Both sides are picked from the one Settings-managed list (prompt-105 unified them: the New
// Recipe dialog's allergen pills and the New Client dialog's allergy pills read the same
// endpoint), so plain equality is already correct for every value those pills produce. Two
// things make equality alone too weak to rely on:
//   1. the client dialog lets the dietitian type a one-off allergy that was never on the list;
//   2. the list ships compound labels — "Gluten/Wheat" — and a hand-typed "Gluten" has to match.
// Word-set intersection handles both: {gluten,wheat} ∩ {gluten} hits, and "Tree nuts" ∩ "Nuts"
// hits.
//
// Deliberately NOT raw substring matching, which matches on fragments: an "Egg" allergy would
// exclude every "Eggplant" recipe. Whole words only. Where the two still disagree the error runs
// in the safe direction — excluding a recipe that was fine is a worse reply, but serving one that
// wasn't is a medical incident.
function allergyWords(values) {
  const out = new Set();
  for (const v of values || []) {
    for (const w of String(v).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (w) out.add(w);
    }
  }
  return out;
}

function conflictsWithAllergies(mealAllergens, clientWords) {
  if (!clientWords.size) return false;
  for (const w of allergyWords(mealAllergens)) {
    if (clientWords.has(w)) return true;
  }
  return false;
}

// total / servings. Meal.totalX is the WHOLE recipe as prepared (prompt-68), and a client asking
// for a recipe is being told what one plate costs her.
//
// NOT recomputed from ingredients: computeRecipeMacros already did that at save time and is the
// single source of truth. Recomputing here would be a second implementation free to disagree
// with the number the dietitian sees on the recipe card.
function perServing(meal) {
  // Guards 0, null, undefined and negative alike. A recipe whose serving count was never set is
  // treated as one serving, which is what the rest of the app does with it.
  const servings = meal.servings > 0 ? meal.servings : 1;
  return {
    calories: Math.round((meal.totalCalories || 0) / servings),
    protein: round1((meal.totalProtein || 0) / servings),
    carbs: round1((meal.totalCarbs || 0) / servings),
    fat: round1((meal.totalFat || 0) / servings),
    fiber: round1((meal.totalFiber || 0) / servings),
  };
}

// The tail of this client's thread, oldest first, for conversational context.
//
// Text only, trimmed: a photo or voice note becomes a short placeholder rather than disappearing
// (the model should know SOMETHING non-text was sent) and no body can exceed MAX_BODY, since this
// is prompt material, not a transcript export. Messages the dietitian typed from the dashboard are
// labelled "dietitian" — the model must be able to tell her words from the coach's own.
//
// `before` excludes the message currently being answered (see the schema comment); `sinceHours`
// stops a stale thread from posing as context. Neither changes anything: pure read.
const MAX_BODY = 600;

export async function getRecentMessages({ phone, limit, before, sinceHours }) {
  const client = await resolveActiveClient(phone, { select: "_id" });

  const upper = before ? new Date(before) : new Date();
  const lower = new Date(upper.getTime() - sinceHours * 3600 * 1000);

  const rows = await Message.find({
    client: client._id,
    sentAt: { $gte: lower, $lt: upper },
  })
    .sort({ sentAt: -1 })
    .limit(limit)
    .select("direction source kind body attachmentLabel sentAt")
    .lean();

  const messages = rows.reverse().map((m) => {
    const text = (m.body || "").trim();
    const placeholder = m.kind === "image" ? "[photo]" : m.kind === "voice" ? "[voice note]" : "";
    return {
      from: m.direction === "inbound" ? "client" : m.source === "automation" ? "coach" : "dietitian",
      text: (text || placeholder).slice(0, MAX_BODY),
      at: m.sentAt,
    };
  });

  return { total: messages.length, messages };
}

export async function lookupMeals({ phone, q, limit }) {
  // Narrow projection, but resolveActiveClient still forces `archived` in — see its comment.
  const client = await resolveActiveClient(phone, {
    select: "profile.allergies profile.dietaryPreferences",
  });

  const tokens = tokenize(q);
  const profile = client.profile || {};
  const allergyTokens = allergyWords(profile.allergies);
  const prefs = new Set((profile.dietaryPreferences || []).map((p) => String(p).toLowerCase()));

  // Projected tightly: no photos, no coverHue/icon, no createdBy, and none of the 22
  // micronutrient totals — a WhatsApp reply has no use for any of it, and this is polled per
  // message. `createdAt` comes along only as the final tie-break.
  //
  // Unbounded on purpose at this scale (one dietitian's recipe library — 16 documents today, and
  // the filter has already narrowed to meals matching at least one token). If that library ever
  // grows into the thousands, the fix is the text index on name/nameAr that meal.model.js
  // already declares, not a LIMIT here: cutting the candidate set before ranking would silently
  // drop the best match rather than the worst.
  const candidates = tokens.length
    ? await Meal.find(buildFilter(tokens))
        .select(
          "name nameAr category cuisine servings prepTime cookTime verified dietTags allergens " +
            "ingredients steps totalCalories totalProtein totalCarbs totalFat totalFiber createdAt",
        )
        .lean()
    : [];

  const scored = [];
  for (const meal of candidates) {
    // Allergy exclusion happens HERE, server-side, before anything is scored or returned — not
    // left to n8n or described to the AI in a prompt. A prompt instruction is a request; a
    // recipe that never leaves the building is a guarantee.
    if (conflictsWithAllergies(meal.allergens, allergyTokens)) continue;

    const haystackName = `${meal.name || ""} ${meal.nameAr || ""}`.toLowerCase();
    const ingredientNames = (meal.ingredients || [])
      .filter((i) => i.type !== "section")
      .map((i) => String(i.name || "").toLowerCase());

    const labels = new Set(
      [meal.cuisine, meal.category, ...(meal.dietTags || [])]
        .filter(Boolean)
        .map((l) => String(l).toLowerCase()),
    );

    let nameHits = 0;
    let ingredientHits = 0;
    let facetHits = 0;
    for (const t of tokens) {
      if (haystackName.includes(t)) nameHits += 1;
      else if (ingredientNames.some((n) => n.includes(t))) ingredientHits += 1;
      else if (facetForms([t]).some((f) => labels.has(f))) facetHits += 1;
    }
    // The Mongo filter matched this document on name, nameAr or a non-section ingredient. If
    // neither counter fired, the only thing that matched was a section row, which is not a food.
    if (nameHits === 0 && ingredientHits === 0 && facetHits === 0) continue;

    scored.push({
      meal,
      nameHits,
      totalHits: nameHits + ingredientHits + facetHits,
      matchedOn: nameHits > 0 ? "name" : ingredientHits > 0 ? "ingredient" : "label",
      dietMatch: (meal.dietTags || []).some((tag) => prefs.has(String(tag).toLowerCase())) ? 1 : 0,
      verified: meal.verified ? 1 : 0,
    });
  }

  // Lexicographic, in exactly the priority order the contract states, rather than a single
  // weighted score — weights would need justifying and would let a big enough bonus in one tier
  // quietly outrank the tier above it.
  //   1. more matched tokens beats fewer (a name, ingredient or cuisine/category label each count)
  //   2. a name match beats an ingredient- or label-only match
  //   3. verified beats unverified
  //   4. a diet-tag match beats none
  //   5. newest first, then _id — so the order is fully determined even when every tier ties,
  //      and the same question never returns the same recipes in a different order.
  scored.sort(
    (a, b) =>
      b.totalHits - a.totalHits ||
      b.nameHits - a.nameHits ||
      b.verified - a.verified ||
      b.dietMatch - a.dietMatch ||
      new Date(b.meal.createdAt) - new Date(a.meal.createdAt) ||
      String(a.meal._id).localeCompare(String(b.meal._id)),
  );

  return {
    query: q,
    // What was actually searched on, after filler removal — so n8n (and a human reading the
    // logs) can see that "can you give me a recipe with shrimp" became ["shrimp"].
    matchedTerms: tokens,
    // Every eligible match, not just the returned page: lets a reply say "I have 4 of these"
    // while quoting 3. Already net of allergy exclusions — an excluded recipe is not a match the
    // client is allowed to hear about, so counting it here would leak its existence.
    total: scored.length,
    meals: scored.slice(0, limit).map(({ meal, matchedOn }) => ({
      id: String(meal._id),
      name: meal.name,
      nameAr: meal.nameAr ?? null,
      category: meal.category ?? null,
      cuisine: meal.cuisine ?? null,
      servings: meal.servings ?? null,
      prepTime: meal.prepTime ?? null,
      cookTime: meal.cookTime ?? null,
      verified: !!meal.verified,
      dietTags: meal.dietTags ?? [],
      // Returned even though conflicting recipes are already gone: "contains no allergen you
      // react to" and "contains nothing at all" are different statements, and the reply may well
      // want to name what IS in it.
      allergens: meal.allergens ?? [],
      perServing: perServing(meal),
      // Section rows are dropped rather than kept as headings. The row shape here has no field
      // that distinguishes a heading from a food, so "For the glaze" would arrive as an
      // ingredient with a null quantity — precisely the kind of thing a language model reads out
      // as an item on the list. Keeping them would also push the filtering back onto n8n's
      // prompt, which is the job this endpoint exists to take off it.
      ingredients: (meal.ingredients || [])
        .filter((i) => i.type !== "section")
        .map((i) => ({
          name: i.name,
          quantity: i.quantity ?? null,
          unit: i.unit ?? null,
          // The dietitian's own wording ("3 pitted dates") where she picked a real measure —
          // same display-string reasoning as planSlotsForDay above.
          measureLabel: i.measureLabel ?? null,
        })),
      steps: meal.steps ?? [],
      matchedOn,
    })),
  };
}
