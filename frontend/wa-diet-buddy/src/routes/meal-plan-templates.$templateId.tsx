import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Archive,
  ArchiveRestore,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlanItemPicker } from "@/components/plan-item-picker";
import { EditTemplateDialog } from "@/components/edit-template-dialog";
// Reused as-is from real Meal Plans (prompt-48/49) — it takes an onSave callback rather than
// calling any plan-specific endpoint itself, so templates can point it at their own PATCH route.
import { EditPlanItemDialog, type EditableItem } from "@/components/edit-plan-item-dialog";
import { formatSavedMeasureAmount, formatSavedGenericUnitAmount } from "@/lib/measure-options";
import { DAYS, SLOT_META, dayMacros, mealMacros, type DayKey, type MealSlot, type DayPlan } from "@/lib/meal-plans-mock";
import type { AddItemPayload } from "@/lib/mealplans-api";
import {
  fetchMealPlanTemplate,
  archiveMealPlanTemplate,
  restoreMealPlanTemplate,
  addTemplateItem,
  removeTemplateItem,
  updateTemplateItem,
  type TemplateItem,
} from "@/lib/mealplantemplates-api";

export const Route = createFileRoute("/meal-plan-templates/$templateId")({
  head: () => ({ meta: [{ title: "Edit Template — Nutria" }] }),
  component: TemplateEditorPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl text-center py-20">
      <h1 className="font-display text-2xl font-semibold">Template not found</h1>
      <Button asChild className="mt-6">
        <Link to="/meal-plan-templates">Back to templates</Link>
      </Button>
    </div>
  ),
});

const DEFAULT_SLOTS: MealSlot[] = ["breakfast", "snack-am", "lunch", "snack-pm", "dinner"];

// Templates always cycle a single 7-day (Mon-Sun) week internally, regardless of the template's
// own advertised `days` duration (e.g. 30 for Ramadan) — matching the real MealPlan's own
// items[].day schema constraint (min 0, max 6; see backend meal-plan.model.js), since this exact
// item list gets copied verbatim into a real plan's items on creation (mealplans.service.js's
// createPlan). The real plan's own day-tab UI never navigates more than 7 days either, no matter
// how many weeks a plan spans — a longer duration just repeats the same week for longer. So this
// editor deliberately does NOT expose up to 30 distinct navigable days; that would both
// contradict how a real plan already works and produce content that can't actually be copied
// into one (day values above 6 would fail the real plan's own validation).
function buildTemplateDays(items: TemplateItem[]): DayPlan[] {
  return DAYS.map((d, dayIdx) => ({
    day: d.key,
    meals: DEFAULT_SLOTS.map((slot, slotIdx) => {
      const slotItems = items.filter((i) => i.day === dayIdx && i.slot === slot);
      return {
        id: `${d.key}-${slotIdx}-${slot}`,
        slot,
        title: SLOT_META[slot].label,
        time: SLOT_META[slot].defaultTime,
        items: slotItems.map((i) => {
          const food = i.food && typeof i.food === "object" ? i.food : null;
          return {
            id: i._id,
            name: i.name,
            amount:
              i.type === "food"
                ? formatSavedMeasureAmount(i) ||
                  formatSavedGenericUnitAmount(i, food) ||
                  i.measureLabel ||
                  `${i.quantity} ${i.unit || "g"}`
                : `${i.servings} serving${i.servings !== 1 ? "s" : ""}`,
            // Templates don't track fiber (out of scope for prompt-53, which is real Meal
            // Plans only) — 0 here is just satisfying the shared Macros type, not a real total.
            macros: { kcal: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat, fiber: 0 },
            // Everything below feeds the in-place edit dialog (prompt-59) — same fields
            // buildItemView assembles for a real plan item in mealplans-api.ts, so the identical
            // EditPlanItemDialog can be reused here with no template-specific variant.
            itemType: i.type,
            rawQuantity: i.type === "recipe" ? i.servings : i.quantity,
            rawUnit: i.unit,
            measureLabel: i.measureLabel ?? null,
            measureDescription: i.measureDescription ?? null,
            measureCount: i.measureCount ?? null,
            realMeasures: food?.portions?.map((p) => ({ label: p.description, grams: p.grams })),
            unitWeights: food
              ? {
                  cup: food.gramsPerCup ?? null,
                  tbsp: food.gramsPerTbsp ?? null,
                  tsp: food.gramsPerTsp ?? null,
                  piece: food.gramsPerPiece ?? null,
                  ml: food.gramsPerMl ?? null,
                }
              : undefined,
            commonServings: food?.commonServings,
          };
        }),
      };
    }),
  }));
}

function MacroStat({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold tabular-nums">
          {value}
          {unit}
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TemplateEditorPage() {
  const { templateId } = Route.useParams();
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState<DayKey>("mon");
  const [editingDetails, setEditingDetails] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  // In-place item edit (prompt-59) — same state/dialog pairing real Meal Plans use.
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [pickerState, setPickerState] = useState<{ open: boolean; day: number; slot: string }>({
    open: false,
    day: 0,
    slot: "breakfast",
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ["meal-plan-templates", "detail", templateId],
    queryFn: () => fetchMealPlanTemplate(templateId),
  });

  function invalidate() {
    // Both this detail query and the list/wizard's query share the "meal-plan-templates" prefix.
    qc.invalidateQueries({ queryKey: ["meal-plan-templates"] });
  }

  async function handleToggleArchive() {
    if (!template) return;
    try {
      if (template.archived) {
        await restoreMealPlanTemplate(templateId);
        toast.success("Template restored");
      } else {
        await archiveMealPlanTemplate(templateId);
        toast.success("Template archived");
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update template");
    }
  }

  // Mirrors real Meal Plans' handleSaveEditedItem (meal-plans.tsx) — the dialog hands back a
  // Partial<AddItemPayload>, which updateTemplateItem's PATCH accepts as-is, so no reshaping and
  // no template-specific dialog variant is needed.
  async function handleSaveEditedItem(data: Partial<AddItemPayload>) {
    if (!editingItem) return;
    await updateTemplateItem(templateId, editingItem.id, data);
    invalidate();
    toast.success("Item updated");
  }

  async function handleRemoveItem(itemId: string) {
    setRemoving(itemId);
    try {
      await removeTemplateItem(templateId, itemId);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove item");
    } finally {
      setRemoving(null);
    }
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!template) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Template not found.</div>;
  }

  const days = buildTemplateDays(template.items);
  const activeDayIdx = DAYS.findIndex((d) => d.key === activeDay);
  const day = days.find((d) => d.day === activeDay);

  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        <Button variant="ghost" size="icon" className="mt-0.5" asChild>
          <Link to="/meal-plan-templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-semibold tracking-tight truncate">
              {template.name}
            </h1>
            {template.tag && (
              <Badge variant="outline" className="text-[10px]">
                {template.tag}
              </Badge>
            )}
            {template.archived && (
              <Badge variant="secondary" className="text-[10px]">
                Archived
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {template.days} day{template.days === 1 ? "" : "s"} advertised duration · content
            cycles this one Mon–Sun week
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingDetails(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleToggleArchive}>
            {template.archived ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            {template.archived ? "Restore" : "Archive"}
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <MacroStat icon={Flame} label="kcal / day" value={template.dailyTotals.calories} />
          <MacroStat icon={Beef} label="Protein" value={template.dailyTotals.protein} unit="g" />
          <MacroStat icon={Wheat} label="Carbs" value={template.dailyTotals.carbs} unit="g" />
          <MacroStat icon={Droplet} label="Fat" value={template.dailyTotals.fat} unit="g" />
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Averaged across the week's days that have items — updates live as you add, edit, or
          remove items below. Editing this template never changes any plan already created from
          it.
        </p>
      </Card>

      {/* day tabs — always the 7-day Mon-Sun cycle, see buildTemplateDays comment above */}
      <div className="flex items-center gap-1 mb-3">
        {DAYS.map((d) => {
          const dp = days.find((x) => x.day === d.key);
          const dm = dp ? dayMacros(dp) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
          const isActive = d.key === activeDay;
          return (
            <button
              key={d.key}
              onClick={() => setActiveDay(d.key)}
              className={cn(
                "flex flex-col items-center px-2.5 py-1.5 rounded-md border text-[11px] transition-colors min-w-13",
                isActive
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-transparent hover:bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="font-medium">{d.short}</span>
              <span className="text-[9px] opacity-70">{dm.kcal} kcal</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {day?.meals.map((meal) => {
          const mm = mealMacros(meal);
          return (
            <Card key={meal.id} className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">
                    {SLOT_META[meal.slot as MealSlot]?.emoji ?? "🍽️"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {SLOT_META[meal.slot as MealSlot]?.label ?? meal.slot}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meal.time}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{mm.kcal} kcal</p>
                  <p className="text-[10px] text-muted-foreground">
                    P{mm.protein} · C{mm.carbs} · F{mm.fat}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {meal.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-muted/20 group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm truncate">{it.name}</span>
                      <p className="text-[10px] text-muted-foreground">{it.amount}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-[10px] text-muted-foreground tabular-nums">
                        <p className="font-medium text-foreground">{it.macros.kcal}</p>
                        <p>
                          P{it.macros.protein} C{it.macros.carbs} F{it.macros.fat}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={!it.itemType}
                          onClick={() =>
                            setEditingItem({
                              id: it.id,
                              name: it.name,
                              itemType: it.itemType ?? "food",
                              rawQuantity: it.rawQuantity ?? 0,
                              rawUnit: it.rawUnit ?? "g",
                              measureLabel: it.measureLabel,
                              measureDescription: it.measureDescription,
                              measureCount: it.measureCount,
                              realMeasures: it.realMeasures,
                              unitWeights: it.unitWeights,
                              commonServings: it.commonServings,
                            })
                          }
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          disabled={removing === it.id}
                          onClick={() => handleRemoveItem(it.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="w-full px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted/30 flex items-center gap-1.5"
                  onClick={() =>
                    setPickerState({ open: true, day: activeDayIdx, slot: meal.slot })
                  }
                >
                  <Plus className="h-3 w-3" />
                  Add to {SLOT_META[meal.slot as MealSlot]?.label ?? meal.slot}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <PlanItemPicker
        open={pickerState.open}
        onOpenChange={(o) => setPickerState((s) => ({ ...s, open: o }))}
        onAdd={(data) => addTemplateItem(templateId, data)}
        onAdded={invalidate}
        day={pickerState.day}
        slot={pickerState.slot}
      />

      <EditTemplateDialog
        template={editingDetails ? template : null}
        onOpenChange={(open) => !open && setEditingDetails(false)}
        onSaved={invalidate}
      />

      <EditPlanItemDialog
        item={editingItem}
        onOpenChange={(o) => !o && setEditingItem(null)}
        onSave={handleSaveEditedItem}
      />
    </>
  );
}
