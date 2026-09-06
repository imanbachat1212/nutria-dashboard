import { api } from "./api";
import type { AddItemPayload } from "./mealplans-api";

// Mirrors the backend's templateItemSchema (meal-plan-template.model.js) — deliberately the
// same shape as a real plan's item (see mealplans-api.ts's APIPlanItem), snapshotted name/
// macros included, so a template survives its referenced food/recipe being edited or deleted
// later exactly like a real plan already does.
export interface TemplateItem {
  _id: string;
  day: number;
  slot: string;
  type: "food" | "recipe";
  // Populated by getTemplateById (prompt-59) with the same measure-relevant field set real plans
  // use, so the in-place edit dialog can offer this food's real measures. Still just an id string
  // on any response that didn't go through that populate.
  food?:
    | {
        _id: string;
        name: string;
        gramsPerCup?: number | null;
        gramsPerTbsp?: number | null;
        gramsPerTsp?: number | null;
        gramsPerPiece?: number | null;
        gramsPerMl?: number | null;
        commonServings?: { label: string; grams: number }[];
        portions?: { description: string; grams: number }[];
      }
    | string
    | null;
  meal?: { _id: string; name: string; servings?: number } | string | null;
  name: string;
  quantity: number;
  unit: string;
  // Display-only (prompt-47/49) — mirrors mealplans-api.ts's APIPlanItem.measureLabel/
  // measureDescription/measureCount exactly. Read by the template item editor since prompt-59
  // (pre-selecting the exact measure originally picked), same as real plan items.
  measureLabel?: string | null;
  measureDescription?: string | null;
  measureCount?: number | null;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanTemplate {
  _id: string;
  name: string;
  tag: string | null;
  days: number;
  items: TemplateItem[];
  dailyTotals: DailyTotals;
  archived: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMealPlanTemplates(params?: {
  archived?: boolean;
}): Promise<MealPlanTemplate[]> {
  const qs = new URLSearchParams();
  if (params?.archived) qs.set("archived", "true");
  const q = qs.toString();
  const result = await api.get<{ templates: MealPlanTemplate[] }>(
    `/api/meal-plan-templates${q ? `?${q}` : ""}`,
  );
  return result.templates;
}

export async function fetchMealPlanTemplate(id: string): Promise<MealPlanTemplate> {
  return api.get<MealPlanTemplate>(`/api/meal-plan-templates/${id}`);
}

export interface TemplateItemInput {
  day: number;
  slot: string;
  type: "food" | "recipe";
  food?: string;
  meal?: string;
  quantity?: number;
  unit?: string;
  servings?: number;
}

export interface CreateTemplatePayload {
  name: string;
  tag?: string;
  days?: number;
  items?: TemplateItemInput[];
}

export async function createMealPlanTemplate(
  data: CreateTemplatePayload,
): Promise<MealPlanTemplate> {
  return api.post<MealPlanTemplate>("/api/meal-plan-templates", data);
}

export async function updateMealPlanTemplate(
  id: string,
  data: Partial<CreateTemplatePayload>,
): Promise<MealPlanTemplate> {
  return api.patch<MealPlanTemplate>(`/api/meal-plan-templates/${id}`, data);
}

export async function archiveMealPlanTemplate(id: string): Promise<MealPlanTemplate> {
  return api.post<MealPlanTemplate>(`/api/meal-plan-templates/${id}/archive`, {});
}

export async function restoreMealPlanTemplate(id: string): Promise<MealPlanTemplate> {
  return api.post<MealPlanTemplate>(`/api/meal-plan-templates/${id}/restore`, {});
}

// Permanent removal (prompt-44) — distinct from archive above. Never affects a real meal plan
// already created from this template (it holds its own independent item copy, no live reference).
export async function deleteMealPlanTemplate(id: string): Promise<void> {
  return api.delete<void>(`/api/meal-plan-templates/${id}`);
}

// Item-level content editing (prompt-41) — same AddItemPayload shape a real plan's addPlanItem
// takes, so PlanItemPicker (mealplans-api.ts's real-plan picker) can be reused as-is for
// templates by just swapping which of these two functions its onAdd prop calls.
export async function addTemplateItem(
  templateId: string,
  data: AddItemPayload,
): Promise<MealPlanTemplate> {
  return api.post<MealPlanTemplate>(`/api/meal-plan-templates/${templateId}/items`, data);
}

export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  data: Partial<AddItemPayload>,
): Promise<MealPlanTemplate> {
  return api.patch<MealPlanTemplate>(
    `/api/meal-plan-templates/${templateId}/items/${itemId}`,
    data,
  );
}

export async function removeTemplateItem(
  templateId: string,
  itemId: string,
): Promise<MealPlanTemplate> {
  return api.delete<MealPlanTemplate>(`/api/meal-plan-templates/${templateId}/items/${itemId}`);
}
