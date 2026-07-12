import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Heart,
  CheckCircle2,
  ShieldCheck,
  Database,
  X,
  AlertTriangle,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Leaf,
  Loader2,
  Library,
  Globe,
  Download,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  SOURCE_META,
  type FoodItem,
  type FoodCategory,
  type FoodSource,
} from "@/lib/food-database-mock";
import { fetchFoods, updateFood } from "@/lib/foods-api";
import { searchUsda, importUsdaFood, type UsdaSearchResult } from "@/lib/usda-api";
import { NewFoodDialog } from "@/components/new-food-dialog";

export const Route = createFileRoute("/food-database")({
  head: () => ({
    meta: [
      { title: "Food Database — Nutria" },
      {
        name: "description",
        content: "USDA + Lebanese foods. The source of truth for verified per-100g macros.",
      },
    ],
  }),
  component: FoodDatabasePage,
});

const CATEGORIES: (FoodCategory | "all")[] = [
  "all",
  "produce",
  "protein",
  "grains",
  "dairy",
  "legumes",
  "fats",
  "snacks",
  "beverages",
  "condiments",
  "prepared",
];

const SOURCES: (FoodSource | "all")[] = ["all", "usda", "lebanese", "custom"];

function FoodDatabasePage() {
  const [mode, setMode] = useState<"library" | "usda">("library");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | "all">("all");
  const [source, setSource] = useState<FoodSource | "all">("all");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["foods", query, category, source],
    queryFn: () =>
      fetchFoods({
        search: query || undefined,
        category: category !== "all" ? category : undefined,
        source: source !== "all" ? source : undefined,
        limit: 100,
      }),
    enabled: mode === "library",
  });

  const allFoods = data?.foods ?? [];

  // Source is now a server-side filter (fetchFoods above) — only verified/favorites stay
  // client-side, since those have no backend param yet and only ever apply to the page of
  // local-library results already in hand.
  const filtered = useMemo(() => {
    return allFoods.filter((f) => {
      if (onlyVerified && !f.verified) return false;
      if (onlyFavorites && !f.isFavorite) return false;
      return true;
    });
  }, [allFoods, onlyVerified, onlyFavorites]);

  const stats = useMemo(() => {
    const total = allFoods.length;
    const verified = allFoods.filter((f) => f.verified).length;
    const lebanese = allFoods.filter((f) => f.source === "lebanese").length;
    return { total, verified, lebanese };
  }, [allFoods]);

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title="Food Database"
        description="USDA + Lebanese foods. The source of truth for verified per-100g macros."
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            New food
          </Button>
        }
      />

      {/* Mode toggle — local library (server-backed, paginated) vs. live USDA search
          (ephemeral, external). Deliberately not merged into one fetched-then-filtered list —
          USDA's catalog is orders of magnitude bigger than the ~100-row local page this UI
          otherwise assumes. */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "library" | "usda")} className="mb-6">
        <TabsList>
          <TabsTrigger value="library">
            <Library className="mr-1.5 size-3.5" />
            My Library
          </TabsTrigger>
          <TabsTrigger value="usda">
            <Globe className="mr-1.5 size-3.5" />
            Search USDA
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "usda" && <UsdaSearchPanel />}

      {mode === "library" && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 pb-6 md:grid-cols-3">
            <KpiCard
              icon={Database}
              label="Total foods"
              value={stats.total.toString()}
              hint="In your library"
            />
            <KpiCard
              icon={ShieldCheck}
              label="Verified"
              value={stats.verified.toString()}
              hint={
                stats.total
                  ? `${Math.round((stats.verified / stats.total) * 100)}% of database`
                  : "—"
              }
            />
            <KpiCard
              icon={Leaf}
              label="Lebanese DB"
              value={stats.lebanese.toString()}
              hint="Local foods"
            />
          </div>

          {/* Filter bar */}
          <Card className="mb-4 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-55">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search foods, brands, Arabic names…"
                  className="pl-8"
                />
              </div>
              <Tabs value={source} onValueChange={(v) => setSource(v as FoodSource | "all")}>
                <TabsList>
                  {SOURCES.map((s) => (
                    <TabsTrigger key={s} value={s} className="capitalize text-xs">
                      {s === "all" ? "All sources" : SOURCE_META[s as FoodSource].label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant={onlyVerified ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyVerified((v) => !v)}
              >
                <CheckCircle2 className="size-4" />
                Verified
              </Button>
              <Button
                variant={onlyFavorites ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyFavorites((v) => !v)}
              >
                <Heart className={cn("size-4", onlyFavorites && "fill-current")} />
                Favorites
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea>
              <div className="flex gap-1.5 pb-1">
                {CATEGORIES.map((c) => {
                  const active = category === c;
                  const meta = c === "all" ? null : CATEGORY_META[c];
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent",
                      )}
                    >
                      {meta ? `${meta.emoji} ${meta.label}` : "All categories"}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filtered.length}</span> foods
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Macros per 100 g
              </div>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Food</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">kcal</TableHead>
                    <TableHead className="text-right">P</TableHead>
                    <TableHead className="text-right">C</TableHead>
                    <TableHead className="text-right">F</TableHead>
                    <TableHead className="text-right">Fib</TableHead>
                    <TableHead className="text-right pr-4">Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => {
                    const meta = CATEGORY_META[f.category];
                    const src = SOURCE_META[f.source];
                    return (
                      <TableRow
                        key={f.id}
                        onClick={() => setSelected(f)}
                        className="cursor-pointer"
                      >
                        <TableCell className="pl-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{f.name}</span>
                              {f.verified && <ShieldCheck className="size-3.5 text-emerald-600" />}
                              {f.isFavorite && (
                                <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {f.brand && <span>{f.brand}</span>}
                              {f.arabicName && <span className="font-arabic">{f.arabicName}</span>}
                              <span className="capitalize">· {meta.label}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", src.color)}>
                            {src.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {f.macros.kcal}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {f.macros.protein}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {f.macros.carbs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {f.macros.fat}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {f.macros.fiber}
                        </TableCell>
                        <TableCell className="text-right pr-4 text-xs text-muted-foreground">
                          {f.usedInPlans}× · {f.lastUsed}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        No foods match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <FoodDrawer food={selected} onClose={() => setSelected(null)} />
      <NewFoodDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

/* ---------- Search USDA (live, ephemeral — separate data path from the local library table
   above; results have no _id and aren't usable anywhere until imported) ---------- */

function UsdaSearchPanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const searching = debounced.length > 1;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["foods", "usda-search", debounced],
    queryFn: () => searchUsda(debounced),
    enabled: searching,
  });

  const importMutation = useMutation({
    mutationFn: (fdcId: number) => importUsdaFood(fdcId),
    onSuccess: (food) => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast.success(`${food.name} added to your library`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't add that food to your library");
    },
  });

  const results = data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search USDA FoodData Central — e.g. "chicken breast"…'
            className="pl-8"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Live results from USDA's public database — not in your library yet. Add one to use it in
          meal plans, recipes, and journal entries.
        </p>
      </Card>

      {!searching ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Globe className="size-8 text-muted-foreground/50" />
          Type at least 2 characters to search USDA's live database.
        </Card>
      ) : isLoading || isFetching ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-destructive">
          <WifiOff className="size-8" />
          {(error as Error).message || "Couldn't reach USDA FoodData Central. Try again shortly."}
        </Card>
      ) : results.length === 0 ? (
        <Card className="py-16 text-center text-sm text-muted-foreground">
          No USDA results for "{debounced}".
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{results.length}</span> USDA results
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Macros per 100 g
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Food</TableHead>
                <TableHead className="text-right">kcal</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">C</TableHead>
                <TableHead className="text-right">F</TableHead>
                <TableHead className="text-right">Fib</TableHead>
                <TableHead className="text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r: UsdaSearchResult) => {
                const importing = importMutation.isPending && importMutation.variables === r.fdcId;
                return (
                  <TableRow key={r.fdcId}>
                    <TableCell className="pl-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate">{r.name}</span>
                          {r.dataType && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {r.dataType}
                            </Badge>
                          )}
                        </div>
                        {r.brand && <div className="text-xs text-muted-foreground">{r.brand}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {r.macros.calories}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.macros.protein}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.macros.carbs}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.macros.fat}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.macros.fiber}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={importing}
                        onClick={() => importMutation.mutate(r.fdcId)}
                      >
                        <Download className="size-3.5" />
                        {importing ? "Adding…" : "Add to library"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}

function FoodDrawer({ food, onClose }: { food: FoodItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [toggling, setToggling] = useState(false);
  if (!food) return null;
  const meta = CATEGORY_META[food.category];
  const src = SOURCE_META[food.source];
  const m = food.macros;

  return (
    <Sheet open={!!food} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-2xl">
                {meta.emoji}
              </div>
              <div>
                <SheetTitle className="text-left">{food.name}</SheetTitle>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {food.brand && <span>{food.brand}</span>}
                  {food.arabicName && <span>· {food.arabicName}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className={src.color}>
              {src.label}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {meta.label}
            </Badge>
            {food.verified && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                <ShieldCheck className="size-3" /> Verified
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Macros per 100g */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nutrition per 100 g</h3>
              <span className="text-xs text-muted-foreground">{m.kcal} kcal</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MacroBlock
                icon={Flame}
                label="kcal"
                value={m.kcal}
                hue="bg-amber-50 text-amber-700"
              />
              <MacroBlock
                icon={Beef}
                label="Protein"
                value={`${m.protein}g`}
                hue="bg-rose-50 text-rose-700"
              />
              <MacroBlock
                icon={Wheat}
                label="Carbs"
                value={`${m.carbs}g`}
                hue="bg-emerald-50 text-emerald-700"
              />
              <MacroBlock
                icon={Droplet}
                label="Fat"
                value={`${m.fat}g`}
                hue="bg-sky-50 text-sky-700"
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <MicroStat label="Fiber" value={`${m.fiber} g`} />
              <MicroStat label="Sugar" value={m.sugar != null ? `${m.sugar} g` : "—"} />
              <MicroStat label="Sodium" value={m.sodium != null ? `${m.sodium} mg` : "—"} />
            </div>
          </section>

          {/* Servings */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Common servings</h3>
            <div className="space-y-1.5">
              {food.servings.map((s) => {
                const factor = s.grams / 100;
                return (
                  <div
                    key={s.label}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.grams} g</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">
                        {Math.round(m.kcal * factor)} kcal
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        P {Math.round(m.protein * factor)} · C {Math.round(m.carbs * factor)} · F{" "}
                        {Math.round(m.fat * factor)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Allergens */}
          {food.allergens.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle className="size-4 text-amber-500" /> Allergens
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {food.allergens.map((a) => (
                  <Badge
                    key={a}
                    variant="secondary"
                    className="bg-amber-100 text-amber-800 capitalize"
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {food.notes && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Dietitian note</h3>
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {food.notes}
              </p>
            </section>
          )}

          {/* Usage */}
          <section className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Used in <span className="font-medium text-foreground">{food.usedInPlans}</span> plans ·
            last logged {food.lastUsed}
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant={food.verified ? "default" : "outline"}
              className={cn("flex-1", food.verified && "bg-emerald-600 hover:bg-emerald-700")}
              disabled={toggling}
              onClick={async () => {
                setToggling(true);
                try {
                  await updateFood(food.id, { verified: !food.verified });
                  qc.invalidateQueries({ queryKey: ["foods"] });
                } catch (err) {
                  console.error("Failed to toggle verified:", err);
                } finally {
                  setToggling(false);
                }
              }}
            >
              <ShieldCheck className="size-4" />
              {toggling ? "Saving…" : food.verified ? "Verified" : "Mark verified"}
            </Button>
            <Button size="sm" variant="outline">
              <Heart className={cn("size-4", food.isFavorite && "fill-rose-500 text-rose-500")} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MacroBlock({
  icon: Icon,
  label,
  value,
  hue,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hue: string;
}) {
  return (
    <div className={cn("rounded-md p-2.5", hue)}>
      <Icon className="size-3.5" />
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
