import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
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
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
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
  type ClientGoal,
  type ClientMacros,
  type LifeStage,
  DRI_VITAMIN_FIELDS,
  DRI_MINERAL_FIELDS,
} from "@/lib/clients-mock";
import { getDriTargets } from "@/lib/dri";
import { fetchDietaryPreferences, fetchAllergies, fetchMedicalHistory } from "@/lib/settings-api";
import {
  fetchClient,
  createClient,
  updateClient,
  type CreatePayload,
} from "@/lib/clients-api";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the dialog loads and edits this existing client (via updateClient) instead of
  // creating a new one — same dual create/edit pattern as new-food-dialog.tsx's editFoodId.
  editClientId?: string | null;
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

export function NewClientDialog({ open, onOpenChange, editClientId }: NewClientDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editClientId;
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [step, setStep] = useState(1);

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [status, setStatus] = useState<ClientStatus>("active");

  // Body & goals
  const [age, setAge] = useState("");
  // Edit mode only — the age/dateOfBirth exactly as loaded, so a save that leaves age untouched
  // can tell clients-api.ts's toAPIBody to send the original dateOfBirth back unchanged instead
  // of recomputing (and drifting) it from age. Stay undefined for create mode.
  const [originalAge, setOriginalAge] = useState<number | undefined>(undefined);
  const [originalDateOfBirth, setOriginalDateOfBirth] = useState<string | undefined>(undefined);
  const [sex, setSex] = useState<"F" | "M">("F");
  const [lifeStage, setLifeStage] = useState<LifeStage>("none");
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
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  // Allergies/medicalHistory: the full set of selected values for this client — both
  // predefined-list picks and one-off "Other" custom entries live in the same array, since
  // that's the exact shape the backend stores. Which chips render as "predefined pill" vs
  // "custom chip" is derived at render time (PillMultiSelectWithOther below), not tracked here.
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);

  const { data: dietaryPreferenceOptions = [] } = useQuery({
    queryKey: ["settings", "dietary-preferences"],
    queryFn: fetchDietaryPreferences,
  });
  const { data: allergyOptions = [] } = useQuery({
    queryKey: ["settings", "allergies"],
    queryFn: fetchAllergies,
  });
  const { data: medicalHistoryOptions = [] } = useQuery({
    queryKey: ["settings", "medical-history"],
    queryFn: fetchMedicalHistory,
  });

  const toggleDietaryPref = (pref: string) => {
    setDietaryPrefs((cur) => (cur.includes(pref) ? cur.filter((p) => p !== pref) : [...cur, pref]));
  };

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

  // lifeStage only applies to female clients — reset it if sex is switched to male so a stale
  // pregnant/lactating value can't silently linger unseen.
  useEffect(() => {
    if (sex === "M" && lifeStage !== "none") setLifeStage("none");
  }, [sex, lifeStage]);

  // Preview only — same client-side-duplicate pattern as bmr/tdee/computedTargets above. The
  // backend recomputes this authoritatively via computeDriTargetsIfEligible on save.
  const driPreview = useMemo(() => {
    if (!ageN) return null;
    return getDriTargets(ageN, sex === "M" ? "male" : "female", lifeStage);
  }, [ageN, sex, lifeStage]);

  // Edit mode: load the client's current data instead of starting blank. `phone` is set from
  // the raw stored string as-is — PhoneInput is designed to accept an unparseable legacy value
  // without crashing (it just won't show a recognized flag/format until corrected), which is
  // exactly the case for the handful of known-bad legacy numbers already in the database.
  // `overrideTargets` is set true so the auto-sync-to-computed-formula effect above doesn't
  // immediately clobber the client's actual loaded targets the moment age/height/weight are
  // prefilled in the same tick.
  useEffect(() => {
    if (!open || !editClientId) return;
    let cancelled = false;
    setLoadingEdit(true);
    fetchClient(editClientId)
      .then((c) => {
        if (cancelled) return;
        setName(c.name);
        setPhone(c.phone);
        setEmail(c.email ?? "");
        setServiceTypes(c.serviceType);
        setStatus(c.status);
        setAge(c.age ? String(c.age) : "");
        setOriginalAge(c.age);
        setOriginalDateOfBirth(c.dateOfBirth);
        setSex(c.sex);
        setLifeStage(c.lifeStage ?? "none");
        setHeightCm(c.heightCm ? String(c.heightCm) : "");
        setWeightKg(c.weightKg ? String(c.weightKg) : "");
        setStartWeightKg(c.startWeightKg ? String(c.startWeightKg) : "");
        setTargetWeightKg(c.targetWeightKg ? String(c.targetWeightKg) : "");
        setActivityFactor(c.activityFactor);
        setGoalType(c.goal.type);
        setTargetDate(c.goal.targetDate ?? "");
        // toClientRecord substitutes "—" for display when occupation is unset — don't let that
        // placeholder round-trip back into the field as if it were real data.
        setOccupation(c.occupation === "—" ? "" : c.occupation);
        setSleepHours(c.sleepHours ? String(c.sleepHours) : "");
        setDietaryPrefs(c.dietaryPrefs);
        // c.allergies/c.medicalHistory are already normalized (split + deduped) by
        // clients-api.ts's toClientRecord, including legacy string/malformed-array data — no
        // further parsing needed here.
        setAllergies(c.allergies);
        setMedicalHistory(c.medicalHistory);
        setTargets(c.targets);
        setOverrideTargets(true);
        setStep(1);
      })
      .catch((err) => console.error("Failed to load client for editing:", err))
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editClientId]);

  const reset = () => {
    setStep(1);
    setName("");
    setPhone("");
    setEmail("");
    setServiceTypes([]);
    setStatus("active");
    setAge("");
    setOriginalAge(undefined);
    setOriginalDateOfBirth(undefined);
    setSex("F");
    setLifeStage("none");
    setHeightCm("");
    setWeightKg("");
    setStartWeightKg("");
    setTargetWeightKg("");
    setActivityFactor(1.375);
    setGoalType("weight-loss");
    setTargetDate("");
    setOccupation("");
    setSleepHours("");
    setDietaryPrefs([]);
    setAllergies([]);
    setMedicalHistory([]);
    setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    setOverrideTargets(false);
  };

  // Create mode deliberately does NOT reset on close via X/Cancel/Escape — whatever was typed
  // should still be there if the dietitian reopens "New client" without having saved. Edit mode
  // is different: leaving stale prefilled-from-client-A data sitting in state would otherwise
  // leak into whatever opens next — a subsequent "New client" (editClientId becomes null, so
  // the fetch effect above never fires to overwrite it) would silently start pre-filled with
  // the previous client's data instead of blank. So edit-mode closes always reset.
  const handleClose = (o: boolean) => {
    if (!o && isEdit) reset();
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

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const payload: CreatePayload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      serviceType: serviceTypes,
      status,
      age: ageN,
      originalAge,
      originalDateOfBirth,
      sex,
      lifeStage,
      heightCm: heightN,
      weightKg: weightN,
      startWeightKg: startWeightN,
      targetWeightKg: targetWeightN,
      activityFactor,
      goalType,
      occupation: occupation.trim(),
      sleepHours: sleepN,
      dietaryPrefs,
      allergies,
      medicalHistory,
      // Matches the heuristic this form has always used (previously computed one level up, in
      // clients.index.tsx's onCreate wiring): body metrics filled in => bmr/calories are
      // computed => targets get sent as "manual" rather than left for the backend to compute.
      // In practice this has always been true for any client created through this dialog
      // (step 2 requires age/height/weight before you can advance), so applying it identically
      // on edit doesn't change anything a dietitian would see in this UI — there's no visible
      // auto-vs-manual indicator anywhere in this form or the client detail page.
      overrideTargets: targets.calories !== 0 && bmr !== 0,
      targets,
    };
    setSaving(true);
    try {
      if (isEdit && editClientId) {
        await updateClient(editClientId, payload);
      } else {
        await createClient(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      // Only the success path resets the form — see handleClose's comment.
      reset();
      handleClose(false);
    } catch (err) {
      console.error(isEdit ? "Failed to save client changes:" : "Failed to create client:", err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't save client — please check the form and try again",
      );
    } finally {
      setSaving(false);
    }
  };

  const canAdvance =
    (step === 1 && name.trim().length > 1 && isValidPhoneNumber(phone)) ||
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
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this client's profile, anthropometrics, goals, and macro targets."
              : "Add a new client record with anthropometrics, goals, and macro targets."}
          </DialogDescription>
        </DialogHeader>

        {loadingEdit ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
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
                  <PhoneInput
                    id="phone"
                    value={phone}
                    onChange={setPhone}
                    invalid={phone.trim() !== "" && !isValidPhoneNumber(phone)}
                  />
                  {phone.trim() !== "" && !isValidPhoneNumber(phone) && (
                    <p className="text-xs text-destructive">
                      Enter a valid number for the selected country.
                    </p>
                  )}
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

              {sex === "F" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Life stage</Label>
                    <Select
                      value={lifeStage}
                      onValueChange={(v) => setLifeStage(v as LifeStage)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="pregnant">Pregnant</SelectItem>
                        <SelectItem value="lactating">Lactating</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Adjusts DRI vitamin/mineral targets for pregnancy or lactation.
                    </p>
                  </div>
                </div>
              )}

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
                <Label className="flex items-center gap-1.5">
                  <Apple className="size-4" /> Dietary preferences
                  {dietaryPrefs.length === 0 && (
                    <span className="text-xs font-normal text-muted-foreground">(none selected)</span>
                  )}
                </Label>
                {dietaryPreferenceOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Loading options…</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {dietaryPreferenceOptions.map((pref) => {
                      const active = dietaryPrefs.includes(pref);
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => toggleDietaryPref(pref)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {pref}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <PillMultiSelectWithOther
                label="Allergies"
                icon={AlertTriangle}
                options={allergyOptions}
                optionsLoading={allergyOptions.length === 0}
                selected={allergies}
                onChange={setAllergies}
                otherPlaceholder="Other allergy…"
              />

              <PillMultiSelectWithOther
                label="Medical history"
                icon={Stethoscope}
                options={medicalHistoryOptions}
                optionsLoading={medicalHistoryOptions.length === 0}
                selected={medicalHistory}
                onChange={setMedicalHistory}
                otherPlaceholder="Other condition…"
              />
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

              <div>
                <h3 className="text-sm font-semibold">DRI targets</h3>
                <p className="text-xs text-muted-foreground">
                  Vitamin/mineral targets from NAM Dietary Reference Intakes, based on age, sex
                  {sex === "F" && lifeStage !== "none" ? ", and life stage" : ""}. Read-only for
                  now — recomputes automatically if age/sex/life stage change later.
                </p>
                {!driPreview ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enter age to preview DRI targets.
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Vitamins
                      </div>
                      <div className="space-y-0.5">
                        {DRI_VITAMIN_FIELDS.map((f) => (
                          <DriRow key={f.key} label={f.label} value={driPreview[f.key]} unit={f.unit} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Minerals
                      </div>
                      <div className="space-y-0.5">
                        {DRI_MINERAL_FIELDS.map((f) => (
                          <DriRow key={f.key} label={f.label} value={driPreview[f.key]} unit={f.unit} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
              <CheckCircle2 className="size-4" />{" "}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save client"}
            </Button>
          )}
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Same pill multi-select pattern as the (inline, not extracted) Dietary preferences block above,
// plus a lightweight "Other" entry: a dietitian can type a one-off value specific to this one
// client — an uncommon allergy, an unlisted condition — without needing to add it to the shared
// Settings list first. `selected` is the full save-ready array (predefined picks and custom
// entries together, exactly what the backend stores); which chips are "predefined" vs "custom"
// is derived here at render time by checking membership in `options`, not tracked separately.
function PillMultiSelectWithOther({
  label,
  icon: Icon,
  options,
  optionsLoading,
  selected,
  onChange,
  otherPlaceholder,
}: {
  label: string;
  icon: React.ElementType;
  options: string[];
  optionsLoading: boolean;
  selected: string[];
  onChange: (next: string[]) => void;
  otherPlaceholder: string;
}) {
  const [otherValue, setOtherValue] = useState("");

  const isSelected = (value: string) =>
    selected.some((s) => s.toLowerCase() === value.toLowerCase());

  const toggleOption = (option: string) => {
    onChange(
      isSelected(option)
        ? selected.filter((s) => s.toLowerCase() !== option.toLowerCase())
        : [...selected, option],
    );
  };

  const removeCustom = (value: string) => {
    onChange(selected.filter((s) => s !== value));
  };

  const addOther = () => {
    const trimmed = otherValue.trim();
    if (!trimmed || isSelected(trimmed)) {
      setOtherValue("");
      return;
    }
    onChange([...selected, trimmed]);
    setOtherValue("");
  };

  // Anything selected that isn't (case-insensitively) one of the predefined options is a
  // custom, client-specific entry — rendered as its own removable chip, visually distinct from
  // the toggleable predefined pills.
  const customChips = selected.filter(
    (s) => !options.some((o) => o.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="size-4" /> {label}
        {selected.length === 0 && (
          <span className="text-xs font-normal text-muted-foreground">(none selected)</span>
        )}
      </Label>
      {optionsLoading ? (
        <p className="text-xs text-muted-foreground">Loading options…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const active = isSelected(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleOption(option)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {option}
              </button>
            );
          })}
          {customChips.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeCustom(value)}
              title="Custom entry for this client — click to remove"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 bg-primary-soft/60 px-3 py-1 text-xs font-medium text-primary"
            >
              {value}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          value={otherValue}
          onChange={(e) => setOtherValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOther();
            }
          }}
          placeholder={otherPlaceholder}
          className="h-7 max-w-50 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={addOther}
        >
          <Plus className="size-3" /> Add
        </Button>
      </div>
    </div>
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

function DriRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | undefined;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {value == null ? "—" : `${value} ${unit}`}
      </span>
    </div>
  );
}
