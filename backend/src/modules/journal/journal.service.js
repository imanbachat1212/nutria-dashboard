import JournalEntry from "./journal-entry.model.js";
import Food from "../foods/food.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { deleteImage } from "../../lib/storage.js";

// ── Macro helpers ──────────────────────────────────────────────────────────

async function enrichItems(items) {
  if (!items?.length) return [];

  const foodIds = items.filter((i) => i.food).map((i) => i.food);
  const foods = foodIds.length
    ? await Food.find({ _id: { $in: foodIds } }).lean()
    : [];
  const foodMap = new Map(foods.map((f) => [f._id.toString(), f]));

  return items.map((item) => {
    // If caller supplied macros directly (automation path), keep them
    if (item.macros) return item;

    if (!item.food || item.grams == null) {
      return { food: item.food || null, label: item.label, grams: item.grams ?? null, macros: null };
    }

    const food = foodMap.get(item.food.toString());
    if (!food) return { food: item.food, label: item.label, grams: item.grams, macros: null };

    const factor = item.grams / (food.servingSize || 100);
    return {
      food: item.food,
      label: item.label || food.name,
      grams: item.grams,
      macros: {
        calories: Math.round(food.calories * factor),
        protein:  Math.round(food.protein  * factor * 10) / 10,
        carbs:    Math.round(food.carbs    * factor * 10) / 10,
        fat:      Math.round(food.fat      * factor * 10) / 10,
        fiber:    Math.round((food.fiber || 0) * factor * 10) / 10,
      },
    };
  });
}

// Exported (prompt-94) so the automation client-context endpoint totals a day out of the exact
// per-entry numbers the Journal Review page already displays, instead of a second summation
// that could drift from them.
export function computeTotals(items) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const item of items) {
    if (!item.macros) continue;
    t.calories += item.macros.calories || 0;
    t.protein  += item.macros.protein  || 0;
    t.carbs    += item.macros.carbs    || 0;
    t.fat      += item.macros.fat      || 0;
    t.fiber    += item.macros.fiber    || 0;
  }
  return {
    calories: Math.round(t.calories),
    protein:  Math.round(t.protein  * 10) / 10,
    carbs:    Math.round(t.carbs    * 10) / 10,
    fat:      Math.round(t.fat      * 10) / 10,
    fiber:    Math.round(t.fiber    * 10) / 10,
  };
}

// Display name + initials from a client's profile. Extracted from clientMeta (prompt-124) so the
// review queue produces byte-identical names to the entry list: the queue groups by client and
// the page shows both, and two copies of this would eventually disagree about someone with one
// name or a missing surname.
function nameAndInitials(profile) {
  const p = profile || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return { clientName: name, clientInitials: initials };
}

function clientMeta(entry) {
  return nameAndInitials(entry.client?.profile);
}

function serialize(entry) {
  const plain = typeof entry.toObject === "function" ? entry.toObject() : entry;
  return {
    ...plain,
    totals: computeTotals(plain.items || []),
    ...clientMeta(plain),
  };
}

// ── Exported service functions ──────────────────────────────────────────────

export async function createEntry(data, actor) {
  const isDashboard = !data.source || data.source === "dashboard";
  const items = await enrichItems(data.items || []);

  const entry = await JournalEntry.create({
    ...data,
    items,
    // dashboard entries are pre-approved; automation entries need review
    status: data.status ?? (isDashboard ? "approved" : "pending"),
    confidence: isDashboard ? null : (data.confidence ?? null),
    flags: isDashboard ? [] : (data.flags || []),
    createdBy: actor._id,
  });

  const populated = await JournalEntry.findById(entry._id)
    .populate("client", "profile.firstName profile.lastName")
    .lean();
  return serialize(populated);
}

export async function listEntries({ client, from, to, kind, status, limit }) {
  const filter = {};
  if (client) filter.client = client;
  if (kind)   filter.kind   = kind;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to)   filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const entries = await JournalEntry.find(filter)
    .populate("client", "profile.firstName profile.lastName")
    .sort("-date")
    .limit(limit)
    .lean();

  return entries.map(serialize);
}

// ── Review queue (prompt-124) ───────────────────────────────────────────────
//
// Journal Review groups its left-hand queue by client and shows four counts above it. Both were
// built from GET /api/journal?from=<30d>&limit=200 — but listEntries sorts "-date" and the Zod
// schema caps limit at 200, so the moment the practice logs more than 200 entries in 30 days the
// rows that fall off the end are the OLDEST ones: exactly the entries that have been waiting
// longest for review, silently missing from the queue and undercounted in the stat cards.
//
// This returns one row per CLIENT instead of one per entry, which is what makes it immune to
// that truncation — the row count is bounded by the roster, not by the volume of logging. There
// is deliberately no `limit`.
//
// NO client scoping, matching listEntries exactly: that function takes no actor and filters by
// nothing but its query arguments, so every dietitian already sees every client's entries. This
// endpoint does not quietly introduce a different rule — if scoping is wanted it belongs on both,
// as one change.
export async function getReviewQueue({ from, to, status, q }) {
  // Same date handling as listEntries, including the end-of-day stretch on `to`, so a given
  // from/to pair selects the same entries through either endpoint.
  const match = {};
  if (status && status !== "all") match.status = status;
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  // Every count is written as an explicit $cond on status rather than leaning on the $match
  // above. With the default status="pending" they are equivalent, but the conditions then stay
  // true to their names if `status` is widened or changed — "pending" in these fields means
  // pending, not "whatever was matched".
  const isPending = { $eq: ["$status", "pending"] };
  const flagCount = { $size: { $ifNull: ["$flags", []] } };

  const rows = await JournalEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$client",
        // Every entry this client has in the matched window. Not in the brief's list, but the
        // queue row's badge shows a count per client, and on the Approved tab `pending` is 0 for
        // everyone by construction — without this the whole queue would read "0". See the report.
        entryCount: { $sum: 1 },
        pending: { $sum: { $cond: [isPending, 1, 0] } },
        // Per-client approved count, so the Approved tab can list only clients who have one.
        approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        flagged: {
          $sum: { $cond: [{ $and: [isPending, { $gt: [flagCount, 0] }] }, 1, 0] },
        },
        lowConf: {
          $sum: { $cond: [{ $and: [isPending, { $eq: ["$confidence", "low"] }] }, 1, 0] },
        },
        // "Clean" is the bulk-approvable set: nothing flagged AND the AI was not unsure. $ne
        // also counts a null confidence as clean, which is correct — a dashboard entry has no
        // confidence at all, and absent is not the same as low.
        cleanPending: {
          $sum: {
            $cond: [
              { $and: [isPending, { $eq: [flagCount, 0] }, { $ne: ["$confidence", "low"] }] },
              1,
              0,
            ],
          },
        },
        // $min ignores the nulls this $cond emits for non-pending rows, so this is the oldest
        // PENDING entry — null when the client has none waiting.
        oldestPendingAt: { $min: { $cond: [isPending, "$date", null] } },
        // Across everything matched, not just pending: it answers "when did I last hear from
        // this client", which is the column the queue shows.
        lastEntryAt: { $max: "$date" },
      },
    },
    {
      $lookup: {
        from: "clients",
        localField: "_id",
        foreignField: "_id",
        as: "client",
        // Just the two name fields. A client document carries the clinical block, targets and
        // the full profile; none of it belongs in a queue row, and some of it is
        // permission-gated elsewhere (client.serializer.js strips `clinical` without
        // clients.clinical.read). Projecting here means it is never read in the first place.
        pipeline: [{ $project: { "profile.firstName": 1, "profile.lastName": 1 } }],
      },
    },
    { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
  ]);

  // Names, filtering and ordering happen here rather than in the pipeline, for one reason: the
  // name is built by nameAndInitials() — the very function serialize() uses — so the queue and
  // the entry list cannot disagree. Reimplementing "join the non-empty parts, else Unknown" in
  // aggregation operators would be a second copy free to drift.
  //
  // Safe at this scale: one row per client with entries in the window, bounded by the roster
  // (6 clients today), not by entry volume.
  const all = rows.map((r) => ({
    clientId: String(r._id),
    ...nameAndInitials(r.client?.profile),
    entryCount: r.entryCount,
    pending: r.pending,
    approved: r.approved,
    flagged: r.flagged,
    lowConf: r.lowConf,
    cleanPending: r.cleanPending,
    oldestPendingAt: r.oldestPendingAt ?? null,
    lastEntryAt: r.lastEntryAt ?? null,
  }));

  const needle = q?.trim().toLowerCase();
  const clients = needle ? all.filter((c) => c.clientName.toLowerCase().includes(needle)) : all;

  // Most-flagged first, then whoever has been waiting longest. Sorted here rather than with a
  // $sort stage so null oldestPendingAt (a client with nothing pending) lands LAST instead of
  // first — Mongo orders null below every date, which would put the clients who need nothing at
  // the top of a review queue. The clientId tiebreak makes the order total, so a reload never
  // reshuffles two otherwise-equal rows.
  clients.sort(
    (a, b) =>
      b.flagged - a.flagged ||
      (a.oldestPendingAt === null) - (b.oldestPendingAt === null) ||
      new Date(a.oldestPendingAt ?? 0) - new Date(b.oldestPendingAt ?? 0) ||
      a.clientId.localeCompare(b.clientId),
  );

  // Grand totals, so the stat cards stop being a sum over whatever 200 rows happened to load.
  //
  // Summed over the UNFILTERED set, not the `q` subset: the cards describe the whole queue, and
  // today's page already computes them from the unsearched list while the search narrows only
  // the rows. Keeping that split means adding this endpoint changes no visible behaviour.
  const totals = all.reduce(
    (acc, c) => ({
      pending: acc.pending + c.pending,
      flagged: acc.flagged + c.flagged,
      lowConf: acc.lowConf + c.lowConf,
      cleanPending: acc.cleanPending + c.cleanPending,
      clients: acc.clients + (c.pending > 0 ? 1 : 0),
    }),
    { pending: 0, flagged: 0, lowConf: 0, cleanPending: 0, clients: 0 },
  );

  // `approved` is NOT part of the five totals in the brief, and is counted separately because it
  // cannot come from the aggregation above: that pipeline $matches status="pending", so approved
  // entries are not in it at all. Without this the page's fourth stat card ("Approved") would be
  // the one card still summing the capped 200-row fetch — the exact dependency this endpoint
  // exists to remove. One indexed count over the same window; see the report.
  const approvedMatch = { ...match, status: "approved" };
  totals.approved = await JournalEntry.countDocuments(approvedMatch);

  return { clients, totals };
}

export async function getEntryById(id) {
  const entry = await JournalEntry.findById(id)
    .populate("client", "profile.firstName profile.lastName")
    .lean();
  if (!entry) throw new ApiError(404, "Journal entry not found");
  return serialize(entry);
}

export async function updateEntry(id, data, actor) {
  const existing = await JournalEntry.findById(id);
  if (!existing) throw new ApiError(404, "Journal entry not found");

  // Re-enrich items if they're being updated
  if (data.items) {
    data.items = await enrichItems(data.items);
  }

  Object.assign(existing, data);
  await existing.save();

  const populated = await JournalEntry.findById(id)
    .populate("client", "profile.firstName profile.lastName")
    .lean();
  return serialize(populated);
}

export async function deleteEntry(id) {
  const entry = await JournalEntry.findByIdAndDelete(id);
  if (!entry) throw new ApiError(404, "Journal entry not found");
  // Same shape as deleteClient/deleteMeal/deleteFood: the document goes first, then the stored
  // file is removed best-effort, never awaited. A storage outage must not stop a dietitian
  // deleting an entry, and re-running the delete wouldn't help — the document is already gone,
  // so there'd be nothing left to retry from.
  //
  // No legacy case to handle here (unlike deleteMeal, which reads .lean() to catch a
  // pre-migration single `photo` field): `photo` has always been a declared path on this
  // schema, and nothing populated it until the WhatsApp intake endpoint shipped. Verified
  // against the database — 0 of the existing journal entries carry a photo.
  if (entry.photo?.key) {
    deleteImage(entry.photo.key).catch((err) => {
      // Logged rather than silently swallowed (the other three call sites use a bare
      // `.catch(() => {})`). A failure here leaks a file that nothing references any more, and
      // without the key in the logs there is no way to find it again to clean it up by hand.
      console.error(`Failed to delete journal photo ${entry.photo.key}:`, err.message);
    });
  }
}
