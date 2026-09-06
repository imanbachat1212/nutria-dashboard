import MealPlanTemplate from "./meal-plan-template.model.js";
import MealPlan from "../mealplans/meal-plan.model.js";
import { computeItemDetails } from "../mealplans/mealplans.service.js";
import { ApiError } from "../../lib/ApiError.js";

// Computes a template's displayed daily kcal/macros the same way this app already sums a real
// plan's day totals on the frontend (mealplans-api.ts's buildDays: plain addition of each item's
// own snapshotted calories/protein/carbs/fat) — not a second/different calculation. Averaged
// across the 7-day (0-6) cycle's days that actually have items, since a template's "days" field
// is an advertised duration (e.g. 30), not 30 distinct authored days — see the model comment.
function computeDailyTotals(items) {
  const byDay = new Map();
  for (const item of items) {
    const day = item.day;
    const totals = byDay.get(day) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    totals.calories += item.calories || 0;
    totals.protein += item.protein || 0;
    totals.carbs += item.carbs || 0;
    totals.fat += item.fat || 0;
    byDay.set(day, totals);
  }
  const daysWithItems = [...byDay.values()];
  if (daysWithItems.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const n = daysWithItems.length;
  const sum = daysWithItems.reduce(
    (acc, d) => ({
      calories: acc.calories + d.calories,
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
      fat: acc.fat + d.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: Math.round(sum.calories / n),
    protein: Math.round((sum.protein / n) * 10) / 10,
    carbs: Math.round((sum.carbs / n) * 10) / 10,
    fat: Math.round((sum.fat / n) * 10) / 10,
  };
}

function toPublicTemplate(doc) {
  return {
    ...doc,
    dailyTotals: computeDailyTotals(doc.items ?? []),
  };
}

export async function listTemplates({ archived }) {
  const filter = { archived: archived ? true : { $ne: true } };
  // Project each item down to just the five fields computeDailyTotals actually reads
  // (prompt-62). The full item subdocuments carry a 22-field micronutrient snapshot plus
  // name/measure/ref fields each, which made this list response ~320KB for 7 templates — several
  // seconds of pure transfer time on a high-latency link, for data no list consumer reads. Both
  // callers only use `items.length` and `dailyTotals` (meal-plan-templates.index.tsx and
  // new-plan-dialog.tsx), and projecting subdocument fields keeps the array length intact, so
  // both still work unchanged. Same spirit as listPlans' existing `.select("-items")`, just
  // keeping enough to still compute the totals this list displays. getTemplateById is untouched
  // and still returns full items for the editor.
  const templates = await MealPlanTemplate.find(filter)
    .select("name tag days archived createdBy createdAt updatedAt items.day items.calories items.protein items.carbs items.fat")
    .sort("-updatedAt")
    .lean();
  return templates.map(toPublicTemplate);
}

export async function getTemplateById(id) {
  const template = await MealPlanTemplate.findById(id)
    .populate(
      "items.food",
      // Same field set populatePlan uses for real plans (mealplans.service.js) — prompt-48 added
      // portions/gramsPerX/commonServings there so MeasureSelect could offer a food's real
      // measures when editing an already-added item. Templates need the identical set now that
      // they have the same in-place item editor (prompt-59); without it the edit dialog would
      // fall back to generic units only. Every item-mutating path here returns via this function,
      // so populating once here covers add/update/remove too.
      "name servingSize servingUnit gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings portions",
    )
    .populate("items.meal", "name servings")
    .lean();
  if (!template) throw new ApiError(404, "Meal plan template not found");
  return toPublicTemplate(template);
}

// Runs every raw item input through the exact same computeItemDetails snapshot logic addItem
// uses for a real plan, so a template's stored calories/protein/carbs/fat/micros are computed
// identically — never hand-entered, never a second calculation path.
async function buildItems(rawItems) {
  const items = [];
  for (const raw of rawItems ?? []) {
    const details = await computeItemDetails(raw);
    items.push({ ...raw, ...details });
  }
  return items;
}

export async function createTemplate(data, actor) {
  const items = await buildItems(data.items);
  const template = await MealPlanTemplate.create({
    name: data.name,
    tag: data.tag ?? null,
    days: data.days ?? 7,
    items,
    createdBy: actor._id,
  });
  return getTemplateById(template._id);
}

// The primary authoring path — snapshot an existing real plan's current days/items into a new
// reusable template. Mirrors duplicatePlan's own copy pattern in mealplans.service.js (strip
// _id, keep everything else) rather than a fresh implementation, since that's already this
// codebase's proven-safe way to clone a plan's item list.
export async function createFromPlan(planId, { name, tag, days }, actor) {
  const plan = await MealPlan.findById(planId).lean();
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const template = await MealPlanTemplate.create({
    name,
    tag: tag ?? null,
    days: days ?? 7,
    items: plan.items.map(({ _id, ...item }) => item),
    createdBy: actor._id,
  });
  return getTemplateById(template._id);
}

export async function updateTemplate(id, data) {
  const update = { ...data };
  if (data.items) {
    update.items = await buildItems(data.items);
  }
  const template = await MealPlanTemplate.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!template) throw new ApiError(404, "Meal plan template not found");
  return toPublicTemplate(template);
}

// Archiving/restoring an already-archived/active template is not an error — same idempotent
// convention as clients' setClientArchived.
export async function setTemplateArchived(id, archived) {
  const template = await MealPlanTemplate.findByIdAndUpdate(id, { archived }, { new: true }).lean();
  if (!template) throw new ApiError(404, "Meal plan template not found");
  return toPublicTemplate(template);
}

// Genuine permanent removal — distinct from setTemplateArchived, which only ever flips a flag.
// Mirrors deleteClient's shape (findByIdAndDelete, 404 if missing); no image/file cleanup needed
// here since templates don't have one. Safe against any real MealPlan already built from this
// template: createPlan's "from template" branch copies the template's items into the new plan's
// own items array at creation time and never stores a reference back to the template afterward
// (MealPlan has no templateId field at all — see meal-plan.model.js) — so deleting the template
// document here cannot reach or affect an already-created plan.
export async function deleteTemplate(id) {
  const template = await MealPlanTemplate.findByIdAndDelete(id);
  if (!template) throw new ApiError(404, "Meal plan template not found");
}

// ── Item-level editing (prompt-41) ──
//
// A template's own day-by-day content editor hits these instead of the real plan's item routes,
// but every one goes through the exact same computeItemDetails snapshot logic addItem/updateItem
// use for a real plan — never a reimplementation. Editing a template's items only ever mutates
// the template document itself; any real MealPlan already created from it got its own
// independent items array at creation time (createPlan's copy in mealplans.service.js) and is
// never touched here.

export async function addTemplateItem(templateId, itemData) {
  const template = await MealPlanTemplate.findById(templateId);
  if (!template) throw new ApiError(404, "Meal plan template not found");

  const details = await computeItemDetails(itemData);
  template.items.push({ ...itemData, ...details });
  await template.save();
  return getTemplateById(template._id);
}

export async function updateTemplateItem(templateId, itemId, itemData) {
  const template = await MealPlanTemplate.findById(templateId);
  if (!template) throw new ApiError(404, "Meal plan template not found");

  const item = template.items.id(itemId);
  if (!item) throw new ApiError(404, "Item not found");

  // Partial update — unset fields fall back to the item's current values so e.g. a bare
  // quantity change doesn't require re-sending day/slot/type/food too.
  const merged = {
    day: itemData.day ?? item.day,
    slot: itemData.slot ?? item.slot,
    type: itemData.type ?? item.type,
    food: itemData.food ?? (item.food ? item.food.toString() : undefined),
    meal: itemData.meal ?? (item.meal ? item.meal.toString() : undefined),
    quantity: itemData.quantity ?? item.quantity,
    unit: itemData.unit ?? item.unit,
    // Display-only (prompt-47/49) — never enters computeItemDetails' calculation, just carried
    // through the same "unset falls back to current value" merge as the fields above.
    measureLabel: itemData.measureLabel !== undefined ? itemData.measureLabel : item.measureLabel,
    measureDescription:
      itemData.measureDescription !== undefined ? itemData.measureDescription : item.measureDescription,
    measureCount: itemData.measureCount !== undefined ? itemData.measureCount : item.measureCount,
    servings: itemData.servings ?? item.servings,
  };
  const details = await computeItemDetails(merged);
  item.set({ ...merged, ...details });
  await template.save();
  return getTemplateById(template._id);
}

export async function removeTemplateItem(templateId, itemId) {
  const template = await MealPlanTemplate.findById(templateId);
  if (!template) throw new ApiError(404, "Meal plan template not found");

  const item = template.items.id(itemId);
  if (!item) throw new ApiError(404, "Item not found");

  template.items.pull(itemId);
  await template.save();
  return getTemplateById(template._id);
}
