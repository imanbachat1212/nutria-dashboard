import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createMeal, updateMeal, getMeal, type PhotoItem } from "@/lib/meals-api";
import { fetchFoods } from "@/lib/foods-api";
import { uploadMedia } from "@/lib/api";
import {
  Plus,
  Trash2,
  Calculator,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Leaf,
  Clock,
  Users,
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Upload,
  Search,
  Loader2,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
  CATEGORY_META,
  DIET_LABEL,
  ALLERGEN_LABEL,
  type RecipeCategory,
  type RecipeCuisine,
  type DietTag,
  type Allergen,
} from "@/lib/meal-library-mock";

type Unit = "g" | "ml" | "cup" | "tbsp" | "tsp" | "oz" | "piece";
const UNITS: Unit[] = ["g", "ml", "cup", "tbsp", "tsp", "oz", "piece"];

const MAX_PHOTOS = 6;

const UNIT_TO_GRAMS: Record<Unit, number> = {
  g: 1,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  oz: 28.35,
  // TODO: unit conversion — "piece" needs per-food gram weights
  piece: 50,
};

interface IngredientMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface IngredientDraft {
  foodId: string;
  name: string;
  quantity: number | "";
  unit: Unit;
  per100g: IngredientMacros | null;
}

interface NewRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
}

const CATEGORIES: RecipeCategory[] = ["breakfast", "lunch", "dinner", "snack", "dessert", "drink"];
const CUISINES: RecipeCuisine[] = [
  "lebanese",
  "mediterranean",
  "levantine",
  "international",
  "asian",
  "italian",
];
const DIETS: DietTag[] = [
  "vegan",
  "vegetarian",
  "high-protein",
  "low-carb",
  "keto",
  "gluten-free",
  "dairy-free",
  "pcos-friendly",
  "ramadan",
];
const ALLERGENS: Allergen[] = ["gluten", "dairy", "nuts", "eggs", "soy", "shellfish", "sesame"];

const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Ingredients" },
  { id: 3, label: "Method" },
  { id: 4, label: "Tags & macros" },
  { id: 5, label: "Review" },
];

export function NewRecipeDialog({ open, onOpenChange, editId }: NewRecipeDialogProps) {
  const isEdit = !!editId;
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [category, setCategory] = useState<RecipeCategory>("lunch");
  const [cuisine, setCuisine] = useState<RecipeCuisine>("lebanese");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prepMin, setPrepMin] = useState(10);
  const [cookMin, setCookMin] = useState(15);
  const [servings, setServings] = useState(1);

  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { foodId: "", name: "", quantity: "", unit: "g", per100g: null },
  ]);

  const [steps, setMethodSteps] = useState<string[]>([""]);

  const [diets, setDiets] = useState<DietTag[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setStep(1);
    setName("");
    setArabicName("");
    setCategory("lunch");
    setCuisine("lebanese");
    setPhotos([]);
    setPrepMin(10);
    setCookMin(15);
    setServings(1);
    setIngredients([{ foodId: "", name: "", quantity: "", unit: "g", per100g: null }]);
    setMethodSteps([""]);
    setDiets([]);
    setAllergens([]);
    setNotes("");
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const { data: editData } = useQuery({
    queryKey: ["meal", editId],
    queryFn: () => getMeal(editId as string),
    enabled: open && isEdit,
  });
  const formReady = !isEdit || !!editData;

  useEffect(() => {
    if (!open || !isEdit || !editData) return;
    setName(editData.name);
    setArabicName(editData.nameAr || "");
    setCategory(editData.category);
    setCuisine(editData.cuisine);
    setPhotos(editData.photos);
    setPrepMin(editData.prepTime);
    setCookMin(editData.cookTime);
    setServings(editData.servings);
    setIngredients(
      editData.ingredients.length
        ? editData.ingredients.map((i) => ({ ...i, unit: (i.unit as Unit) || "g" }))
        : [{ foodId: "", name: "", quantity: "", unit: "g", per100g: null }],
    );
    setMethodSteps(editData.steps.length ? editData.steps : [""]);
    setDiets(editData.dietTags as DietTag[]);
    setAllergens(editData.allergens as Allergen[]);
    setNotes(editData.notes || "");
  }, [open, isEdit, editData]);

  const validIngredients = ingredients.filter(
    (i) => i.foodId && i.name.trim() && typeof i.quantity === "number" && i.quantity > 0,
  );
  const validSteps = steps.filter((s) => s.trim());

  const liveMacros = useMemo(() => {
    let kcal = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0;
    let matched = 0;
    for (const ing of validIngredients) {
      if (!ing.per100g) continue;
      matched++;
      const qty = typeof ing.quantity === "number" ? ing.quantity : 0;
      const grams = qty * (UNIT_TO_GRAMS[ing.unit] ?? 1);
      const factor = grams / 100;
      kcal += ing.per100g.kcal * factor;
      protein += ing.per100g.protein * factor;
      carbs += ing.per100g.carbs * factor;
      fat += ing.per100g.fat * factor;
      fiber += ing.per100g.fiber * factor;
    }
    const s = Math.max(1, servings);
    return {
      total: {
        kcal: Math.round(kcal),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        fiber: Math.round(fiber),
      },
      perServing: {
        kcal: Math.round(kcal / s),
        protein: Math.round(protein / s),
        carbs: Math.round(carbs / s),
        fat: Math.round(fat / s),
        fiber: Math.round(fiber / s),
      },
      matched,
      count: validIngredients.length,
    };
  }, [validIngredients, servings]);

  const canAdvance = useMemo(() => {
    if (step === 1) return name.trim().length > 1;
    if (step === 2) return validIngredients.length > 0;
    return true;
  }, [step, name, validIngredients]);

  const totalTime = prepMin + cookMin;
  const meta = CATEGORY_META[category];
  const ps = liveMacros.perServing;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-w-3xl p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ChefHat className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="font-display text-xl">
                {isEdit ? "Edit recipe" : "New recipe"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Step {step} of {STEPS.length} · {STEPS[step - 1].label}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s.id <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {!formReady ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading recipe…
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Recipe name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Grilled chicken tabbouleh"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Arabic name{" "}
                        <span className="text-muted-foreground text-[10px]">optional</span>
                      </Label>
                      <Input
                        value={arabicName}
                        onChange={(e) => setArabicName(e.target.value)}
                        placeholder="تبولة دجاج"
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Servings</Label>
                      <Input
                        type="number"
                        min={1}
                        value={servings}
                        onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select
                        value={category}
                        onValueChange={(v) => setCategory(v as RecipeCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cuisine</Label>
                      <Select value={cuisine} onValueChange={(v) => setCuisine(v as RecipeCuisine)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUISINES.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prep time (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={prepMin}
                        onChange={(e) => setPrepMin(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cook time (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={cookMin}
                        onChange={(e) => setCookMin(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" /> Photos{" "}
                        <span className="text-muted-foreground text-[10px] font-normal">
                          optional · up to {MAX_PHOTOS}
                        </span>
                      </Label>
                      {photos.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          First photo is the cover shown on the recipe card
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, idx) => (
                        <div
                          key={p.key}
                          className="h-24 rounded-lg overflow-hidden relative group border"
                        >
                          <img
                            src={p.url}
                            alt={idx === 0 ? "Cover" : `Photo ${idx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                              Cover
                            </span>
                          )}
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos((prev) => [
                                  prev[idx],
                                  ...prev.slice(0, idx),
                                  ...prev.slice(idx + 1),
                                ])
                              }
                              title="Set as cover"
                              className="absolute bottom-1 left-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity"
                            >
                              <Star className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-24 rounded-lg flex flex-col items-center justify-center gap-1 bg-muted border border-dashed border-border hover:bg-muted/70 disabled:opacity-50 transition-colors"
                        >
                          {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="h-5 w-5 text-muted-foreground/70" />
                              <span className="text-[10px] text-muted-foreground">
                                {photos.length === 0 ? "Add photos" : "Add more"}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length === 0) return;
                        const room = MAX_PHOTOS - photos.length;
                        const toUpload = files.slice(0, room);
                        setUploading(true);
                        try {
                          const uploaded = await Promise.all(toUpload.map((f) => uploadMedia(f)));
                          setPhotos((prev) => [...prev, ...uploaded]);
                        } catch (err) {
                          console.error("Upload failed:", err);
                        } finally {
                          setUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="sticky top-0 z-10 -mt-5 -mx-6 bg-background px-6 pt-5 pb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Ingredients</div>
                      <div className="text-xs text-muted-foreground">
                        For {servings} serving{servings > 1 ? "s" : ""}. Search from your food
                        database.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setIngredients([
                          ...ingredients,
                          { foodId: "", name: "", quantity: "", unit: "g", per100g: null },
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <FoodSearchInput
                          value={ing.name}
                          foodId={ing.foodId}
                          onSelect={(id, label, macros) => {
                            const copy = [...ingredients];
                            copy[idx] = { ...copy[idx], foodId: id, name: label, per100g: macros };
                            setIngredients(copy);
                          }}
                          onChange={(val) => {
                            const copy = [...ingredients];
                            copy[idx] = { ...copy[idx], name: val, foodId: "", per100g: null };
                            setIngredients(copy);
                          }}
                        />
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="150"
                          value={ing.quantity}
                          onChange={(e) => {
                            const copy = [...ingredients];
                            const v = e.target.value;
                            copy[idx] = {
                              ...copy[idx],
                              quantity: v === "" ? "" : Math.max(0, Number(v)),
                            };
                            setIngredients(copy);
                          }}
                          className="w-20"
                        />
                        <Select
                          value={ing.unit}
                          onValueChange={(v) => {
                            const copy = [...ingredients];
                            copy[idx] = { ...copy[idx], unit: v as Unit };
                            setIngredients(copy);
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                          disabled={ingredients.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {liveMacros.matched > 0 && (
                    <Card className="p-3 bg-accent/30 text-xs">
                      <div className="flex items-center gap-1.5 mb-1.5 font-semibold text-foreground">
                        <Calculator className="h-3.5 w-3.5 text-primary" />
                        Live preview ({liveMacros.matched}/{liveMacros.count} matched)
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-center">
                        <MacroPrev label="kcal" value={ps.kcal} />
                        <MacroPrev label="P" value={`${ps.protein}g`} />
                        <MacroPrev label="C" value={`${ps.carbs}g`} />
                        <MacroPrev label="F" value={`${ps.fat}g`} />
                        <MacroPrev label="Fib" value={`${ps.fiber}g`} />
                      </div>
                      {servings > 1 && (
                        <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
                          Per serving (total: {liveMacros.total.kcal} kcal)
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        Method{" "}
                        <span className="text-muted-foreground text-[10px] font-normal">
                          optional
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        One concise step per line.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMethodSteps([...steps, ""])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add step
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {steps.map((s, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-2">
                          {idx + 1}
                        </span>
                        <Textarea
                          value={s}
                          onChange={(e) => {
                            const c = [...steps];
                            c[idx] = e.target.value;
                            setMethodSteps(c);
                          }}
                          placeholder="Describe this step…"
                          className="flex-1 min-h-15"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 mt-1"
                          onClick={() => setMethodSteps(steps.filter((_, i) => i !== idx))}
                          disabled={steps.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  {/* Live macros */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-amber-600" />
                        Macros per serving
                      </Label>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {liveMacros.matched}/{liveMacros.count} ingredients matched
                      </Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <MacroBlock
                        icon={Flame}
                        label="kcal"
                        value={ps.kcal}
                        tone="text-amber-600"
                        bg="bg-amber-50"
                      />
                      <MacroBlock
                        icon={Beef}
                        label="Protein"
                        value={`${ps.protein}g`}
                        tone="text-rose-600"
                        bg="bg-rose-50"
                      />
                      <MacroBlock
                        icon={Wheat}
                        label="Carbs"
                        value={`${ps.carbs}g`}
                        tone="text-orange-600"
                        bg="bg-orange-50"
                      />
                      <MacroBlock
                        icon={Droplet}
                        label="Fat"
                        value={`${ps.fat}g`}
                        tone="text-sky-600"
                        bg="bg-sky-50"
                      />
                      <MacroBlock
                        icon={Leaf}
                        label="Fiber"
                        value={`${ps.fiber}g`}
                        tone="text-emerald-600"
                        bg="bg-emerald-50"
                      />
                    </div>
                    {servings > 1 && (
                      <div className="text-[11px] text-muted-foreground text-center">
                        Total recipe: {liveMacros.total.kcal} kcal · {liveMacros.total.protein}g P ·{" "}
                        {liveMacros.total.carbs}g C · {liveMacros.total.fat}g F
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Diet tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DIETS.map((d) => {
                        const active = diets.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() =>
                              setDiets((prev) =>
                                prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                              )
                            }
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted",
                            )}
                          >
                            {DIET_LABEL[d]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Allergens
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALLERGENS.map((a) => {
                        const active = allergens.includes(a);
                        return (
                          <button
                            key={a}
                            onClick={() =>
                              setAllergens((prev) =>
                                prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                              )
                            }
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs border transition-colors",
                              active
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-background border-border hover:bg-muted",
                            )}
                          >
                            {ALLERGEN_LABEL[a]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Dietitian note{" "}
                      <span className="text-muted-foreground text-[10px]">optional</span>
                    </Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="When to use, swap ideas, client tips…"
                      className="min-h-15"
                    />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <Card className="overflow-hidden">
                    <div
                      className={cn(
                        "h-32 flex items-center justify-center relative overflow-hidden",
                        photos[0] ? "" : "bg-muted",
                      )}
                    >
                      {photos[0] ? (
                        <img
                          src={photos[0].url}
                          alt="Cover"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      )}
                      {photos.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="absolute bottom-2 right-2 gap-1 bg-black/60 text-[10px] text-white"
                        >
                          <ImageIcon className="h-2.5 w-2.5" />
                          {photos.length} photos
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {meta.emoji} {category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {cuisine}
                          </Badge>
                        </div>
                        <h3 className="font-display text-lg font-semibold">
                          {name || "Untitled recipe"}
                        </h3>
                        {arabicName && (
                          <div className="text-sm text-muted-foreground" dir="rtl">
                            {arabicName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {totalTime} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {servings}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-center">
                        <ReviewMacro label="kcal" value={ps.kcal} tone="text-amber-600" />
                        <ReviewMacro label="P" value={`${ps.protein}g`} tone="text-rose-600" />
                        <ReviewMacro label="C" value={`${ps.carbs}g`} tone="text-orange-600" />
                        <ReviewMacro label="F" value={`${ps.fat}g`} tone="text-sky-600" />
                        <ReviewMacro label="Fib" value={`${ps.fiber}g`} tone="text-emerald-600" />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {diets.map((d) => (
                          <Badge key={d} variant="secondary" className="text-[10px]">
                            {DIET_LABEL[d]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Card className="p-3">
                      <div className="font-semibold mb-1.5">
                        Ingredients · {validIngredients.length}
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {validIngredients.slice(0, 5).map((i, idx) => (
                          <li key={idx} className="truncate">
                            • {i.name} — {i.quantity} {i.unit}
                          </li>
                        ))}
                        {validIngredients.length > 5 && (
                          <li className="text-[10px]">+ {validIngredients.length - 5} more</li>
                        )}
                      </ul>
                    </Card>
                    <Card className="p-3">
                      <div className="font-semibold mb-1.5">Method · {validSteps.length} steps</div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {validSteps.slice(0, 3).map((s, idx) => (
                          <li key={idx} className="truncate">
                            {idx + 1}. {s}
                          </li>
                        ))}
                        {validSteps.length > 3 && (
                          <li className="text-[10px]">+ {validSteps.length - 3} more</li>
                        )}
                      </ul>
                    </Card>
                  </div>
                  {allergens.length > 0 && (
                    <Card className="p-3 border-amber-200 bg-amber-50 text-xs">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle className="h-3 w-3" />
                        Contains: {allergens.map((a) => ALLERGEN_LABEL[a]).join(", ")}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 1 ? close() : setStep(step - 1))}
          >
            {step === 1 ? <X className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance || !formReady}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving || !formReady}
              onClick={async () => {
                setSaving(true);
                try {
                  const payload = {
                    name: name.trim(),
                    nameAr: arabicName.trim() || undefined,
                    category,
                    cuisine,
                    servings,
                    prepTime: prepMin,
                    cookTime: cookMin,
                    dietTags: diets,
                    allergens,
                    ingredients: validIngredients.map((i) => ({
                      food: i.foodId,
                      name: i.name,
                      quantity: typeof i.quantity === "number" ? i.quantity : undefined,
                      unit: i.unit,
                    })),
                    steps: validSteps,
                    notes: notes.trim() || undefined,
                    photos,
                  };
                  if (isEdit && editId) {
                    await updateMeal(editId, payload);
                    queryClient.invalidateQueries({ queryKey: ["meal", editId] });
                  } else {
                    await createMeal(payload);
                  }
                  queryClient.invalidateQueries({ queryKey: ["meals"] });
                  close();
                } catch (err) {
                  console.error(
                    isEdit ? "Failed to update recipe:" : "Failed to create recipe:",
                    err,
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving…" : "Save recipe"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Macro display blocks ── */

function MacroBlock({
  icon: Icon,
  label,
  value,
  tone,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: string;
  bg: string;
}) {
  return (
    <div className={cn("rounded-md p-2.5 text-center", bg)}>
      <Icon className={cn("h-3.5 w-3.5 mx-auto", tone)} />
      <div className={cn("text-base font-semibold mt-1 tabular-nums", tone)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function MacroPrev({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-background border px-1.5 py-1">
      <div className="text-xs font-semibold tabular-nums">{value}</div>
      <div className="text-[8px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function ReviewMacro({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-md bg-muted/40 py-1.5">
      <div className={cn("text-sm font-semibold", tone)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

/* ── Searchable food dropdown (portaled to body) ── */

interface FoodSearchResult {
  id: string;
  name: string;
  arabicName?: string;
  category: string;
  macros: IngredientMacros;
}

function FoodSearchInput({
  value,
  foodId,
  onSelect,
  onChange,
}: {
  value: string;
  foodId: string;
  onSelect: (id: string, label: string, macros: IngredientMacros) => void;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectingRef = useRef(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchFoods({ search: q, limit: 8 });
      setResults(
        res.foods.map((f) => ({
          id: f.id,
          name: f.name,
          arabicName: f.arabicName,
          category: f.category,
          macros: f.macros,
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleType = (val: string) => {
    onChange(val);
    setQuery(val);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const pick = (r: FoodSearchResult) => {
    selectingRef.current = true;
    onSelect(r.id, r.name, r.macros);
    setQuery(r.name);
    setOpen(false);
    setResults([]);
    setTimeout(() => {
      selectingRef.current = false;
    }, 100);
  };

  const showResults = open && (results.length > 0 || (query.length >= 2 && !loading));

  return (
    <div className="relative flex-1" style={{ overflow: "visible" }}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search food…"
          value={foodId ? value : query || value}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!selectingRef.current) setOpen(false);
            }, 200);
          }}
          className={cn("pl-7", foodId && "border-emerald-300 bg-emerald-50/50")}
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {showResults && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg max-h-56 overflow-y-auto"
          style={{ zIndex: 9999 }}
        >
          {results.length > 0 ? (
            results.map((r) => (
              <div
                key={r.id}
                role="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted cursor-pointer flex items-center justify-between border-b last:border-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(r);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {r.arabicName && <span>{r.arabicName}</span>}
                    <span>
                      {r.macros.kcal} kcal · P{r.macros.protein} C{r.macros.carbs} F{r.macros.fat}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] capitalize shrink-0 ml-2">
                  {r.category}
                </Badge>
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-muted-foreground text-center">
              No foods found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
