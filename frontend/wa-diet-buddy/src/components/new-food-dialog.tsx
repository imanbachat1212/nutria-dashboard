import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFood,
  updateFood,
  fetchFoodById,
  addFavoriteFood,
  removeFavoriteFood,
  mapCategory,
  mapSource,
  CATEGORY_TO_BACKEND,
  type UnitWeightMatch,
  type APIFood,
} from "@/lib/foods-api";
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
  Loader2,
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
import { labelToUnit, type CommonServingUnit } from "@/lib/unit-conversion";

interface NewFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the dialog opens pre-filled with this food's current data and saves via
  // updateFood instead of createFood — see the `isEdit` derived flag below.
  editFoodId?: string | null;
}

const ALLERGENS = ["gluten", "dairy", "nuts", "eggs", "soy", "shellfish", "sesame"] as const;

// Pulls every non-null numeric micronutrient off a raw fetched food into the same sparse
// { key: value } shape the Micronutrients step's local state already uses — a key's absence
// means "no data" (matches how the create flow leaves unfilled fields out entirely).
function extractSparseMicros(raw: APIFood): Partial<Record<NumericMicroKey, number>> {
  const result: Partial<Record<NumericMicroKey, number>> = {};
  for (const group of MICRO_FIELD_GROUPS) {
    for (const f of group.fields) {
      const value = raw[f.key as keyof APIFood];
      if (typeof value === "number") result[f.key] = value;
    }
  }
  return result;
}

// Renders only the units a matched FNDDS entry actually had data for — most foods have 1-2
// of the 5, not all 5 (see foodMatching.js's per-unit derivation from the raw portions list).
const UNIT_WEIGHT_LABELS: [keyof UnitWeightMatch["fields"], CommonServingUnit][] = [
  ["gramsPerCup", "cup"],
  ["gramsPerTbsp", "tbsp"],
  ["gramsPerTsp", "tsp"],
  ["gramsPerPiece", "piece"],
  ["gramsPerMl", "ml"],
];
function formatUnitWeightLines(fields: UnitWeightMatch["fields"]): string[] {
  return UNIT_WEIGHT_LABELS.filter(([key]) => fields[key] != null).map(
    ([key, label]) => `1 ${label} = ${fields[key]}g`,
  );
}

// A Common servings row inserted by a USDA auto-match. `autoMatch` freezes the label/grams it
// was inserted with — never mutated afterwards — so "Clear" can tell an untouched auto-row
// (still equal to its autoMatch snapshot) from one the dietitian has since edited (now
// diverged from it) without persisting any extra "source" flag to the backend.
interface DraftServing extends ServingSize {
  autoMatch?: ServingSize;
}

// Builds one row per matched unit that doesn't already have a Common servings row mapping to
// it (via the same labelToUnit parser recipe/meal-plan math uses) — so a dietitian's existing
// manual row (e.g. "1 cup, packed") is never duplicated or clobbered.
function buildAutoServingRows(
  existing: DraftServing[],
  fields: UnitWeightMatch["fields"],
): DraftServing[] {
  const alreadyMapped = new Set(
    existing.map((s) => labelToUnit(s.label)).filter((u): u is CommonServingUnit => u != null),
  );
  const rows: DraftServing[] = [];
  for (const [key, unit] of UNIT_WEIGHT_LABELS) {
    const grams = fields[key];
    if (grams == null || alreadyMapped.has(unit)) continue;
    const row: ServingSize = { label: `1 ${unit}`, grams };
    rows.push({ ...row, autoMatch: row });
  }
  return rows;
}

const STEPS = [
  { id: 1, label: "Identity" },
  { id: 2, label: "Macros / 100g" },
  { id: 3, label: "Micronutrients" },
  { id: 4, label: "Servings & tags" },
  { id: 5, label: "Review" },
];

// ── Draft auto-save (create mode only — see module-level rationale below) ──────────────────
//
// CREATE-ONLY BY DESIGN: an edit-mode draft would risk drifting from the live document (someone
// else edits/deletes the food, or the match/Common-servings state goes stale by the time a
// draft is resumed) — a correctness problem a fresh, not-yet-created food's draft doesn't have.
// So this only ever runs while `!isEdit`, and only up until the food actually gets created —
// once `savedFoodId` is set (a real document now exists), there's nothing left to lose by
// closing, so the draft is cleared rather than kept alive. In practice this means
// `unitWeightMatch` is always null in a saved draft (it's only ever set alongside
// `savedFoodId` in the create flow, i.e. after the draft window has already ended) — included
// in the shape anyway per spec, and so a future change to when matching can happen doesn't
// require another shape migration.
const DRAFT_KEY = "nutria:new-food-draft";
const DRAFT_VERSION = 1;

interface NewFoodDraft {
  version: number;
  step: number;
  name: string;
  arabicName: string;
  brand: string;
  category: FoodCategory;
  source: FoodSource;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  micros: Partial<Record<NumericMicroKey, number>>;
  servings: DraftServing[];
  allergens: string[];
  verified: boolean;
  favorite: boolean;
  notes: string;
  unitWeightMatch: UnitWeightMatch | null;
}

// Deliberately loose (checks shape, not every field's type) — good enough to catch a future
// wizard-shape change or hand-edited localStorage value without being a second schema to
// maintain in lockstep with NewFoodDraft itself.
function isValidDraft(value: unknown): value is NewFoodDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    d.version === DRAFT_VERSION &&
    typeof d.name === "string" &&
    Array.isArray(d.servings) &&
    Array.isArray(d.allergens) &&
    typeof d.micros === "object" &&
    d.micros !== null
  );
}

// Never throws — a corrupted/incompatible draft (bad JSON, old version, hand-edited garbage)
// is treated exactly like "no draft," not an error, and the bad value is wiped so it doesn't
// keep failing to load on every future open.
function readDraft(): NewFoodDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable (private browsing, quota, disabled) — nothing to clean up either way.
  }
}

// A dialog that's just been opened (or opened and immediately closed with nothing typed) would
// otherwise still produce a "draft" — the auto-save effect below fires 400ms after mount
// regardless of input. This is the line between "genuinely blank" and "worth resuming": `step`
// and `unitWeightMatch` are deliberately excluded (navigating steps without typing anything, or
// the always-null-at-this-point match state, aren't data that could be lost).
function isMeaningfulDraftState(d: NewFoodDraft): boolean {
  if (d.name.trim() !== "") return true;
  if (d.arabicName.trim() !== "") return true;
  if (d.brand.trim() !== "") return true;
  if (d.category !== "protein") return true;
  if (d.source !== "custom") return true;
  if (d.kcal !== 0 || d.protein !== 0 || d.carbs !== 0 || d.fat !== 0) return true;
  if (d.fiber !== 0 || d.sugar !== 0 || d.sodium !== 0) return true;
  if (Object.keys(d.micros).length > 0) return true;
  // Default is exactly the one placeholder row ("1 serving", 100g, never auto-inserted) — more
  // rows, a different label/grams, or an auto-inserted row all count as real input.
  const isDefaultServings =
    d.servings.length === 1 &&
    d.servings[0].label === "1 serving" &&
    d.servings[0].grams === 100 &&
    !d.servings[0].autoMatch;
  if (!isDefaultServings) return true;
  if (d.allergens.length > 0) return true;
  if (d.verified) return true;
  if (d.favorite) return true;
  if (d.notes.trim() !== "") return true;
  return false;
}

export function NewFoodDialog({ open, onOpenChange, editFoodId }: NewFoodDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editFoodId;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  // The raw backend category string as originally stored (e.g. "fruits") — mapCategory()
  // collapses several backend values onto one frontend option (both "vegetables" and "fruits"
  // become "produce"), so if the dietitian never touches the Category select, saving must
  // resend this exact original value rather than re-deriving a possibly-different one.
  const [originalCategory, setOriginalCategory] = useState<string | null>(null);
  // Which micro keys had a real value when the food was loaded — used at save time to send an
  // explicit null for any the dietitian has since cleared, since an absent key in a PATCH body
  // means "leave unchanged," not "clear this."
  const [initialMicroKeys, setInitialMicroKeys] = useState<Set<NumericMicroKey>>(new Set());
  const [initialFavorite, setInitialFavorite] = useState(false);
  // Whether an explicit "Check USDA match" has been run this session, purely to distinguish
  // "not checked yet" from "checked, no match found" in the step-4 copy.
  const [matchChecked, setMatchChecked] = useState(false);

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
  const [servings, setServings] = useState<DraftServing[]>([{ label: "1 serving", grams: 100 }]);
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
  const [finishing, setFinishing] = useState(false);
  // A draft found in localStorage on open, awaiting the dietitian's Resume/Start new choice —
  // the form stays hidden behind a prompt while this is set, so the auto-save effect below
  // (gated on `!pendingDraft`) can never overwrite it with the still-blank initial state first.
  const [pendingDraft, setPendingDraft] = useState<NewFoodDraft | null>(null);

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
    setOriginalCategory(null);
    setInitialMicroKeys(new Set());
    setInitialFavorite(false);
    setMatchChecked(false);
    // Only clears the in-memory prompt, NOT the stored draft — closing via X/Escape is exactly
    // the scenario the draft exists to protect against, so it must survive a close. Reopening
    // re-runs the resume-check effect below and prompts again against the same stored draft.
    setPendingDraft(null);
  };

  // Edit mode: load the food's current raw data instead of starting blank. Deliberately does
  // NOT set unitWeightMatch from anything — a match is never auto-run against an existing food
  // (see handleCheckMatch), only offered as something the dietitian can explicitly trigger.
  useEffect(() => {
    if (!open || !editFoodId) return;
    let cancelled = false;
    setLoadingEdit(true);
    fetchFoodById(editFoodId)
      .then((raw) => {
        if (cancelled) return;
        setName(raw.name);
        setArabicName(raw.nameAr ?? "");
        setBrand(raw.brand ?? "");
        setCategory(mapCategory(raw.category));
        setOriginalCategory(raw.category ?? null);
        setSource(mapSource(raw.source));
        setKcal(raw.calories);
        setProtein(raw.protein);
        setCarbs(raw.carbs);
        setFat(raw.fat);
        setFiber(raw.fiber ?? 0);
        setSugar(raw.sugar ?? 0);
        setSodium(raw.sodium ?? 0);
        const sparseMicros = extractSparseMicros(raw);
        setMicros(sparseMicros);
        setInitialMicroKeys(new Set(Object.keys(sparseMicros) as NumericMicroKey[]));
        setServings(
          raw.commonServings && raw.commonServings.length > 0
            ? raw.commonServings.map((s) => ({ ...s }))
            : [{ label: `${raw.servingSize} ${raw.servingUnit}`, grams: raw.servingSize }],
        );
        setAllergens(raw.allergens ?? []);
        setVerified(raw.verified ?? false);
        setFavorite(raw.isFavorite ?? false);
        setInitialFavorite(raw.isFavorite ?? false);
        setNotes(raw.notes ?? "");
        setSavedFoodId(editFoodId);
        setUnitWeightMatch(null);
        setMatchChecked(false);
        setStep(1);
      })
      .catch((err) => console.error("Failed to load food for editing:", err))
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editFoodId]);

  // Create mode only: on each fresh open, check for a saved draft and hold it for the
  // dietitian's explicit Resume/Start new choice rather than silently restoring it — a stored
  // draft could be for a different food than the one they mean to add right now.
  useEffect(() => {
    if (!open || isEdit) return;
    const draft = readDraft();
    if (draft) setPendingDraft(draft);
  }, [open, isEdit]);

  const applyDraft = (draft: NewFoodDraft) => {
    setStep(draft.step);
    setName(draft.name);
    setArabicName(draft.arabicName);
    setBrand(draft.brand);
    setCategory(draft.category);
    setSource(draft.source);
    setKcal(draft.kcal);
    setProtein(draft.protein);
    setCarbs(draft.carbs);
    setFat(draft.fat);
    setFiber(draft.fiber);
    setSugar(draft.sugar);
    setSodium(draft.sodium);
    setMicros(draft.micros);
    setServings(draft.servings);
    setAllergens(draft.allergens);
    setVerified(draft.verified);
    setFavorite(draft.favorite);
    setNotes(draft.notes);
    setUnitWeightMatch(draft.unitWeightMatch);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  // Debounced auto-save — covers an accidental tab close/crash, not just a deliberate X click.
  // Gated on `!pendingDraft` so this can never fire while the resume prompt is still up (which
  // would overwrite the stored draft with the current, still-blank-or-stale form state before
  // the dietitian has even chosen Resume/Start new), and on `!savedFoodId` since a real document
  // exists from that point on — there's nothing left to protect against losing.
  useEffect(() => {
    if (!open || isEdit || savedFoodId || pendingDraft) return;
    const t = setTimeout(() => {
      const draft: NewFoodDraft = {
        version: DRAFT_VERSION,
        step,
        name,
        arabicName,
        brand,
        category,
        source,
        kcal,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        sodium,
        micros,
        servings,
        allergens,
        verified,
        favorite,
        notes,
        unitWeightMatch,
      };
      // A dialog opened and closed without typing anything meaningful shouldn't leave a
      // "resume?" prompt behind — and if a real draft WAS saved earlier this session and the
      // dietitian has since cleared everything back out, that stale draft shouldn't linger
      // either (clearing here, not just skipping the write, handles that case too).
      if (!isMeaningfulDraftState(draft)) {
        clearDraft();
        return;
      }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Best-effort — e.g. storage full/unavailable. Not worth surfacing to the dietitian
        // over what's purely a convenience feature.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    open,
    isEdit,
    savedFoodId,
    pendingDraft,
    step,
    name,
    arabicName,
    brand,
    category,
    source,
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    micros,
    servings,
    allergens,
    verified,
    favorite,
    notes,
    unitWeightMatch,
  ]);

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

  // Payload shape only — strips the client-only autoMatch marker before it ever reaches the API.
  const toCommonServingsPayload = (rows: DraftServing[]) =>
    rows
      .filter((s) => s.label.trim() && s.grams > 0)
      .map(({ label, grams }) => ({ label, grams }));

  // Inserts one Common servings row per newly-matched unit (skipping units that already have a
  // manually-entered row) and persists the result immediately, since the create request that
  // originally saved `servings` already went out before this match result came back.
  const applyAutoServings = async (foodId: string, fields: UnitWeightMatch["fields"]) => {
    const newRows = buildAutoServingRows(servings, fields);
    if (newRows.length === 0) return;
    const next = [...servings, ...newRows];
    setServings(next);
    try {
      await updateFood(foodId, { commonServings: toCommonServingsPayload(next) });
    } catch (err) {
      console.error("Failed to persist auto-inserted common servings rows:", err);
    }
  };

  const handleClearMatch = async () => {
    if (!savedFoodId) return;
    setMatchActionLoading(true);
    try {
      // Only drop auto-inserted rows still exactly equal to what they were inserted with — one
      // the dietitian has since edited (grams or label diverged from its autoMatch snapshot) is
      // treated as manual from here on and left alone.
      const prunedServings = servings.filter(
        (s) => !(s.autoMatch && s.label === s.autoMatch.label && s.grams === s.autoMatch.grams),
      );
      await updateFood(savedFoodId, {
        gramsPerCup: null,
        gramsPerTbsp: null,
        gramsPerTsp: null,
        gramsPerPiece: null,
        gramsPerMl: null,
        commonServings: toCommonServingsPayload(prunedServings),
      });
      setServings(prunedServings);
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
      await applyAutoServings(savedFoodId, unitWeightMatch.fields);
    } catch (err) {
      console.error("Failed to apply suggested unit weights:", err);
    } finally {
      setMatchActionLoading(false);
    }
  };

  const handleDismissSuggestion = () => setUnitWeightMatch(null);

  // Once a food already exists (post-match), nothing else in this step persists edits as the
  // dietitian types them — Common servings rows (including ones auto-inserted from a match,
  // which the dietitian may have since retyped to a real-world value) only ever get written to
  // the API by explicit actions (create / Apply / Clear). Without this, an edit made to an
  // auto-inserted row after the fact just sits in local state and is lost on close, and reading
  // the food back shows the stale auto-matched value instead of the dietitian's correction.
  // "Done" is the one remaining action before the dialog closes, so it's the right place to
  // flush whatever is currently on screen — never re-deriving from the original match snapshot.
  const handleDone = async () => {
    if (savedFoodId) {
      setFinishing(true);
      try {
        await updateFood(savedFoodId, { commonServings: toCommonServingsPayload(servings) });
      } catch (err) {
        console.error("Failed to save Common servings edits:", err);
      } finally {
        setFinishing(false);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["foods"] });
    handleClose(false);
  };

  // Edit mode never auto-runs matching (see module doc comment / task constraints) — this is
  // the dietitian's explicit opt-in, reusing the exact same safe-by-default backend behavior
  // create relies on: updateFood's re-match-on-name-change hook only auto-writes gramsPerX
  // fields that are currently null, never overwriting an already-curated value.
  const handleCheckMatch = async () => {
    if (!savedFoodId) return;
    setMatchActionLoading(true);
    try {
      const { unitWeightMatch: match } = await updateFood(savedFoodId, { name: name.trim() });
      setMatchChecked(true);
      setUnitWeightMatch(match);
      if (match?.tier === "match") {
        await applyAutoServings(savedFoodId, match.fields);
      }
    } catch (err) {
      console.error("Failed to check USDA match:", err);
    } finally {
      setMatchActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editFoodId) return;
    setSaving(true);
    try {
      // Preserve the exact original category if the dietitian never touched the selector —
      // re-deriving through CATEGORY_TO_BACKEND would always land on the same default backend
      // value (e.g. "vegetables"), silently rewriting a food originally categorized "fruits".
      const categoryChanged =
        originalCategory == null || mapCategory(originalCategory) !== category;
      const categoryForPayload =
        !categoryChanged && originalCategory
          ? originalCategory
          : CATEGORY_TO_BACKEND[category] || category;

      // An absent key in a PATCH body means "leave unchanged" — any micro the dietitian cleared
      // back to empty needs an explicit null, not just omission, or it would silently survive.
      const microsPayload: Partial<Record<NumericMicroKey, number | null>> = { ...micros };
      for (const key of initialMicroKeys) {
        if (!(key in micros)) microsPayload[key] = null;
      }

      await updateFood(editFoodId, {
        name: name.trim(),
        nameAr: arabicName.trim() || undefined,
        brand: brand.trim() || undefined,
        category: categoryForPayload,
        source,
        servingSize: servings[0]?.grams || 100,
        servingUnit: "g",
        commonServings: toCommonServingsPayload(servings),
        calories: kcal,
        protein,
        carbs,
        fat,
        fiber,
        sugar: sugar || null,
        sodium: sodium || null,
        allergens,
        notes: notes.trim() || null,
        verified,
        ...microsPayload,
      });
      // Favoriting is per-user state, not a plain field on the food — only call if it actually
      // changed, through the same endpoints the drawer's heart button uses.
      if (favorite !== initialFavorite) {
        if (favorite) await addFavoriteFood(editFoodId);
        else await removeFavoriteFood(editFoodId);
      }
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      handleClose(false);
    } catch (err) {
      console.error("Failed to save food changes:", err);
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && (kcal > 0 || protein + carbs + fat > 0)) ||
    step === 3 || // Micronutrients — every field optional, never blocks
    (step === 4 && servings.every((s) => s.label.trim() && s.grams > 0)) ||
    step === 5;

  // Only the create flow's post-match review state shows the Done-only footer — savedFoodId
  // is ALSO set throughout edit mode (from the very first load), so isEdit must gate this too,
  // or an edit session would never reach the Back/Next/Save-changes footer at all.
  const showPostCreateDone = !isEdit && !!savedFoodId;

  const meta = CATEGORY_META[category];
  const src = SOURCE_META[source];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        // This form holds a lot of state across 5 steps (identity, macros, micronutrients,
        // Common servings, allergens…) — an accidental click on the backdrop shouldn't silently
        // discard all of it. Escape and the explicit "X"/Cancel controls are untouched; both go
        // through onOpenChange exactly as before, only the outside-click path is swallowed here.
        // Same pattern already used by new-client-dialog.tsx and new-recipe-dialog.tsx.
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit food" : "Add new food"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this food's details."
              : "Add an ingredient or branded item with verified macros to your database."}
          </DialogDescription>
        </DialogHeader>

        {pendingDraft ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                You have an unsaved draft
                {pendingDraft.name ? ` — "${pendingDraft.name}"` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Resume where you left off, or start a new food from scratch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={discardDraft}>
                Start new
              </Button>
              <Button onClick={() => applyDraft(pendingDraft)}>Resume draft</Button>
            </div>
          </div>
        ) : loadingEdit ? (
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
              {/* Edit mode never auto-runs the USDA match on open — this is the dietitian's
                  explicit opt-in, shown regardless of whether structured fields already exist
                  (re-checking is always available, just never automatic). */}
              {isEdit && !unitWeightMatch && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm">
                  <div>
                    <p className="font-medium">USDA serving-weight match</p>
                    <p className="text-xs text-muted-foreground">
                      {matchChecked
                        ? "No USDA match found for this name."
                        : "Not checked automatically in edit mode — existing values are left as-is unless you check."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={matchActionLoading}
                    onClick={handleCheckMatch}
                  >
                    {matchActionLoading ? "Checking…" : "Check USDA match"}
                  </Button>
                </div>
              )}

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
          </>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {pendingDraft || loadingEdit ? null : showPostCreateDone ? (
            <>
              <div />
              <Button disabled={finishing} onClick={handleDone}>
                <CheckCircle2 className="size-4" /> {finishing ? "Saving…" : "Done"}
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
              ) : isEdit ? (
                <Button disabled={saving} onClick={handleSaveEdit}>
                  <CheckCircle2 className="size-4" /> {saving ? "Saving…" : "Save changes"}
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
                        // Send every row the dietitian entered, not just row 0 — previously
                        // rows 1+ were silently dropped since only servingSize (derived from
                        // row 0) was ever persisted.
                        commonServings: toCommonServingsPayload(servings),
                        allergens,
                        notes: notes.trim() || null,
                        verified,
                        micros,
                      });
                      // favoritedBy is per-user state, not a plain create-time field — a
                      // follow-up call once the food has a real id, same pattern as
                      // applyAutoServings' post-create commonServings write below.
                      if (favorite) await addFavoriteFood(food.id);
                      // The food is real now — the draft's only job was to survive up to this
                      // point, and it would just prompt to "resume" a food that already exists.
                      clearDraft();
                      queryClient.invalidateQueries({ queryKey: ["foods"] });
                      if (match) {
                        // Stay open on the Servings & tags step so the dietitian can review the
                        // auto-fill/suggestion right next to the serving-weight fields it
                        // affects, instead of it flashing by in a generic confirmation.
                        setSavedFoodId(food.id);
                        setUnitWeightMatch(match);
                        setStep(4);
                        // tier "match" means the backend already auto-wrote the structured
                        // fields on create — mirror that into visible/editable Common servings
                        // rows too, same as an explicit "Apply" would.
                        if (match.tier === "match") {
                          await applyAutoServings(food.id, match.fields);
                        }
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
