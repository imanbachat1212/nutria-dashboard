import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, X, UtensilsCrossed, Apple, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fetchFoods } from "@/lib/foods-api";
import { fetchMeals } from "@/lib/meals-api";
import type { AddItemPayload } from "@/lib/mealplans-api";
import { SLOT_META, type MealSlot } from "@/lib/meal-plans-mock";
import type { ServingSize, UnitWeights } from "@/lib/food-database-mock";
import { gramsPerUnitForFood } from "@/lib/unit-conversion";
import { resolveMeasure } from "@/lib/measure-options";
import { MeasureSelect } from "@/components/measure-select";

interface PlanItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Generic over what "adding an item" actually does — a real plan's addPlanItem(planId, data)
  // or a template's addTemplateItem(templateId, data) — so this same picker/staging UI is
  // shared by both editors instead of being hardcoded to real plans (see meal-plans.tsx and
  // meal-plan-templates.$templateId.tsx for the two call sites).
  onAdd: (data: AddItemPayload) => Promise<unknown>;
  // Called once after a batch of adds has settled (at least one succeeded) — lets each caller
  // invalidate whatever query key its own data lives under, rather than this shared component
  // hardcoding one.
  onAdded?: () => void;
  day: number;
  slot: string;
}

interface ItemMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// One entry per selected food OR recipe. `amount` is "how many of `unit`" for food (e.g. 3
// dates, or 150 g) and servings for recipe — keeping a single field (rather than two, one of
// which is always unused) since a given entry is only ever one type. `macrosPerUnit` is
// captured at selection time (per-100g for food, per-serving for recipe) so the preview/total
// math doesn't depend on the food/recipe still being present in the current (possibly
// since-changed-by-search) query results. `unit`/`realMeasures`/etc are food-only, unused for
// recipes (always "srv").
interface SelectedItem {
  id: string;
  type: "food" | "recipe";
  name: string;
  amount: number;
  macrosPerUnit: ItemMacros;
  unit: string;
  realMeasures?: ServingSize[];
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
}

function selectionKey(type: "food" | "recipe", id: string) {
  return `${type}:${id}`;
}

// Resolves a food item's selected measure (real per-food portion or generic unit) down to a
// gram total exactly like new-recipe-dialog.tsx's live preview does — resolveMeasure()
// normalizes a real-measure selection to unit="g" first, so gramsPerUnitForFood's existing
// generic-unit resolution always runs on a value it already understands either way.
function foodGrams(item: SelectedItem): number {
  const resolved = resolveMeasure(item.realMeasures, item.unit, item.amount);
  return resolved.quantity * gramsPerUnitForFood(item.commonServings, item.unitWeights, resolved.unit);
}

function scaleMacros(item: SelectedItem): ItemMacros {
  const factor = item.type === "food" ? foodGrams(item) / 100 : item.amount;
  return {
    kcal: Math.round(item.macrosPerUnit.kcal * factor),
    protein: Math.round(item.macrosPerUnit.protein * factor),
    carbs: Math.round(item.macrosPerUnit.carbs * factor),
    fat: Math.round(item.macrosPerUnit.fat * factor),
  };
}

export function PlanItemPicker({
  open,
  onOpenChange,
  onAdd,
  onAdded,
  day,
  slot,
}: PlanItemPickerProps) {
  const [tab, setTab] = useState<"food" | "recipe">("food");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedItems(new Map());
      setTab("food");
    }
  }, [open]);

  const { data: foodsData, isLoading: foodsLoading } = useQuery({
    queryKey: ["foods", "plan-picker", debouncedSearch],
    queryFn: () => fetchFoods({ search: debouncedSearch || undefined, limit: 30 }),
    enabled: tab === "food" && open,
  });

  const { data: mealsData, isLoading: mealsLoading } = useQuery({
    queryKey: ["meals", "plan-picker", debouncedSearch],
    queryFn: () => fetchMeals({ search: debouncedSearch || undefined, limit: 30 }),
    enabled: tab === "recipe" && open,
  });

  const foods = foodsData?.foods ?? [];
  const recipes = mealsData?.meals ?? [];
  const isLoading = tab === "food" ? foodsLoading : mealsLoading;

  function toggleFood(f: {
    id: string;
    name: string;
    macros: ItemMacros;
    unitWeights?: UnitWeights;
    servings: ServingSize[];
    portions?: ServingSize[];
  }) {
    const key = selectionKey("food", f.id);
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          id: f.id,
          type: "food",
          name: f.name,
          amount: 100,
          unit: "g",
          macrosPerUnit: f.macros,
          unitWeights: f.unitWeights,
          commonServings: f.servings,
          realMeasures: f.portions,
        });
      }
      return next;
    });
  }

  function toggleRecipe(id: string, name: string, macros: ItemMacros) {
    const key = selectionKey("recipe", id);
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { id, type: "recipe", name, amount: 1, unit: "srv", macrosPerUnit: macros });
      }
      return next;
    });
  }

  function updateAmount(key: string, amount: number) {
    setSelectedItems((prev) => {
      const item = prev.get(key);
      if (!item) return prev;
      const next = new Map(prev);
      next.set(key, { ...item, amount });
      return next;
    });
  }

  function updateUnit(key: string, unit: string) {
    setSelectedItems((prev) => {
      const item = prev.get(key);
      if (!item) return prev;
      const next = new Map(prev);
      next.set(key, { ...item, unit });
      return next;
    });
  }

  function removeSelected(key: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  const selectedList = useMemo(() => Array.from(selectedItems.entries()), [selectedItems]);

  const combinedTotal = useMemo(() => {
    return selectedList.reduce(
      (acc, [, item]) => {
        const m = scaleMacros(item);
        return {
          kcal: acc.kcal + m.kcal,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [selectedList]);

  async function handleAdd() {
    if (selectedList.length === 0) return;
    setAdding(true);
    try {
      const settled = await Promise.allSettled(
        selectedList.map(([, item]) => {
          if (item.type !== "food") {
            return onAdd({ day, slot, type: "recipe", meal: item.id, servings: item.amount });
          }
          // A real-measure selection resolves to its exact gram total here (unit="g") — see
          // measure-select.tsx/measure-options.ts; a generic-unit selection passes through
          // unchanged, exactly as this already sent before prompt-45 (unit was always "g").
          const resolved = resolveMeasure(item.realMeasures, item.unit, item.amount);
          return onAdd({
            day,
            slot,
            type: "food",
            food: item.id,
            quantity: resolved.quantity,
            unit: resolved.unit,
            measureLabel: resolved.measureLabel,
            measureDescription: resolved.measureDescription,
            measureCount: resolved.measureCount,
          });
        }),
      );

      const failedKeys = new Set(
        selectedList.filter((_, idx) => settled[idx].status === "rejected").map(([key]) => key),
      );
      const succeeded = selectedList.length - failedKeys.size;

      // Refresh only after every add has settled (success or failure), not after the first
      // one resolves — a partial failure still means some items landed and the slot changed.
      if (succeeded > 0) {
        onAdded?.();
      }

      if (failedKeys.size === 0) {
        toast.success(`${succeeded} item${succeeded === 1 ? "" : "s"} added to ${slotLabel}`);
        onOpenChange(false);
      } else if (succeeded === 0) {
        toast.error(`Couldn't add ${failedKeys.size === 1 ? "that item" : "those items"} — try again`);
      } else {
        toast.warning(
          `${succeeded} of ${selectedList.length} items added — ${failedKeys.size} failed, still selected below`,
        );
        // Keep only the failed items selected so the dietitian can retry just those, instead
        // of re-picking everything (matches the bulk USDA import's per-item accountability).
        setSelectedItems((prev) => {
          const next = new Map();
          for (const [key, item] of prev) {
            if (failedKeys.has(key)) next.set(key, item);
          }
          return next;
        });
      }
    } finally {
      setAdding(false);
    }
  }

  const slotLabel = SLOT_META[slot as MealSlot]?.label || slot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b">
          <DialogTitle className="text-base">
            Add to {slotLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "food" | "recipe")}>
            <TabsList className="grid grid-cols-2 h-8 w-full">
              <TabsTrigger value="food" className="text-xs gap-1.5">
                <Apple className="h-3.5 w-3.5" />
                Foods
              </TabsTrigger>
              <TabsTrigger value="recipe" className="text-xs gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5" />
                Recipes
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "food" ? "Search foods…" : "Search recipes…"
              }
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="h-75 px-5 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : tab === "food" ? (
            <div className="space-y-1">
              {foods.map((f) => {
                const selected = selectedItems.has(selectionKey("food", f.id));
                return (
                  <button
                    key={f.id}
                    onClick={() =>
                      toggleFood({
                        id: f.id,
                        name: f.name,
                        macros: f.macros,
                        unitWeights: f.unitWeights,
                        servings: f.servings,
                        portions: f.portions,
                      })
                    }
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                      selected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="min-w-0 truncate text-sm font-medium"
                        title={f.name}
                      >
                        {f.name}
                      </span>
                      {f.verified && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 shrink-0"
                        >
                          verified
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      per 100g: {f.macros.kcal} kcal · P{f.macros.protein} C
                      {f.macros.carbs} F{f.macros.fat}
                    </div>
                  </button>
                );
              })}
              {foods.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No foods found
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {recipes.map((r) => {
                const selected = selectedItems.has(selectionKey("recipe", r.id));
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRecipe(r.id, r.name, r.macros)}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                      selected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {r.photoUrl ? (
                          <img
                            src={r.photoUrl}
                            alt={r.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-base leading-none">{r.image}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {r.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {r.macros.kcal} kcal · P{r.macros.protein} C
                          {r.macros.carbs} F{r.macros.fat}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {recipes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No recipes found
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        {selectedList.length > 0 && (
          <div className="px-5 py-3 border-t bg-muted/10 space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 -mr-1 pr-1">
              {selectedList.map(([key, item]) => {
                // Same scaleMacros() the footer total below reduces over — one shared
                // computation, so a per-item row and the running total can never disagree
                // (prompt-51: they previously could, since this row didn't exist at all and
                // nothing guaranteed a future one would derive from the same function).
                const itemMacros = scaleMacros(item);
                return (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" title={item.name}>{item.name}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {itemMacros.kcal} kcal · P{itemMacros.protein} C{itemMacros.carbs} F
                      {itemMacros.fat}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.type === "food" ? (
                      <MeasureSelect
                        realMeasures={item.realMeasures}
                        option={item.unit}
                        count={item.amount}
                        onOptionChange={(u) => updateUnit(key, u)}
                        onCountChange={(v) => updateAmount(key, typeof v === "number" ? v : 0)}
                        quantityClassName="h-8 w-16 text-sm tabular-nums text-right"
                        unitClassName="h-8 w-24 text-xs"
                      />
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateAmount(key, Number(e.target.value) || 0)}
                          className="h-8 w-16 text-sm tabular-nums text-right"
                          min={0.5}
                          step={0.5}
                        />
                        <span className="text-xs text-muted-foreground w-6">srv</span>
                      </>
                    )}
                    <button
                      onClick={() => removeSelected(key)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground border-t pt-2">
              <span className="font-medium text-foreground">
                {combinedTotal.kcal} kcal total
              </span>
              <span>P{combinedTotal.protein}</span>
              <span>C{combinedTotal.carbs}</span>
              <span>F{combinedTotal.fat}</span>
            </div>

            <Button
              size="sm"
              className="w-full"
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {adding
                ? "Adding…"
                : `Add ${selectedList.length} item${selectedList.length === 1 ? "" : "s"} to slot`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
