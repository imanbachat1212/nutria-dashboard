import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Activity,
  Calendar,
  Ruler,
  Weight,
  Target,
  Briefcase,
  Moon,
  Apple,
  AlertTriangle,
  Stethoscope,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Calculator,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SERVICE_TYPE_LABEL,
  type ServiceType,
  type ClientStatus,
  type ClientRecord,
  type ClientGoal,
  type ClientMacros,
} from "@/lib/clients-mock";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (client: ClientRecord) => void | Promise<void>;
}

const STEPS = [
  { id: 1, label: "Profile" },
  { id: 2, label: "Body & goals" },
  { id: 3, label: "Lifestyle" },
  { id: 4, label: "Targets & review" },
];

const ACTIVITY_OPTIONS = [
  { value: 1.2, label: "Sedentary (desk job)" },
  { value: 1.375, label: "Light (1–2 days/week)" },
  { value: 1.55, label: "Moderate (3–5 days/week)" },
  { value: 1.725, label: "Active (6–7 days/week)" },
  { value: 1.9, label: "Very active (physical job)" },
];

const GOAL_TYPES: { value: ClientGoal["type"]; label: string; deficit: number }[] = [
  { value: "weight-loss", label: "Weight loss", deficit: -500 },
  { value: "muscle-gain", label: "Muscle gain", deficit: 300 },
  { value: "maintenance", label: "Maintenance", deficit: 0 },
  { value: "clinical", label: "Clinical / other", deficit: 0 },
];

export function NewClientDialog({ open, onOpenChange, onCreate }: NewClientDialogProps) {
  const [step, setStep] = useState(1);

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [status, setStatus] = useState<ClientStatus>("active");

  // Body & goals
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"F" | "M">("F");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [startWeightKg, setStartWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [activityFactor, setActivityFactor] = useState(1.375);
  const [goalType, setGoalType] = useState<ClientGoal["type"]>("weight-loss");
  const [targetDate, setTargetDate] = useState("");

  // Lifestyle
  const [occupation, setOccupation] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [dietaryPrefsRaw, setDietaryPrefsRaw] = useState("");
  const [allergiesRaw, setAllergiesRaw] = useState("");
  const [medicalHistoryRaw, setMedicalHistoryRaw] = useState("");

  // Targets
  const [targets, setTargets] = useState<ClientMacros>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [overrideTargets, setOverrideTargets] = useState(false);

  const ageN = Number(age) || 0;
  const heightN = Number(heightCm) || 0;
  const weightN = Number(weightKg) || 0;
  const startWeightN = Number(startWeightKg) || 0;
  const targetWeightN = Number(targetWeightKg) || 0;
  const sleepN = Number(sleepHours) || 0;

  const bmr = useMemo(() => {
    if (!weightN || !heightN || !ageN) return 0;
    const s = sex === "M" ? 5 : -161;
    return Math.round(10 * weightN + 6.25 * heightN - 5 * ageN + s);
  }, [weightN, heightN, ageN, sex]);

  const tdee = useMemo(() => Math.round(bmr * activityFactor), [bmr, activityFactor]);

  const computedTargets = useMemo(() => {
    if (!tdee) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const adjustment = GOAL_TYPES.find((g) => g.value === goalType)?.deficit ?? 0;
    const calories = Math.max(1200, tdee + adjustment);
    const proteinGoal = goalType === "weight-loss" || goalType === "muscle-gain" ? 1.8 : 1.4;
    const protein = Math.round(weightN * proteinGoal);
    const fat = Math.round((calories * 0.28) / 9);
    const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
    return { calories, protein, carbs, fat };
  }, [tdee, goalType, weightN]);

  // Keep targets in sync with computed unless user overrides
  useEffect(() => {
    if (!overrideTargets) setTargets(computedTargets);
  }, [computedTargets, overrideTargets]);

  const reset = () => {
    setStep(1);
    setName("");
    setPhone("");
    setEmail("");
    setServiceTypes([]);
    setStatus("active");
    setAge("");
    setSex("F");
    setHeightCm("");
    setWeightKg("");
    setStartWeightKg("");
    setTargetWeightKg("");
    setActivityFactor(1.375);
    setGoalType("weight-loss");
    setTargetDate("");
    setOccupation("");
    setSleepHours("");
    setDietaryPrefsRaw("");
    setAllergiesRaw("");
    setMedicalHistoryRaw("");
    setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    setOverrideTargets(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const avatarInitials = useMemo(() => {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const parseList = (raw: string) =>
    raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const now = new Date().toISOString().split("T")[0];
    const newClient: ClientRecord = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      avatarInitials: avatarInitials || "??",
      serviceType: serviceTypes,
      status,
      joinedAt: now,
      lastActivity: "Just now",
      age: ageN,
      sex,
      heightCm: heightN,
      weightKg: weightN,
      startWeightKg: startWeightN,
      targetWeightKg: targetWeightN,
      activityFactor,
      bmr,
      targets,
      todayConsumed: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      adherencePct: 0,
      occupation: occupation.trim() || "—",
      sleepHours: sleepN,
      dietaryPrefs: parseList(dietaryPrefsRaw),
      allergies: parseList(allergiesRaw),
      medicalHistory: parseList(medicalHistoryRaw),
      labs: [],
      nutritionDiagnosis: "",
      adimeNotes: [],
      goal: { type: goalType, targetWeight: targetWeightN, targetDate: targetDate || undefined },
      journal: [],
      plans: [],
      payments: [],
      files: [],
      outstandingBalanceUsd: 0,
    };
    setSaving(true);
    try {
      await onCreate(newClient);
      handleClose(false);
    } catch (err) {
      console.error("Failed to create client:", err);
    } finally {
      setSaving(false);
    }
  };

  const canAdvance =
    (step === 1 && name.trim().length > 1 && phone.trim().length >= 8) ||
    (step === 2 &&
      ageN > 0 &&
      heightN > 0 &&
      weightN > 0 &&
      startWeightN > 0 &&
      targetWeightN > 0) ||
    step === 3 ||
    (step === 4 && targets.calories > 0 && targets.protein > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Add a new client record with anthropometrics, goals, and macro targets.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > s.id ? <CheckCircle2 className="size-4" /> : s.id}
              </div>
              <div
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  step === s.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </div>
              {i < STEPS.length - 1 && <Separator className="flex-1" />}
            </div>
          ))}
        </div>

        <div className="min-h-90 py-2">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="name">Full name *</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sura Haddad"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s()-]/g, ""))}
                      placeholder="+961 71 000 000"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>
                    Program
                    {serviceTypes.length === 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(none selected)</span>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    {(Object.keys(SERVICE_TYPE_LABEL) as ServiceType[]).map((s) => {
                      const active = serviceTypes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setServiceTypes((prev) =>
                              active ? prev.filter((p) => p !== s) : [...prev, s],
                            )
                          }
                          className={cn(
                            "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {SERVICE_TYPE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sex</Label>
                  <Select value={sex} onValueChange={(v) => setSex(v as "F" | "M")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="M">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="height">Height (cm)</Label>
                  <div className="relative">
                    <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="height"
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="e.g. 165"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <div className="relative">
                    <Weight className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="weight"
                      type="number"
                      step={0.1}
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="e.g. 70"
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startWeight">Start weight (kg)</Label>
                  <Input
                    id="startWeight"
                    type="number"
                    step={0.1}
                    value={startWeightKg}
                    onChange={(e) => setStartWeightKg(e.target.value)}
                    placeholder="e.g. 78"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="targetWeight">Target weight (kg)</Label>
                  <Input
                    id="targetWeight"
                    type="number"
                    step={0.1}
                    value={targetWeightKg}
                    onChange={(e) => setTargetWeightKg(e.target.value)}
                    placeholder="e.g. 64"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Activity level</Label>
                  <Select
                    value={activityFactor.toString()}
                    onValueChange={(v) => setActivityFactor(Number(v))}
                  >
                    <SelectTrigger>
                      <Activity className="size-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Goal</Label>
                  <Select
                    value={goalType}
                    onValueChange={(v) => setGoalType(v as ClientGoal["type"])}
                  >
                    <SelectTrigger>
                      <Target className="size-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="targetDate">Target date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="targetDate"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="occupation">Occupation</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="occupation"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="e.g. Architect"
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sleep">Sleep hours</Label>
                  <div className="relative">
                    <Moon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sleep"
                      type="number"
                      step={0.5}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      placeholder="e.g. 7"
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prefs" className="flex items-center gap-1.5">
                  <Apple className="size-4" /> Dietary preferences
                </Label>
                <Textarea
                  id="prefs"
                  value={dietaryPrefsRaw}
                  onChange={(e) => setDietaryPrefsRaw(e.target.value)}
                  placeholder="e.g. Mediterranean, Vegetarian-leaning, High protein (comma or line separated)"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="allergies" className="flex items-center gap-1.5">
                  <AlertTriangle className="size-4" /> Allergies
                </Label>
                <Textarea
                  id="allergies"
                  value={allergiesRaw}
                  onChange={(e) => setAllergiesRaw(e.target.value)}
                  placeholder="e.g. Peanuts, Shellfish, Dairy (comma or line separated)"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="medical" className="flex items-center gap-1.5">
                  <Stethoscope className="size-4" /> Medical history
                </Label>
                <Textarea
                  id="medical"
                  value={medicalHistoryRaw}
                  onChange={(e) => setMedicalHistoryRaw(e.target.value)}
                  placeholder="e.g. PCOS, Hypothyroidism, Hypertension (comma or line separated)"
                  rows={2}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Calculator className="size-4" /> Estimated metabolism
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <StatBox label="BMR" value={`${bmr} kcal`} />
                  <StatBox label="TDEE" value={`${tdee} kcal`} />
                  <StatBox
                    label="BMI"
                    value={heightN ? (weightN / (heightN / 100) ** 2).toFixed(1) : "—"}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Targets update automatically when you change body metrics or goals.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Daily macro targets</h3>
                  <p className="text-xs text-muted-foreground">
                    Edit values if you want a custom split.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOverrideTargets(false);
                    setTargets(computedTargets);
                  }}
                >
                  <Calculator className="size-4" /> Reset to computed
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <MacroInput
                  icon={Flame}
                  label="kcal"
                  value={targets.calories}
                  onChange={(v) => {
                    setOverrideTargets(true);
                    setTargets((t) => ({ ...t, calories: v }));
                  }}
                  hue="bg-amber-50"
                />
                <MacroInput
                  icon={Beef}
                  label="Protein"
                  value={targets.protein}
                  onChange={(v) => {
                    setOverrideTargets(true);
                    setTargets((t) => ({ ...t, protein: v }));
                  }}
                  hue="bg-rose-50"
                  suffix="g"
                />
                <MacroInput
                  icon={Wheat}
                  label="Carbs"
                  value={targets.carbs}
                  onChange={(v) => {
                    setOverrideTargets(true);
                    setTargets((t) => ({ ...t, carbs: v }));
                  }}
                  hue="bg-emerald-50"
                  suffix="g"
                />
                <MacroInput
                  icon={Droplet}
                  label="Fat"
                  value={targets.fat}
                  onChange={(v) => {
                    setOverrideTargets(true);
                    setTargets((t) => ({ ...t, fat: v }));
                  }}
                  hue="bg-sky-50"
                  suffix="g"
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">Review</h3>
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                      {avatarInitials || "??"}
                    </div>
                    <div>
                      <div className="font-semibold">{name || "New client"}</div>
                      <div className="text-xs text-muted-foreground">
                        {phone} · {serviceTypes.map((s) => SERVICE_TYPE_LABEL[s]).join(" + ") || "No program"} · {status}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      {age || "—"} yrs · {sex}
                    </Badge>
                    <Badge variant="secondary">
                      {heightCm || "—"} cm · {weightN.toFixed(1)} kg
                    </Badge>
                    <Badge variant="secondary">
                      Goal: {GOAL_TYPES.find((g) => g.value === goalType)?.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Next <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              <CheckCircle2 className="size-4" /> {saving ? "Saving…" : "Save client"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MacroInput({
  icon: Icon,
  label,
  value,
  onChange,
  hue,
  suffix,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onChange: (v: number) => void;
  hue: string;
  suffix?: string;
}) {
  return (
    <div className={cn("rounded-md p-2.5", hue)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 border-0 bg-white/60 px-2 text-base font-semibold tabular-nums"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5 text-center">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
