import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Send,
  Download,
  MoreHorizontal,
  Repeat2,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  Pencil,
  Users,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Leaf,
  Archive,
  Pill,
  Info,
  Layers,
  GripVertical,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DAYS,
  SLOT_META,
  DRI_FIELD_GROUPS,
  dayMacros,
  mealMacros,
  dayMicros,
  mealMicros,
  type MealPlan,
  type DayKey,
  type MealSlot,
} from "@/lib/meal-plans-mock";
import {
  fetchMealPlans,
  fetchMealPlan,
  updateMealPlan,
  addPlanItem,
  updatePlanItem,
  removePlanItem,
  downloadPlanPdf,
  copyPlanDay,
  copyMealSlot,
  copySlotToSlot,
  updateSlotTime,
} from "@/lib/mealplans-api";
import { toast } from "sonner";
import { NewPlanDialog } from "@/components/new-plan-dialog";
import { DuplicatePlanDialog } from "@/components/duplicate-plan-dialog";
import { SaveAsTemplateDialog } from "@/components/save-as-template-dialog";
import { PlanItemPicker } from "@/components/plan-item-picker";
import { MicronutrientPanel, type MicronutrientRow } from "@/components/micronutrient-panel";
import { fetchDailyValues } from "@/lib/foods-api";
import { EditPlanItemDialog, type EditableItem } from "@/components/edit-plan-item-dialog";

export const Route = createFileRoute("/meal-plans")({
  head: () => ({
    meta: [
      { title: "Meal Plans — Nutria" },
      {
        name: "description",
        content: "Build day-by-day plans with live macros, swap pools, and templates.",
      },
    ],
  }),
  component: MealPlansPage,
});

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  draft: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ended: "bg-muted text-muted-foreground border-border",
  shared: "bg-primary/15 text-primary border-primary/30",
};

function MealPlansPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<DayKey>("mon");
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MealPlan["status"]>("all");
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    day: number;
    slot: string;
  }>({ open: false, day: 0, slot: "breakfast" });
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [copyDayOpen, setCopyDayOpen] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [copying, setCopying] = useState(false);
  const [microsOpen, setMicrosOpen] = useState(false);
  // null => the whole day; a meal id => that slot only (prompt-83).
  const [microsSlotId, setMicrosSlotId] = useState<string | null>(null);
  const [slotAction, setSlotAction] = useState<{
    mealId: string;
    slot: string;
    mode: "copy" | "time";
  } | null>(null);
  const [copyTargetDaysForSlot, setCopyTargetDaysForSlot] = useState<number[]>([]);
  const [copyingSlot, setCopyingSlot] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState("");
  const [savingTime, setSavingTime] = useState(false);
  // Drag-and-drop same-day slot copy (prompt-56) — draggedSlot is the slot currently being
  // dragged (by its header), dragOverSlot is whichever slot card the pointer is currently over
  // (drives the drop-target highlight). Both cleared on drop or drag end/cancel.
  const [draggedSlot, setDraggedSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  // Edge auto-scroll while dragging (prompt-57) — refs, not state, since these update on every
  // dragover (many times a second) and don't need to trigger a re-render themselves; only the
  // interval's own scrollTop writes need to happen on each tick. slotListRef is the ScrollArea
  // instance itself (its forwarded ref lands on Radix's Root, an ancestor of the actual
  // scrollable [data-radix-scroll-area-viewport] div, not that div itself — queried out of it
  // on demand below rather than plumbing a second ref through the shared ScrollArea component).
  const slotListRef = useRef<HTMLDivElement>(null);
  const autoScrollDirRef = useRef<"up" | "down" | null>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);

  // isPending matters as much as data here (prompt-60): this list previously rendered its
  // "Create your first meal plan to get started." empty state while the very first fetch was
  // still in flight, so a slow response looked exactly like "this dietitian has no plans" —
  // which reads as a broken/empty page and prompts a pointless manual reload.
  const { data: listData, isPending: plansPending } = useQuery({
    queryKey: ["mealplans"],
    queryFn: () => fetchMealPlans({ limit: 100 }),
  });
  const plans = listData?.plans ?? [];

  const effectiveId = selectedId ?? plans[0]?.id ?? null;

  const { data: detailPlan, isPending: detailPending } = useQuery({
    queryKey: ["mealplan", effectiveId],
    queryFn: () => fetchMealPlan(effectiveId!),
    enabled: !!effectiveId,
  });
  // `enabled: false` also reports isPending, so only treat the detail query as loading when it
  // actually has an id to fetch.
  const planLoading = plansPending || (!!effectiveId && detailPending);

  const plan = detailPlan ?? plans.find((p) => p.id === effectiveId);
  const day = plan?.days.find((d) => d.day === activeDay) ?? plan?.days[0];

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
    });
  }, [query, statusFilter, plans]);

  const totals = day ? dayMacros(day) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const targets = plan?.targets ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  // Static reference data — fetched once, never refetched. Served by the backend so the FDA
  // table has no second copy in frontend source (prompt-83).
  const { data: dvRef } = useQuery({
    queryKey: ["foods", "daily-values"],
    queryFn: fetchDailyValues,
    staleTime: Infinity,
  });

  const microsSlot = microsSlotId ? day?.meals.find((m) => m.id === microsSlotId) ?? null : null;
  // Day totals and a slot's totals come from the SAME per-item numbers: dayMicros is literally
  // sumMicros over each slot's mealMicros (meal-plans-mock.ts), so "day == sum of its slots" is
  // structural here, not a coincidence to be re-checked. No new calculation path (prompt-83).
  const microTotals = microsSlot ? mealMicros(microsSlot) : day ? dayMicros(day) : {};

  // Rows for the shared panel: the client's own DRI target drives the bar, the FDA Daily Value
  // rides alongside as generic context. Nutrients nothing reported are dropped rather than
  // shown as a measured zero.
  const microRows: MicronutrientRow[] = DRI_FIELD_GROUPS.flatMap((g) => g.fields).flatMap((f) => {
    const value = microTotals[f.key] ?? null;
    if (value == null) return [];
    const target = plan?.driTargets?.[f.key] ?? null;
    const dvEntry = dvRef?.dailyValues?.[f.key];
    return [{
      nutrient: f.key,
      label: f.label,
      unit: f.unit,
      value,
      dri: target != null && target > 0 ? { target, pct: Math.round((value / target) * 100) } : null,
      dv: dvEntry ? { pct: Math.round((value / dvEntry.dv) * 100), level: null } : null,
    }];
  });

  async function handleRemoveItem(itemId: string) {
    if (!effectiveId) return;
    setRemoving(itemId);
    try {
      await removePlanItem(effectiveId, itemId);
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
    } finally {
      setRemoving(null);
    }
  }

  // In-place edit (prompt-48) — PATCH via updatePlanItem, never remove+re-add, so the item keeps
  // its exact day/slot position instead of landing at the end of the slot's list.
  async function handleSaveEditedItem(data: Parameters<typeof updatePlanItem>[2]) {
    if (!effectiveId || !editingItem) return;
    await updatePlanItem(effectiveId, editingItem.id, data);
    toast.success("Item updated");
    qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
  }

  async function handleActivate() {
    if (!effectiveId || plan?.status !== "draft") return;
    setActivating(true);
    try {
      await updateMealPlan(effectiveId, { status: "active" });
      qc.invalidateQueries({ queryKey: ["mealplans"] });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
    } finally {
      setActivating(false);
    }
  }

  async function handleEnd() {
    if (!effectiveId || plan?.status !== "active") return;
    setActivating(true);
    try {
      await updateMealPlan(effectiveId, { status: "ended" });
      qc.invalidateQueries({ queryKey: ["mealplans"] });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
    } finally {
      setActivating(false);
    }
  }

  async function handleDownload() {
    if (!plan || !effectiveId) return;
    setDownloading(true);
    try {
      await downloadPlanPdf(effectiveId, plan.name);
    } finally {
      setDownloading(false);
    }
  }

  function handleDuplicate() {
    if (!plan) return;
    setDuplicateDialogOpen(true);
  }

  function handleDuplicateCreated(copy: MealPlan) {
    qc.invalidateQueries({ queryKey: ["mealplans"] });
    setSelectedId(copy.id);
  }

  const activeDayIdx = DAYS.findIndex((d) => d.key === activeDay);
  const otherDayIndices = DAYS.map((_, i) => i).filter((i) => i !== activeDayIdx);

  function toggleCopyTarget(idx: number) {
    setCopyTargetDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
    );
  }

  async function handleCopyDay() {
    if (!effectiveId || copyTargetDays.length === 0) return;
    setCopying(true);
    try {
      await copyPlanDay(effectiveId, { fromDay: activeDayIdx, toDays: copyTargetDays });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
      setCopyDayOpen(false);
      setCopyTargetDays([]);
    } finally {
      setCopying(false);
    }
  }

  function openCopySlot(mealId: string, slot: string) {
    setSlotAction({ mealId, slot, mode: "copy" });
    setCopyTargetDaysForSlot([]);
  }

  function openEditTime(mealId: string, slot: string, currentTime: string) {
    setSlotAction({ mealId, slot, mode: "time" });
    setEditTimeValue(currentTime);
  }

  function closeSlotAction() {
    setSlotAction(null);
    setCopyTargetDaysForSlot([]);
  }

  function toggleCopyTargetForSlot(idx: number) {
    setCopyTargetDaysForSlot((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
    );
  }

  async function handleCopyMealSlot() {
    if (!effectiveId || !slotAction || copyTargetDaysForSlot.length === 0) return;
    setCopyingSlot(true);
    try {
      await copyMealSlot(effectiveId, {
        fromDay: activeDayIdx,
        slot: slotAction.slot,
        toDays: copyTargetDaysForSlot,
      });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
      closeSlotAction();
    } finally {
      setCopyingSlot(false);
    }
  }

  // Drag-and-drop same-day slot copy (prompt-56/57). Native HTML5 DnD, not a library — nothing
  // like dnd-kit/react-dnd is already a dependency here, and this interaction (drag one card,
  // drop on another card in the same list) doesn't need more than that. dataTransfer carries the
  // source slot and is the actual source of truth read in handleSlotDrop below — a state closure
  // read at drop time could be stale if drop fires before a React re-render catches up (draggedSlot
  // state is still tracked for the drag-source/drop-target highlight styling, which is allowed to
  // lag a tick without breaking anything functional).
  const AUTO_SCROLL_EDGE_PX = 56;
  const AUTO_SCROLL_STEP_PX = 14;

  function getSlotListViewport(): HTMLElement | null {
    return slotListRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null;
  }

  function stopAutoScroll() {
    if (autoScrollIntervalRef.current != null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    autoScrollDirRef.current = null;
  }

  function startAutoScroll() {
    if (autoScrollIntervalRef.current != null) return;
    autoScrollIntervalRef.current = window.setInterval(() => {
      const dir = autoScrollDirRef.current;
      if (!dir) return;
      const viewport = getSlotListViewport();
      if (!viewport) return;
      viewport.scrollTop += dir === "down" ? AUTO_SCROLL_STEP_PX : -AUTO_SCROLL_STEP_PX;
    }, 16);
  }

  // Attached to the ScrollArea itself (not each individual slot card) so it keeps tracking
  // pointer position via bubbled dragover events no matter which child is currently under the
  // pointer, or whether the pointer is over the gap between cards / empty space below the last
  // one. Only updates a ref, not state — this fires continuously during a drag and doesn't need
  // to trigger a re-render on every pointer movement.
  function handleSlotListDragOver(e: React.DragEvent) {
    const viewport = getSlotListViewport();
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
      autoScrollDirRef.current = "up";
    } else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
      autoScrollDirRef.current = "down";
    } else {
      autoScrollDirRef.current = null;
    }
  }

  function handleSlotDragStart(e: React.DragEvent, slot: string) {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", slot);
    startAutoScroll();
  }

  function handleSlotDragOver(e: React.DragEvent, slot: string) {
    // preventDefault unconditionally — every slot is a valid drop target (self-drop is allowed
    // to land here too; it's rejected as a no-op in handleSlotDrop below, not blocked at the
    // browser level), and the browser disallows dropping on anything that doesn't call this in
    // dragover. Gating it on draggedSlot state would make the very first dragover after
    // dragstart a no-op whenever state hasn't re-rendered yet (a real risk on a fast drag, not
    // just a synthetic one), silently breaking the drop that follows it.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dragOverSlot !== slot) setDragOverSlot(slot);
  }

  function handleSlotDragLeave(slot: string) {
    setDragOverSlot((prev) => (prev === slot ? null : prev));
  }

  function handleSlotDragEnd() {
    setDraggedSlot(null);
    setDragOverSlot(null);
    stopAutoScroll();
  }

  async function handleSlotDrop(e: React.DragEvent, toSlot: string) {
    e.preventDefault();
    // dataTransfer, not the draggedSlot state closure, is the source of truth here — it's
    // attached to the native drag gesture itself (set once in onDragStart, read directly off
    // this event), so it can't go stale the way a state closure could if drop fires before a
    // React re-render has caught up on a fast drag.
    const fromSlot = e.dataTransfer.getData("text/plain") || draggedSlot;
    setDraggedSlot(null);
    setDragOverSlot(null);
    stopAutoScroll();
    if (!effectiveId || !fromSlot) return;
    // Self-drop (prompt-57 reversal of prompt-56's original "append is fine either way" call):
    // an accidental small/imprecise drag that starts and ends on the same slot must not double
    // up that slot's own items — true no-op, no API call at all.
    if (fromSlot === toSlot) return;
    try {
      await copySlotToSlot(effectiveId, { day: activeDayIdx, fromSlot, toSlot });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
      const fromLabel = SLOT_META[fromSlot as MealSlot]?.label ?? fromSlot;
      const toLabel = SLOT_META[toSlot as MealSlot]?.label ?? toSlot;
      toast.success(`Copied ${fromLabel} into ${toLabel}`);
    } catch {
      toast.error(`Couldn't copy into ${SLOT_META[toSlot as MealSlot]?.label ?? toSlot} — try again`);
    }
  }

  async function handleSaveSlotTime() {
    if (!effectiveId || !slotAction || !editTimeValue) return;
    setSavingTime(true);
    try {
      await updateSlotTime(effectiveId, { slot: slotAction.slot, time: editTimeValue });
      qc.invalidateQueries({ queryKey: ["mealplan", effectiveId] });
      closeSlotAction();
    } finally {
      setSavingTime(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 max-w-425 mx-auto">
        <PageHeader
          eyebrow="Nutrition"
          title="Meal Plans"
          description="Build day-by-day plans with live macros, swap pools, and templates."
          actions={
            <>
              {/* TODO: Templates button — hidden until template library is built
            <Button variant="outline" size="sm">
              <Layers className="h-4 w-4" />
              Templates
            </Button>
            */}
              <Button size="sm" onClick={() => setNewPlanOpen(true)}>
                <Plus className="h-4 w-4" />
                New plan
              </Button>
            </>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard
            icon={Users}
            label="Active plans"
            value={plansPending ? "—" : String(plans.filter((p) => p.status === "active").length)}
            hint={plansPending ? "Loading…" : `${plans.length} total`}
          />
          <KpiCard
            icon={FileText}
            label="Drafts"
            value={String(plans.filter((p) => p.status === "draft").length)}
            hint="Pending review"
            tone="amber"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Avg adherence"
            value={`${(() => {
              const withAdh = plans.filter((p) => p.adherencePct > 0);
              return withAdh.length
                ? Math.round(withAdh.reduce((a, p) => a + p.adherencePct, 0) / withAdh.length)
                : 0;
            })()}%`}
            hint="Last 7 days"
            tone="primary"
          />
          <KpiCard
            icon={Archive}
            label="Ended plans"
            value={String(plans.filter((p) => p.status === "ended").length)}
            hint="Completed"
          />
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: plan list */}
          <Card className="col-span-12 lg:col-span-3 border-border/60">
            <CardContent className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search plans, clients…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Tabs
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <TabsList className="grid grid-cols-4 h-8 w-full">
                  <TabsTrigger value="all" className="text-[11px]">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="active" className="text-[11px]">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-[11px]">
                    Draft
                  </TabsTrigger>
                  <TabsTrigger value="ended" className="text-[11px]">
                    Ended
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Separator />
              <ScrollArea className="h-140 pr-2 -mr-2">
                <div className="space-y-1.5">
                  {plansPending &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`skeleton-${i}`}
                        className="rounded-lg border border-transparent p-2.5 flex items-center gap-2.5"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                          <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                    ))}
                  {!plansPending && filteredPlans.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {plans.length === 0 ? "No plans yet" : "No plans match your filters"}
                    </p>
                  )}
                  {filteredPlans.map((p) => {
                    const active = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "w-full text-left rounded-lg border p-2.5 transition-colors",
                          active
                            ? "border-primary/50 bg-primary/5"
                            : "border-transparent hover:border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10px] bg-accent">
                              {p.clientInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{p.clientName}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] h-4 px-1.5 capitalize",
                                  STATUS_TONE[p.status],
                                )}
                              >
                                {p.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{p.name}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {p.targets.kcal} kcal · {p.updatedAt}
                              </span>
                              {p.adherencePct > 0 && (
                                <span className="text-[10px] font-medium text-emerald-300">
                                  {p.adherencePct}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Center: builder */}
          <Card className="col-span-12 lg:col-span-9 border-border/60">
            <CardContent className="p-4 space-y-4">
              {!plan && planLoading ? (
                <div className="flex items-center justify-center h-100 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading plans…
                </div>
              ) : !plan ? (
                <div className="flex items-center justify-center h-100 text-sm text-muted-foreground">
                  Create your first meal plan to get started.
                </div>
              ) : (
                <>
                  {/* plan header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-xl font-semibold tracking-tight truncate">
                          {plan.name}
                        </h2>
                        <Badge
                          variant="outline"
                          className={cn("capitalize text-[10px]", STATUS_TONE[plan.status])}
                        >
                          {plan.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {plan.clientName} · {plan.startDate} → {plan.endDate} ·{" "}
                        <span className="capitalize">{plan.goal.replace("-", " ")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {plan.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                          onClick={handleActivate}
                          disabled={activating}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {activating ? "Activating…" : "Activate"}
                        </Button>
                      )}
                      {plan.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-border text-muted-foreground hover:border-rose-500/40 hover:text-rose-300 hover:bg-rose-500/10"
                          onClick={handleEnd}
                          disabled={activating}
                        >
                          {activating ? "Ending…" : "End plan"}
                        </Button>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleDownload}
                            disabled={downloading}
                          >
                            <Download
                              className={downloading ? "h-4 w-4 animate-pulse" : "h-4 w-4"}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {downloading ? "Generating PDF…" : "Export PDF"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSaveAsTemplateOpen(true)}
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save as template</TooltipContent>
                      </Tooltip>
                      <Button size="sm" className="h-8">
                        <Send className="h-4 w-4" />
                        Send to client
                      </Button>
                    </div>
                  </div>

                  {/* macros vs targets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setMicrosSlotId(null);
                          setMicrosOpen(true);
                        }}
                      >
                        <Pill className="h-3.5 w-3.5" />
                        Micronutrients
                      </Button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <MacroBar
                        icon={Flame}
                        label="kcal"
                        value={totals.kcal}
                        target={targets.kcal}
                        tone="primary"
                      />
                      <MacroBar
                        icon={Beef}
                        label="Protein"
                        value={totals.protein}
                        target={targets.protein}
                        unit="g"
                        tone="rose"
                      />
                      <MacroBar
                        icon={Wheat}
                        label="Carbs"
                        value={totals.carbs}
                        target={targets.carbs}
                        unit="g"
                        tone="amber"
                      />
                      <MacroBar
                        icon={Droplet}
                        label="Fat"
                        value={totals.fat}
                        target={targets.fat}
                        unit="g"
                        tone="violet"
                      />
                      <MacroBar
                        icon={Leaf}
                        label="Fiber"
                        value={totals.fiber}
                        target={targets.fiber}
                        unit="g"
                        tone="emerald"
                      />
                    </div>
                  </div>

                  {/* day tabs */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {DAYS.map((d) => {
                        const dp = plan.days.find((dp) => dp.day === d.key);
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
                    <Popover
                      open={copyDayOpen}
                      onOpenChange={(o) => {
                        setCopyDayOpen(o);
                        if (!o) setCopyTargetDays([]);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          <Repeat2 className="h-3.5 w-3.5" />
                          Copy day
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3" align="end">
                        <p className="text-xs font-semibold mb-2.5">
                          Copy {DAYS[activeDayIdx]?.label} to:
                        </p>
                        <div className="space-y-1 mb-3">
                          <button
                            className="w-full text-left text-xs px-1.5 py-1 rounded hover:bg-muted/40 text-primary font-medium"
                            onClick={() => setCopyTargetDays(otherDayIndices)}
                          >
                            All other days
                          </button>
                          <Separator />
                          {DAYS.map((d, idx) => {
                            if (idx === activeDayIdx) return null;
                            const checked = copyTargetDays.includes(idx);
                            return (
                              <button
                                key={d.key}
                                className="w-full flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-muted/40"
                                onClick={() => toggleCopyTarget(idx)}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleCopyTarget(idx)}
                                  className="h-3.5 w-3.5"
                                />
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          disabled={copying || copyTargetDays.length === 0}
                          onClick={handleCopyDay}
                        >
                          {copying
                            ? "Copying…"
                            : copyTargetDays.length === 0
                              ? "Select days"
                              : `Copy to ${copyTargetDays.length} day${copyTargetDays.length !== 1 ? "s" : ""}`}
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Separator />

                  {/* meal slots */}
                  <ScrollArea
                    ref={slotListRef}
                    onDragOver={handleSlotListDragOver}
                    className="h-130 pr-2 -mr-2"
                  >
                    <div className="space-y-3">
                      {day?.meals.map((meal) => {
                        const mm = mealMacros(meal);
                        const dayIdx = DAYS.findIndex((d) => d.key === activeDay);
                        return (
                          <div
                            key={meal.id}
                            onDragOver={(e) => handleSlotDragOver(e, meal.slot)}
                            onDragLeave={() => handleSlotDragLeave(meal.slot)}
                            onDrop={(e) => handleSlotDrop(e, meal.slot)}
                            className={cn(
                              "rounded-lg border overflow-hidden transition-colors",
                              // No drop-allowed highlight on the slot being dragged itself —
                              // dropping onto itself is a no-op (prompt-57), so it shouldn't
                              // advertise itself as a target.
                              dragOverSlot === meal.slot &&
                                draggedSlot &&
                                draggedSlot !== meal.slot
                                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                : "border-border/60 bg-card/40",
                            )}
                          >
                            <div
                              draggable
                              onDragStart={(e) => handleSlotDragStart(e, meal.slot)}
                              onDragEnd={handleSlotDragEnd}
                              title="Drag onto another slot to copy these items into it"
                              className={cn(
                                "flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60 cursor-grab active:cursor-grabbing",
                                draggedSlot === meal.slot && "opacity-50",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                <span className="text-base leading-none">
                                  {SLOT_META[meal.slot as MealSlot]?.emoji ?? "🍽️"}
                                </span>
                                <div>
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
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs font-semibold">{mm.kcal} kcal</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    P{mm.protein} · C{mm.carbs} · F{mm.fat}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onSelect={() => openCopySlot(meal.id, meal.slot)}
                                    >
                                      <Repeat2 className="h-3.5 w-3.5" />
                                      Copy to another day
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => openEditTime(meal.id, meal.slot, meal.time)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit time
                                    </DropdownMenuItem>
                                    {/* Same sheet the day-level button opens, scoped to this
                                        slot (prompt-83) — added to the kebab this slot already
                                        has rather than inventing a new affordance. */}
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setMicrosSlotId(meal.id);
                                        setMicrosOpen(true);
                                      }}
                                    >
                                      <Pill className="h-3.5 w-3.5" />
                                      Micronutrients
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="divide-y divide-border/40">
                              {meal.items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/20 group"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm truncate">{it.name}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      {it.amount}
                                      {it.isApproximate && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-56 text-xs">
                                            Approximate — real weight not available for this
                                            food, enter in grams for exact accuracy.
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right text-[10px] text-muted-foreground tabular-nums">
                                      <p className="font-medium text-foreground">
                                        {it.macros.kcal}
                                      </p>
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
                                  setPickerState({
                                    open: true,
                                    day: dayIdx,
                                    slot: meal.slot,
                                  })
                                }
                              >
                                <Plus className="h-3 w-3" />
                                Add food from database
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button className="w-full rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-muted/30 hover:border-primary/40 flex items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Add custom meal slot
                      </button>
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <NewPlanDialog
          open={newPlanOpen}
          onOpenChange={setNewPlanOpen}
          onCreate={(p) => {
            qc.invalidateQueries({ queryKey: ["mealplans"] });
            setSelectedId(p.id);
          }}
        />

        {plan && (
          <DuplicatePlanDialog
            open={duplicateDialogOpen}
            onOpenChange={setDuplicateDialogOpen}
            sourcePlan={plan}
            onCreated={handleDuplicateCreated}
          />
        )}

        {plan && (
          <SaveAsTemplateDialog
            open={saveAsTemplateOpen}
            onOpenChange={setSaveAsTemplateOpen}
            sourcePlan={plan}
            onSaved={() => toast.success(`Saved "${plan.name}" as a template`)}
          />
        )}

        {effectiveId && (
          <PlanItemPicker
            open={pickerState.open}
            onOpenChange={(o) => setPickerState((s) => ({ ...s, open: o }))}
            onAdd={(data) => addPlanItem(effectiveId, data)}
            onAdded={() => qc.invalidateQueries({ queryKey: ["mealplan"] })}
            day={pickerState.day}
            slot={pickerState.slot}
          />
        )}

        <EditPlanItemDialog
          item={editingItem}
          onOpenChange={(o) => !o && setEditingItem(null)}
          onSave={handleSaveEditedItem}
        />

        <Dialog open={!!slotAction} onOpenChange={(o) => !o && closeSlotAction()}>
          <DialogContent className="sm:max-w-80">
            {slotAction?.mode === "copy" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    Copy {SLOT_META[slotAction.slot as MealSlot]?.label ?? slotAction.slot} to:
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-1">
                  <button
                    className="w-full text-left text-xs px-1.5 py-1.5 rounded hover:bg-muted/40 text-primary font-medium"
                    onClick={() => setCopyTargetDaysForSlot(otherDayIndices)}
                  >
                    All other days
                  </button>
                  <Separator />
                  {DAYS.map((d, idx) => {
                    if (idx === activeDayIdx) return null;
                    const checked = copyTargetDaysForSlot.includes(idx);
                    return (
                      <button
                        key={d.key}
                        className="w-full flex items-center gap-2 text-xs px-1.5 py-1.5 rounded hover:bg-muted/40"
                        onClick={() => toggleCopyTargetForSlot(idx)}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCopyTargetForSlot(idx)}
                          className="h-3.5 w-3.5"
                        />
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={copyingSlot || copyTargetDaysForSlot.length === 0}
                  onClick={handleCopyMealSlot}
                >
                  {copyingSlot
                    ? "Copying…"
                    : copyTargetDaysForSlot.length === 0
                      ? "Select days"
                      : `Copy to ${copyTargetDaysForSlot.length} day${copyTargetDaysForSlot.length !== 1 ? "s" : ""}`}
                </Button>
              </>
            ) : slotAction?.mode === "time" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    Edit {SLOT_META[slotAction.slot as MealSlot]?.label ?? slotAction.slot} time
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground -mt-2">
                  Applies to this slot on every day in the plan.
                </p>
                <Input
                  type="time"
                  value={editTimeValue}
                  onChange={(e) => setEditTimeValue(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={savingTime || !editTimeValue}
                  onClick={handleSaveSlotTime}
                >
                  {savingTime ? "Saving…" : "Save time"}
                </Button>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Sheet open={microsOpen} onOpenChange={setMicrosOpen}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                Micronutrients — {DAYS.find((d) => d.key === activeDay)?.label}
                {microsSlot ? ` · ${microsSlot.title}` : ""}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              {/* Day <-> slot switcher. The day total and each slot's total are the same
                  numbers grouped differently, so this is a view toggle, not a refetch. */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setMicrosSlotId(null)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] transition-colors",
                    microsSlotId === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  Whole day
                </button>
                {day?.meals.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMicrosSlotId(m.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] transition-colors",
                      microsSlotId === m.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {m.title}
                  </button>
                ))}
              </div>

              <MicronutrientPanel
                rows={microRows}
                caption={microsSlot ? `${microsSlot.title} · ${microsSlot.items.length} item${microsSlot.items.length === 1 ? "" : "s"}` : "whole day"}
                emptyText={
                  microsSlot
                    ? "No item in this meal reports micronutrient data."
                    : "No item in this day reports micronutrient data."
                }
              />
              {!plan?.driTargets && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Set the client's age, sex and activity level to see their personal DRI targets
                  alongside these amounts.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

// ---------------- Subcomponents ----------------

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "amber";
}) {
  const iconTone =
    tone === "primary"
      ? "text-primary bg-primary/10"
      : tone === "amber"
        ? "text-amber-300 bg-amber-500/10"
        : "text-muted-foreground bg-muted";
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center", iconTone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MacroBar({
  icon: Icon,
  label,
  value,
  target,
  unit = "",
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  target: number;
  unit?: string;
  tone: "primary" | "rose" | "amber" | "violet" | "emerald";
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const toneMap: Record<string, string> = {
    primary: "text-primary",
    rose: "text-rose-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
    emerald: "text-emerald-300",
  };
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", toneMap[tone])} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-semibold tabular-nums">{Math.round(value)}</span>
        <span className="text-[10px] text-muted-foreground">
          / {target}
          {unit}
        </span>
      </div>
      <Progress value={pct} className="h-1" />
    </div>
  );
}

// Same value/target/% presentation as MacroBar, laid out as a compact list row rather than a
// card — 22 of these need to fit in one Sheet without the height MacroBar's card padding would
// take. `target == null` (no DRI value at all — shouldn't happen for these 22 fields when
// plan.driTargets exists, but handled defensively) shows the raw amount with no percentage,
// same as `value == null` ("no data available" — not the same as zero, see meal-plans-mock.ts).
function MicroRow({
  label,
  unit,
  value,
  target,
}: {
  label: string;
  unit: string;
  value: number | null;
  target: number | null;
}) {
  const hasTarget = target != null && target > 0;
  const pct = hasTarget && value != null ? Math.round((value / target) * 100) : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value != null ? value : "—"}
          {hasTarget ? ` / ${target}` : ""} {unit}
          {pct != null && <span className="ml-1.5 font-semibold text-foreground">{pct}%</span>}
        </span>
      </div>
      {hasTarget && <Progress value={Math.min(100, pct ?? 0)} className="h-1" />}
    </div>
  );
}
