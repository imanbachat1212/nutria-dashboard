import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Target,
  CalendarDays,
  Layers,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchClients } from "@/lib/clients-api";
import type { ClientRecord } from "@/lib/clients-mock";
import { PLAN_TEMPLATES, type MealPlan } from "@/lib/meal-plans-mock";
import { createMealPlan } from "@/lib/mealplans-api";

type Goal = MealPlan["goal"];
type StartMethod = "blank" | "template";

const GOAL_META: Record<
  Goal,
  { label: string; emoji: string; kcalDelta: number; description: string }
> = {
  "weight-loss": {
    label: "Weight loss",
    emoji: "🔥",
    kcalDelta: -450,
    description: "Sustainable deficit, high protein",
  },
  "muscle-gain": {
    label: "Muscle gain",
    emoji: "💪",
    kcalDelta: 350,
    description: "Lean surplus, performance focused",
  },
  maintenance: {
    label: "Maintenance",
    emoji: "⚖️",
    kcalDelta: 0,
    description: "Hold weight, support lifestyle",
  },
  clinical: {
    label: "Clinical",
    emoji: "🩺",
    kcalDelta: 0,
    description: "Medical condition driven",
  },
};

const STEPS = ["Client", "Goal & duration", "Macro targets", "Starter", "Review"] as const;

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (plan: MealPlan) => void;
  /** Pre-selects this client and skips the picker step — used when opened from a client's own page. */
  initialClient?: ClientRecord;
}

export function NewPlanDialog({
  open,
  onOpenChange,
  onCreate,
  initialClient,
}: NewPlanDialogProps) {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [goal, setGoal] = useState<Goal>("weight-loss");
  const [weeks, setWeeks] = useState(4);
  const [kcalOverride, setKcalOverride] = useState<number | null>(null);
  const [protein, setProtein] = useState(130);
  const [carbs, setCarbs] = useState(170);
  const [fat, setFat] = useState(55);
  const [starter, setStarter] = useState<StartMethod>("template");
  const [templateId, setTemplateId] = useState<string | null>(PLAN_TEMPLATES[0].id);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "plan-picker", debouncedSearch],
    queryFn: () =>
      fetchClients({
        search: debouncedSearch || undefined,
        limit: 50,
        status: "active",
      }),
    enabled: open,
  });
  const allClients = clientsData?.clients ?? [];

  const client = useMemo(() => {
    if (initialClient && initialClient.id === clientId) return initialClient;
    return allClients.find((c: ClientRecord) => c.id === clientId);
  }, [clientId, allClients, initialClient]);

  // Pre-seed the picker with the client this dialog was opened for, and skip straight
  // to goal/duration — the user is already on that client's page.
  useEffect(() => {
    if (!open || !initialClient) return;
    setClientId(initialClient.id);
    setPlanName(`${GOAL_META[goal].label} · ${initialClient.name.split(" ")[0]}`);
    const k = Math.max(
      1200,
      Math.round(
        (initialClient.bmr * initialClient.activityFactor + GOAL_META[goal].kcalDelta) / 10,
      ) * 10,
    );
    applySuggestedMacros(k, goal);
    setStep(1);
    // Only re-seed when the dialog is (re)opened for this client, not on every goal change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialClient]);

  const suggestedKcal = useMemo(() => {
    if (!client) return 1800;
    return Math.max(
      1200,
      Math.round((client.bmr * client.activityFactor + GOAL_META[goal].kcalDelta) / 10) * 10,
    );
  }, [client, goal]);

  const kcal = kcalOverride ?? suggestedKcal;

  const macroKcal = protein * 4 + carbs * 4 + fat * 9;
  const macrosBalanced = Math.abs(macroKcal - kcal) <= 50;

  const canNext = useMemo(() => {
    if (step === 0) return !!clientId && planName.trim().length > 0;
    if (step === 1) return weeks > 0;
    if (step === 2) return macrosBalanced;
    if (step === 3) return starter === "blank" || (starter === "template" && !!templateId);
    return true;
  }, [step, clientId, planName, weeks, macrosBalanced, starter, templateId]);

  function reset() {
    setStep(0);
    setSearch("");
    setClientId(null);
    setPlanName("");
    setGoal("weight-loss");
    setWeeks(4);
    setKcalOverride(null);
    setProtein(130);
    setCarbs(170);
    setFat(55);
    setStarter("template");
    setTemplateId(PLAN_TEMPLATES[0].id);
  }

  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!client) return;
    setSaving(true);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + weeks * 7 * 86400000);
      const plan = await createMealPlan({
        client: client.id,
        name: planName.trim() || `${goal} · ${client.name.split(" ")[0]}`,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        goal,
        targetCalories: kcal,
        targetProtein: protein,
        targetCarbs: carbs,
        targetFat: fat,
      });
      onCreate(plan);
      onOpenChange(false);
      setTimeout(reset, 200);
    } finally {
      setSaving(false);
    }
  }

  // Auto-fill plan name + macros when client picked
  function pickClient(id: string) {
    setClientId(id);
    const c = allClients.find((x: ClientRecord) => x.id === id);
    if (c) {
      if (!planName) {
        setPlanName(`${GOAL_META[goal].label} · ${c.name.split(" ")[0]}`);
      }
      const k =
        kcalOverride ??
        Math.max(
          1200,
          Math.round((c.bmr * c.activityFactor + GOAL_META[goal].kcalDelta) / 10) * 10,
        );
      applySuggestedMacros(k, goal);
    }
  }

  // Auto-set macros from kcal when goal/kcal changes
  function applySuggestedMacros(k: number, g: Goal) {
    if (g === "muscle-gain") {
      setProtein(Math.round((k * 0.28) / 4));
      setCarbs(Math.round((k * 0.45) / 4));
      setFat(Math.round((k * 0.27) / 9));
    } else if (g === "weight-loss") {
      setProtein(Math.round((k * 0.34) / 4));
      setCarbs(Math.round((k * 0.36) / 4));
      setFat(Math.round((k * 0.3) / 9));
    } else {
      setProtein(Math.round((k * 0.3) / 4));
      setCarbs(Math.round((k * 0.4) / 4));
      setFat(Math.round((k * 0.3) / 9));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">New meal plan</DialogTitle>
              <DialogDescription className="text-xs">
                {initialClient
                  ? `For ${initialClient.name} — build a tailored plan in ${STEPS.length} quick steps.`
                  : `Build a tailored plan in ${STEPS.length} quick steps.`}
              </DialogDescription>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              {STEPS.map((label, idx) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full grid place-items-center text-[11px] font-medium border transition-colors",
                      idx < step && "bg-primary/15 border-primary/30 text-primary",
                      idx === step && "bg-primary text-primary-foreground border-primary",
                      idx > step && "bg-muted/30 text-muted-foreground border-border",
                    )}
                  >
                    {idx < step ? <Check className="h-3 w-3" /> : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground sm:hidden">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 min-h-105 max-h-[60vh] overflow-y-auto">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Plan name
                </Label>
                <Input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Cut · Phase 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Assign to client
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients…"
                    className="pl-8"
                  />
                </div>
                <ScrollArea className="h-65 border rounded-md mt-2">
                  <div className="p-1">
                    {allClients.map((c) => {
                      const selected = c.id === clientId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => pickClient(c.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                            selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40",
                          )}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[11px]">
                              {c.avatarInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {c.sex} · {c.age}y · {c.weightKg}kg → {c.targetWeightKg}kg
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {c.serviceType.map((s) => ({ diet: "Diet", gym: "Gym", classes: "Classes" }[s] ?? s)).join(" + ") || "—"}
                          </Badge>
                          {selected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                    {allClients.length === 0 && (
                      <div className="text-xs text-muted-foreground p-6 text-center">
                        No clients match "{search}"
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Goal
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(Object.keys(GOAL_META) as Goal[]).map((g) => {
                    const meta = GOAL_META[g];
                    const selected = goal === g;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setGoal(g);
                          if (client) {
                            const k = Math.max(
                              1200,
                              Math.round(
                                (client.bmr * client.activityFactor + meta.kcalDelta) / 10,
                              ) * 10,
                            );
                            applySuggestedMacros(kcalOverride ?? k, g);
                          }
                        }}
                        className={cn(
                          "p-3 rounded-md border text-left transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{meta.emoji}</span>
                          <span className="text-sm font-medium">{meta.label}</span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{meta.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Duration
                  </Label>
                  <span className="text-sm font-medium tabular-nums">
                    {weeks} week{weeks === 1 ? "" : "s"}
                  </span>
                </div>
                <Slider
                  value={[weeks]}
                  onValueChange={([v]) => setWeeks(v)}
                  min={1}
                  max={12}
                  step={1}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>1w</span>
                  <span>4w</span>
                  <span>8w</span>
                  <span>12w</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoTile
                  icon={CalendarDays}
                  label="Starts"
                  value={new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                />
                <InfoTile
                  icon={CalendarDays}
                  label="Ends"
                  value={new Date(Date.now() + weeks * 7 * 86400000).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-md border bg-muted/20 p-3 flex items-start gap-3">
                <Target className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-xs text-muted-foreground flex-1">
                  Suggested from {client?.name ?? "client"}'s BMR & activity:{" "}
                  <span className="text-foreground font-medium">{suggestedKcal} kcal</span>
                  {kcalOverride !== null && (
                    <button
                      onClick={() => {
                        setKcalOverride(null);
                        applySuggestedMacros(suggestedKcal, goal);
                      }}
                      className="ml-2 text-primary hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5" /> Daily kcal target
                  </Label>
                  <span className="text-base font-semibold tabular-nums">{kcal}</span>
                </div>
                <Slider
                  value={[kcal]}
                  onValueChange={([v]) => {
                    setKcalOverride(v);
                    applySuggestedMacros(v, goal);
                  }}
                  min={1000}
                  max={4000}
                  step={50}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-3">
                <MacroInput
                  icon={Beef}
                  label="Protein"
                  unit="g"
                  value={protein}
                  onChange={setProtein}
                  tone="text-rose-300"
                />
                <MacroInput
                  icon={Wheat}
                  label="Carbs"
                  unit="g"
                  value={carbs}
                  onChange={setCarbs}
                  tone="text-amber-300"
                />
                <MacroInput
                  icon={Droplet}
                  label="Fat"
                  unit="g"
                  value={fat}
                  onChange={setFat}
                  tone="text-sky-300"
                />
              </div>

              <div
                className={cn(
                  "rounded-md border p-3 text-xs flex items-center justify-between",
                  macrosBalanced
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                )}
              >
                <span>
                  Macro total: <span className="font-semibold tabular-nums">{macroKcal} kcal</span>
                </span>
                <span>
                  {macrosBalanced
                    ? `Balanced (±${Math.abs(macroKcal - kcal)} kcal)`
                    : `Off by ${macroKcal - kcal} kcal — adjust to within ±50`}
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <StarterCard
                  icon={Layers}
                  title="From template"
                  description="Start from a vetted template, then tweak."
                  active={starter === "template"}
                  onClick={() => setStarter("template")}
                  recommended
                />
                <StarterCard
                  icon={Target}
                  title="Blank canvas"
                  description="Empty week — build meal by meal."
                  active={starter === "blank"}
                  onClick={() => setStarter("blank")}
                />
              </div>

              {starter === "template" && (
                <div className="border rounded-md p-2 space-y-1">
                  {PLAN_TEMPLATES.map((t) => {
                    const selected = t.id === templateId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTemplateId(t.id);
                          setKcalOverride(t.kcal);
                          applySuggestedMacros(t.kcal, goal);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                          selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">{t.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.kcal} kcal · {t.days} days
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {t.tag}
                        </Badge>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/10 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{client?.avatarInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{planName}</div>
                    <div className="text-xs text-muted-foreground">
                      {client?.name} · {GOAL_META[goal].label} · {weeks} weeks
                    </div>
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                    Draft
                  </Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <ReviewStat icon={Flame} label="Daily" value={`${kcal} kcal`} />
                  <ReviewStat icon={Beef} label="Protein" value={`${protein}g`} />
                  <ReviewStat icon={Wheat} label="Carbs" value={`${carbs}g`} />
                  <ReviewStat icon={Droplet} label="Fat" value={`${fat}g`} />
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Starter:{" "}
                  <span className="text-foreground font-medium">
                    {starter === "template" &&
                      `Template — ${PLAN_TEMPLATES.find((t) => t.id === templateId)?.name}`}
                    {starter === "blank" && "Blank canvas"}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-primary mt-0.5" />
                <div className="text-muted-foreground">
                  Plan saves as <span className="text-foreground font-medium">Draft</span>. You can
                  edit days, swap items, and share via WhatsApp from the plan editor.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/10 flex-row sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              <Check className="h-4 w-4" />
              {saving ? "Creating…" : "Create plan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-muted/40 grid place-items-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function MacroInput({
  icon: Icon,
  label,
  unit,
  value,
  onChange,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  tone: string;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-8 text-base tabular-nums font-semibold"
        />
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        {value * (label === "Fat" ? 9 : 4)} kcal
      </div>
    </div>
  );
}

function StarterCard({
  icon: Icon,
  title,
  description,
  active,
  onClick,
  recommended,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-md border text-left transition-colors relative",
        active ? "border-primary/40 bg-primary/10" : "border-border hover:bg-muted/40",
      )}
    >
      {recommended && (
        <Badge className="absolute top-2 right-2 text-[9px] bg-primary/20 text-primary border-primary/30">
          Recommended
        </Badge>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{description}</div>
    </button>
  );
}

function ReviewStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
