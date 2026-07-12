import { useMemo, useState } from "react";
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
import {
  CATEGORY_META,
  DIET_LABEL,
  ALLERGEN_LABEL,
  type Recipe,
  type RecipeCategory,
  type DietTag,
} from "@/lib/meal-library-mock";
import { fetchMeals, deleteMeal } from "@/lib/meals-api";
import { NewRecipeDialog } from "@/components/new-recipe-dialog";

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

const DIET_FILTERS: DietTag[] = [
  "high-protein",
  "vegan",
  "vegetarian",
  "low-carb",
  "gluten-free",
  "dairy-free",
  "pcos-friendly",
  "ramadan",
];

function MealLibraryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [activeDiets, setActiveDiets] = useState<DietTag[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [newOpen, setNewOpen] = useState(false);
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

  const openNewRecipe = () => {
    setEditingId(null);
    setNewOpen(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setSelected(null);
    setEditingId(recipe.id);
    setNewOpen(true);
  };

  const allMeals = useMemo(() => data?.meals ?? [], [data?.meals]);

  const filtered = useMemo(() => {
    return allMeals.filter((r) => {
      if (favOnly && !r.isFavorite) return false;
      if (activeDiets.length && !activeDiets.every((d) => r.diets.includes(d))) return false;
      return true;
    });
  }, [allMeals, activeDiets, favOnly]);

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
          <Button size="sm" onClick={openNewRecipe}>
            <Plus className="h-4 w-4" />
            New recipe
          </Button>
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
            {DIET_FILTERS.map((d) => {
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
                  {DIET_LABEL[d]}
                </button>
              );
            })}
          </div>
          {activeDiets.length > 0 && (
            <button
              onClick={() => setActiveDiets([])}
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
      />
      <NewRecipeDialog
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) setEditingId(null);
        }}
        editId={editingId}
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
              {DIET_LABEL[d]}
            </Badge>
          ))}
          {recipe.diets.length > 3 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              +{recipe.diets.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
          <span>Used in {recipe.usedInPlans} plans</span>
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
}: {
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: (recipe: Recipe) => void;
  onDeleteRequest: (recipe: Recipe) => void;
}) {
  return (
    <Sheet open={!!recipe} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {recipe && (
          <>
            <div
              className={cn(
                "h-48 flex items-center justify-center relative overflow-hidden",
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
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
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
                  <MacroStat
                    label="Calories"
                    value={recipe.macros.kcal}
                    unit="kcal"
                    tone="text-amber-600"
                  />
                  <MacroStat
                    label="Protein"
                    value={recipe.macros.protein}
                    unit="g"
                    tone="text-rose-600"
                  />
                  <MacroStat
                    label="Carbs"
                    value={recipe.macros.carbs}
                    unit="g"
                    tone="text-orange-600"
                  />
                  <MacroStat label="Fat" value={recipe.macros.fat} unit="g" tone="text-sky-600" />
                  <MacroStat
                    label="Fiber"
                    value={recipe.macros.fiber}
                    unit="g"
                    tone="text-emerald-600"
                  />
                </div>
              </Card>

              {/* Tags */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Diet tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recipe.diets.map((d) => (
                    <Badge key={d} variant="secondary" className="text-[11px]">
                      <Leaf className="h-3 w-3 mr-1" />
                      {DIET_LABEL[d]}
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
                        {ALLERGEN_LABEL[a]}
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
                  {recipe.ingredients.map((i, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-dashed last:border-0"
                    >
                      <span>{i.name}</span>
                      <span className="text-muted-foreground text-xs">{i.amount}</span>
                    </li>
                  ))}
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
}: {
  label: string;
  value: number;
  unit: string;
  tone: string;
}) {
  return (
    <div className="text-center">
      <div className={cn("text-lg font-display font-semibold", tone)}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{unit}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
