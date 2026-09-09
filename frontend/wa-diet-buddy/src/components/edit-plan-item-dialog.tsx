import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeasureSelect } from "@/components/measure-select";
import {
  resolveMeasure,
  pickInitialMeasureSelection,
  formatGramEquivalent,
} from "@/lib/measure-options";
import { gramsPerUnitForFood } from "@/lib/unit-conversion";
import type { ServingSize, UnitWeights } from "@/lib/food-database-mock";
import type { AddItemPayload } from "@/lib/mealplans-api";

// The item being edited — a subset of FoodItem's prompt-48 fields (meal-plans-mock.ts), enough
// to pre-fill this dialog without a second fetch.
export interface EditableItem {
  id: string;
  name: string;
  itemType: "food" | "recipe";
  rawQuantity: number;
  rawUnit: string;
  measureLabel?: string | null;
  // Structured pick info (prompt-49) — lets this dialog pre-select the exact real measure
  // originally picked, when its description still matches one of the food's current portions.
  measureDescription?: string | null;
  measureCount?: number | null;
  realMeasures?: ServingSize[];
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
}

// In-place edit for an already-added meal plan (or template) item's amount (prompt-48) — reuses
// the exact same MeasureSelect the add flow's PlanItemPicker uses, so real per-food measures
// (not just grams) are just as available here as when first adding the item. Deliberately a
// separate, small dialog rather than reusing PlanItemPicker's own food-search UI: the food is
// already fixed for an edit, only its amount/measure needs to change.
export function EditPlanItemDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: EditableItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<AddItemPayload>) => Promise<void>;
}) {
  const [option, setOption] = useState("g");
  const [count, setCount] = useState<number | "">(0);
  const [saving, setSaving] = useState(false);

  // Pre-fills the exact real measure originally picked (prompt-49) when its description still
  // matches one of the food's current portions — falling back to plain grams + the stored raw
  // quantity (today's pre-fix behavior) for a pre-existing item, a generic-unit item, or one
  // whose original measure no longer exists in that food's portions list.
  useEffect(() => {
    if (!item) return;
    if (item.itemType !== "food") {
      setOption("srv");
      setCount(item.rawQuantity);
      return;
    }
    const initial = pickInitialMeasureSelection(
      item.realMeasures,
      item.measureDescription,
      item.measureCount,
      item.rawQuantity,
      item.rawUnit,
    );
    setOption(initial.option);
    setCount(initial.count);
  }, [item]);

  if (!item) return null;

  async function handleSave() {
    if (!item) return;
    const c = typeof count === "number" ? count : 0;
    if (c <= 0) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      if (item.itemType === "recipe") {
        await onSave({ servings: c });
      } else {
        const resolved = resolveMeasure(item.realMeasures, option, c);
        await onSave({
          quantity: resolved.quantity,
          unit: resolved.unit,
          measureLabel: resolved.measureLabel,
          measureDescription: resolved.measureDescription,
          measureCount: resolved.measureCount,
        });
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base truncate">Edit "{item.name}"</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount</Label>
          {item.itemType === "food" ? (
            <div className="flex items-center gap-2">
              <MeasureSelect
                realMeasures={item.realMeasures}
                option={option}
                count={count}
                onOptionChange={setOption}
                onCountChange={setCount}
              />
              {/* Gram equivalent (prompt-69) — resolved through the exact same two steps
                  handleSave() above submits with, so what's previewed here is the weight that
                  actually gets saved. */}
              {(() => {
                const c = typeof count === "number" ? count : 0;
                const resolved = resolveMeasure(item.realMeasures, option, c);
                const grams =
                  resolved.quantity *
                  gramsPerUnitForFood(
                    item.commonServings,
                    item.unitWeights,
                    resolved.unit,
                    item.realMeasures,
                  );
                const eq = formatGramEquivalent(option, count, grams);
                return eq ? (
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{eq}</span>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={count}
                onChange={(e) => setCount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                className="h-9 w-20"
              />
              <span className="text-sm text-muted-foreground">serving{count === 1 ? "" : "s"}</span>
            </div>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/10 flex-row justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
