import { useMemo, useState } from "react";
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
  Archive,
  Pill,
  Info,
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
  type MealPlan,
  type DayKey,
  type MealSlot,
} from "@/lib/meal-plans-mock";
import {
  fetchMealPlans,
  fetchMealPlan,
  updateMealPlan,
  removePlanItem,
  downloadPlanPdf,
  copyPlanDay,
  copyMealSlot,
  updateSlotTime,
} from "@/lib/mealplans-api";
import { NewPlanDialog } from "@/components/new-plan-dialog";
import { DuplicatePlanDialog } from "@/components/duplicate-plan-dialog";
import { PlanItemPicker } from "@/components/plan-item-picker";

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
  const [removing, setRemoving] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [copyDayOpen, setCopyDayOpen] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [copying, setCopying] = useState(false);
  const [microsOpen, setMicrosOpen] = useState(false);
  const [slotAction, setSlotAction] = useState<{
    mealId: string;
    slot: string;
    mode: "copy" | "time";
  } | null>(null);
  const [copyTargetDaysForSlot, setCopyTargetDaysForSlot] = useState<number[]>([]);
  const [copyingSlot, setCopyingSlot] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState("");
  const [savingTime, setSavingTime] = useState(false);

  const { data: listData } = useQuery({
    queryKey: ["mealplans"],
    queryFn: () => fetchMealPlans({ limit: 100 }),
  });
  const plans = listData?.plans ?? [];

  const effectiveId = selectedId ?? plans[0]?.id ?? null;

  const { data: detailPlan } = useQuery({
    queryKey: ["mealplan", effectiveId],
    queryFn: () => fetchMealPlan(effectiveId!),
    enabled: !!effectiveId,
  });

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

  const totals = day ? dayMacros(day) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const targets = plan?.targets ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const microTotals = day ? dayMicros(day) : {};

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
            value={String(plans.filter((p) => p.status === "active").length)}
            hint={`${plans.length} total`}
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
              {!plan ? (
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
                        onClick={() => setMicrosOpen(true)}
                      >
                        <Pill className="h-3.5 w-3.5" />
                        Micronutrients
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
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
                  <ScrollArea className="h-130 pr-2 -mr-2">
                    <div className="space-y-3">
                      {day?.meals.map((meal) => {
                        const mm = mealMacros(meal);
                        const dayIdx = DAYS.findIndex((d) => d.key === activeDay);
                        return (
                          <div
                            key={meal.id}
                            className="rounded-lg border border-border/60 bg-card/40 overflow-hidden"
                          >
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
                              <div className="flex items-center gap-2.5">
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

        {effectiveId && (
          <PlanItemPicker
            open={pickerState.open}
            onOpenChange={(o) => setPickerState((s) => ({ ...s, open: o }))}
            planId={effectiveId}
            day={pickerState.day}
            slot={pickerState.slot}
          />
        )}

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
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              {!plan?.driTargets ? (
                <p className="text-sm text-muted-foreground">
                  Set client's age, sex, and activity level to see DRI targets.
                </p>
              ) : (
                <div className="space-y-5">
                  {DRI_FIELD_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-2.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </h4>
                      <div className="space-y-2.5">
                        {group.fields.map((f) => (
                          <MicroRow
                            key={f.key}
                            label={f.label}
                            unit={f.unit}
                            value={microTotals[f.key] ?? null}
                            target={plan.driTargets?.[f.key] ?? null}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
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
  tone: "primary" | "rose" | "amber" | "violet";
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const toneMap: Record<string, string> = {
    primary: "text-primary",
    rose: "text-rose-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
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
