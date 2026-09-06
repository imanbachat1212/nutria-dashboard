import { useState } from "react";
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
import { updateMealPlanTemplate, type MealPlanTemplate } from "@/lib/mealplantemplates-api";

// Metadata-only (name/tag/days) — day-by-day content editing lives on the template's own editor
// page (meal-plan-templates.$templateId.tsx). Shared by the templates list page (quick rename)
// and the editor page itself ("Edit details").
export function EditTemplateDialog({
  template,
  onOpenChange,
  onSaved,
}: {
  template: MealPlanTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [tag, setTag] = useState(template?.tag ?? "");
  const [days, setDays] = useState(template?.days ?? 7);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!template || !name.trim()) return;
    setSaving(true);
    try {
      await updateMealPlanTemplate(template._id, {
        name: name.trim(),
        tag: tag.trim() || undefined,
        days,
      });
      toast.success("Template updated");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Edit template details</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tag</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} className="h-9" />
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
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
