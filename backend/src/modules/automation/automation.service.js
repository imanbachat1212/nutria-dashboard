import Client from "../clients/client.model.js";
import JournalEntry from "../journal/journal-entry.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
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

// Which slot the client is in right now, by local wall clock: the latest slot whose start time
// has passed. Before breakfast that's null rather than a guess — "you're in dinner" at 6am
// would be worse than saying nothing.
function currentSlot(nowHHMM, slotTimes) {
  let found = null;
  for (const slot of SLOT_ORDER) {
    const time = slotTimes[slot] ?? DEFAULT_SLOT_TIMES[slot];
    if (time <= nowHHMM) found = slot;
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
  return [...bySlot.entries()]
    .sort((a, b) => {
      const ai = SLOT_ORDER.indexOf(a[0]);
      const bi = SLOT_ORDER.indexOf(b[0]);
      return (ai === -1 ? SLOT_ORDER.length : ai) - (bi === -1 ? SLOT_ORDER.length : bi);
    })
    .map(([slot, items]) => ({
      slot,
      time: slotTimes[slot] ?? DEFAULT_SLOT_TIMES[slot] ?? null,
      // measureLabel is the dietitian's own wording ("3 pitted dates") where she picked a real
      // measure; otherwise the resolved quantity+unit. Both are display strings the AI can read
      // back verbatim without recomputing anything.
      items: items.map((i) => i.measureLabel || `${i.name} ${i.quantity}${i.unit}`),
      calories: Math.round(items.reduce((s, i) => s + (i.calories || 0), 0)),
    }));
}

export async function getClientContext({ phone: rawPhone, now = new Date() }) {
  const phone = normalizePhone(rawPhone);
  const client = phone ? await Client.findOne({ phone }).lean() : null;

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
