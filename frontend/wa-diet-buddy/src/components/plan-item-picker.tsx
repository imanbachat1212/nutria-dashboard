import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, UtensilsCrossed, Apple, Loader2 } from "lucide-react";

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
import { addPlanItem } from "@/lib/mealplans-api";
import { SLOT_META, type MealSlot } from "@/lib/meal-plans-mock";

interface PlanItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  day: number;
  slot: string;
}

export function PlanItemPicker({
  open,
  onOpenChange,
  planId,
  day,
  slot,
}: PlanItemPickerProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"food" | "recipe">("food");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [servings, setServings] = useState("1");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedId(null);
      setQuantity("100");
      setServings("1");
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

  const selectedFood = tab === "food" ? foods.find((f) => f.id === selectedId) : null;
  const selectedRecipe = tab === "recipe" ? recipes.find((r) => r.id === selectedId) : null;

  const previewMacros =
    selectedFood
      ? {
          kcal: Math.round((selectedFood.macros.kcal * (Number(quantity) || 0)) / 100),
          protein: Math.round((selectedFood.macros.protein * (Number(quantity) || 0)) / 100),
          carbs: Math.round((selectedFood.macros.carbs * (Number(quantity) || 0)) / 100),
          fat: Math.round((selectedFood.macros.fat * (Number(quantity) || 0)) / 100),
        }
      : selectedRecipe
        ? {
            kcal: Math.round(selectedRecipe.macros.kcal * (Number(servings) || 1)),
            protein: Math.round(selectedRecipe.macros.protein * (Number(servings) || 1)),
            carbs: Math.round(selectedRecipe.macros.carbs * (Number(servings) || 1)),
            fat: Math.round(selectedRecipe.macros.fat * (Number(servings) || 1)),
          }
        : null;

  async function handleAdd() {
    if (!selectedId) return;
    setAdding(true);
    try {
      if (tab === "food") {
        await addPlanItem(planId, {
          day,
          slot,
          type: "food",
          food: selectedId,
          quantity: Number(quantity) || 100,
          unit: "g",
        });
      } else {
        await addPlanItem(planId, {
          day,
          slot,
          type: "recipe",
          meal: selectedId,
          servings: Number(servings) || 1,
        });
      }
      qc.invalidateQueries({ queryKey: ["mealplan"] });
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  }

  const slotLabel =
    SLOT_META[slot as MealSlot]?.label || slot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b">
          <DialogTitle className="text-base">
            Add to {slotLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 space-y-3">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "food" | "recipe");
              setSelectedId(null);
            }}
          >
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
                const selected = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedId(selected ? null : f.id)}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                      selected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
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
                const selected = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(selected ? null : r.id)}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                      selected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{r.image}</span>
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

        {(selectedFood || selectedRecipe) && (
          <div className="px-5 py-3 border-t bg-muted/10 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFood?.name || selectedRecipe?.name}
                </p>
              </div>
              {tab === "food" ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-8 w-20 text-sm tabular-nums text-right"
                  />
                  <span className="text-xs text-muted-foreground">g</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="h-8 w-20 text-sm tabular-nums text-right"
                    min={0.5}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">srv</span>
                </div>
              )}
            </div>

            {previewMacros && (
              <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">
                  {previewMacros.kcal} kcal
                </span>
                <span>P{previewMacros.protein}</span>
                <span>C{previewMacros.carbs}</span>
                <span>F{previewMacros.fat}</span>
              </div>
            )}

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
              {adding ? "Adding…" : "Add to slot"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
