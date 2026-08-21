import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFood, updateFood, type UnitWeightMatch } from "@/lib/foods-api";
import {
  Sparkles,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Plus,
  Trash2,
  ShieldCheck,
  Heart,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  SOURCE_META,
  MICRO_FIELD_GROUPS,
  type FoodCategory,
  type FoodSource,
  type ServingSize,
  type NumericMicroKey,
} from "@/lib/food-database-mock";

interface NewFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALLERGENS = ["gluten", "dairy", "nuts", "eggs", "soy", "shellfish", "sesame"] as const;

// Renders only the units a matched FNDDS entry actually had data for — most foods have 1-2
// of the 4, not all 4 (see fndds-common-servings.json's sparse servingsGrams shape).
const UNIT_WEIGHT_LABELS: [keyof UnitWeightMatch["fields"], string][] = [
  ["gramsPerCup", "cup"],
  ["gramsPerTbsp", "tbsp"],
  ["gramsPerTsp", "tsp"],
  ["gramsPerPiece", "piece"],
];
function formatUnitWeightLines(fields: UnitWeightMatch["fields"]): string[] {
  return UNIT_WEIGHT_LABELS.filter(([key]) => fields[key] != null).map(
    ([key, label]) => `1 ${label} = ${fields[key]}g`,
  );
}

const STEPS = [
  { id: 1, label: "Identity" },
  { id: 2, label: "Macros / 100g" },
  { id: 3, label: "Micronutrients" },
  { id: 4, label: "Servings & tags" },
  { id: 5, label: "Review" },
];

export function NewFoodDialog({ open, onOpenChange }: NewFoodDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // identity
  const [name, setName] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<FoodCategory>("protein");
  const [source, setSource] = useState<FoodSource>("custom");

  // macros
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [fiber, setFiber] = useState(0);
  const [sugar, setSugar] = useState(0);
  const [sodium, setSodium] = useState(0);

  // micronutrients — sparse: a key is only present here once the dietitian actually types a
  // value, so unfilled fields are omitted from the save payload entirely (stay null server-side)
  // rather than being sent as 0.
  const [micros, setMicros] = useState<Partial<Record<NumericMicroKey, number>>>({});

  const updateMicro = (key: NumericMicroKey, raw: string) => {
    setMicros((prev) => {
      const next = { ...prev };
      if (raw.trim() === "") {
        delete next[key];
      } else {
        const n = Number(raw);
        if (!Number.isNaN(n)) next[key] = n;
      }
      return next;
    });
  };

  // servings & tags
  const [servings, setServings] = useState<ServingSize[]>([{ label: "1 serving", grams: 100 }]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [notes, setNotes] = useState("");

  // Set once the food has been created and the server found a unit-weight match — kept
  // separate from `saving` since the dialog stays open past save to show this result. Cleared
  // (not re-fetched) once the dietitian applies/clears/dismisses it.
  const [savedFoodId, setSavedFoodId] = useState<string | null>(null);
  const [unitWeightMatch, setUnitWeightMatch] = useState<UnitWeightMatch | null>(null);
  const [matchActionLoading, setMatchActionLoading] = useState(false);

  const computedKcal = useMemo(
    () => Math.round(protein * 4 + carbs * 4 + fat * 9),
    [protein, carbs, fat],
  );
  const kcalMismatch = kcal > 0 && Math.abs(kcal - computedKcal) > 15;

  const reset = () => {
    setStep(1);
    setName("");
    setArabicName("");
    setBrand("");
    setCategory("protein");
    setSource("custom");
    setKcal(0);
    setProtein(0);
    setCarbs(0);
    setFat(0);
    setFiber(0);
    setSugar(0);
    setSodium(0);
    setMicros({});
    setServings([{ label: "1 serving", grams: 100 }]);
    setAllergens([]);
    setVerified(false);
    setFavorite(false);
    setNotes("");
    setSavedFoodId(null);
    setUnitWeightMatch(null);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const toggleAllergen = (a: string) =>
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const addServing = () => setServings((s) => [...s, { label: "", grams: 0 }]);
  const updateServing = (i: number, patch: Partial<ServingSize>) =>
    setServings((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeServing = (i: number) => setServings((s) => s.filter((_, idx) => idx !== i));

  const useComputedKcal = () => setKcal(computedKcal);

  const handleClearMatch = async () => {
    if (!savedFoodId) return;
    setMatchActionLoading(true);
    try {
      await updateFood(savedFoodId, {
        gramsPerCup: null,
        gramsPerTbsp: null,
        gramsPerTsp: null,
        gramsPerPiece: null,
      });
      setUnitWeightMatch(null);
    } catch (err) {
      console.error("Failed to clear auto-filled unit weights:", err);
    } finally {
      setMatchActionLoading(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!savedFoodId || !unitWeightMatch) return;
    setMatchActionLoading(true);
    try {
      await updateFood(savedFoodId, unitWeightMatch.fields);
      // Converges to the same "auto-filled, here's how to undo it" state as a direct match.
      setUnitWeightMatch({ ...unitWeightMatch, tier: "match" });
    } catch (err) {
      console.error("Failed to apply suggested unit weights:", err);
    } finally {
      setMatchActionLoading(false);
    }
  };

  const handleDismissSuggestion = () => setUnitWeightMatch(null);

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && (kcal > 0 || protein + carbs + fat > 0)) ||
    step === 3 || // Micronutrients — every field optional, never blocks
    (step === 4 && servings.every((s) => s.label.trim() && s.grams > 0)) ||
    step === 5;

  const meta = CATEGORY_META[category];
  const src = SOURCE_META[source];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new food</DialogTitle>
          <DialogDescription>
            Add an ingredient or branded item with verified macros to your database.
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

        <div className="min-h-85 py-2">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="name">Food name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chicken breast, raw"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="arabic">Arabic name</Label>
                  <Input
                    id="arabic"
                    value={arabicName}
                    onChange={(e) => setArabicName(e.target.value)}
                    placeholder="اسم بالعربي"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Brand (optional)</Label>
                  <Input
                    id="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Oatly"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as FoodCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_META) as FoodCategory[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as FoodSource)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SOURCE_META) as FoodSource[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SOURCE_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Nutrition per 100 g</h3>
                  <p className="text-xs text-muted-foreground">
                    Enter values from the nutrition label or USDA reference.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={useComputedKcal}>
                  <Sparkles className="size-4" /> Use 4·4·9
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <MacroInput
                  icon={Flame}
                  label="kcal"
                  value={kcal}
                  onChange={setKcal}
                  hue="bg-amber-50"
                />
                <MacroInput
                  icon={Beef}
                  label="Protein"
                  value={protein}
                  onChange={setProtein}
                  hue="bg-rose-50"
                  suffix="g"
                />
                <MacroInput
                  icon={Wheat}
                  label="Carbs"
                  value={carbs}
                  onChange={setCarbs}
                  hue="bg-emerald-50"
                  suffix="g"
                />
                <MacroInput
                  icon={Droplet}
                  label="Fat"
                  value={fat}
                  onChange={setFat}
                  hue="bg-sky-50"
                  suffix="g"
                />
              </div>

              {kcalMismatch && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  <AlertTriangle className="size-4 shrink-0" />
                  <div>
                    Entered kcal ({kcal}) differs from computed ({computedKcal}) by 15+.
                    Double-check label values.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <FieldNum label="Fiber (g)" value={fiber} onChange={setFiber} />
                <FieldNum label="Sugar (g)" value={sugar} onChange={setSugar} />
                <FieldNum label="Sodium (mg)" value={sodium} onChange={setSodium} step={5} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Micronutrients (optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Fill in whatever you have from a lab report or label — everything here is
                  optional and defaults to no data.
                </p>
              </div>
              <Accordion type="multiple" className="rounded-md border px-3">
                {MICRO_FIELD_GROUPS.map((group) => {
                  const filledCount = group.fields.filter((f) => micros[f.key] != null).length;
                  return (
                    <AccordionItem key={group.id} value={group.id} className="last:border-b-0">
                      <AccordionTrigger>
                        <span>
                          {group.label}
                          {filledCount > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {filledCount} filled
                            </span>
                          )}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {group.fields.map((f) => (
                            <div key={f.key} className="space-y-1.5">
                              <Label className="text-xs">
                                {f.label} <span className="text-muted-foreground">({f.unit})</span>
                              </Label>
                              <Input
                                type="number"
                                value={micros[f.key] ?? ""}
                                onChange={(e) => updateMicro(f.key, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {unitWeightMatch && (
                <div
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    unitWeightMatch.tier === "match"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-amber-500/30 bg-amber-500/10",
                  )}
                >
                  {unitWeightMatch.tier === "match" ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Sparkles className="size-4 mt-0.5 text-emerald-500 shrink-0" />
                        <div>
                          <p className="font-medium">Auto-filled from USDA data</p>
                          <p className="text-xs text-muted-foreground">
                            Matched to "{unitWeightMatch.matchedDescription}" — looks right?
                          </p>
                          <ul className="mt-1 text-xs text-muted-foreground/90">
                            {formatUnitWeightLines(unitWeightMatch.fields).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={matchActionLoading}
                        onClick={handleClearMatch}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
                        <div>
                          <p className="font-medium">Possible serving-weight match</p>
                          <p className="text-xs text-muted-foreground">
                            Matched to "{unitWeightMatch.matchedDescription}" (
                            {unitWeightMatch.score}% confidence) — apply its serving weights?
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" disabled={matchActionLoading} onClick={handleApplySuggestion}>
                          Apply
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={matchActionLoading}
                          onClick={handleDismissSuggestion}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Common servings</h3>
                  <Button variant="ghost" size="sm" onClick={addServing}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {servings.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Label (e.g. 1 cup)"
                        value={s.label}
                        onChange={(e) => updateServing(i, { label: e.target.value })}
                        className="flex-1"
                      />
                      <div className="relative w-32">
                        <Input
                          type="number"
                          placeholder="grams"
                          value={s.grams || ""}
                          onChange={(e) => updateServing(i, { grams: Number(e.target.value) })}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          g
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeServing(i)}
                        disabled={servings.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-sm font-semibold">Allergens</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => {
                    const active = allergens.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() => toggleAllergen(a)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                          active
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-input bg-background hover:bg-accent",
                        )}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    <div>
                      <div className="text-sm font-medium">Mark as verified</div>
                      <div className="text-xs text-muted-foreground">Trusted for client plans</div>
                    </div>
                  </div>
                  <Switch checked={verified} onCheckedChange={setVerified} />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Heart className={cn("size-4", favorite && "fill-rose-500 text-rose-500")} />
                    <div>
                      <div className="text-sm font-medium">Add to favorites</div>
                      <div className="text-xs text-muted-foreground">Pin to quick-access</div>
                    </div>
                  </div>
                  <Switch checked={favorite} onCheckedChange={setFavorite} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Dietitian note (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Clinical context, swap suggestions, etc."
                    rows={2}
                  />
                </div>
              </section>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Review</h3>
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 items-center justify-center rounded-md bg-muted text-2xl">
                    {meta.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{name || "Untitled food"}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {brand && <span>{brand}</span>}
                      {arabicName && <span>· {arabicName}</span>}
                      <span>· {meta.label}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className={src.color}>
                        {src.label}
                      </Badge>
                      {verified && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          <ShieldCheck className="size-3" /> Verified
                        </Badge>
                      )}
                      {favorite && (
                        <Badge variant="secondary" className="bg-rose-100 text-rose-700">
                          <Heart className="size-3" /> Favorite
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <StatBox label="kcal" value={kcal} />
                  <StatBox label="Protein" value={`${protein}g`} />
                  <StatBox label="Carbs" value={`${carbs}g`} />
                  <StatBox label="Fat" value={`${fat}g`} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {servings.length} serving size{servings.length !== 1 && "s"} ·{" "}
                  {allergens.length > 0 ? `${allergens.length} allergen(s)` : "no allergens"}
                </div>
              </div>

              {/* Only the fields actually filled in — not all ~44, which would mostly be blank */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Micronutrients</h3>
                {Object.keys(micros).length === 0 ? (
                  <p className="text-xs text-muted-foreground">None entered.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {MICRO_FIELD_GROUPS.flatMap((group) =>
                      group.fields
                        .filter((f) => micros[f.key] != null)
                        .map((f) => (
                          <Badge key={f.key} variant="secondary">
                            {f.label}: {micros[f.key]}
                            {f.unit}
                          </Badge>
                        )),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {savedFoodId ? (
            <>
              <div />
              <Button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["foods"] });
                  handleClose(false);
                }}
              >
                <CheckCircle2 className="size-4" /> Done
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
              {step < STEPS.length ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                  Next <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const { food, unitWeightMatch: match } = await createFood({
                        name: name.trim(),
                        arabicName: arabicName.trim() || undefined,
                        brand: brand.trim() || undefined,
                        category,
                        source,
                        kcal,
                        protein,
                        carbs,
                        fat,
                        fiber,
                        sugar: sugar || null,
                        sodium: sodium || null,
                        servingSize: servings[0]?.grams || 100,
                        servingUnit: "g",
                        micros,
                      });
                      queryClient.invalidateQueries({ queryKey: ["foods"] });
                      if (match) {
                        // Stay open on the Servings & tags step so the dietitian can review the
                        // auto-fill/suggestion right next to the serving-weight fields it
                        // affects, instead of it flashing by in a generic confirmation.
                        setSavedFoodId(food.id);
                        setUnitWeightMatch(match);
                        setStep(4);
                      } else {
                        handleClose(false);
                      }
                    } catch (err) {
                      console.error("Failed to create food:", err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <CheckCircle2 className="size-4" /> {saving ? "Saving…" : "Save food"}
                </Button>
              )}
            </>
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

function FieldNum({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
