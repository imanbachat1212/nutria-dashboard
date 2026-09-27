import Client from "../clients/client.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
import Food from "../foods/food.model.js";
import JournalEntry from "../journal/journal-entry.model.js";
import Appointment from "../appointments/appointment.model.js";
import Message from "../messages/message.model.js";
import { listConversations } from "../messages/messages.service.js";
import { listAppointments } from "../appointments/appointments.service.js";
import { localDayRange } from "../../lib/localDay.js";

// The Overview page's single read (prompt-118). Everything the dashboard's first screen shows,
// in one request — replacing a page where every stat, every appointment and every activity row
// was a hardcoded literal.
//
// ── Why this lives in `reports` ───────────────────────────────────────────────────────────────
// The module was an empty stub, it is already mounted in routes/index.js, and — decisively —
// `reports.read` already exists in the Permission collection AND is already granted to the
// `dietitian` role. A new `overview` module would have needed a new permission key seeded onto
// every role before the endpoint could answer anyone. report.model.js is left untouched: it
// models a *saved, generated* report document (title/parameters/result/generatedBy), which is a
// different, still-unbuilt feature. This endpoint persists nothing.
//
// ── "Today" — two conventions, because the data has two ──────────────────────────────────────
// JOURNAL uses lib/localDay.js (Asia/Beirut, DST-correct), the same helper automation.service.js
// uses for the WhatsApp coach's "so far today". A journal `date` is a real instant — the moment a
// client ate — so the day it belongs to is the client's local day. (This is NOT the Journal page's
// convention: that page doesn't scope to a day at all, it loads a rolling 30 days and filters
// client-side. See flaggedEntries below for the one definition that had to be reconciled.)
//
// APPOINTMENTS use the UTC calendar day instead, and that is not a preference — it is forced by
// how they are written. new-appointment-dialog.tsx composes the dietitian's chosen wall-clock time
// with `Date.UTC(y, mo, d, h, m)`, so a booking entered as "09:00" is stored as 09:00Z, and the
// Appointments page reads it back with getUTCHours() and its UTC `TODAY_KEY`. Bucketing those by a
// Beirut day would put a late-evening booking on the wrong date and disagree with the very page
// this card links to.
//
// The underlying inconsistency — appointments stored as wall-clock-in-UTC while everything else
// stores true instants — is pre-existing and out of scope here. Mirroring each source is the only
// way for this endpoint to agree with both pages at once.
//
// ── Cost ──────────────────────────────────────────────────────────────────────────────────────
// 13 round trips, in three waves (the second needs the active roster from the first; the third
// needs the activity rows from the second). The count is FIXED — it does not grow with clients,
// foods, plans or feed rows.
//
// Round trips are the unit that matters here, not documents scanned: this app talks to a remote
// shared-tier Atlas cluster where a countDocuments over four documents measured ~300ms, the same
// as one over 1,433. So six separate client counts were collapsed into one $facet, the two meal-
// plan counts into one $group, and the two per-client journal aggregations into a second $facet.
// That took the endpoint from 24 trips to 13 without changing a single number it reports.
//
// Every query is either indexed or bounded by an explicit limit. The two $facet pipelines are the
// deliberate exception: each scans its collection once (6 clients, 16 journal entries today) to
// answer six or two questions in one trip, which is the right trade at this size and the wrong one
// at a scale where a collection scan stops being free. The journal $facet is already pre-matched
// to the active roster; the client one would want its facets split back out and indexed.

const ACTIVITY_LIMIT = 12;
// Per-source fetch depth for the merged feed. Each source is sorted newest-first and capped here;
// the merge then keeps the newest ACTIVITY_LIMIT overall. Deeper than the output cap on purpose,
// so one very chatty source can't crowd the others out of the merge window.
const ACTIVITY_PER_SOURCE = 15;
const NOT_LOGGED_LIMIT = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

function nameOf(client) {
  const p = client?.profile || {};
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
}

// A count against the equivalent prior window, expressed as an absolute delta — never a
// percentage. A percentage needs a non-zero baseline, and "+38% vs prior" over a prior of 0 is
// the kind of invented number this endpoint exists to remove.
//
// Returns null when BOTH windows are empty: nothing happened either period, and a "+0" badge
// dressed up as a trend is noise. The frontend renders no badge at all for null.
function trendFrom(current, prior) {
  if (!current && !prior) return null;
  return {
    delta: current - prior,
    direction: current > prior ? "up" : current < prior ? "down" : "flat",
    prior,
  };
}

// New leads, counted as Clients with status "lead".
//
// NOT the Lead model, despite it having exactly the createdAt/status fields this wants. That
// model is dead code: nothing in src/ imports it, leads.service.js and leads.routes.js are both
// literal `// stub`, and the frontend's /leads page runs entirely on leads-mock.ts. Meanwhile
// message.model.js documents the live definition in its own header — "a lead in this codebase is
// a Client with status: 'lead'" — and the shipped Messages inbox classifies conversations by
// exactly that field. Counting the model nothing writes would have produced a permanent 0 that
// looked like a working number.
//
// Both definitions happen to return 0 on the current database, so this choice is invisible
// today; it is the one that starts being right the moment a WhatsApp inquiry creates a client.
function newLeadWindow(from, to) {
  const createdAt = { $gte: from };
  if (to) createdAt.$lt = to;
  return { status: "lead", createdAt };
}

export async function getOverview({ now = new Date() } = {}) {
  const day = localDayRange(now);
  // UTC calendar day, for appointments only — see the "Today" note above.
  const utcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcDayEnd = new Date(utcDayStart.getTime() + DAY_MS);
  const t = now.getTime();
  const since7 = new Date(t - 7 * DAY_MS);
  const since14 = new Date(t - 14 * DAY_MS);
  const since30 = new Date(t - 30 * DAY_MS);
  const since60 = new Date(t - 60 * DAY_MS);

  // ── Wave 1: the stat row, plus the active roster the meal-logging card needs ───────────────
  const [clientFacets, plansByStatus, foodsBySource] = await Promise.all([
    // Six numbers and the active roster itself in one round trip. Every facet inherits the
    // archived-excluding $match, which is buildClientFilter({})'s semantics — the same scope
    // clients.service.js's getClientsStats() uses for the Clients page's stat strip, so
    // `active`/`total` here cannot disagree with that strip. (buildClientFilter isn't exported,
    // and exporting it to save a duplicated one-line $match wasn't worth widening that module's
    // surface; the equality is asserted in the verification instead of assumed.)
    Client.aggregate([
      { $match: { archived: { $ne: true } } },
      {
        $facet: {
          total: [{ $count: "n" }],
          // Documents, not a count: the meal-logging card needs the roster anyway, so taking it
          // from this facet makes `active` free rather than a seventh query.
          activeRoster: [
            { $match: { status: "active" } },
            { $project: { "profile.firstName": 1, "profile.lastName": 1 } },
          ],
          newLeads7: [{ $match: newLeadWindow(since7) }, { $count: "n" }],
          newLeadsPrior7: [{ $match: newLeadWindow(since14, since7) }, { $count: "n" }],
          created30: [{ $match: { createdAt: { $gte: since30 } } }, { $count: "n" }],
          createdPrior30: [
            { $match: { createdAt: { $gte: since60, $lt: since30 } } },
            { $count: "n" },
          ],
        },
      },
    ]),
    // Both plan numbers from one pass. MealPlanTemplate is its own collection, so templates are
    // excluded here by construction rather than by a filter.
    MealPlan.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Food.aggregate([{ $group: { _id: "$source", n: { $sum: 1 } } }]),
  ]);

  const f = clientFacets[0] ?? {};
  // $count emits no document at all for an empty match, hence the ?? 0 on every one.
  const facetCount = (rows) => rows?.[0]?.n ?? 0;
  const activeClients = f.activeRoster ?? [];
  const clientStats = { active: activeClients.length, total: facetCount(f.total) };
  const leads7 = facetCount(f.newLeads7);
  const leads14to7 = facetCount(f.newLeadsPrior7);
  const clients30 = facetCount(f.created30);
  const clients60to30 = facetCount(f.createdPrior30);

  const activePlans = plansByStatus.find((r) => r._id === "active")?.n ?? 0;
  const totalPlans = plansByStatus.reduce((sum, r) => sum + r.n, 0);

  // Sources with zero rows don't come back from the $group at all — "custom" is currently one of
  // them — so the three keys are seeded rather than read off the result.
  const bySource = { usda: 0, lebanese: 0, custom: 0 };
  for (const row of foodsBySource) {
    if (row._id && row._id in bySource) bySource[row._id] = row.n;
  }
  const totalFoods = foodsBySource.reduce((sum, row) => sum + row.n, 0);

  const activeIds = activeClients.map((c) => c._id);

  // ── Wave 2: today's logging, attention counts, appointments, activity sources ──────────────
  const [
    journalFacets,
    flaggedEntries,
    conversations,
    todayAppointments,
    recentJournal,
    recentMessages,
    recentLeads,
    recentAppointments,
  ] = await Promise.all([
    // Both per-client journal questions in one trip, over one pre-matched stream.
    //
    // activeIds come straight out of the previous aggregation as real ObjectIds. That matters:
    // aggregation pipelines get none of Mongoose's automatic casting, so a stringified id here
    // would match nothing and every client would read as "hasn't logged today" — an honest-
    // looking wrong answer rather than an error.
    JournalEntry.aggregate([
      { $match: { client: { $in: activeIds } } },
      {
        $facet: {
          // Distinct active clients with at least one MEAL entry inside the local day. An
          // exercise entry deliberately does not count as having logged a meal.
          loggedToday: [
            { $match: { kind: "meal", date: { $gte: day.start, $lt: day.end } } },
            { $group: { _id: "$client" } },
          ],
          // Newest entry per client, which is what orders the not-yet-logged list by staleness.
          lastLogged: [{ $group: { _id: "$client", lastAt: { $max: "$date" } } }],
        },
      },
    ]),
    // Flagged entries still awaiting review.
    //
    // This is the one number that departs from the brief, which asked for "flagged journal
    // entries in the last 24h". Two reasons, and the brief's own acceptance criterion is the
    // second one:
    //
    //   1. A 24h window reads as "nothing needs attention" the moment the practice has a quiet
    //      day, while 10 flagged entries sit unreviewed. Staleness is an argument for surfacing
    //      an entry, not for hiding it.
    //   2. The card links to /journal, whose Flagged tab counts `status === "pending" && flags
    //      .length > 0`. A summary card reading 0 above a page reading 10 is precisely the
    //      "disagrees with the page it's supposedly summarizing" bug the brief warned about.
    //
    // So the definition is copied from that tab instead, minus the window. The Journal page
    // currently fetches a rolling 30 days, so the two agree exactly (10 = 10) unless a still-
    // pending flagged entry ages past 30 days — at which point this keeps counting it and the
    // page needs its range widened to show it. That is the correct direction to disagree in.
    JournalEntry.countDocuments({ status: "pending", "flags.0": { $exists: true } }),
    // Reused, not reimplemented: "inbound messages that arrived after the last thing anyone sent
    // back". The definition and its caveats live in messages.service.js; this only counts the
    // threads it returns.
    listConversations(),
    // Also reused, so "today's calendar" matches the Appointments page's list endpoint. `to` is
    // inclusive ($lte) there while this range is half-open, hence the 1ms step back — without it
    // an appointment at exactly tomorrow-midnight would land in today's list.
    listAppointments({ from: utcDayStart, to: new Date(utcDayEnd.getTime() - 1) }),
    JournalEntry.find({})
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_PER_SOURCE)
      .select("client kind date createdAt items exercise")
      .lean(),
    Message.find({ direction: "inbound" })
      .sort({ sentAt: -1 })
      .limit(ACTIVITY_PER_SOURCE)
      .select("client body kind attachmentLabel sentAt")
      .lean(),
    Client.find({ archived: { $ne: true }, status: "lead" })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_PER_SOURCE)
      .select("profile.firstName profile.lastName phone createdAt")
      .lean(),
    Appointment.find({})
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_PER_SOURCE)
      .select("client name type category dateTime createdAt")
      .lean(),
  ]);

  const jf = journalFacets[0] ?? {};
  const loggedToday = new Set((jf.loggedToday ?? []).map((r) => String(r._id)));
  const lastLoggedBy = new Map((jf.lastLogged ?? []).map((r) => [String(r._id), r.lastAt]));

  // Ordered longest-since-last-logged first, which puts the clients who have gone quiet at the
  // top. Never-logged sorts ahead of everyone (nothing is staler than nothing), and name is the
  // final tie-break so the list is deterministic rather than dependent on document order.
  const notLoggedAll = activeClients
    .filter((c) => !loggedToday.has(String(c._id)))
    .map((c) => ({
      id: String(c._id),
      name: nameOf(c),
      lastLoggedAt: lastLoggedBy.get(String(c._id))?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      if (a.lastLoggedAt === b.lastLoggedAt) return a.name.localeCompare(b.name);
      if (a.lastLoggedAt === null) return -1;
      if (b.lastLoggedAt === null) return 1;
      return a.lastLoggedAt < b.lastLoggedAt ? -1 : 1;
    });

  const activity = buildActivity({
    recentJournal,
    recentMessages,
    recentLeads,
    recentAppointments,
  }).slice(0, ACTIVITY_LIMIT);
  const activityClients = await resolveClientNames(activity);

  return {
    generatedAt: now.toISOString(),
    today: {
      date: day.date,
      timeZone: day.timeZone,
      // The appointments card is scoped to this UTC date instead; usually identical, and
      // different only for the hours where the two calendars disagree.
      appointmentsDate: utcDayStart.toISOString().slice(0, 10),
    },
    stats: {
      clients: {
        active: clientStats.active,
        total: clientStats.total,
        // Describes clients *created*, which is not the same quantity as the headline "active"
        // figure above it — the frontend labels it "new" for exactly that reason.
        trend: trendFrom(clients30, clients60to30),
        trendWindowDays: 30,
      },
      mealPlans: {
        active: activePlans,
        total: totalPlans,
        // No honest prior-period comparison: `status` is a current state, not a dated event, so
        // "active plans last month" isn't recoverable from the data.
        trend: null,
      },
      foods: {
        total: totalFoods,
        bySource,
        // Deliberately absent. The database moves when someone imports a dataset, not week to
        // week, so a weekly delta here would be a decorative zero.
        trend: null,
      },
      leads: {
        last7Days: leads7,
        trend: trendFrom(leads7, leads14to7),
        trendWindowDays: 7,
      },
    },
    mealLogging: {
      loggedToday: loggedToday.size,
      activeClients: activeClients.length,
      notLoggedCount: notLoggedAll.length,
      notLogged: notLoggedAll.slice(0, NOT_LOGGED_LIMIT),
    },
    appointmentsToday: todayAppointments.appointments.map(serializeAppointment),
    needsAttention: {
      flaggedEntries,
      unreadConversations: conversations.filter((c) => c.unread > 0).length,
      // Same call and same window as stats.leads.last7Days, read off the one variable, so the
      // stat row and the attention card cannot drift apart.
      newLeads: leads7,
    },
    activity: activity.map((e) => ({
      ...e,
      clientName: e.clientId ? (activityClients.get(e.clientId) ?? "Unknown") : e.clientName,
    })),
  };
}

// Titles are a deliberate mirror of routes/appointments.tsx's displayName(), so the same booking
// reads identically on the Overview card and on the Appointments page it links to:
//
//   gym-machine  → whoever is actually on it, because the resource name ("Rowing machines") says
//                  less than the person's name; falls back to the title, then the type label.
//   gym-class    → its own title ("Zumba"), since a class has many attendees under one name.
//   everything   → the client's name, or the literal "Unknown" when the ref is dangling. That
//   else           string is not a placeholder I invented: appointments.tsx line 162 renders
//                  exactly `a.client?.name || "Unknown"`, and this database has one assessment
//                  whose client was deleted out from under it.
//
// APPOINTMENT_TYPE_LABEL likewise copies appointments-mock.ts's TYPE_META labels verbatim rather
// than paraphrasing them ("Initial consult", not "Initial consultation").
const APPOINTMENT_TYPE_LABEL = {
  "consult-initial": "Initial consult",
  "consult-followup": "Follow-up",
  "try-out": "Try out",
  assessment: "Assessment",
  "gym-machine": "Gym machine",
  "gym-class": "Group class",
};

// Statuses that occupy a capacity slot — same set appointments.service.js enforces capacity with.
const OCCUPYING = new Set(["booked", "checked-in"]);

function serializeAppointment(appt) {
  const isCapacity = appt.type === "gym-class" || appt.type === "gym-machine";
  const label = APPOINTMENT_TYPE_LABEL[appt.type] ?? appt.type;
  const booked = (appt.attendees || []).filter((a) => OCCUPYING.has(a.status));

  let title;
  if (appt.type === "gym-machine") {
    title = booked.length ? booked.map((a) => a.name).join(", ") : appt.name || label;
  } else if (isCapacity) {
    title = appt.name || label;
  } else {
    title = appt.client ? nameOf(appt.client) : "Unknown";
  }

  return {
    id: String(appt._id),
    at: appt.dateTime,
    category: appt.category,
    type: appt.type,
    status: appt.status,
    title,
    // The type label is dropped from the subtitle when it already IS the title — an empty gym
    // machine would otherwise read "Gym machine / 0/8 booked · Gym machine".
    subtitle: isCapacity
      ? [`${booked.length}/${appt.capacity ?? 8} booked`, title === label ? null : label]
          .filter(Boolean)
          .join(" · ")
      : label,
  };
}

// One merged, newest-first stream. `type` is the only thing that varies per source — icon and
// wording are the frontend's job, so nothing here sends a component name or a rendered sentence.
function buildActivity({ recentJournal, recentMessages, recentLeads, recentAppointments }) {
  const events = [];

  for (const e of recentJournal) {
    const labels = (e.items || []).map((i) => i.label).filter(Boolean);
    const kcal = (e.items || []).reduce((sum, i) => sum + (i.macros?.calories || 0), 0);
    const meta =
      e.kind === "exercise"
        ? [e.exercise?.type, e.exercise?.minutes ? `${e.exercise.minutes} min` : null]
            .filter(Boolean)
            .join(" · ") || "activity logged"
        : [labels.slice(0, 2).join(", ") || "meal logged", kcal ? `${Math.round(kcal)} kcal` : null]
            .filter(Boolean)
            .join(" · ");
    events.push({
      id: `journal-${e._id}`,
      type: e.kind === "exercise" ? "journal-exercise" : "journal-meal",
      clientId: String(e.client),
      meta,
      at: (e.createdAt ?? e.date).toISOString(),
    });
  }

  for (const m of recentMessages) {
    const meta =
      m.body?.trim() ||
      m.attachmentLabel ||
      (m.kind === "image" ? "Photo" : m.kind === "voice" ? "Voice note" : "Message");
    events.push({
      id: `message-${m._id}`,
      type: "message-inbound",
      clientId: String(m.client),
      meta: meta.length > 90 ? `${meta.slice(0, 89)}…` : meta,
      at: m.sentAt.toISOString(),
    });
  }

  for (const c of recentLeads) {
    events.push({
      id: `lead-${c._id}`,
      type: "lead-new",
      clientId: String(c._id),
      // A lead's own name is often all that exists; the phone is the useful second line.
      meta: c.phone || "new inquiry",
      at: c.createdAt.toISOString(),
    });
  }

  for (const a of recentAppointments) {
    const label = APPOINTMENT_TYPE_LABEL[a.type] ?? a.type;
    events.push({
      id: `appointment-${a._id}`,
      type: "appointment-booked",
      // Capacity bookings have no single client — the row shows the session title instead, so
      // clientId stays null and clientName is supplied directly.
      clientId: a.client ? String(a.client) : null,
      clientName: a.client ? undefined : a.name || "Group session",
      meta: `${label} · ${a.dateTime.toISOString()}`,
      at: (a.createdAt ?? a.dateTime).toISOString(),
    });
  }

  return events.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
}

// One lookup for every client id across every feed source, rather than a query per row.
async function resolveClientNames(events) {
  const ids = [...new Set(events.map((e) => e.clientId).filter(Boolean))];
  if (!ids.length) return new Map();
  const clients = await Client.find({ _id: { $in: ids } })
    .select("profile.firstName profile.lastName")
    .lean();
  return new Map(clients.map((c) => [String(c._id), nameOf(c)]));
}
