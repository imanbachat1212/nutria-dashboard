import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

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
import { saveMealPlanAsTemplate } from "@/lib/mealplans-api";
import type { MealPlan } from "@/lib/meal-plans-mock";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePlan: MealPlan;
  onSaved: () => void;
}

// Snapshots an existing, already-built plan's current days/items into a new, independent
// MealPlanTemplate — the primary way a dietitian builds a template in practice (per prompt-40:
// build a real plan first, then save it as a reusable starting point for future clients).
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  sourcePlan,
  onSaved,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(sourcePlan.name);
  const [tag, setTag] = useState("");
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(sourcePlan.name);
      setTag("");
      setDays(7);
    }
  }, [open, sourcePlan.name]);

  async function handleConfirm() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveMealPlanAsTemplate(sourcePlan.id, {
        name: name.trim(),
        tag: tag.trim() || undefined,
        days,
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Save as template</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Copies this plan's current days and meals into a reusable template — future plans
            built from it start as an independent copy, so editing or deleting anything here
            later won't affect it.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Template name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mediterranean 1600"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tag (optional)
              </Label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. Weight loss"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Advertised duration (days)
              </Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/10 flex-row justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
