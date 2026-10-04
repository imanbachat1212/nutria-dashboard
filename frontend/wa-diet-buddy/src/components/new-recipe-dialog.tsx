import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMeal,
  updateMeal,
  getMeal,
  type CreateMealIngredient,
  type PhotoItem,
} from "@/lib/meals-api";
import { fetchFoods } from "@/lib/foods-api";
import {
  searchUsda,
  importUsdaFood,
  fetchImportedUsdaFdcIds,
  USDA_DATA_TYPES,
  type UsdaDataType,
  type UsdaSearchResult,
} from "@/lib/usda-api";
import { USDA_DATA_TYPE_LABEL } from "@/lib/food-database-mock";
import { toast } from "sonner";
import type { UnitWeights, ServingSize } from "@/lib/food-database-mock";
import { gramsPerUnitForFood, realGramsPerUnit } from "@/lib/unit-conversion";
import { resolveMeasure, pickInitialMeasureSelection, formatGramEquivalent } from "@/lib/measure-options";
import { MeasureSelect } from "@/components/measure-select";
import { uploadMedia } from "@/lib/api";
import {
  importedFoodToItem,
  type ImportedRecipe,
  type SiteNutrition,
} from "@/lib/recipe-import-api";
import { fetchDietaryPreferences, fetchAllergies } from "@/lib/settings-api";
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
  GripVertical,
  Link as LinkIcon,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  type RecipeCategory,
  type RecipeCuisine,
  type DietTag,
} from "@/lib/meal-library-mock";

const MAX_PHOTOS = 6;

// cup/tbsp/tsp/piece/ml vary by food density (1 cup of oats != 1 cup of spinach, 1 ml of
// honey != 1 ml of skim milk) — only g/oz are always exact regardless of which food.
const UNIT_TO_FOOD_FIELD: Partial<Record<string, keyof UnitWeights>> = {
  cup: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
  piece: "piece",
  ml: "ml",
};

// This dialog used to keep its own copy of gramsPerUnitForFood. It is now the shared one from
// lib/unit-conversion.ts (prompt-80): that function grew a real-USDA-portion fallback which must
// match backend/src/lib/calc/recipeMacros.js exactly, and a third hand-maintained copy of a
// precedence chain that has to agree across three files is a drift waiting to happen. The
// preview here is still only an estimate — the backend recomputes the authoritative totals on
// save — but it now provably resolves units the same way that recompute will.

// g/oz are always exact regardless of which food, so they never need the indicator — only
// cup/tbsp/tsp/piece/ml vary by food density and can silently fall back to a flat guess. A real
// per-food measure label (see realMeasures on IngredientDraft below) is never approximate either
// — it isn't one of UNIT_TO_FOOD_FIELD's keys, so this already returns false for one unchanged.
// A food whose weight now comes from one of its own USDA portions (prompt-80) is a REAL measured
// weight, not a flat guess, so realGramsPerUnit — not the gramsPerX field alone — decides this.
function isApproximateUnit(
  commonServings: ServingSize[] | undefined,
  unitWeights: UnitWeights | undefined,
  unit: string,
  portions: ServingSize[] | undefined,
): boolean {
  const field = UNIT_TO_FOOD_FIELD[unit];
  if (!field) return false;
  return realGramsPerUnit(commonServings, unitWeights, unit, portions) == null;
}

interface IngredientMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface IngredientDraft {
  // Stable per-row identity, frontend-only — never sent to the server, never persisted.
  // The list was keyed by array index, which is fine while rows are only appended and removed;
  // once they can be REORDERED (prompt-97) an index key makes React reuse the wrong row's DOM,
  // so a dragged row's search box would keep the previous occupant's text and focus. dnd-kit
  // needs a stable sort id regardless, so the two requirements are satisfied by the same field.
  // Every state update below addresses rows by this id rather than by index, for the same
  // reason: an index captured at render time is stale the moment anything moves.
  rowId: string;
  // "ingredient" | "section" — a section is a titled divider the dietitian inserts between
  // ingredients ("Batter", "Frosting"); see meal.model.js's ingredientSchema.type. A section
  // row carries ONLY `name` (its title); every other field below stays at its blank value and
  // is never read for it.
  type: "ingredient" | "section";
  foodId: string;
  name: string;
  // "How many of `unit`" — when `unit` is a real measure's own label (see realMeasures), this
  // is a count (e.g. 3 dates); resolveMeasure() turns that into an actual gram quantity only at
  // preview/submit time, never stored pre-multiplied here.
  quantity: number | "";
  // "g" | a generic unit (ml/cup/tbsp/tsp/oz/piece) | one of realMeasures' own labels.
  unit: string;
  per100g: IngredientMacros | null;
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
  // This food's real, food-specific measures (e.g. "1 pitted date, pitted") — undefined/empty
  // falls back to the generic unit list, per prompt-45's MeasureSelect.
  realMeasures?: ServingSize[];
  // Display-only (prompt-47) — carries either a freshly-picked real measure's label (see the
  // final save mapping below, which prefers a fresh resolveMeasure() result) or, for a row
  // loaded from an existing recipe and never re-touched, whatever label was already saved —
  // so simply opening "Edit recipe" and saving again doesn't silently wipe it.
  measureLabel?: string | null;
  // Structured pick info (prompt-49) — same "fresh pick wins, else preserve what was loaded"
  // rule as measureLabel above; used on edit-load to pre-select the exact real measure
  // originally picked (see the editData hydration below) instead of always defaulting to grams.
  measureDescription?: string | null;
  measureCount?: number | null;
  // The ingredient line exactly as the imported page wrote it (prompt-120). Frontend-only, like
  // rowId — never sent to the server. Shown under the row so Sura can see the original wording
  // while she picks a food, which matters most on the rows the importer could NOT match.
  //
  // The parsed quantity/unit are deliberately NOT pre-filled on an unmatched row: picking a food
  // resets `unit` to "g" while KEEPING a non-zero quantity (see FoodSearchInput's onSelect), so
  // a pre-filled "0.667 cup" would silently become "0.667 g" the moment she picked the oil.
  // Showing the raw line avoids that trap and tells her more than a parsed number would.
  importedRaw?: string;
}

// The single definition of "this row is a real ingredient that can be saved". Used by both
// validIngredients (which gates step 2 and drives the review count) and the save mapping —
// two hand-kept copies of this condition would eventually disagree about what gets written.
function isSavableIngredient(i: IngredientDraft): boolean {
  return (
    i.type === "ingredient" &&
    !!i.foodId &&
    !!i.name.trim() &&
    typeof i.quantity === "number" &&
    i.quantity > 0
  );
}

// Row ids only have to be unique within one open dialog, so a counter is enough — and unlike
// crypto.randomUUID() it needs no secure context and can't differ between the server render and
// the client hydration.
let rowSeq = 0;

function blankIngredient(): IngredientDraft {
  return {
    rowId: `row-${++rowSeq}`,
    type: "ingredient",
    foodId: "",
    name: "",
    quantity: "",
    unit: "g",
    per100g: null,
  };
}

// Same blank shape with type flipped: a section only ever reads `name`, but keeping the other
// fields present (rather than optional) means nothing downstream has to null-check them.
function blankSection(): IngredientDraft {
  return { ...blankIngredient(), type: "section" };
}

// Index just past this section's own contiguous run of ingredient rows — i.e. right before the
// next section header, or the array's end if this is the last section. A flat array keeps
// ordering trivial but gives a section no boundary of its own, so "where does Batter end" has
// to be answered by scanning forward from its header; only the section itself knows.
function sectionInsertIndex(rows: IngredientDraft[], sectionRowId: string): number {
  const start = rows.findIndex((r) => r.rowId === sectionRowId);
  if (start === -1) return rows.length;
  let i = start + 1;
  while (i < rows.length && rows[i].type !== "section") i++;
  return i;
}

// The one place this dialog turns a {count, unit} selection into grams. resolveMeasure() turns
// a real-measure selection into an exact gram total (unit="g"); for the generic-unit path it
// passes quantity/unit through unchanged, so gramsPerUnitForFood still does the existing
// per-food-density resolution exactly as before either way.
//
// Extracted (prompt-69) from liveMacros, which was its only caller, so the gram equivalent now
// shown beside each row is by construction the very number the macro preview is dividing by —
// not a parallel recomputation that could quietly disagree with it.
function ingredientGrams(ing: IngredientDraft): number {
  const qty = typeof ing.quantity === "number" ? ing.quantity : 0;
  const resolved = resolveMeasure(ing.realMeasures, ing.unit, qty);
  return (
    resolved.quantity *
    gramsPerUnitForFood(ing.commonServings, ing.unitWeights, resolved.unit, ing.realMeasures)
  );
}

// One ingredient's contribution at the amount actually entered for it (prompt-78) — the same
// `per-100g × grams/100` scaling computeRecipeMacros applies per ingredient on the server
// before summing. That server loop accumulates inline and exposes no per-ingredient value to
// import, so this is the frontend's single copy of that formula: liveMacros below sums exactly
// these objects, and the ingredient rows print exactly these objects. A row can therefore never
// disagree with the total it feeds.
//
// Returns raw unrounded values on purpose. liveMacros rounds once at the end, as it always has,
// so surfacing these per-row changes the recipe total by nothing at all; the row does its own
// rounding purely for display.
function ingredientMacros(ing: IngredientDraft): IngredientMacros | null {
  if (!ing.per100g) return null;
  const factor = ingredientGrams(ing) / 100;
  return {
    kcal: ing.per100g.kcal * factor,
    protein: ing.per100g.protein * factor,
    carbs: ing.per100g.carbs * factor,
    fat: ing.per100g.fat * factor,
    fiber: ing.per100g.fiber * factor,
  };
}

// Formatted to read as the same sentence the food search shows for its per-100g reference
// ("884 kcal · P0 C0 F100") — same four fields, same order, same separators — so the dietitian
// is comparing like with like, just at the real amount instead of 100 g. kcal whole, macros to
// one decimal, matching how per-serving figures round elsewhere in the app.
function formatIngredientMacros(m: IngredientMacros): string {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  // "Fib" (not "F") for fiber — "F" is already taken by fat two tokens earlier on this same
  // line, and this dialog's own Live preview/Review macro tiles already label fiber "Fib"
  // (MacroPrev/ReviewMacro below), so this line now reads consistently with those.
  return `${Math.round(m.kcal)} kcal · P${r1(m.protein)} C${r1(m.carbs)} F${r1(m.fat)} Fib${r1(m.fiber)}`;
}

/* ── One draggable row of the ingredients list ────────────────────────────────────────────── */

// Extracted from the step-2 map (prompt-97) because useSortable is a hook and has to be called
// from a component, not a loop body. Rows are addressed by `rowId`, never by index: `onPatch`
// and `onRemove` are already bound to this row's id by the parent, so a reorder mid-edit can't
// write into the wrong row.
function SortableIngredientRow({
  ing,
  number,
  canDelete,
  onPatch,
  onRemove,
  onAddIngredient,
}: {
  ing: IngredientDraft;
  // Position in the ingredient sequence, or null for a section header — headers don't consume
  // a number, so "Batter / 1. flour / 2. butter / Frosting / 3. sugar" reads 1,2,3.
  number: number | null;
  canDelete: boolean;
  onPatch: (patch: Partial<IngredientDraft>) => void;
  onRemove: () => void;
  // Section rows only — appends an ingredient at the end of THIS section's run. Absent on
  // ingredient rows, which have no run of their own to append to.
  onAddIngredient?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ing.rowId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lifts the row being dragged above its neighbours; without it the rows it passes over
    // paint on top of it halfway through the drag.
    zIndex: isDragging ? 20 : undefined,
  };

  const handle = (
    <button
      type="button"
      className="h-8 w-5 shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
      aria-label={`Reorder ${ing.name || "this row"}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  // ── Section header ──
  // Deliberately renders none of the ingredient machinery: no FoodSearchInput (there's no food
  // to match), no MeasureSelect / gram equivalent / approximate-unit warning (no amount), and
  // no macro line below. That last one matters — the macro block's fallback branch fires for
  // any row with `per100g === null` and a non-empty name, so a titled section would otherwise
  // accuse itself of not being matched to a food.
  if (ing.type === "section") {
    return (
      <div
        ref={setNodeRef}
        data-row-id={ing.rowId}
        style={style}
        className={cn("pt-3", isDragging && "opacity-60")}
      >
        <div className="flex items-center gap-2">
          {handle}
          <Input
            value={ing.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Section title"
            className="h-8 flex-1 rounded-none border-0 border-b border-dashed bg-transparent px-0 text-xs font-semibold uppercase tracking-wider focus-visible:ring-0"
          />
          {onAddIngredient && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-[11px] text-muted-foreground"
              onClick={onAddIngredient}
            >
              <Plus className="h-3 w-3" /> Add ingredient
            </Button>
          )}
          {/* Always deletable — the "keep at least one row" rule exists so the form can't end
              up with nowhere to enter an ingredient, and a header is not that. */}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Ingredient ──
  return (
    <div
      ref={setNodeRef}
      data-row-id={ing.rowId}
      style={style}
      className={cn("space-y-1", isDragging && "opacity-60")}
    >
      <div className="flex items-center gap-2">
        {handle}
        <span className="h-6 w-6 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">
          {number}
        </span>
        <FoodSearchInput
          value={ing.name}
          foodId={ing.foodId}
          onSelect={(id, label, macros, unitWeights, commonServings, realMeasures) =>
            onPatch({
              foodId: id,
              name: label,
              per100g: macros,
              unitWeights,
              commonServings,
              realMeasures,
              // A fresh food swap resets to plain grams rather than keeping the previous
              // food's measure selection, which may not even exist for this one (e.g. "1
              // stick" doesn't apply to a vegetable) — and its label along with it, since it
              // described that other food's measure.
              unit: "g",
              measureLabel: null,
              measureDescription: null,
              measureCount: null,
              // Defaults a freshly-picked food to a quantity of 1 rather than leaving this
              // row's existing amount (almost always "" on a brand-new row) untouched. Without
              // this, picking a food contributes nothing to the recipe until the dietitian
              // separately remembers to also type an amount — the row shows no macro line and
              // the Live preview card doesn't appear, which reads as "the app didn't register
              // my pick" rather than "there's one more field to fill in". Only overrides a
              // quantity that isn't already a real (>0) amount, so re-picking a different food
              // for a row the dietitian already sized keeps that sizing.
              quantity: typeof ing.quantity === "number" && ing.quantity > 0 ? ing.quantity : 1,
            })
          }
          onChange={(val) =>
            onPatch({
              name: val,
              foodId: "",
              per100g: null,
              unitWeights: undefined,
              commonServings: undefined,
              realMeasures: undefined,
              measureLabel: null,
              measureDescription: null,
              measureCount: null,
            })
          }
        />
        <MeasureSelect
          realMeasures={ing.realMeasures}
          option={ing.unit}
          count={ing.quantity}
          onOptionChange={(v) => onPatch({ unit: v })}
          onCountChange={(v) => onPatch({ quantity: v })}
        />
        {/* Gram equivalent (prompt-69) — the weight this selection already resolves to, for
            clients who think in metric. tabular-nums + a fixed min-width so the row doesn't
            jitter as digits change while typing. */}
        {(() => {
          const eq = formatGramEquivalent(ing.unit, ing.quantity, ingredientGrams(ing));
          return eq ? (
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 min-w-14">
              {eq}
            </span>
          ) : null;
        })()}
        {isApproximateUnit(ing.commonServings, ing.unitWeights, ing.unit, ing.realMeasures) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </TooltipTrigger>
            <TooltipContent className="max-w-56 text-xs">
              Approximate — real weight not available for this food, enter in grams for exact
              accuracy.
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          disabled={!canDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {/* This ingredient's own macros at the amount entered above (prompt-78). Its own line
          rather than more text on the row, which already carries the name, the amount picker
          and the gram equivalent; pl-13 lines it up under the food name (past the drag handle
          + the h-6 index badge + two gap-2s). Deliberately plainer than the "Live preview"
          card below, which is the recipe total — a small grey figure per row can't be mistaken
          for the headline. */}
      {(() => {
        const m = ingredientMacros(ing);
        // Gate on "is there an amount to scale?", NOT on "is the result > 0" (prompt-81). Salt,
        // water and most spices are genuinely 0 kcal, and the old `m.kcal > 0` test hid their
        // line entirely — indistinguishable from the unmatched-food gap below, and wrong:
        // "0 kcal · P0 C0 F0" is a true and useful statement about a matched ingredient.
        if (m && ingredientGrams(ing) > 0) {
          return (
            <p className="pl-13 text-[11px] text-muted-foreground tabular-nums">
              {formatIngredientMacros(m)}
            </p>
          );
        }
        // No macro line means this row has no food behind it — its text was typed but never
        // matched to one in the library (prompt-81). Say so. The blank space alone read as
        // "still loading", and the row's only other signal is the absence of a subtle green
        // tint, which is easy to miss. This ingredient contributes 0 to every total until
        // it's matched.
        if (!ing.per100g && ing.name.trim()) {
          return (
            <>
              <p className="pl-13 flex items-center gap-1 text-[11px] text-amber-600">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Not matched to a food in your library — adds nothing to this recipe. Pick a
                suggestion from the search box.
              </p>
              {ing.importedRaw && (
                <p className="pl-13 text-[11px] text-muted-foreground">
                  Imported line: &ldquo;{ing.importedRaw}&rdquo;
                </p>
              )}
            </>
          );
        }
        return null;
      })()}
    </div>
  );
}

interface NewRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  // Pre-selects the category for a brand-new recipe with whatever category tab the dietitian
  // was already filtering the library by (e.g. clicking "New recipe" while on the "Snack" tab
  // starts the form on Snack instead of always defaulting to Lunch). Ignored in edit mode — an
  // existing recipe's own category always wins there, regardless of the caller's current tab.
  // Undefined (the "All" tab has no single category to hand down) falls back to "lunch", the
  // form's original default.
  initialCategory?: RecipeCategory;
  // A parsed recipe from the import flow (prompt-120), used to PRE-FILL this form instead of
  // starting blank. Deliberately not a separate "review imported recipe" screen: an import has
  // to end up in exactly this dialog, under exactly this save gate, so an imported ingredient
  // can never reach the database on terms a hand-typed one couldn't. Ignored in edit mode.
  importData?: ImportedRecipe | null;
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
const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Ingredients" },
  { id: 3, label: "Method" },
  { id: 4, label: "Tags & macros" },
  { id: 5, label: "Review" },
];

export function NewRecipeDialog({
  open,
  onOpenChange,
  editId,
  initialCategory,
  importData,
}: NewRecipeDialogProps) {
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
  // number | "" (prompt: servings backspace fix) — mirrors measure-select.tsx's own
  // onCountChange pattern for the exact same reason: a controlled <input type="number"> whose
  // value is clamped to a minimum ON EVERY KEYSTROKE can never actually show empty, because
  // Number("") is 0 and Math.max(min, 0) instantly snaps back to the minimum before the
  // dietitian can type a replacement digit — backspacing "1" just re-renders "1". Letting the
  // state hold "" while the field is transiently empty (clamped back to the minimum on blur,
  // not on every change) is what lets a plain backspace-then-retype actually work.
  const [prepMin, setPrepMin] = useState<number | "">(10);
  const [cookMin, setCookMin] = useState<number | "">(15);
  const [servings, setServings] = useState<number | "">(1);

  const [ingredients, setIngredients] = useState<IngredientDraft[]>([blankIngredient()]);

  const [steps, setMethodSteps] = useState<string[]>([""]);

  const [diets, setDiets] = useState<DietTag[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  // Import provenance (prompt-120). sourceUrl is persisted on the Meal (meal.model.js) so an
  // imported recipe can be attributed later; siteNutrition is NEVER persisted — it is shown
  // once on the review step as a sanity check against the macros this app computes itself from
  // the matched foods, and is dropped when the dialog closes.
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [siteNutrition, setSiteNutrition] = useState<SiteNutrition | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

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
    setIngredients([blankIngredient()]);
    setSourceUrl(null);
    setSiteNutrition(null);
    setImportWarnings([]);
    setMethodSteps([""]);
    setDiets([]);
    setAllergens([]);
    setNotes("");
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  // Seeds a brand-new recipe's category from whatever tab the dietitian was on in the library
  // (see initialCategory above), each time the dialog actually opens for a NEW recipe. Doing
  // this in an effect on `open` rather than trusting reset()'s own hardcoded "lunch" avoids a
  // staleness trap: reset() runs 200ms after the PREVIOUS close, capturing whatever category
  // tab was active back then — if the dietitian then switches tabs before opening the dialog
  // again, that stale reset would win. Gated on !isEdit so opening this same dialog to edit an
  // existing recipe never overrides its own stored category.
  useEffect(() => {
    if (open && !isEdit) setCategory(initialCategory ?? "lunch");
  }, [open, isEdit, initialCategory]);

  const { data: editData } = useQuery({
    queryKey: ["meal", editId],
    queryFn: () => getMeal(editId as string),
    enabled: open && isEdit,
  });

  const { data: dietOptions = [] } = useQuery({
    queryKey: ["settings", "dietary-preferences"],
    queryFn: fetchDietaryPreferences,
  });
  // Same Settings-managed allergen list the New Client dialog and New Food dialog now use
  // (prompt-105) — one vocabulary on both sides of the client/food divide, so a tag chosen here
  // can actually match a client's recorded allergy. Replaces a hardcoded lowercase array that
  // shared none of its values' casing with the client side.
  const { data: allergyOptions = [] } = useQuery({
    queryKey: ["settings", "allergies"],
    queryFn: fetchAllergies,
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
        ? editData.ingredients.map((i) => {
            // A section row has no food, no portions and no amount, so there is no measure to
            // pre-select — pickInitialMeasureSelection reads exactly those fields. Rebuild it
            // from a blank section and keep only its title.
            if (i.type === "section") return { ...blankSection(), name: i.name };
            // Pre-selects the exact real measure originally picked (prompt-49) when it still
            // matches one of this food's current portions, else falls back to grams + the
            // stored quantity — same rule as EditPlanItemDialog.
            const initial = pickInitialMeasureSelection(
              i.realMeasures,
              i.measureDescription,
              i.measureCount,
              typeof i.quantity === "number" ? i.quantity : 0,
              i.unit,
            );
            return {
              ...i,
              rowId: `row-${++rowSeq}`,
              // A recipe saved before sections existed has no `type` on its rows; every one of
              // those is an ingredient.
              type: "ingredient" as const,
              unit: initial.option,
              quantity: initial.count,
            };
          })
        : [blankIngredient()],
    );
    setMethodSteps(editData.steps.length ? editData.steps : [""]);
    setDiets(editData.dietTags as DietTag[]);
    setAllergens(editData.allergens);
    setNotes(editData.notes || "");
  }, [open, isEdit, editData]);

  // Import hydration (prompt-120) — the same job the editData effect above does, from a parsed
  // draft instead of a saved Meal. Everything it sets is ordinary form state, so from this
  // point on an imported recipe is indistinguishable from one typed in by hand: same steps,
  // same validation, same save gate, same isSavableIngredient() filter.
  //
  // Gated on !isEdit for the same reason the category effect is: opening this dialog to edit an
  // existing recipe must never have a stale import overwrite it.
  useEffect(() => {
    if (!open || isEdit || !importData) return;

    setName(importData.title);
    if (importData.servings > 0) setServings(importData.servings);
    setPrepMin(importData.prepTime);
    setCookMin(importData.cookTime);
    setMethodSteps(importData.steps.length ? importData.steps : [""]);
    setPhotos(importData.photo ? [importData.photo] : []);
    setSourceUrl(importData.source.kind === "url" ? importData.source.url : null);
    setSiteNutrition(importData.siteNutrition);
    setImportWarnings(importData.warnings);

    setIngredients(
      importData.ingredients.length
        ? importData.ingredients.map((imported) => {
            if (imported.isSection) {
              return { ...blankSection(), name: imported.sectionTitle || imported.raw };
            }
            const row = blankIngredient();
            // No matched food: leave the row exactly as a half-filled manual row looks — the
            // parsed search term sits in the name/search box so one click opens the dropdown
            // already showing candidates, and isSavableIngredient() keeps the row out of the
            // save until a food is actually chosen. This is the deliberate behaviour for every
            // ingredient the backend wasn't confident about; a guessed match would be worse,
            // because a wrong food silently contributes wrong macros to a saved recipe.
            if (!imported.food) {
              return { ...row, name: imported.searchName || imported.raw, importedRaw: imported.raw };
            }
            // Matched: build the row through foods-api's own toFoodItem, so these fields are
            // byte-for-byte what the search dropdown's onSelect would have set.
            const item = importedFoodToItem(imported.food);
            return {
              ...row,
              foodId: item.id,
              name: item.name,
              per100g: { ...item.macros, fiber: item.macros.fiber ?? 0 },
              unitWeights: item.unitWeights,
              commonServings: item.servings,
              realMeasures: item.portions,
              // Fall back to grams when the line stated no unit — the same default a blank row
              // starts on, rather than inventing a measure the food may not support.
              unit: imported.unit ?? "g",
              quantity: imported.quantity ?? "",
              importedRaw: imported.raw,
            };
          })
        : [blankIngredient()],
    );
  }, [open, isEdit, importData]);

  // Rows that will actually be SAVED as ingredients — a row with no foodId has no food to
  // reference, so it can't be persisted as one. This gates submission and must keep that
  // meaning. Section headers are excluded (prompt-97): they're saved too, but they aren't
  // ingredients, and letting one count here would let a recipe consisting of nothing but a
  // title pass step 2's gate and be saved with no food in it at all.
  const validIngredients = ingredients.filter(isSavableIngredient);
  // Rows the dietitian has actually FILLED IN, matched or not (prompt-81). The "n/n matched"
  // ratio has to be against this: it was previously counted against validIngredients, which
  // already excludes unmatched rows, so an unmatched ingredient was left out of its own
  // denominator and the ratio read a reassuring "5/5 matched" while one row silently
  // contributed nothing. A ratio that can never report a problem is worse than no ratio.
  const filledIngredients = ingredients.filter(
    (i) => i.type === "ingredient" && i.name.trim() && typeof i.quantity === "number" && i.quantity > 0,
  );
  const validSteps = steps.filter((s) => s.trim());

  // Scrolls a freshly-added row into view. Without this, "+ Add"/"+ Add section"/a section's
  // own "+ Add ingredient" silently appends off the bottom of a long list — nothing on screen
  // changes, so it reads as if the click did nothing until the dietitian manually scrolls down
  // to find it. Set (to the new row's rowId, via data-row-id on its rendered element) right
  // before the state update that introduces it; the effect below consumes it exactly once,
  // after the row has actually rendered, so scrollIntoView has a real element to find rather
  // than racing the render.
  const pendingScrollRowId = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingScrollRowId.current;
    if (!id) return;
    pendingScrollRowId.current = null;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-row-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [ingredients]);

  // Rows are addressed by rowId, never by index — after a drag, an index captured when the row
  // rendered points at whatever moved into that slot.
  const patchRow = useCallback((rowId: string, patch: Partial<IngredientDraft>) => {
    setIngredients((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);
  const removeRow = useCallback((rowId: string) => {
    setIngredients((prev) => prev.filter((r) => r.rowId !== rowId));
  }, []);
  // Appends into one section's own run rather than at the end of the whole list. Without this
  // the toolbar's "+ Add" is the only way to add an ingredient, so with two or more sections a
  // new row could only ever join the LAST one — everything else needed a drag to get there.
  const addIngredientToSection = useCallback((sectionRowId: string) => {
    const row = blankIngredient();
    pendingScrollRowId.current = row.rowId;
    setIngredients((prev) => {
      const idx = sectionInsertIndex(prev, sectionRowId);
      return [...prev.slice(0, idx), row, ...prev.slice(idx)];
    });
  }, []);
  // Appends a section, except that an untouched placeholder ingredient sitting at the end is
  // REPLACED rather than pushed above the new header. The dialog opens with one blank row, and
  // sections append to the end, so the common "open the form, start with a section" path
  // otherwise strands that row above the first heading, outside every section. Only a row with
  // neither a matched food nor typed text qualifies — anything the dietitian has actually put
  // something into stays exactly where it is.
  const addSection = useCallback(() => {
    const row = blankSection();
    pendingScrollRowId.current = row.rowId;
    setIngredients((prev) => {
      const last = prev[prev.length - 1];
      const swallow = last && last.type === "ingredient" && !last.foodId && !last.name.trim();
      return swallow ? [...prev.slice(0, -1), row] : [...prev, row];
    });
  }, []);

  // The visible sequence skips section headers, so numbering reads 1,2,3 across the whole
  // recipe rather than restarting or leaving gaps where a title sits.
  const rowNumbers = useMemo(() => {
    let n = 0;
    return ingredients.map((i) => (i.type === "section" ? null : ++n));
  }, [ingredients]);
  // The last remaining INGREDIENT row can't be deleted — the form would then have nowhere to
  // enter one. Section headers don't count toward that floor and are always deletable, so a
  // recipe can freely have none or several.
  const ingredientRowCount = ingredients.filter((i) => i.type === "ingredient").length;

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking the handle (or tabbing to it)
    // isn't read as the beginning of one.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setIngredients((prev) => {
      const from = prev.findIndex((r) => r.rowId === active.id);
      const to = prev.findIndex((r) => r.rowId === over.id);
      if (from === -1 || to === -1) return prev;
      // Array order IS recipe order — reordering here is the whole feature, no position field
      // to keep in sync.
      return arrayMove(prev, from, to);
    });
  }, []);

  const liveMacros = useMemo(() => {
    let kcal = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0;
    let matched = 0;
    for (const ing of validIngredients) {
      const m = ingredientMacros(ing);
      if (!m) continue;
      matched++;
      kcal += m.kcal;
      protein += m.protein;
      carbs += m.carbs;
      fat += m.fat;
      fiber += m.fiber;
    }
    // servings can be "" transiently while the dietitian is mid-edit (see the servings state
    // comment above) — treated as 0 here so Math.max still falls through to the same 1-serving
    // floor, exactly as it did when servings was always a plain number.
    const s = Math.max(1, servings === "" ? 0 : servings);
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
      count: filledIngredients.length,
    };
  }, [validIngredients, filledIngredients, servings]);

  const canAdvance = useMemo(() => {
    if (step === 1) return name.trim().length > 1;
    if (step === 2) return validIngredients.length > 0;
    return true;
  }, [step, name, validIngredients]);

  // Normalized numbers for every downstream read (macros, display text, the save payload) —
  // "" only ever exists transiently in the input itself while the dietitian is mid-edit; it
  // must never leak into arithmetic ("" + 15 is the STRING "15", not 15) or be saved as a
  // recipe's actual servings/time.
  const numServings = servings === "" ? 1 : servings;
  const numPrepMin = prepMin === "" ? 0 : prepMin;
  const numCookMin = cookMin === "" ? 0 : cookMin;
  const totalTime = numPrepMin + numCookMin;
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
                        onChange={(e) => {
                          const v = e.target.value;
                          setServings(v === "" ? "" : Math.max(1, Number(v)));
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => setServings((s) => (s === "" ? 1 : s))}
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
                        onChange={(e) => {
                          const v = e.target.value;
                          setPrepMin(v === "" ? "" : Math.max(0, Number(v)));
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => setPrepMin((m) => (m === "" ? 0 : m))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cook time (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={cookMin}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCookMin(v === "" ? "" : Math.max(0, Number(v)));
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => setCookMin((m) => (m === "" ? 0 : m))}
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
                <div className="space-y-8">
                  <div className="sticky top-0 z-10 -mt-5 -mx-6 bg-background px-6 pt-5 pb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Ingredients</div>
                      <div className="text-xs text-muted-foreground">
                        For {numServings} serving{numServings > 1 ? "s" : ""}. Search your library and
                        USDA FoodData Central — picking a USDA result adds it to your library.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* A section header is just another row appended to the same list — it
                          can then be dragged anywhere, like any other row. */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addSection}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add section
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const row = blankIngredient();
                          pendingScrollRowId.current = row.rowId;
                          setIngredients([...ingredients, row]);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={ingredients.map((i) => i.rowId)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {ingredients.map((ing, idx) => (
                          <SortableIngredientRow
                            key={ing.rowId}
                            ing={ing}
                            number={rowNumbers[idx]}
                            canDelete={ing.type === "section" || ingredientRowCount > 1}
                            onPatch={(patch) => patchRow(ing.rowId, patch)}
                            onRemove={() => removeRow(ing.rowId)}
                            onAddIngredient={
                              ing.type === "section"
                                ? () => addIngredientToSection(ing.rowId)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
                      {numServings > 1 && (
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
                    {numServings > 1 && (
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
                      {dietOptions.map((d) => {
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
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Allergens
                    </Label>
                    {allergyOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Loading allergens…</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allergyOptions.map((a) => {
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
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                  {/* Import provenance + the site's OWN stated nutrition (prompt-120).
                      Read-only, and labelled as the source's numbers rather than this app's:
                      the macros this recipe actually saves are computed by the backend from the
                      matched foods (computeRecipeMacros), exactly as for a hand-entered recipe.
                      Shown side by side purely as a sanity check — a wild disagreement usually
                      means an ingredient matched the wrong food or a quantity needs a look. */}
                  {sourceUrl && (
                    <Card className="border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                      <div className="flex items-start gap-2">
                        <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-xs text-sky-900 dark:text-sky-200">
                            Imported from{" "}
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-medium underline underline-offset-2 break-all"
                            >
                              {sourceUrl}
                            </a>
                          </p>
                          {siteNutrition && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80 dark:text-sky-300/80">
                                Site&apos;s stated nutrition — not saved
                              </p>
                              <p className="text-[11px] text-sky-900/80 dark:text-sky-200/80">
                                {[
                                  siteNutrition.servingSize && `per ${siteNutrition.servingSize}`,
                                  siteNutrition.calories,
                                  siteNutrition.protein && `protein ${siteNutrition.protein}`,
                                  siteNutrition.carbs && `carbs ${siteNutrition.carbs}`,
                                  siteNutrition.fat && `fat ${siteNutrition.fat}`,
                                  siteNutrition.fiber && `fiber ${siteNutrition.fiber}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <p className="text-[10px] text-sky-800/70 dark:text-sky-300/70">
                                Saved macros come from the matched foods below, not these.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}
                  {importWarnings.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <ul className="space-y-1">
                        {importWarnings.map((w) => (
                          <li key={w} className="text-xs text-amber-900 dark:text-amber-200">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
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
                          {numServings}
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
                            {d}
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
                        Contains: {allergens.join(", ")}
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
                    servings: numServings,
                    prepTime: numPrepMin,
                    cookTime: numCookMin,
                    dietTags: diets,
                    allergens,
                    // Iterates the FULL row list rather than validIngredients (prompt-97).
                    // That filter requires a foodId and a section header has none, so mapping
                    // over it would silently drop every section on save — the recipe would come
                    // back from a reload with its headers gone and no error anywhere.
                    ingredients: ingredients.flatMap((i): CreateMealIngredient[] => {
                      if (i.type === "section") {
                        // Same "don't save empty junk" rule ingredients already follow: an
                        // untitled header is a row that was started and abandoned (and `name`
                        // is required server-side regardless).
                        const title = i.name.trim();
                        return title ? [{ type: "section" as const, name: title }] : [];
                      }
                      if (!isSavableIngredient(i)) return [];
                      // Same resolution as the live preview — a real-measure selection (e.g.
                      // "3" × "1 pitted date, pitted") is sent as its exact resolved gram total
                      // with unit="g", since that's the only unit value every downstream
                      // consumer (recipeMacros.js's gramsPerUnitForFood, re-run on every future
                      // edit) can resolve correctly for an arbitrary per-food measure.
                      const qty = typeof i.quantity === "number" ? i.quantity : 0;
                      const resolved = resolveMeasure(i.realMeasures, i.unit, qty);
                      return [{
                        type: "ingredient" as const,
                        food: i.foodId,
                        name: i.name,
                        quantity: resolved.quantity,
                        unit: resolved.unit,
                        // A freshly-picked real measure (resolved.measureLabel set) always wins;
                        // otherwise preserve whatever this row already had loaded (e.g. editing
                        // an existing recipe without re-touching this ingredient) rather than
                        // wiping it just because it currently resolves through plain grams. In
                        // practice the edit-load hydration above already pre-selects the real
                        // measure when one exists, so `resolved` is correct here even for an
                        // untouched row — these `i.*` fallbacks only matter if that food's
                        // portions failed to load for some reason.
                        measureLabel: resolved.measureLabel ?? i.measureLabel ?? null,
                        measureDescription: resolved.measureDescription ?? i.measureDescription ?? null,
                        measureCount: resolved.measureCount ?? i.measureCount ?? null,
                      }];
                    }),
                    steps: validSteps,
                    notes: notes.trim() || undefined,
                    photos,
                    // Attribution for an imported recipe (prompt-120); undefined for every
                    // hand-entered one, which is what makes its absence meaningful.
                    sourceUrl: sourceUrl || undefined,
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
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
  realMeasures?: ServingSize[];
}

// Ingredient search covers the library AND live USDA FoodData Central (prompt-89), so one
// keyboard-navigable list holds two kinds of row that behave differently when picked:
//   library — already a Food document; picking it fills the ingredient in immediately, exactly
//             as this dropdown has always worked.
//   usda    — an ephemeral FDC search hit with no Food document, no portions and no id.
//             Picking it imports the food FIRST (foods.service.js's importUsdaFood, the same
//             call Food Database's Add button makes) and fills the ingredient from the created
//             document — never from the search hit, which carries none of the portion/unit-weight
//             data an ingredient needs.
type SearchOption =
  | { kind: "library"; key: string; food: FoodSearchResult }
  | { kind: "usda"; key: string; hit: UsdaSearchResult };

// Deliberately smaller than Food Database's 200-per-page browser — this is a dropdown, not a
// paginated list. Raised from the original 10 (prompt-100): FDC's Branded dataset outnumbers
// Foundation/SR Legacy/Survey (FNDDS) combined by roughly 15:1, so relevance-ranked results for
// a common ingredient name can fill 10 slots with Branded products alone even though generic
// matches exist further down. 25 gives real headroom for a mix up front.
//
// Also doubles (prompt-101) as the STARTING point and GROWTH STEP for usdaLimit below — scrolling
// near the bottom of the results panel asks for another batch of this size, up to FDC's own
// 200-per-request ceiling, instead of stopping dead at a fixed count. The query key is
// namespaced with "ingredient" for that reason: Food Database caches its USDA searches under
// ["foods","usda-search", q, page, types] with no limit in the key, so sharing that key at a
// different limit would let a dropdown response be served to its paginated list.
const USDA_DROPDOWN_LIMIT = 25;

function FoodSearchInput({
  value,
  foodId,
  onSelect,
  onChange,
}: {
  value: string;
  foodId: string;
  onSelect: (
    id: string,
    label: string,
    macros: IngredientMacros,
    unitWeights: UnitWeights | undefined,
    commonServings: ServingSize[] | undefined,
    realMeasures: ServingSize[] | undefined,
  ) => void;
  onChange: (val: string) => void;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  // Drives the live USDA query. Set by the SAME debounce timer as the library search below, so
  // typing an ingredient name fires one library request and one FDC request, not one per
  // keystroke (prompt-62/63's latency work — the safeguard is the debounce plus React Query's
  // cache, since neither USDA route carries server-side rate limiting).
  const [debounced, setDebounced] = useState("");
  // Defaults to every type EXCEPT Branded (prompt-100) — a recipe ingredient normally wants the
  // generic USDA reference food (Foundation/SR Legacy/Survey), not a specific commercial
  // product, and Branded's sheer size (see USDA_DROPDOWN_LIMIT above) otherwise crowds the
  // other three out of a small dropdown. Branded stays one tap away via its own chip below;
  // deselecting all three chips (an empty Set) falls through to "no filter", matching the
  // chips' existing all-or-nothing semantics — it doesn't mean "just Branded".
  const [dataTypeFilter, setDataTypeFilter] = useState<Set<UsdaDataType>>(
    new Set(["Foundation", "SR Legacy", "Survey (FNDDS)"]),
  );
  const [importingFdcId, setImportingFdcId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Keyboard-navigation highlight — this dropdown is a hand-rolled div list (not cmdk), so
  // there's no built-in ArrowDown/ArrowUp handling to inherit; -1 means nothing highlighted.
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectingRef = useRef(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (activeIndex < 0) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // Most-used-as-an-ingredient first (prompt-117) — distinct recipes containing this
      // food, NOT meal-plan usage. Staples like flour, eggs and olive oil should lead
      // here; what gets dropped straight into a plan is a different list entirely.
      const res = await fetchFoods({ search: q, limit: 20, sortBy: "usedInRecipes" });
      setResults(
        res.foods.map((f) => ({
          id: f.id,
          name: f.name,
          arabicName: f.arabicName,
          category: f.category,
          // fiber is nullable on FoodMacrosPer100g (prompt-73) but this is a CALCULATION input
          // — liveMacros sums it into the recipe's fiber total — so the 0 fallback that was
          // previously applied invisibly in foods-api.ts is applied explicitly here instead.
          // Identical arithmetic to before; the assumption is just now visible where it's made.
          macros: { ...f.macros, fiber: f.macros.fiber ?? 0 },
          unitWeights: f.unitWeights,
          commonServings: f.servings,
          realMeasures: f.portions,
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
    timerRef.current = setTimeout(() => {
      doSearch(val);
      setDebounced(val.trim());
    }, 300);
  };

  // ── Live USDA FoodData Central ──────────────────────────────────────────────────────────────
  // Same endpoints, same params and the same `enabled` gate as Food Database's Search USDA tab;
  // only the page size and the query-key namespace differ (see USDA_DROPDOWN_LIMIT).
  const dataTypesKey = [...dataTypeFilter].sort().join(",");
  const usdaEnabled = debounced.length > 1;
  // How many results to ask FDC for — grows as the dietitian scrolls (see handleResultsScroll
  // below), starting from USDA_DROPDOWN_LIMIT and capped at 200, FDC's own per-request ceiling
  // (see the comment on searchUsdaFoods in usda-client.js — 201 gets a live 400). Re-querying at
  // a bigger flat limit rather than paging+merging keeps this dropdown's fetch/render logic
  // identical to before scroll growth existed; FDC has no server-side rate limiting on this
  // route (see the debounce comment above) and the result sets here are small enough that
  // re-fetching from the top on each growth step is cheap. A recipe ingredient search hitting
  // the 200 ceiling with more still unseen is exactly the case Food Database's full 200-per-page
  // "Search USDA" tab (with real pagination) exists for.
  const [usdaLimit, setUsdaLimit] = useState(USDA_DROPDOWN_LIMIT);
  // A fresh search (new query or source filter) starts back at the small default — growth is
  // earned per-search, not carried over from whatever the dietitian had scrolled to before.
  useEffect(() => {
    setUsdaLimit(USDA_DROPDOWN_LIMIT);
  }, [debounced, dataTypesKey]);
  const { data: usdaData, isFetching: usdaFetching } = useQuery({
    queryKey: ["foods", "usda-search", "ingredient", debounced, dataTypesKey, usdaLimit],
    queryFn: () =>
      searchUsda(debounced, {
        limit: usdaLimit,
        dataTypes: dataTypeFilter.size > 0 ? [...dataTypeFilter] : undefined,
      }),
    enabled: usdaEnabled,
  });
  const usdaTotal = usdaData?.total ?? 0;
  const usdaHasMore = usdaLimit < 200 && usdaLimit < usdaTotal;
  // Fires on any scroll of the results panel — native (scrollbar drag) or the manual
  // scrollTop-driven wheel handling below, both change scrollTop and both fire this. 48px of
  // slack so growth kicks in a little before the literal last pixel, which reads as smoother.
  const handleResultsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!usdaHasMore || usdaFetching) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      setUsdaLimit((n) => Math.min(200, n + USDA_DROPDOWN_LIMIT));
    }
  };

  // Anything already imported is dropped from the USDA section — it's already in the library
  // section above, from its own Food document. Same bulk existence check Food Database uses for
  // its "Added" state: one request per result set, never one per row.
  const usdaResults = useMemo(() => usdaData?.results ?? [], [usdaData]);
  const resultFdcIdsKey = usdaResults.map((r) => r.fdcId).join(",");
  const { data: importedFdcIds } = useQuery({
    queryKey: ["foods", "usda-imported", resultFdcIdsKey],
    queryFn: () => fetchImportedUsdaFdcIds(usdaResults.map((r) => r.fdcId)),
    enabled: usdaResults.length > 0,
  });
  const importedSet = useMemo(() => new Set(importedFdcIds ?? []), [importedFdcIds]);
  // The imported check is a SECOND request, keyed on the fdcIds the search just returned, so
  // there is a window where the hits are known but which of them are already in the library
  // isn't. Rendering during that window showed a food twice — once from the library section,
  // once from USDA — until the check landed a moment later and it vanished. Confirmed live on
  // "Pistachio nuts, unsalted" (fdcId 2707530, already imported).
  //
  // So the USDA section waits for the answer instead of guessing. Food Database can afford the
  // opposite trade (it renders rows immediately and flips a button to "Added"), because there a
  // stale row is a button label; here it's a duplicate entry in a picker the dietitian is about
  // to choose from. The check is one indexed local query — no FDC round trip — so the wait is
  // short next to the search that precedes it.
  const importedKnown = usdaResults.length === 0 || importedFdcIds !== undefined;
  // Memoized, not a bare .filter(): `options` below feeds the effect that resets the keyboard
  // highlight, so a fresh array identity on every render would clear the highlight mid-keypress.
  const usdaHits = useMemo(
    () => (importedKnown ? usdaResults.filter((r) => !importedSet.has(r.fdcId)) : []),
    [usdaResults, importedSet, importedKnown],
  );

  // One flat list so ArrowDown/ArrowUp/Enter keep working across both sections — the rendering
  // below groups it back into headed sections, but navigation never sees the split.
  const options: SearchOption[] = useMemo(
    () => [
      ...results.map((f) => ({ kind: "library" as const, key: `lib:${f.id}`, food: f })),
      ...usdaHits.map((h) => ({ kind: "usda" as const, key: `usda:${h.fdcId}`, hit: h })),
    ],
    [results, usdaHits],
  );

  // A fresh result set (new search, or the list closing) invalidates whatever was highlighted
  // before — start from "nothing highlighted" rather than carrying over a stale index that may
  // now point at an unrelated row. Keyed on the merged list, so USDA results arriving after the
  // library's (two independent requests) also reset it rather than leaving the highlight on a
  // row that has just shifted position.
  useEffect(() => {
    setActiveIndex(-1);
  }, [options]);

  const finishPick = (name: string) => {
    setQuery(name);
    setOpen(false);
    setResults([]);
    setTimeout(() => {
      selectingRef.current = false;
    }, 100);
  };

  const pickLibrary = (r: FoodSearchResult) => {
    selectingRef.current = true;
    onSelect(r.id, r.name, r.macros, r.unitWeights, r.commonServings, r.realMeasures);
    finishPick(r.name);
  };

  // Picking a live USDA hit imports it first. Everything the ingredient needs — id, portions,
  // unit weights, per-100 g macros — comes from the created Food document, so an ingredient
  // added this way is indistinguishable from one picked out of the library (and never lands in
  // the unresolved foodId: "" state prompt-81 had to warn about).
  const pickUsda = async (hit: UsdaSearchResult) => {
    if (importingFdcId != null) return;
    selectingRef.current = true;
    setImportingFdcId(hit.fdcId);
    try {
      const food = await importUsdaFood(hit.fdcId);
      onSelect(
        food.id,
        food.name,
        // Same explicit fiber fallback the library branch makes — this is a calculation input.
        { ...food.macros, fiber: food.macros.fiber ?? 0 },
        food.unitWeights,
        food.servings,
        food.portions,
      );
      // My Library, its stats and the "already imported" checks all key off "foods".
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast.success(`${food.name} added to your library`);
      finishPick(food.name);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't add that food to your library");
      selectingRef.current = false;
    } finally {
      setImportingFdcId(null);
    }
  };

  const pick = (o: SearchOption) => {
    if (o.kind === "library") pickLibrary(o.food);
    else void pickUsda(o.hit);
  };

  const showResults =
    open && (options.length > 0 || (query.length >= 2 && !loading && !usdaFetching));

  // ArrowDown/ArrowUp/Enter — this list has no cmdk/Command root to inherit navigation from
  // (see the module-level comment on FoodSearchInput), so it's implemented directly against the
  // same `results` array the list itself renders from.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault();
        pick(options[activeIndex]);
      }
    } else if (e.key === "Escape") {
      // Stop propagation so Escape dismisses just this dropdown, not the whole Radix Dialog
      // behind it (which also treats Escape as "close" by default) — a dietitian escaping the
      // suggestion list shouldn't lose the recipe form she's in the middle of filling out.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <Popover open={showResults}>
      <PopoverAnchor asChild>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search food…"
            value={foodId ? value : query || value}
            onChange={(e) => handleType(e.target.value)}
            onKeyDown={handleKeyDown}
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
      </PopoverAnchor>
      {/* Portal-rendered (Radix), so this escapes the Ingredients step's scrollable container
          entirely instead of being clipped by its overflow-y-auto — a plain absolute+z-index
          div here was getting cut off / painted under the dialog's sticky Back/Next footer for
          rows near the bottom of a long ingredient list. */}
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="p-0 max-h-80 overflow-y-auto"
        style={{ width: "max(var(--radix-popover-trigger-width), 420px)" }}
        // Confirmed root cause of "dragging the scrollbar closes the dropdown": each result row
        // already calls preventDefault() on mousedown (below) so clicking one doesn't blur the
        // input, but that guard was only ever on the rows themselves — a mousedown anywhere else
        // in this content (the scrollbar track/thumb, or empty space between rows) had no such
        // guard, so the browser's default focus-shift ran, blurring the <Input>, which the
        // input's onBlur handler (200ms later) reads as "clicked away" and closes the popover.
        // preventDefault() here at the container level closes that gap without touching the
        // per-row handler's own stopPropagation/pick() behavior.
        onMouseDown={(e) => e.preventDefault()}
        // Radix Dialog locks page scroll via react-remove-scroll while open, allow-listing
        // only the Dialog's own content ref as a scrollable "shard" — this Popover renders
        // into a separate Portal, so real wheel/touch scroll gestures over it get silently
        // swallowed by that lock even though its own overflow-y-auto/max-height are correct.
        // Driving scrollTop from the wheel delta ourselves sidesteps the native scroll action
        // entirely, so it works regardless of the lock. (React attaches onWheel as a passive
        // listener, so e.preventDefault() here would no-op with a console warning — omitted
        // since the manual scrollTop update doesn't need it anyway.)
        onWheel={(e) => {
          e.currentTarget.scrollTop += e.deltaY;
        }}
        onScroll={handleResultsScroll}
      >
        {/* Data-type filter, same four values and the same semantics as Food Database's Source
            chips: none selected = no filter = search every type, and the choice is forwarded to
            FDC's own dataType param rather than filtering client-side. Sticky so it stays
            reachable while scrolling a long result list. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            USDA source
          </span>
          {USDA_DATA_TYPES.map((type) => {
            const active = dataTypeFilter.has(type);
            return (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-5 rounded-full px-2 text-[10px]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDataTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  });
                }}
              >
                {type}
              </Button>
            );
          })}
          {dataTypeFilter.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-muted-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDataTypeFilter(new Set());
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {options.length > 0 || !importedKnown ? (
          options.map((o, i) => {
            // Section headers are derived from the flat list rather than rendered as their own
            // array entries, so they can never be landed on by ArrowDown or counted as options.
            const prev = options[i - 1];
            const header =
              !prev || prev.kind !== o.kind ? (
                <div
                  key={`h:${o.kind}`}
                  className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  <span>{o.kind === "library" ? "My library" : "USDA FoodData Central"}</span>
                  {o.kind === "usda" && (
                    <span className="font-normal normal-case tracking-normal">
                      not in your library — picking one adds it
                    </span>
                  )}
                </div>
              ) : null;

            const row =
              o.kind === "library" ? (
                <div
                  key={o.key}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="button"
                  title={o.food.name}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-muted cursor-pointer flex items-center justify-between border-b last:border-0",
                    i === activeIndex && "bg-muted",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(o);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{o.food.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {o.food.arabicName && <span>{o.food.arabicName}</span>}
                      <span>
                        {o.food.macros.kcal} kcal · P{o.food.macros.protein} C
                        {o.food.macros.carbs} F{o.food.macros.fat}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] capitalize shrink-0 ml-2">
                    {o.food.category}
                  </Badge>
                </div>
              ) : (
                <div
                  key={o.key}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="button"
                  title={o.hit.name}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-muted cursor-pointer flex items-center justify-between border-b last:border-0",
                    i === activeIndex && "bg-muted",
                    importingFdcId != null && "opacity-60",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(o);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{o.hit.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {o.hit.brand && <span className="truncate">{o.hit.brand}</span>}
                      <span>
                        {o.hit.macros.calories} kcal · P{o.hit.macros.protein} C
                        {o.hit.macros.carbs} F{o.hit.macros.fat}
                      </span>
                    </div>
                  </div>
                  {importingFdcId === o.hit.fdcId ? (
                    <span className="ml-2 flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Adding…
                    </span>
                  ) : (
                    <Badge
                      variant="outline"
                      className="ml-2 shrink-0 border-sky-300 text-[9px] text-sky-700"
                    >
                      {USDA_DATA_TYPE_LABEL[o.hit.dataType ?? ""] ?? o.hit.dataType ?? "USDA"}
                    </Badge>
                  )}
                </div>
              );

            return header ? (
              <div key={o.key}>
                {header}
                {row}
              </div>
            ) : (
              row
            );
          })
        ) : null}

        {/* The library and USDA are two independent requests and FDC is much the slower of the
            two, so library rows routinely render while USDA is still in flight. Without a line
            here the list looks finished when it isn't, and a dietitian would reasonably conclude
            her search found nothing beyond the library. Covers both stages: the FDC search
            itself, and the library cross-check that follows it (see importedKnown above). */}
        {showResults && options.length > 0 && (usdaFetching || !importedKnown) && (
          <div className="flex items-center justify-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {usdaFetching
              ? "Searching USDA FoodData Central…"
              : "Checking which USDA results you already have…"}
          </div>
        )}

        {options.length === 0 &&
          importedKnown &&
          (usdaFetching || loading ? (
            <div className="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching your library and USDA…
            </div>
          ) : (
            <div className="p-3 text-xs text-muted-foreground text-center">
              No foods found for "{query}"
              {dataTypeFilter.size > 0 && " with the selected USDA sources"}
            </div>
          ))}
      </PopoverContent>
    </Popover>
  );
}
