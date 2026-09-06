import puppeteer from "puppeteer-core";
import MealPlan from "./meal-plan.model.js";
import Client from "../clients/client.model.js";
import Food from "../foods/food.model.js";
import Meal from "../meals/meal.model.js";
import MealPlanTemplate from "../mealplantemplates/meal-plan-template.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { buildPlanHtml } from "../../lib/pdf/buildPlanHtml.js";
import { env } from "../../config/env.js";
import {
  MICRO_FIELDS,
  microTotalKey,
  addMicronutrients,
  finalizeMicronutrients,
  gramsPerUnitForFood,
} from "../../lib/calc/recipeMacros.js";

export async function createPlan(data, actor) {
  const client = await Client.findById(data.client).lean();
  if (!client) throw new ApiError(404, "Client not found");

  // "From template" copies the template's current day/item content in as a plain structural
  // copy — the exact same snapshot-copy pattern duplicatePlan already uses for plan-to-plan
  // copies (strip subdocument _id, keep everything else, including each item's own denormalized
  // name/macros so this is safe even if the template's underlying food/recipe is edited/deleted
  // later). "Blank canvas" (no templateId) keeps the original items: [] behavior exactly.
  const { templateId, ...rest } = data;
  let items = [];
  if (templateId) {
    const template = await MealPlanTemplate.findById(templateId).lean();
    if (!template) throw new ApiError(404, "Meal plan template not found");
    items = template.items.map(({ _id, ...item }) => item);
  }

  const plan = await MealPlan.create({
    ...rest,
    targetCalories: data.targetCalories ?? client.targets?.calories ?? 0,
    targetProtein: data.targetProtein ?? client.targets?.protein ?? 0,
    targetCarbs: data.targetCarbs ?? client.targets?.carbs ?? 0,
    targetFat: data.targetFat ?? client.targets?.fat ?? 0,
    targetFiber: data.targetFiber ?? client.targets?.fiber ?? 0,
    items,
    createdBy: actor._id,
  });

  return populatePlan(plan._id);
}

export async function listPlans({ page, limit, status, client }) {
  const filter = {};
  if (status) filter.status = status;
  if (client) filter.client = client;

  const skip = (page - 1) * limit;
  const [mealPlans, total] = await Promise.all([
    MealPlan.find(filter)
      .populate("client", "profile.firstName profile.lastName targets driTargets")
      .select("-items")
      .skip(skip)
      .limit(limit)
      .sort("-updatedAt")
      .lean(),
    MealPlan.countDocuments(filter),
  ]);
  return { mealPlans, total, page, limit };
}

export async function getPlanById(id) {
  const plan = await populatePlan(id);
  if (!plan) throw new ApiError(404, "Meal plan not found");
  return plan;
}

export async function updatePlan(id, data) {
  const plan = await MealPlan.findByIdAndUpdate(id, data, { new: true });
  if (!plan) throw new ApiError(404, "Meal plan not found");
  return populatePlan(plan._id);
}

export async function duplicatePlan(id, { name, client: clientId } = {}, actor) {
  const source = await MealPlan.findById(id).lean();
  if (!source) throw new ApiError(404, "Meal plan not found");

  const resolvedClientId = clientId || source.client;
  const resolvedName = name || `${source.name} (copy)`;

  // If the client changed, copy that client's targets onto the new plan
  let targets = {
    targetCalories: source.targetCalories,
    targetProtein: source.targetProtein,
    targetCarbs: source.targetCarbs,
    targetFat: source.targetFat,
    targetFiber: source.targetFiber,
  };
  if (clientId && String(clientId) !== String(source.client)) {
    const newClient = await Client.findById(clientId).lean();
    if (!newClient) throw new ApiError(404, "Client not found");
    targets = {
      targetCalories: newClient.targets?.calories ?? 0,
      targetProtein: newClient.targets?.protein ?? 0,
      targetCarbs: newClient.targets?.carbs ?? 0,
      targetFat: newClient.targets?.fat ?? 0,
      targetFiber: newClient.targets?.fiber ?? 0,
    };
  }

  const { _id, createdAt, updatedAt, __v, ...rest } = source;
  const copy = await MealPlan.create({
    ...rest,
    ...targets,
    client: resolvedClientId,
    name: resolvedName,
    status: "draft",
    items: source.items.map(({ _id: _iid, ...item }) => item),
    createdBy: actor._id,
  });
  return populatePlan(copy._id);
}

export async function exportPlanToPdf(id) {
  const plan = await MealPlan.findById(id)
    .populate("client", "profile.firstName profile.lastName targets driTargets")
    .populate("items.food", "name nameAr servingSize servingUnit")
    .populate("items.meal", "name nameAr servings")
    .lean();
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const html = buildPlanHtml(plan);

  const executablePath =
    env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "0mm", bottom: "10mm", left: "0mm" },
    });
    return { pdf, name: plan.name };
  } finally {
    await browser.close();
  }
}

export async function copyDay(planId, fromDay, toDays) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const sourceItems = plan.items.filter((i) => i.day === fromDay);

  // Replace all items in the target days with copies of the source day's items
  plan.items = plan.items.filter((i) => !toDays.includes(i.day));
  for (const targetDay of toDays) {
    for (const item of sourceItems) {
      const { _id, day, ...rest } = item.toObject();
      plan.items.push({ ...rest, day: targetDay });
    }
  }

  await plan.save();
  return populatePlan(plan._id);
}

// Copies one meal slot's items from one day to others. Deliberately NOT built on top of
// copyDay — that function has no slot filter and destructively wipes every item already on
// the target day first. This is additive: existing items already in the target day/slot are
// left untouched, and the copied items are added alongside them. That means copying to a day
// that already has that slot filled results in BOTH sets of items, not a replacement — the
// safer default (no silent data loss), at the cost of leaving duplicate cleanup to the
// dietitian if a replacement was actually what they wanted.
export async function copyMealSlot(planId, fromDay, slot, toDays) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const sourceItems = plan.items.filter((i) => i.day === fromDay && i.slot === slot);

  for (const targetDay of toDays) {
    for (const item of sourceItems) {
      const { _id, day, ...rest } = item.toObject();
      plan.items.push({ ...rest, day: targetDay });
    }
  }

  await plan.save();
  return populatePlan(plan._id);
}

// Same-day slot-to-slot copy (prompt-56, drag-and-drop) — mirrors copyMealSlot exactly, just
// varying `slot` instead of `day`: additive, existing items already in the target slot are left
// untouched, copied items are appended alongside them. fromSlot === toSlot (a self-drop) needs no
// special-casing — it just appends a duplicate copy of the slot's own items onto itself, which is
// the same "append, never overwrite" behavior as every other case. An empty source slot naturally
// no-ops (sourceItems is empty, nothing pushed, plan.save() persists no change).
export async function copySlotToSlot(planId, day, fromSlot, toSlot) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const sourceItems = plan.items.filter((i) => i.day === day && i.slot === fromSlot);

  for (const item of sourceItems) {
    const { _id, slot, ...rest } = item.toObject();
    plan.items.push({ ...rest, slot: toSlot });
  }

  await plan.save();
  return populatePlan(plan._id);
}

// Slot times are whole-plan scoped (not per-item, not per-day) — see meal-plan.model.js.
export async function updateSlotTime(planId, slot, time) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  plan.slotTimes.set(slot, time);
  await plan.save();
  return populatePlan(plan._id);
}

export async function deletePlan(id) {
  const plan = await MealPlan.findByIdAndDelete(id);
  if (!plan) throw new ApiError(404, "Meal plan not found");
}

export async function addItem(planId, itemData) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const details = await computeItemDetails(itemData);
  plan.items.push({ ...itemData, ...details });
  await plan.save();
  return populatePlan(plan._id);
}

// New (prompt-48) — a real plan's items previously only supported remove + re-add via the
// picker, which lost the item's position (re-added items land at the end of their slot).
// Mirrors updateTemplateItem in mealplantemplates.service.js exactly: a partial update, unset
// fields fall back to the item's current values, then run through the same computeItemDetails
// snapshot logic addItem already uses — never a parallel reimplementation.
export async function updateItem(planId, itemId, itemData) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const item = plan.items.id(itemId);
  if (!item) throw new ApiError(404, "Item not found");

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
  await plan.save();
  return populatePlan(plan._id);
}

export async function removeItem(planId, itemId) {
  const plan = await MealPlan.findById(planId);
  if (!plan) throw new ApiError(404, "Meal plan not found");

  const item = plan.items.id(itemId);
  if (!item) throw new ApiError(404, "Item not found");

  plan.items.pull(itemId);
  await plan.save();
}

async function populatePlan(id) {
  return MealPlan.findById(id)
    .populate("client", "profile.firstName profile.lastName targets driTargets")
    .populate(
      "items.food",
      // portions (prompt-45's real per-food measures) added for prompt-48's in-place item
      // editor — MeasureSelect needs a food's real measures to let the dietitian switch to a
      // different one when editing an already-added item, not just when first adding it.
      "name servingSize servingUnit gramsPerCup gramsPerTbsp gramsPerTsp gramsPerPiece gramsPerMl commonServings portions",
    )
    .populate("items.meal", "name servings")
    .lean();
}

// Exported so mealplantemplates.service.js can compute a template item's snapshot with the
// exact same math when authoring a template from scratch — one shared calculation path, not a
// second reimplementation (mirrors this app's existing pattern of denormalizing name/macros
// onto an item at add-time rather than relying on a live food/meal lookup at render time).
export async function computeItemDetails(item) {
  if (item.type === "food") {
    const food = await Food.findById(item.food).lean();
    if (!food) throw new ApiError(404, "Food not found");
    // Same conversion as recipeMacros.js's computeRecipeMacros: quantity -> grams via
    // gramsPerUnitForFood (per-food override, falling back to the flat UNIT_TO_GRAMS table),
    // then a per-100g factor. Previously this divided by food.servingSize instead of
    // converting item.unit at all, silently ignoring any non-gram unit — fixed to match the
    // recipe path exactly rather than reimplementing a second conversion.
    const qty = item.quantity || 0;
    const gramsPerUnit = gramsPerUnitForFood(food, item.unit);
    const grams = qty * gramsPerUnit;
    const factor = grams / 100;

    const microTotals = {};
    const microSeen = {};
    addMicronutrients(microTotals, microSeen, food, factor);

    return {
      name: food.name,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
      fiber: Math.round((food.fiber || 0) * factor * 10) / 10,
      ...finalizeMicronutrients(microTotals, microSeen),
    };
  }

  if (item.type === "recipe") {
    const meal = await Meal.findById(item.meal).lean();
    if (!meal) throw new ApiError(404, "Recipe not found");
    const s = (item.servings || 1) / (meal.servings || 1);

    const micros = {};
    for (const field of MICRO_FIELDS) {
      const mealValue = meal[microTotalKey(field)];
      micros[field] = mealValue == null ? null : Math.round(mealValue * s * 100) / 100;
    }

    return {
      name: meal.name,
      calories: Math.round(meal.totalCalories * s),
      protein: Math.round(meal.totalProtein * s * 10) / 10,
      carbs: Math.round(meal.totalCarbs * s * 10) / 10,
      fat: Math.round(meal.totalFat * s * 10) / 10,
      fiber: Math.round((meal.totalFiber || 0) * s * 10) / 10,
      ...micros,
    };
  }

  return { name: "Unknown", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}
