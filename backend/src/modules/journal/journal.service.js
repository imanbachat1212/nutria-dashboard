import JournalEntry from "./journal-entry.model.js";
import Food from "../foods/food.model.js";
import { ApiError } from "../../lib/ApiError.js";

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

function computeTotals(items) {
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

function clientMeta(entry) {
  const p = entry.client?.profile || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return { clientName: name, clientInitials: initials };
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
}
