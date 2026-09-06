import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Flame, CalendarDays, Pencil, Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchMealPlanTemplates,
  createMealPlanTemplate,
  archiveMealPlanTemplate,
  restoreMealPlanTemplate,
  deleteMealPlanTemplate,
  type MealPlanTemplate,
} from "@/lib/mealplantemplates-api";

export const Route = createFileRoute("/meal-plan-templates/")({
  head: () => ({
    meta: [
      { title: "Meal Templates — Nutria" },
      {
        name: "description",
        content: "Reusable meal-plan templates with real day-by-day content.",
      },
    ],
  }),
  component: MealPlanTemplatesPage,
});

// Name/tag/days only — the brand-new template starts with items: [] and the dietitian lands
// straight in the full content editor to add real meals, rather than stopping at a metadata-only
// record with no way to reach an editor (the gap this prompt closes).
function NewTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (templateId: string) => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setTag("");
    setDays(7);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await createMealPlanTemplate({
        name: name.trim(),
        tag: tag.trim() || undefined,
        days,
      });
      onOpenChange(false);
      reset();
      onCreated(created._id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : (onOpenChange(false), reset()))}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">New template</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Low-FODMAP 1600"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tag (optional)
              </Label>
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
          <p className="text-[11px] text-muted-foreground">
            You'll add real meals to each day next.
          </p>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/10 flex-row justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create & add meals"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MealPlanTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MealPlanTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meal-plan-templates", "manage", showArchived],
    queryFn: () => fetchMealPlanTemplates({ archived: showArchived }),
  });
  const templates = data ?? [];

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveMealPlanTemplate(id),
    onSuccess: () => {
      toast.success("Template archived");
      queryClient.invalidateQueries({ queryKey: ["meal-plan-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreMealPlanTemplate(id),
    onSuccess: () => {
      toast.success("Template restored");
      queryClient.invalidateQueries({ queryKey: ["meal-plan-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMealPlanTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["meal-plan-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title="Meal Templates"
        description="Reusable starting points for the New Meal Plan wizard's From template step."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New template
          </Button>
        }
      />

      <Tabs
        value={showArchived ? "archived" : "active"}
        onValueChange={(v) => setShowArchived(v === "archived")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="mb-4 text-xs text-muted-foreground">
        Start a template from scratch with "New template," or open a real plan under Meal Plans
        and use "Save as template" in its header.
      </p>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : templates.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Layers className="size-8 text-muted-foreground/50" />
          {showArchived ? "No archived templates." : "No templates yet."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t._id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  {t.tag && (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {t.tag}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Open editor"
                    onClick={() => navigate({ to: "/meal-plan-templates/$templateId", params: { templateId: t._id } })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {showArchived ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => restoreMutation.mutate(t._id)}
                        disabled={restoreMutation.isPending}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete permanently"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => archiveMutation.mutate(t._id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" />
                  {t.dailyTotals.calories} kcal/day
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t.days} days
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                P{t.dailyTotals.protein}g · C{t.dailyTotals.carbs}g · F{t.dailyTotals.fat}g /day ·{" "}
                {t.items.length} item{t.items.length === 1 ? "" : "s"}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewTemplateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(templateId) =>
          navigate({ to: "/meal-plan-templates/$templateId", params: { templateId } })
        }
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Any meal plan already created from this template keeps its
              own copy of its meals and is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
