import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  Heart,
  Clock,
  Users,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Sparkles,
  CheckCircle2,
  BookOpen,
  X,
  Leaf,
  AlertTriangle,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { MicronutrientPanel } from "@/components/micronutrient-panel";
import { ContributionHover } from "@/components/nutrient-contributions";
import {
  CATEGORY_META,
  type NutrientContribution,
  type Recipe,
  type RecipeCategory,
  type DietTag,
} from "@/lib/meal-library-mock";
import {
  NUTRIENT_CLAIM_LABEL,
  OTHER_NUTRIENT_FIELDS,
  type NutrientClaimLevel,
} from "@/lib/food-database-mock";
import { fetchMeals, deleteMeal, duplicateMeal, getMeal } from "@/lib/meals-api";
import { fetchDietaryPreferences } from "@/lib/settings-api";
import { NewRecipeDialog } from "@/components/new-recipe-dialog";
import { ImportRecipeDialog } from "@/components/import-recipe-dialog";
import type { ImportedRecipe } from "@/lib/recipe-import-api";

// "Other" nutrient key (as OTHER_NUTRIENT_FIELDS and the backend's Food fields name it) -> this
// recipe's own per-serving figure (prompt-100). Written out rather than computed as
// r[`${key}PerServing`], so TypeScript actually checks each field exists — a stringly-typed
// lookup would return undefined for a typo and silently filter everything out instead of
// failing the build. Add a nutrient here when one is added to OTHER_NUTRIENT_FIELDS.
const OTHER_PER_SERVING: Record<string, (r: Recipe) => number | null | undefined> = {
  oxalate: (r) => r.oxalatePerServing,
  phytate: (r) => r.phytatePerServing,
};

export const Route = createFileRoute("/meal-library")({
  head: () => ({
    meta: [
      { title: "Meal Library — Nutria" },
      {
        name: "description",
        content: "Reusable recipes with photos, macros, and allergen tags.",
      },
    ],
  }),
  component: MealLibraryPage,
});

const CATEGORIES: (RecipeCategory | "all")[] = [
  "all",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "drink",
];

function MealLibraryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [activeDiets, setActiveDiets] = useState<DietTag[]>([]);
  // FDA %DV nutrient content claim filter (same High/Good Source system as the Food Database
  // page), applied to this recipe's own per-serving micronutrient panel — computed server-side
  // from its ingredients (see Recipe.micronutrients / meals.service.js withMicronutrients).
  const [claimNutrient, setClaimNutrient] = useState<string>("");
  const [claimLevel, setClaimLevel] = useState<NutrientClaimLevel | "">("");
  // "Other"-group MAXIMUM per serving in mg (prompt-99 for oxalate, generalized to a nutrient
  // picker in prompt-100) — its own pair of controls, not a claim level, since neither nutrient
  // has an FDA Daily Value to tier against. "" = off on either half; both are needed to filter.
  const [otherNutrient, setOtherNutrient] = useState<string>("");
  const [maxOther, setMaxOther] = useState<string>("");
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  // Recipe import (prompt-120). `imported` is handed straight to NewRecipeDialog as pre-fill —
  // it is never saved from here. Cleared when that dialog closes so the next plain "New recipe"
  // starts blank rather than resurrecting the last import.
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meals", search, category],
    queryFn: () =>
      fetchMeals({
        search: search || undefined,
        category: category !== "all" ? category : undefined,
        limit: 100,
      }),
  });

  const { data: dietFilters = [] } = useQuery({
    queryKey: ["settings", "dietary-preferences"],
    queryFn: fetchDietaryPreferences,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMeal(id),
    onSuccess: () => {
      toast.success("Recipe deleted");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Post-action behaviour copied from meal-plans.tsx's handleDuplicateCreated: refresh the list
  // and select the copy, staying on this page rather than navigating anywhere. The drawer is
  // already open on the source, so swapping `selected` to the copy leaves the dietitian looking
  // at the new recipe — the same "you're now on the duplicate" outcome setSelectedId gives for
  // plans, in this page's own idiom.
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateMeal(id),
    onSuccess: (copy) => {
      toast.success(`Created "${copy.name}"`);
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setSelected(copy);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNewRecipe = () => {
    setEditingId(null);
    // Belt-and-braces alongside the onOpenChange reset: "New recipe" must always start blank,
    // never inherit the previous import's pre-fill.
    setImported(null);
    setNewOpen(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setSelected(null);
    setEditingId(recipe.id);
    setImported(null);
    setNewOpen(true);
  };

  const allMeals = useMemo(() => data?.meals ?? [], [data?.meals]);

  const filtered = useMemo(() => {
    return allMeals.filter((r) => {
      if (favOnly && !r.isFavorite) return false;
      if (activeDiets.length && !activeDiets.every((d) => r.diets.includes(d))) return false;
      // Nutrient claim: match a recipe whose own per-serving panel crosses the claim threshold
      // for the chosen nutrient. "Any level" (claimLevel === "") matches either High or Good
      // Source, mirroring the Food Database page's same filter.
      if (claimNutrient) {
        const row = r.micronutrients?.find((m) => m.nutrient === claimNutrient);
        if (!row?.level) return false;
        if (claimLevel && row.level !== claimLevel) return false;
      }
      // "Other" nutrient ceiling, per serving. A null (no ingredient in the recipe reports the
      // chosen nutrient) EXCLUDES rather than passes: "we have no phytate data for this" is not
      // the same claim as "this is low in phytate", and a filter meant to find safe recipes must
      // not quietly hand back unverified ones. 0 is a real measured value and passes normally.
      if (otherNutrient && maxOther) {
        const perServing = OTHER_PER_SERVING[otherNutrient]?.(r);
        if (perServing == null) return false;
        if (perServing > Number(maxOther)) return false;
      }
      return true;
    });
  }, [allMeals, activeDiets, favOnly, claimNutrient, claimLevel, otherNutrient, maxOther]);

  const stats = useMemo(() => {
    const total = allMeals.length;
    const fav = allMeals.filter((r) => r.isFavorite).length;
    return { total, fav };
  }, [allMeals]);

  const toggleDiet = (d: DietTag) =>
    setActiveDiets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title="Meal Library"
        description="Reusable recipes with verified macros, photos, and allergen tags. Drop any recipe into a client plan in one click."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Import recipe
            </Button>
            <Button size="sm" onClick={openNewRecipe}>
              <Plus className="h-4 w-4" />
              New recipe
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <KpiCard label="Total recipes" value={stats.total} icon={BookOpen} />
        <KpiCard label="Favorites" value={stats.fav} icon={Heart} tone="text-rose-500" />
      </div>

      <div className="space-y-6">
        {/* Diet filters */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            Diet & tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {dietFilters.map((d) => {
              const active = activeDiets.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDiet(d)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] border transition-colors",
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

          <Separator className="my-3" />

          {/* FDA %DV nutrient content claim filter — "High Source" is >=20% DV per serving,
              "Good Source" is 10-19% (21 CFR 101.54), exactly like the Food Database page's
              same filter. Here it reads a recipe's own per-serving micronutrient panel, which
              the server computes from that recipe's ingredients (Recipe.micronutrients). Only
              nutrients with an FDA Daily Value that this app stores are listed. */}
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

            {/* "Other" nutrients (prompt-99 for oxalate, generalized in prompt-100). Beside the
                claim filter but deliberately not part of it: neither nutrient has an FDA Daily
                Value, so neither has a High/Good Source tier and this must not read as a claim
                — the same reason the Food Database gives omega-3 its own numeric control
                instead of forcing it into the claim dropdown.

                Shaped like the Nutrient claim pair above — pick the nutrient, then the
                qualifier — rather than one hardcoded select per nutrient, so a third "Other"
                nutrient needs no new control. Options come from OTHER_NUTRIENT_FIELDS, the same
                list the Food Database's picker and the food detail panel use.

                A MAXIMUM for both: the client doesn't care about direction for phytate, so it
                keeps oxalate's "find me low-X" framing and the control reads one way.

                PER SERVING here, where the Food Database's version is per 100 g. That
                difference is intentional, not a bug: every recipe figure on this page is per
                serving (Recipe.macros, the micronutrient panel, the drawer's tiles), while the
                Food Database shows a food's raw per-100 g panel. Each select states its own
                basis so neither can be misread as the other.

                Thresholds are placeholder round numbers, NOT sourced clinical cutoffs. */}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Other
            </span>
            <select
              value={otherNutrient}
              onChange={(e) => setOtherNutrient(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Any nutrient</option>
              {OTHER_NUTRIENT_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={maxOther}
              onChange={(e) => setMaxOther(e.target.value)}
              disabled={!otherNutrient}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
            >
              <option value="">Any amount</option>
              <option value="10">&le; 10 mg / serving</option>
              <option value="25">&le; 25 mg / serving</option>
              <option value="50">&le; 50 mg / serving</option>
              <option value="100">&le; 100 mg / serving</option>
            </select>
            {otherNutrient && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setOtherNutrient("");
                  setMaxOther("");
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>

          {(activeDiets.length > 0 || claimNutrient || otherNutrient) && (
            <button
              onClick={() => {
                setActiveDiets([]);
                setClaimNutrient("");
                setClaimLevel("");
                setOtherNutrient("");
                setMaxOther("");
              }}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </Card>

        {/* Main: search + grid */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipes, ingredients, cuisine…"
                className="pl-9"
              />
            </div>
            <Button
              variant={favOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setFavOnly((v) => !v)}
            >
              <Heart className={cn("h-4 w-4", favOnly && "fill-current")} />
              Favorites
            </Button>
          </div>

          <Tabs value={category} onValueChange={(v) => setCategory(v as RecipeCategory | "all")}>
            <TabsList className="flex-wrap h-auto">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c} value={c} className="capitalize text-xs">
                  {c === "all" ? "All" : `${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}`}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="text-xs text-muted-foreground">
            {filtered.length} recipe{filtered.length !== 1 ? "s" : ""}
          </div>

          {filtered.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No recipes match these filters.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((r) => (
                <RecipeCard key={r.id} recipe={r} onOpen={() => setSelected(r)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <RecipeDrawer
        recipe={selected}
        onClose={() => setSelected(null)}
        onEdit={openEditRecipe}
        onDeleteRequest={setDeleteTarget}
        onDuplicate={(r) => duplicateMutation.mutate(r.id)}
        duplicating={duplicateMutation.isPending}
      />
      <ImportRecipeDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(recipe) => {
          // Straight into the normal New Recipe dialog, on its review flow, under its existing
          // save gate — the import never writes a recipe of its own.
          setImported(recipe);
          setEditingId(null);
          setNewOpen(true);
        }}
      />

      <NewRecipeDialog
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) {
            setEditingId(null);
            setImported(null);
          }
        }}
        editId={editingId}
        importData={imported}
        // Whatever category tab the dietitian is currently filtering by — "New recipe" from
        // the Snack tab starts the form on Snack instead of always defaulting to Lunch. "All"
        // has no single category to hand down, so the dialog falls back to its own default.
        initialCategory={category !== "all" ? category : undefined}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the recipe and its cover photo. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete recipe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-display font-semibold mt-1">{value}</div>
        </div>
        <Icon className={cn("h-5 w-5 text-muted-foreground", tone)} />
      </div>
    </Card>
  );
}

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  return (
    <Card
      onClick={onOpen}
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
    >
      <div
        className={cn(
          "h-32 flex items-center justify-center relative overflow-hidden",
          recipe.photoUrl ? "" : "bg-muted",
        )}
      >
        {recipe.photoUrl ? (
          <img
            src={recipe.photoUrl}
            alt={recipe.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {recipe.verified && (
            <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] bg-white/90">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
              Verified
            </Badge>
          )}
        </div>
        <div className="absolute top-2 right-2">
          {recipe.isFavorite && <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />}
        </div>
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="bg-white/90 text-[10px] capitalize">
            {CATEGORY_META[recipe.category].label}
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm leading-tight">{recipe.name}</h3>
          {recipe.arabicName && (
            <div className="text-xs text-muted-foreground mt-0.5" dir="rtl">
              {recipe.arabicName}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {recipe.prepMin + recipe.cookMin} min
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {recipe.servings}
          </span>
          <span className="capitalize">{recipe.cuisine}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <MacroPill icon={Flame} value={recipe.macros.kcal} label="kcal" tone="text-amber-600" />
          <MacroPill
            icon={Beef}
            value={`${recipe.macros.protein}g`}
            label="P"
            tone="text-rose-600"
          />
          <MacroPill
            icon={Wheat}
            value={`${recipe.macros.carbs}g`}
            label="C"
            tone="text-orange-600"
          />
          <MacroPill icon={Droplet} value={`${recipe.macros.fat}g`} label="F" tone="text-sky-600" />
        </div>

        <div className="flex flex-wrap gap-1">
          {recipe.diets.slice(0, 3).map((d) => (
            <Badge key={d} variant="outline" className="text-[10px] h-5 px-1.5">
              <Leaf className="h-2.5 w-2.5 mr-0.5" />
              {d}
            </Badge>
          ))}
          {recipe.diets.length > 3 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              +{recipe.diets.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
          {/* Pluralised (prompt-116): this count was hardcoded to 0 until now, so
              "1 plans" was never reachable. Same form getFoodUsages uses backend-side. */}
          <span>
            Used in {recipe.usedInPlans} plan{recipe.usedInPlans === 1 ? "" : "s"}
          </span>
          <span>{recipe.lastUsed}</span>
        </div>
      </div>
    </Card>
  );
}

function MacroPill({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <Icon className={cn("h-3 w-3 mx-auto", tone)} />
      <div className="text-xs font-semibold mt-0.5">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function RecipeDrawer({
  recipe,
  onClose,
  onEdit,
  onDeleteRequest,
  onDuplicate,
  duplicating,
}: {
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: (recipe: Recipe) => void;
  onDeleteRequest: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  duplicating: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [recipe?.id]);

  // `recipe` comes from the LIST query, and listMeals deliberately skips the per-recipe
  // ingredient lookup that the nutrient breakdown needs (prompt-98) — a page of cards would
  // pay for it once per card and never show it. So the drawer fetches the single recipe when
  // it opens: one request, only when someone is actually looking, and it shares the ["meal",
  // id] cache with the edit dialog and with the Meal Plan sheet's level-2 drill-down.
  const { data: detail } = useQuery({
    queryKey: ["meal", recipe?.id],
    queryFn: () => getMeal(recipe!.id),
    enabled: !!recipe,
  });
  const macroContributions = detail?.macroContributions;
  // Micronutrient rows still come from the list response (they're cheap); only the breakdown
  // is merged in from the detail fetch, matched by nutrient key.
  const contributionsByNutrient = new Map(
    (detail?.micronutrients ?? []).map((m) => [m.nutrient, m.contributions]),
  );

  const photos = recipe?.photos ?? [];
  const activePhotoUrl = photos[activeIndex]?.url ?? recipe?.photoUrl;

  return (
    <Sheet open={!!recipe} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {recipe && (
          <>
            <div
              className={cn(
                "h-48 flex items-center justify-center relative overflow-hidden",
                activePhotoUrl ? "" : "bg-muted",
              )}
            >
              {activePhotoUrl ? (
                <img
                  src={activePhotoUrl}
                  alt={recipe.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
              )}
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 overflow-x-auto">
                  {photos.map((p, idx) => (
                    <button
                      key={p.key}
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-md overflow-hidden border-2 transition-colors",
                        idx === activeIndex
                          ? "border-white"
                          : "border-white/40 hover:border-white/70",
                      )}
                    >
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(recipe)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit recipe
                    </DropdownMenuItem>
                    {/* Between edit and delete (prompt-77) — a non-destructive action grouped
                        with the other non-destructive one, above the red divider-by-colour that
                        delete already forms. */}
                    <DropdownMenuItem
                      disabled={duplicating}
                      onSelect={() => onDuplicate(recipe)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {duplicating ? "Duplicating…" : "Duplicate recipe"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-rose-600"
                      onSelect={() => onDeleteRequest(recipe)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete recipe
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <SheetHeader className="space-y-1.5 p-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {CATEGORY_META[recipe.category].emoji} {recipe.category}
                  </Badge>
                  {recipe.verified && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Verified
                    </Badge>
                  )}
                </div>
                <SheetTitle className="font-display text-2xl text-left">{recipe.name}</SheetTitle>
                {recipe.arabicName && (
                  <div className="text-sm text-muted-foreground" dir="rtl">
                    {recipe.arabicName}
                  </div>
                )}
              </SheetHeader>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {recipe.prepMin} prep · {recipe.cookMin} cook
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {recipe.servings} serving{recipe.servings > 1 ? "s" : ""}
                </span>
                <span className="capitalize">{recipe.cuisine}</span>
              </div>

              {/* Macros */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Per serving
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {/* `field` is the backend's key (calories, not kcal) so the hover can look
                      the same nutrient up one level deeper. macroContributions is undefined on
                      a recipe that came from the list endpoint, which just means no hover. */}
                  <MacroStat
                    label="Calories"
                    value={recipe.macros.kcal}
                    unit="kcal"
                    tone="text-amber-600"
                    field="calories"
                    contributions={macroContributions?.calories}
                  />
                  <MacroStat
                    label="Protein"
                    value={recipe.macros.protein}
                    unit="g"
                    tone="text-rose-600"
                    field="protein"
                    contributions={macroContributions?.protein}
                  />
                  <MacroStat
                    label="Carbs"
                    value={recipe.macros.carbs}
                    unit="g"
                    tone="text-orange-600"
                    field="carbs"
                    contributions={macroContributions?.carbs}
                  />
                  <MacroStat
                    label="Fat"
                    value={recipe.macros.fat}
                    unit="g"
                    tone="text-sky-600"
                    field="fat"
                    contributions={macroContributions?.fat}
                  />
                  <MacroStat
                    label="Fiber"
                    value={recipe.macros.fiber}
                    unit="g"
                    tone="text-emerald-600"
                    field="fiber"
                    contributions={macroContributions?.fiber}
                  />
                </div>
              </Card>

              <MicronutrientPanel
                title="Micronutrients"
                caption="per serving · % Daily Value"
                showClaims
                rows={(recipe.micronutrients ?? []).map((r) => ({
                  nutrient: r.nutrient,
                  label: r.label,
                  unit: r.unit,
                  value: r.value,
                  dv: { pct: r.pct, level: r.level, pctExact: r.pctExact },
                  contributions: contributionsByNutrient.get(r.nutrient),
                }))}
              />

              {/* Tags */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Diet tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recipe.diets.map((d) => (
                    <Badge key={d} variant="secondary" className="text-[11px]">
                      <Leaf className="h-3 w-3 mr-1" />
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>

              {recipe.allergens.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Contains allergens
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recipe.allergens.map((a) => (
                      <Badge
                        key={a}
                        variant="outline"
                        className="text-[11px] border-amber-300 bg-amber-50 text-amber-900"
                      >
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Ingredients */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ingredients
                </div>
                <ul className="space-y-1.5">
                  {recipe.ingredients.map((i, idx) =>
                    // A section header (prompt-97) is a divider inside the list, not an
                    // ingredient: no amount column, and no bottom rule of its own — it sits
                    // above the rows it introduces rather than reading as one of them. The
                    // leading pt only applies after the first row, so a recipe that opens with
                    // a section doesn't start with a gap.
                    i.type === "section" ? (
                      <li
                        key={idx}
                        className={cn(
                          // Darker than the "Ingredients" eyebrow directly above it — same
                          // size and weight would read as a second panel heading rather than
                          // a divider inside this one.
                          "text-xs font-semibold text-foreground uppercase tracking-wider",
                          idx > 0 && "pt-3",
                        )}
                      >
                        {i.name}
                      </li>
                    ) : (
                      <li
                        key={idx}
                        className="flex items-center justify-between text-sm py-1.5 border-b border-dashed last:border-0"
                      >
                        <span>{i.name}</span>
                        <span className="text-muted-foreground text-xs">{i.amount}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Method
                </div>
                <ol className="space-y-2">
                  {recipe.steps.map((s, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {recipe.notes && (
                <Card className="p-3 bg-accent/30 text-xs">
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Dietitian note
                  </div>
                  <p className="text-muted-foreground">{recipe.notes}</p>
                </Card>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MacroStat({
  label,
  value,
  unit,
  tone,
  field,
  contributions,
}: {
  label: string;
  value: number;
  unit: string;
  tone: string;
  // Both optional so this tile still renders unchanged anywhere a breakdown isn't available.
  field?: string;
  contributions?: NutrientContribution[];
}) {
  return (
    <div className="text-center">
      <ContributionHover
        contributions={contributions}
        field={field ?? ""}
        label={label}
        align="center"
      >
        <div className={cn("text-lg font-display font-semibold", tone)}>{value}</div>
      </ContributionHover>
      <div className="text-[10px] text-muted-foreground uppercase">{unit}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
