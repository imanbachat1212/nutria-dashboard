import puppeteer from "puppeteer-core";
import MealPlan from "./meal-plan.model.js";
import Client from "../clients/client.model.js";
import Food from "../foods/food.model.js";
import Meal from "../meals/meal.model.js";
import { ApiError } from "../../lib/ApiError.js";
import { buildPlanHtml } from "../../lib/pdf/buildPlanHtml.js";
import { env } from "../../config/env.js";

export async function createPlan(data, actor) {
  const client = await Client.findById(data.client).lean();
  if (!client) throw new ApiError(404, "Client not found");

  const plan = await MealPlan.create({
    ...data,
    targetCalories: data.targetCalories ?? client.targets?.calories ?? 0,
    targetProtein: data.targetProtein ?? client.targets?.protein ?? 0,
    targetCarbs: data.targetCarbs ?? client.targets?.carbs ?? 0,
    targetFat: data.targetFat ?? client.targets?.fat ?? 0,
    items: [],
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
      .populate("client", "profile.firstName profile.lastName targets")
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
  };
  if (clientId && String(clientId) !== String(source.client)) {
    const newClient = await Client.findById(clientId).lean();
    if (!newClient) throw new ApiError(404, "Client not found");
    targets = {
      targetCalories: newClient.targets?.calories ?? 0,
      targetProtein: newClient.targets?.protein ?? 0,
      targetCarbs: newClient.targets?.carbs ?? 0,
      targetFat: newClient.targets?.fat ?? 0,
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
    .populate("client", "profile.firstName profile.lastName targets")
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
    .populate("client", "profile.firstName profile.lastName targets")
    .populate("items.food", "name servingSize servingUnit")
    .populate("items.meal", "name servings")
    .lean();
}

async function computeItemDetails(item) {
  if (item.type === "food") {
    const food = await Food.findById(item.food).lean();
    if (!food) throw new ApiError(404, "Food not found");
    const factor = (item.quantity || 0) / (food.servingSize || 100);
    return {
      name: food.name,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
    };
  }

  if (item.type === "recipe") {
    const meal = await Meal.findById(item.meal).lean();
    if (!meal) throw new ApiError(404, "Recipe not found");
    const s = (item.servings || 1) / (meal.servings || 1);
    return {
      name: meal.name,
      calories: Math.round(meal.totalCalories * s),
      protein: Math.round(meal.totalProtein * s * 10) / 10,
      carbs: Math.round(meal.totalCarbs * s * 10) / 10,
      fat: Math.round(meal.totalFat * s * 10) / 10,
    };
  }

  return { name: "Unknown", calories: 0, protein: 0, carbs: 0, fat: 0 };
}
