import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, X, UtensilsCrossed, Apple, Database, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { fetchFoods } from "@/lib/foods-api";
import { fetchMeals } from "@/lib/meals-api";
import type { Recipe } from "@/lib/meal-library-mock";
import type { AddItemPayload } from "@/lib/mealplans-api";
import { SLOT_META, type MealSlot } from "@/lib/meal-plans-mock";
import type { FoodItem, ServingSize, UnitWeights } from "@/lib/food-database-mock";
import {
  USDA_DATA_TYPE_LABEL,
  NUTRIENT_CLAIM_LABEL,
  type NutrientClaimLevel,
} from "@/lib/food-database-mock";
import {
  searchUsda,
  importUsdaFood,
  fetchImportedUsdaFdcIds,
  USDA_DATA_TYPES,
  type UsdaDataType,
  type UsdaSearchResult,
} from "@/lib/usda-api";
import { gramsPerUnitForFood } from "@/lib/unit-conversion";
import { resolveMeasure, formatGramEquivalent } from "@/lib/measure-options";
import { MeasureSelect } from "@/components/measure-select";
import { AllergyConflictBadge } from "@/components/allergy-conflict-badge";
import { DietTagBadges } from "@/components/diet-tag-badges";
import { getAllergyConflicts, formatAllergyConflicts } from "@/lib/allergy-matching";

interface PlanItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Generic over what "adding an item" actually does — a real plan's addPlanItem(planId, data)
  // or a template's addTemplateItem(templateId, data) — so this same picker/staging UI is
  // shared by both editors instead of being hardcoded to real plans (see meal-plans.tsx and
  // meal-plan-templates.$templateId.tsx for the two call sites).
  onAdd: (data: AddItemPayload) => Promise<unknown>;
  // Called once after a batch of adds has settled (at least one succeeded) — lets each caller
  // invalidate whatever query key its own data lives under, rather than this shared component
  // hardcoding one.
  onAdded?: () => void;
  day: number;
  slot: string;
  // The client's recorded allergies, for cross-referencing against each row's allergen tags
  // (prompt-104). Optional and defaulted to []: the template editor has no client in scope, and
  // absent simply means no warnings rather than a broken picker.
  clientAllergies?: string[];
  // The client's recorded dietary preferences (prompt-109). Two jobs: recipes matching at least
  // one sort to the top of the Recipes tab (server-side — see fetchMeals), and matching tags
  // render emphasized on the row. Same optionality rule as above: absent means plain recency
  // order and unemphasized tags, never a broken picker.
  clientDietaryPrefs?: string[];
}

interface ItemMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// One entry per selected food OR recipe. `amount` is "how many of `unit`" for food (e.g. 3
// dates, or 150 g) and servings for recipe — keeping a single field (rather than two, one of
// which is always unused) since a given entry is only ever one type. `macrosPerUnit` is
// captured at selection time (per-100g for food, per-serving for recipe) so the preview/total
// math doesn't depend on the food/recipe still being present in the current (possibly
// since-changed-by-search) query results. `unit`/`realMeasures`/etc are food-only, unused for
// recipes (always "srv").
interface SelectedItem {
  id: string;
  type: "food" | "recipe";
  name: string;
  amount: number;
  macrosPerUnit: ItemMacros;
  unit: string;
  realMeasures?: ServingSize[];
  unitWeights?: UnitWeights;
  commonServings?: ServingSize[];
  // Carried so the staging list below the tabs can repeat the conflict warning (prompt-104) —
  // an item staged from a tab the dietitian has since switched away from would otherwise show
  // no trace of why it was flagged.
  allergens?: string[];
}

// ── Scroll-to-grow limits ───────────────────────────────────────────────────────────────────
// Both list endpoints validate `limit` at max 100 server-side (foods.validation.js /
// meals.validation.js), so 100 is a hard ceiling here, not a taste call — asking for 130 is a
// 400, not a bigger page. 30 is what this picker always fetched; it stays the first page and
// becomes the growth step, so nothing changes for a dietitian who never scrolls.
const LIBRARY_LIMIT_STEP = 30;
const LIBRARY_LIMIT_MAX = 100;

// USDA's own ceiling is 200 per request (FDC returns a live 400 at 201 — see the comment on
// searchUsdaFoods in the backend's usda-client.js), and 25 matches USDA_DROPDOWN_LIMIT in
// new-recipe-dialog.tsx: FDC's Branded dataset outnumbers the three generic ones by roughly
// 15:1, so a smaller first page would fill with commercial products before generic matches.
const USDA_LIMIT_STEP = 25;
const USDA_LIMIT_MAX = 200;

// Grow a little before the literal last pixel — reads as smoother than a hard stop at the end.
const SCROLL_GROW_SLACK_PX = 48;
// This picker's My Library tab ranks by meal-plan usage (prompt-117).
const FOOD_SORT_BY = "usedInPlans" as const;

// Shared by both scrollers (the library/recipes ScrollArea, and the USDA tab's own panel).
function isNearBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_GROW_SLACK_PX;
}

// What both pick paths hand to buildSelectedFood. Structurally a subset of FoodItem, which is
// what fetchFoods returns AND what importUsdaFood returns — stated as its own alias so the two
// call sites are provably passing the same thing.
type PickableFood = Pick<
  FoodItem,
  "id" | "name" | "unitWeights" | "servings" | "portions" | "allergens"
> & {
  macros: ItemMacros;
};

function selectionKey(type: "food" | "recipe", id: string) {
  return `${type}:${id}`;
}

// Resolves a food item's selected measure (real per-food portion or generic unit) down to a
// gram total exactly like new-recipe-dialog.tsx's live preview does — resolveMeasure()
// normalizes a real-measure selection to unit="g" first, so gramsPerUnitForFood's existing
// generic-unit resolution always runs on a value it already understands either way.
function foodGrams(item: SelectedItem): number {
  const resolved = resolveMeasure(item.realMeasures, item.unit, item.amount);
  return (
    resolved.quantity *
    gramsPerUnitForFood(item.commonServings, item.unitWeights, resolved.unit, item.realMeasures)
  );
}

function scaleMacros(item: SelectedItem): ItemMacros {
  const factor = item.type === "food" ? foodGrams(item) / 100 : item.amount;
  return {
    kcal: Math.round(item.macrosPerUnit.kcal * factor),
    protein: Math.round(item.macrosPerUnit.protein * factor),
    carbs: Math.round(item.macrosPerUnit.carbs * factor),
    fat: Math.round(item.macrosPerUnit.fat * factor),
  };
}

// Hover preview for a recipe row (prompt-114) — "which of these two similarly-named recipes is
// the one I mean", answered without leaving the picker. Same HoverCard primitives and visual
// language as nutrient-contributions.tsx, but with no fetch: the Recipes tab already holds full
// `ingredients` for every row it rendered, so this is synchronous and needs no loading state.
//
// PER SERVING is stated in the header because the Meal Library drawer shows the WHOLE-recipe
// amount for the same ingredients. Two different numbers for the same row in the same app is
// exactly the confusion worth one line of copy to prevent.
function RecipeIngredientsHover({
  recipe,
  children,
}: {
  recipe: Recipe;
  children: React.ReactNode;
}) {
  // Nothing to preview — render the row untouched rather than an empty card, the same way
  // NutrientContributionsHover bails on an empty contributor list.
  if (!recipe.ingredients?.length) return <>{children}</>;

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      {/* Portalled: this trigger lives inside both a Dialog and a ScrollArea viewport, and an
          un-portalled card is clipped to a sliver at their edge (see hover-card.tsx).
          side="right" keeps it clear of the row list it is describing. */}
      <HoverCardContent portal side="right" align="start" className="w-64 p-3 text-left text-xs">
        <div className="text-sm font-medium leading-tight">{recipe.name}</div>
        <div className="mb-2 mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ingredients · per serving
          {recipe.servings > 1 ? ` (of ${recipe.servings})` : ""}
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {recipe.ingredients.map((ing, idx) =>
            ing.type === "section" ? (
              // Kept as a sub-heading rather than skipped: a multi-component recipe reads as
              // "Batter / Frosting" groups, and dropping the dividers would run them together.
              <li
                key={`${ing.name}-${idx}`}
                className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0"
              >
                {ing.name}
              </li>
            ) : (
              <li key={`${ing.name}-${idx}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{ing.name}</span>
                {/* An em dash, never "0 g": no resolvable weight means unknown, and a dietitian
                    reading a fabricated 0 would draw the opposite conclusion. */}
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {ing.gramsPerServing != null ? `${ing.gramsPerServing} g` : "—"}
                </span>
              </li>
            ),
          )}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function PlanItemPicker({
  open,
  onOpenChange,
  onAdd,
  onAdded,
  day,
  slot,
  clientAllergies = [],
  clientDietaryPrefs = [],
}: PlanItemPickerProps) {
  // "food" still means My Library — the value is kept so the query keys, reset keys and
  // handlers all read the same as before; only its tab label changed (prompt-103).
  const [tab, setTab] = useState<"food" | "usda" | "recipe">("food");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();

  // Three independent scroll-growth counters (prompt-102). Separate state, separate resets and
  // separate caps — the Foods tab's library list and its USDA panel below it grow from their own
  // scrollers, and the Recipes tab's counter is untouched by either.
  const [foodLimit, setFoodLimit] = useState(LIBRARY_LIMIT_STEP);
  const [recipeLimit, setRecipeLimit] = useState(LIBRARY_LIMIT_STEP);
  const [usdaLimit, setUsdaLimit] = useState(USDA_LIMIT_STEP);
  // Defaults to every type EXCEPT Branded, the same convention new-recipe-dialog.tsx's
  // ingredient search uses: a plan item normally wants the generic USDA reference food, and
  // Branded's sheer size otherwise crowds the other three out. Branded is one tap away; an
  // empty Set falls through to "no filter", matching the chips' all-or-nothing semantics.
  const [dataTypeFilter, setDataTypeFilter] = useState<Set<UsdaDataType>>(
    new Set(["Foundation", "SR Legacy", "Survey (FNDDS)"]),
  );
  const [importingFdcId, setImportingFdcId] = useState<number | null>(null);
  // FDA %DV nutrient content claim filter (prompt-110) — the same control Food Database and
  // Meal Library already carry, so a dietitian can pull up "good source of manganese" while
  // actually placing items rather than only while browsing. ONE control shared by the My
  // Library and Recipes tabs (it applies to whichever is showing), not one per tab.
  const [claimNutrient, setClaimNutrient] = useState<string>("");
  const [claimLevel, setClaimLevel] = useState<NutrientClaimLevel | "">("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedItems(new Map());
      setTab("food");
    }
  }, [open]);

  // A fresh list must not inherit how far the dietitian had scrolled somewhere else — growth is
  // earned per search term and per tab, never carried across either. Both library counters
  // reset together because switching tabs abandons whichever list was being scrolled; USDA
  // resets on those two triggers plus its own source filter, since changing which FDC data
  // types are searched is a different result set.
  //
  // Adjusted DURING render, not in an effect. An effect runs after the render that first pairs
  // the new search term with the OLD grown limit, and React Query subscribes on that render —
  // so a dietitian who had scrolled to limit=90 and then typed a new term fired a wasted
  // request at (newTerm, 90) and saw 90 rows flash up before the reset shrank it back to 30.
  // This is React's documented "adjust state when a prop changes" pattern: the component
  // re-renders immediately with the reset value, before the stale query is ever issued.
  const dataTypesKey = [...dataTypeFilter].sort().join(",");
  // Folded into the reset key because it changes the ORDER the server returns recipes in
  // (prompt-109). Reopening the picker for a different client would otherwise leave the list
  // grown to its previous limit and scrolled mid-way through a ranking that no longer applies.
  // Sorted so an array that differs only in order isn't treated as a change.
  const dietPrefsKey = [...clientDietaryPrefs].sort().join(",");
  // Two plain strings, so no sorting needed — but folded into the SAME reset key for the same
  // reason (prompt-110): changing the claim changes which rows should be showing, and a list
  // left scrolled and grown would otherwise stay mid-scroll against a filter that just moved
  // the goalposts.
  const claimKey = `${claimNutrient}\u0000${claimLevel}`;
  const libraryResetKey = `${debouncedSearch}\u0000${tab}\u0000${dietPrefsKey}\u0000${claimKey}`;
  const usdaResetKey = `${libraryResetKey}\u0000${dataTypesKey}`;
  const [lastLibraryResetKey, setLastLibraryResetKey] = useState(libraryResetKey);
  const [lastUsdaResetKey, setLastUsdaResetKey] = useState(usdaResetKey);
  if (lastLibraryResetKey !== libraryResetKey) {
    setLastLibraryResetKey(libraryResetKey);
    setFoodLimit(LIBRARY_LIMIT_STEP);
    setRecipeLimit(LIBRARY_LIMIT_STEP);
  }
  if (lastUsdaResetKey !== usdaResetKey) {
    setLastUsdaResetKey(usdaResetKey);
    setUsdaLimit(USDA_LIMIT_STEP);
  }

  // Resetting the counter is only half of it: the scroll POSITION survives a search change too,
  // so a list left scrolled to the bottom lands at the bottom of the next one and fires
  // near-bottom instantly — re-growing to 60 before the dietitian has scrolled a pixel.
  // Observed live: typing a new term after scrolling produced 30 → 60 with no input.
  //
  // ScrollArea forwards its ref to Radix's Root, not the element that scrolls, so the viewport
  // is queried out of it the same way meal-plans.tsx's drag auto-scroll does.
  const listRef = useRef<HTMLDivElement>(null);
  const usdaPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector("[data-radix-scroll-area-viewport]")?.scrollTo({ top: 0 });
  }, [libraryResetKey]);
  useEffect(() => {
    usdaPanelRef.current?.scrollTo({ top: 0 });
  }, [usdaResetKey]);

  // placeholderData keeps the current rows on screen while the next (larger) limit is in
  // flight. The limit is part of the query key, so without it every growth step would land on
  // an empty cache entry and blank the list mid-scroll — very visible in a list, which is why
  // this differs from the dropdown in new-recipe-dialog.tsx.
  const {
    data: foodsData,
    isLoading: foodsLoading,
    isFetching: foodsFetching,
  } = useQuery({
    // FOOD_SORT_BY is in the key even though it is a constant for this call site (prompt-117):
    // if it ever becomes conditional, a cache entry keyed without it would serve the other
    // ordering's rows.
    queryKey: ["foods", "plan-picker", debouncedSearch, foodLimit, claimKey, FOOD_SORT_BY],
    queryFn: () =>
      fetchFoods({
        search: debouncedSearch || undefined,
        limit: foodLimit,
        // Most-used-in-meal-plans first. Specifically NOT recipe-ingredient usage: this picker
        // is placing a food directly into a plan, so "what do I put in plans" is the useful
        // ranking, not "what do I cook with".
        sortBy: FOOD_SORT_BY,
        // Server-side for foods: Food.nutrientClaims is stored and indexed, and buildFoodFilter
        // already does the $elemMatch — exactly what Food Database's own filter uses.
        claimNutrient: claimNutrient || undefined,
        claimLevel: claimNutrient && claimLevel ? claimLevel : undefined,
      }),
    enabled: tab === "food" && open,
    placeholderData: keepPreviousData,
  });

  // A recipe's claims are computed on READ (meals.service.js's withMicronutrients) rather than
  // stored and indexed the way Food.nutrientClaims is, so there is no server-side query param
  // to filter them — the filtering happens client-side below, exactly as meal-library.tsx does.
  //
  // That page gets away with it because it always fetches the 100 ceiling, i.e. effectively the
  // whole library. This picker doesn't: it grows from 30 as you scroll. Filtering only what
  // happens to be loaded would silently hide a qualifying recipe sitting at position 45. So
  // while a claim filter is active the recipe query asks for the ceiling outright, putting it
  // on the same "effectively everything" footing meal-library.tsx already relies on.
  const effectiveRecipeLimit = claimNutrient ? LIBRARY_LIMIT_MAX : recipeLimit;

  const {
    data: mealsData,
    isLoading: mealsLoading,
    isFetching: mealsFetching,
  } = useQuery({
    // dietPrefsKey is part of the key, not just the queryFn: it changes the returned ORDER, so
    // React Query has to treat a different client as a different result set rather than serving
    // the previous client's ranking from cache.
    queryKey: [
      "meals",
      "plan-picker",
      debouncedSearch,
      effectiveRecipeLimit,
      dietPrefsKey,
      claimKey,
    ],
    queryFn: () =>
      fetchMeals({
        search: debouncedSearch || undefined,
        limit: effectiveRecipeLimit,
        dietaryPrefs: clientDietaryPrefs.length ? clientDietaryPrefs : undefined,
      }),
    enabled: tab === "recipe" && open,
    placeholderData: keepPreviousData,
  });

  const foods = foodsData?.foods ?? [];
  // Same predicate meal-library.tsx applies (prompt-110): a recipe qualifies when its own
  // per-serving panel crosses the threshold for the chosen nutrient. "Any level" matches either
  // High or Good Source. Recipe.micronutrients is already carried through toRecipe(), so the
  // row type needed no widening.
  const allRecipes = useMemo(() => mealsData?.meals ?? [], [mealsData]);
  const recipes = useMemo(() => {
    if (!claimNutrient) return allRecipes;
    return allRecipes.filter((r) => {
      const row = r.micronutrients?.find((m) => m.nutrient === claimNutrient);
      if (!row?.level) return false;
      if (claimLevel && row.level !== claimLevel) return false;
      return true;
    });
  }, [allRecipes, claimNutrient, claimLevel]);
  const isLoading = tab === "food" ? foodsLoading : tab === "recipe" ? mealsLoading : false;

  // `total` is the server's real count for the filter, not the page size, so this is "are there
  // more to fetch" rather than "did the page come back full".
  const foodsHasMore = foodLimit < LIBRARY_LIMIT_MAX && foodLimit < (foodsData?.total ?? 0);
  // No growth while a claim filter is active — the query already asked for the ceiling, so
  // there is nothing further to grow into and a near-bottom scroll would only refetch.
  const recipesHasMore =
    !claimNutrient && recipeLimit < LIBRARY_LIMIT_MAX && recipeLimit < (mealsData?.total ?? 0);

  // ── Live USDA FoodData Central (prompt-102) ─────────────────────────────────────────────────
  // Same endpoints and the same params new-recipe-dialog.tsx's ingredient search uses; only the
  // page size and the query-key namespace differ. "plan-picker" in the key for the same reason
  // "ingredient" is in that one's: Food Database caches its own USDA searches without a limit in
  // the key, so sharing it at a different limit would cross-serve responses.
  //
  // Foods tab only — USDA has no concept of a recipe, so the Recipes tab never fires this.
  const usdaEnabled = open && tab === "usda" && debouncedSearch.trim().length > 1;
  const { data: usdaData, isFetching: usdaFetching } = useQuery({
    queryKey: ["foods", "usda-search", "plan-picker", debouncedSearch, dataTypesKey, usdaLimit],
    queryFn: () =>
      searchUsda(debouncedSearch, {
        limit: usdaLimit,
        dataTypes: dataTypeFilter.size > 0 ? [...dataTypeFilter] : undefined,
      }),
    enabled: usdaEnabled,
    placeholderData: keepPreviousData,
  });
  const usdaResults = useMemo(() => usdaData?.results ?? [], [usdaData]);
  const usdaHasMore = usdaLimit < USDA_LIMIT_MAX && usdaLimit < (usdaData?.total ?? 0);

  // Anything already imported is dropped from the USDA section — it's already in the library
  // list above, from its own Food document. One bulk existence check per result set, never one
  // request per row.
  const resultFdcIdsKey = usdaResults.map((r) => r.fdcId).join(",");
  const { data: importedFdcIds } = useQuery({
    queryKey: ["foods", "usda-imported", resultFdcIdsKey],
    queryFn: () => fetchImportedUsdaFdcIds(usdaResults.map((r) => r.fdcId)),
    enabled: usdaResults.length > 0,
  });
  const importedSet = useMemo(() => new Set(importedFdcIds ?? []), [importedFdcIds]);
  // That check is a SECOND request, keyed on the fdcIds the search just returned, so there is a
  // window where the hits are known but which of them are already in the library isn't.
  // Rendering during it would show a food twice — once under Foods, once under USDA — until the
  // check landed. The section waits for the answer instead of guessing; it's one indexed local
  // query, short next to the FDC search that precedes it.
  const importedKnown = usdaResults.length === 0 || importedFdcIds !== undefined;
  const usdaHits = useMemo(
    () => (importedKnown ? usdaResults.filter((r) => !importedSet.has(r.fdcId)) : []),
    [usdaResults, importedSet, importedKnown],
  );
  // Growth handlers. The outer one drives whichever library list the current tab shows; the USDA
  // panel below has its own scroller and its own handler, so neither can advance the other's
  // counter. Both no-op while a fetch is already in flight, so one flick of the wheel near the
  // bottom asks for exactly one more batch.
  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isNearBottom(e.currentTarget)) return;
    if (tab === "food") {
      if (foodsHasMore && !foodsFetching) {
        setFoodLimit((n) => Math.min(LIBRARY_LIMIT_MAX, n + LIBRARY_LIMIT_STEP));
      }
    } else if (tab === "recipe" && recipesHasMore && !mealsFetching) {
      setRecipeLimit((n) => Math.min(LIBRARY_LIMIT_MAX, n + LIBRARY_LIMIT_STEP));
    }
  };

  const handleUsdaScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!usdaHasMore || usdaFetching) return;
    if (isNearBottom(e.currentTarget)) {
      setUsdaLimit((n) => Math.min(USDA_LIMIT_MAX, n + USDA_LIMIT_STEP));
    }
  };

  // The one place a food becomes a staged item, shared by the library rows and the USDA import
  // path below. Both feed it the same `FoodItem` shape (fetchFoods returns FoodItem[], and
  // importUsdaFood maps its response through the very same toFoodItem), so a USDA-imported pick
  // is identical downstream to a library pick — same id, macros, unitWeights, servings and
  // portions, therefore the same MeasureSelect options and the same onAdd payload.
  function buildSelectedFood(f: PickableFood): SelectedItem {
    return {
      id: f.id,
      type: "food",
      name: f.name,
      amount: 100,
      unit: "g",
      macrosPerUnit: f.macros,
      unitWeights: f.unitWeights,
      commonServings: f.servings,
      realMeasures: f.portions,
      allergens: f.allergens,
    };
  }

  // Advisory only (prompt-104): the item is staged either way. Fired on the way IN, not on
  // removal, and not on every re-render — a dietitian may well be adding a conflicting food
  // deliberately (a substitution, a client re-challenge), so this acknowledges the conflict
  // rather than standing in its way. No confirmation dialog.
  function noteConflicts(name: string, allergens: string[] | undefined) {
    const conflicts = getAllergyConflicts(clientAllergies, allergens);
    if (conflicts.length) toast.warning(`${name} — ${formatAllergyConflicts(conflicts)}`);
  }

  function toggleFood(f: PickableFood) {
    const key = selectionKey("food", f.id);
    if (!selectedItems.has(key)) noteConflicts(f.name, f.allergens);
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, buildSelectedFood(f));
      }
      return next;
    });
  }

  // Importing always STAGES, never toggles. A USDA row is only rendered while the food is not
  // in the library, so the toggle semantics the library rows use have no meaning here — and a
  // second click landing in the gap between the import finishing and the row disappearing would
  // otherwise un-stage the food the dietitian just asked for.
  function stageFood(f: PickableFood) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.set(selectionKey("food", f.id), buildSelectedFood(f));
      return next;
    });
  }

  // Picking a live USDA hit imports it first. Everything the staged item needs — id, per-100 g
  // macros, unit weights, portions — comes from the created Food document, never from the
  // search hit, which carries none of it.
  async function pickUsda(hit: UsdaSearchResult) {
    if (importingFdcId != null) return;
    setImportingFdcId(hit.fdcId);
    try {
      const food = await importUsdaFood(hit.fdcId);
      stageFood(food);
      // My Library, its stats and the "already imported" checks all key off "foods" — this is
      // what makes the row disappear from the USDA section and reappear in the list above.
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast.success(`${food.name} added to your library`);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't add that food to your library");
    } finally {
      setImportingFdcId(null);
    }
  }

  function toggleRecipe(id: string, name: string, macros: ItemMacros, allergens?: string[]) {
    const key = selectionKey("recipe", id);
    if (!selectedItems.has(key)) noteConflicts(name, allergens);
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          id,
          type: "recipe",
          name,
          amount: 1,
          unit: "srv",
          macrosPerUnit: macros,
          allergens,
        });
      }
      return next;
    });
  }

  function updateAmount(key: string, amount: number) {
    setSelectedItems((prev) => {
      const item = prev.get(key);
      if (!item) return prev;
      const next = new Map(prev);
      next.set(key, { ...item, amount });
      return next;
    });
  }

  function updateUnit(key: string, unit: string) {
    setSelectedItems((prev) => {
      const item = prev.get(key);
      if (!item) return prev;
      const next = new Map(prev);
      next.set(key, { ...item, unit });
      return next;
    });
  }

  function removeSelected(key: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  const selectedList = useMemo(() => Array.from(selectedItems.entries()), [selectedItems]);

  const combinedTotal = useMemo(() => {
    return selectedList.reduce(
      (acc, [, item]) => {
        const m = scaleMacros(item);
        return {
          kcal: acc.kcal + m.kcal,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [selectedList]);

  async function handleAdd() {
    if (selectedList.length === 0) return;
    setAdding(true);
    try {
      const settled = await Promise.allSettled(
        selectedList.map(([, item]) => {
          if (item.type !== "food") {
            return onAdd({ day, slot, type: "recipe", meal: item.id, servings: item.amount });
          }
          // A real-measure selection resolves to its exact gram total here (unit="g") — see
          // measure-select.tsx/measure-options.ts; a generic-unit selection passes through
          // unchanged, exactly as this already sent before prompt-45 (unit was always "g").
          const resolved = resolveMeasure(item.realMeasures, item.unit, item.amount);
          return onAdd({
            day,
            slot,
            type: "food",
            food: item.id,
            quantity: resolved.quantity,
            unit: resolved.unit,
            measureLabel: resolved.measureLabel,
            measureDescription: resolved.measureDescription,
            measureCount: resolved.measureCount,
          });
        }),
      );

      const failedKeys = new Set(
        selectedList.filter((_, idx) => settled[idx].status === "rejected").map(([key]) => key),
      );
      const succeeded = selectedList.length - failedKeys.size;

      // Refresh only after every add has settled (success or failure), not after the first
      // one resolves — a partial failure still means some items landed and the slot changed.
      if (succeeded > 0) {
        onAdded?.();
      }

      if (failedKeys.size === 0) {
        toast.success(`${succeeded} item${succeeded === 1 ? "" : "s"} added to ${slotLabel}`);
        onOpenChange(false);
      } else if (succeeded === 0) {
        toast.error(
          `Couldn't add ${failedKeys.size === 1 ? "that item" : "those items"} — try again`,
        );
      } else {
        toast.warning(
          `${succeeded} of ${selectedList.length} items added — ${failedKeys.size} failed, still selected below`,
        );
        // Keep only the failed items selected so the dietitian can retry just those, instead
        // of re-picking everything (matches the bulk USDA import's per-item accountability).
        setSelectedItems((prev) => {
          const next = new Map();
          for (const [key, item] of prev) {
            if (failedKeys.has(key)) next.set(key, item);
          }
          return next;
        });
      }
    } finally {
      setAdding(false);
    }
  }

  const slotLabel = SLOT_META[slot as MealSlot]?.label || slot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b">
          <DialogTitle className="text-base">Add to {slotLabel}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "food" | "usda" | "recipe")}>
            <TabsList className="grid grid-cols-3 h-8 w-full">
              <TabsTrigger value="food" className="text-xs gap-1.5">
                <Apple className="h-3.5 w-3.5" />
                My Library
              </TabsTrigger>
              <TabsTrigger value="usda" className="text-xs gap-1.5">
                <Database className="h-3.5 w-3.5" />
                USDA Search
              </TabsTrigger>
              <TabsTrigger value="recipe" className="text-xs gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5" />
                Recipes
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "food"
                  ? "Search your library…"
                  : tab === "usda"
                    ? "Search USDA FoodData Central…"
                    : "Search recipes…"
              }
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* FDA %DV nutrient content claim filter (prompt-110) — "High Source" is >=20% DV per
              serving, "Good Source" is 10-19% (21 CFR 101.54); "Any level" matches either.
              Identical control and copy to Food Database's and Meal Library's, deliberately: a
              dietitian shouldn't have to learn a second version of the same filter here.

              ONE control for both list tabs rather than one per tab — it applies to whichever
              is showing. Hidden on USDA Search because an FDC search hit carries no claim data
              to filter on: UsdaSearchResult is macros only (calories/protein/carbs/fat/fiber/
              sugar/sodium), with no micronutrients and no nutrientClaims, so a food only gains
              claims once it's imported and becomes a Food document. Same established gap as the
              allergen and diet-tag work, which skip this tab for the same reason. */}
          {tab !== "usda" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nutrient claim
              </span>
              <select
                value={claimNutrient}
                onChange={(e) => setClaimNutrient(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Any nutrient</option>
                {Object.entries(NUTRIENT_CLAIM_LABEL)
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
              <select
                value={claimLevel}
                onChange={(e) => setClaimLevel(e.target.value as NutrientClaimLevel | "")}
                disabled={!claimNutrient}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
              >
                <option value="">Any level</option>
                <option value="high">High Source (&ge;20% DV)</option>
                <option value="good">Good Source (10-19% DV)</option>
              </select>
              {claimNutrient && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setClaimNutrient("");
                    setClaimLevel("");
                  }}
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {tab === "usda" ? (
          /* USDA gets its own tab rather than a panel nested under My Library (prompt-103).
             As a sub-section it was squeezed under whatever the library had matched — with a
             single library hit the chips and results ran straight into it and read as broken.
             A tab of its own also means exactly ONE scroller here (this panel), where the
             nested version had two, which is what made the growth handlers delicate. */
          <div className="px-5 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              {/* "USDA source" here, not "From USDA FoodData Central" — the tab itself is
                  already labeled "USDA Search" (prompt-103), so restating the source above the
                  chips read as redundant. This still labels what the chips below select,
                  matching the wording new-recipe-dialog.tsx's ingredient search already uses. */}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                USDA source
              </span>
              {(usdaFetching || !importedKnown) && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Source chips — the same four FDC data types and the same semantics as the
                ingredient search and Food Database: none selected means no filter, and
                the choice is forwarded to FDC's own dataType param, not applied
                client-side. */}
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              {USDA_DATA_TYPES.map((type) => {
                const active = dataTypeFilter.has(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="h-5 rounded-full px-2 text-[10px]"
                    onClick={() =>
                      setDataTypeFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      })
                    }
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
                  onClick={() => setDataTypeFilter(new Set())}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Its own scroller, so USDA growth is driven by scrolling THIS panel and the
                library list above keeps its own position and counter. Bounded height
                keeps a 200-result USDA set from burying the library results in a dialog
                this size. */}
            <div
              ref={usdaPanelRef}
              className="h-60 space-y-1 overflow-y-auto rounded-md border bg-muted/10 p-1"
              onScroll={handleUsdaScroll}
            >
              {usdaHits.map((hit) => {
                const importing = importingFdcId === hit.fdcId;
                return (
                  <button
                    key={hit.fdcId}
                    disabled={importingFdcId != null}
                    onClick={() => void pickUsda(hit)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/40",
                      importingFdcId != null && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium" title={hit.name}>
                        {hit.name}
                      </span>
                      {importing ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Adding…
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-sky-300 px-1 text-[9px] text-sky-700"
                        >
                          {USDA_DATA_TYPE_LABEL[hit.dataType ?? ""] ?? hit.dataType ?? "USDA"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {hit.brand ? `${hit.brand} · ` : ""}
                      per 100g: {hit.macros.calories} kcal · P{hit.macros.protein} C
                      {hit.macros.carbs} F{hit.macros.fat}
                    </div>
                  </button>
                );
              })}

              {usdaHits.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {usdaFetching || !importedKnown
                    ? "Searching USDA…"
                    : "No new USDA matches — everything found is already in your library."}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* onViewportScroll, not onScroll: ScrollArea spreads its other props onto Radix's
             Root, which is not the element that scrolls — see the note in ui/scroll-area.tsx. */
          <ScrollArea ref={listRef} className="h-75 px-5 py-2" onViewportScroll={handleListScroll}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : tab === "food" ? (
              <div className="space-y-1">
                {foods.map((f) => {
                  const selected = selectedItems.has(selectionKey("food", f.id));
                  return (
                    <button
                      key={f.id}
                      onClick={() =>
                        toggleFood({
                          id: f.id,
                          name: f.name,
                          macros: f.macros,
                          unitWeights: f.unitWeights,
                          servings: f.servings,
                          portions: f.portions,
                          allergens: f.allergens,
                        })
                      }
                      className={cn(
                        "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                        selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium" title={f.name}>
                          {f.name}
                        </span>
                        {f.verified && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                            verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                        per 100g: {f.macros.kcal} kcal · P{f.macros.protein} C{f.macros.carbs} F
                        {f.macros.fat}
                      </div>
                      <AllergyConflictBadge
                        className="mt-1"
                        conflicts={getAllergyConflicts(clientAllergies, f.allergens)}
                      />
                    </button>
                  );
                })}
                {foods.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No foods found</p>
                )}

                {foodsFetching && foods.length > 0 && (
                  <p className="py-2 text-center text-[10px] text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Loading more…
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {recipes.map((r) => {
                  const selected = selectedItems.has(selectionKey("recipe", r.id));
                  return (
                    <RecipeIngredientsHover key={r.id} recipe={r}>
                      <button
                        onClick={() => toggleRecipe(r.id, r.name, r.macros, r.allergens)}
                        className={cn(
                          "w-full text-left rounded-md px-2.5 py-2 transition-colors",
                          selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                            {r.photoUrl ? (
                              <img
                                src={r.photoUrl}
                                alt={r.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-base leading-none">{r.image}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{r.name}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {r.macros.kcal} kcal · P{r.macros.protein} C{r.macros.carbs} F
                              {r.macros.fat}
                            </span>
                            <AllergyConflictBadge
                              className="mt-1"
                              conflicts={getAllergyConflicts(clientAllergies, r.allergens)}
                            />
                            {/* Informational, never a warning — emerald/leaf, deliberately
                                nothing like the rose conflict badge directly above it. */}
                            <DietTagBadges
                              className="mt-1"
                              diets={r.diets}
                              clientDietaryPrefs={clientDietaryPrefs}
                            />
                          </div>
                        </div>
                      </button>
                    </RecipeIngredientsHover>
                  );
                })}
                {recipes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No recipes found</p>
                )}
                {/* Recipes get Phase 2's growth and nothing else — USDA has no notion of a
                  recipe, so there is no second section on this tab. */}
                {mealsFetching && recipes.length > 0 && (
                  <p className="py-2 text-center text-[10px] text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Loading more…
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        )}

        {selectedList.length > 0 && (
          <div className="px-5 py-3 border-t bg-muted/10 space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 -mr-1 pr-1">
              {selectedList.map(([key, item]) => {
                // Same scaleMacros() the footer total below reduces over — one shared
                // computation, so a per-item row and the running total can never disagree
                // (prompt-51: they previously could, since this row didn't exist at all and
                // nothing guaranteed a future one would derive from the same function).
                const itemMacros = scaleMacros(item);
                // Gram equivalent (prompt-69) of a non-gram measure, from the same foodGrams()
                // scaleMacros() just used above — leading the existing macro line rather than
                // adding a third line, so the staging list's row height is unchanged.
                const gramEq =
                  item.type === "food"
                    ? formatGramEquivalent(item.unit, item.amount, foodGrams(item))
                    : null;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {gramEq && <>{gramEq} · </>}
                        {itemMacros.kcal} kcal · P{itemMacros.protein} C{itemMacros.carbs} F
                        {itemMacros.fat}
                      </p>
                      <AllergyConflictBadge
                        compact
                        conflicts={getAllergyConflicts(clientAllergies, item.allergens)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.type === "food" ? (
                        <MeasureSelect
                          realMeasures={item.realMeasures}
                          option={item.unit}
                          count={item.amount}
                          onOptionChange={(u) => updateUnit(key, u)}
                          onCountChange={(v) => updateAmount(key, typeof v === "number" ? v : 0)}
                          quantityClassName="h-8 w-16 text-sm tabular-nums text-right"
                          unitClassName="h-8 w-24 text-xs"
                        />
                      ) : (
                        <>
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateAmount(key, Number(e.target.value) || 0)}
                            className="h-8 w-16 text-sm tabular-nums text-right"
                            min={0.5}
                            step={0.5}
                          />
                          <span className="text-xs text-muted-foreground w-6">srv</span>
                        </>
                      )}
                      <button
                        onClick={() => removeSelected(key)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground border-t pt-2">
              <span className="font-medium text-foreground">{combinedTotal.kcal} kcal total</span>
              <span>P{combinedTotal.protein}</span>
              <span>C{combinedTotal.carbs}</span>
              <span>F{combinedTotal.fat}</span>
            </div>

            <Button size="sm" className="w-full" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {adding
                ? "Adding…"
                : `Add ${selectedList.length} item${selectedList.length === 1 ? "" : "s"} to slot`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
