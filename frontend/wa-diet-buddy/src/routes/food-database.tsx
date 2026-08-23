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
  XCircle,
  MoreHorizontal,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
  MICRO_FIELD_GROUPS,
  EMPTY_MICROS,
  type FoodItem,
  type FoodCategory,
  type FoodSource,
  type Micronutrients,
} from "@/lib/food-database-mock";
import {
  fetchFoods,
  fetchFoodStats,
  updateFood,
  deleteFood,
  addFavoriteFood,
  removeFavoriteFood,
  bulkDeleteFoods,
  toMicronutrients,
  type BulkDeleteResult,
} from "@/lib/foods-api";
import {
  searchUsda,
  importUsdaFood,
  fetchImportedUsdaFdcIds,
  fetchUsdaFoodDetails,
  type UsdaSearchResult,
} from "@/lib/usda-api";
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
  "prepared",
  "sweets",
];

const SOURCES: (FoodSource | "all")[] = ["all", "usda", "lebanese", "custom"];

const FOODS_PAGE_SIZE = 100;

// Windowed page numbers with ellipsis once there are enough pages that showing every number
// would crowd the bar — always keeps first, last, and a small run around the current page.
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(sorted[i]);
  }
  return result;
}

function FoodDatabasePage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"library" | "usda">("library");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | "all">("all");
  const [source, setSource] = useState<FoodSource | "all">("all");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FoodItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FoodItem | null>(null);
  // Bulk-select for the table below — id -> name (name kept alongside the id so the confirm
  // dialog can list foods selected on a page the dietitian has since navigated away from,
  // without an extra fetch). Persists across page changes; cleared on any filter change.
  const [bulkSelection, setBulkSelection] = useState<Map<string, string>>(new Map());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // A stale page number after changing any filter could otherwise land on an empty page (e.g.
  // page 3 of "All sources", then filtering down to a source with only 1 page). A selection made
  // under a different filter/search may no longer make sense either, so it's cleared too.
  useEffect(() => {
    setPage(1);
    setBulkSelection(new Map());
  }, [query, category, source, onlyVerified, onlyFavorites]);

  const { data, isLoading } = useQuery({
    queryKey: ["foods", query, category, source, onlyVerified, onlyFavorites, page],
    queryFn: () =>
      fetchFoods({
        search: query || undefined,
        category: category !== "all" ? category : undefined,
        source: source !== "all" ? source : undefined,
        verified: onlyVerified || undefined,
        favorites: onlyFavorites || undefined,
        page,
        limit: FOODS_PAGE_SIZE,
      }),
    enabled: mode === "library",
  });

  const allFoods = data?.foods ?? [];
  const pageTotal = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(pageTotal / FOODS_PAGE_SIZE));
  const rangeStart = pageTotal === 0 ? 0 : (page - 1) * FOODS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * FOODS_PAGE_SIZE, pageTotal);

  // Deleting enough foods (single or bulk) can shrink totalPages below the page currently being
  // viewed — land back on the new last page instead of showing an empty one.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // True total/verified/lebanese counts for the current filter, from a dedicated backend
  // aggregate — NOT derived from `allFoods`, which is capped at the 100-row page size above
  // and would silently freeze these KPIs once the library passed that size (it already has).
  const { data: statsData } = useQuery({
    queryKey: ["foods", "stats", query, category, source, onlyVerified, onlyFavorites],
    queryFn: () =>
      fetchFoodStats({
        search: query || undefined,
        category: category !== "all" ? category : undefined,
        source: source !== "all" ? source : undefined,
        verified: onlyVerified || undefined,
        favorites: onlyFavorites || undefined,
      }),
    enabled: mode === "library",
  });
  const stats = statsData ?? { total: 0, verified: 0, lebanese: 0 };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFood(id),
    onSuccess: () => {
      toast.success("Food removed from library");
      qc.invalidateQueries({ queryKey: ["foods"] });
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // verified/source/category/search/favorites are now all real server-side filters (see
  // fetchFoods above) — allFoods is already exactly the matching, paginated set, no further
  // client-side narrowing needed.
  const filtered = allFoods;

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((f) => bulkSelection.has(f.id));
  const someOnPageSelected = filtered.some((f) => bulkSelection.has(f.id));

  function toggleSelectOne(food: FoodItem) {
    setBulkSelection((prev) => {
      const next = new Map(prev);
      if (next.has(food.id)) next.delete(food.id);
      else next.set(food.id, food.name);
      return next;
    });
  }

  // Scoped to the CURRENT page only, per the task's explicit "don't let a dietitian
  // accidentally select hundreds of foods without realizing it" — never the full 407-food
  // library at once.
  function toggleSelectAllOnPage() {
    setBulkSelection((prev) => {
      const next = new Map(prev);
      if (allOnPageSelected) {
        for (const f of filtered) next.delete(f.id);
      } else {
        for (const f of filtered) next.set(f.id, f.name);
      }
      return next;
    });
  }

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteFoods(ids),
    onSuccess: (result: BulkDeleteResult) => {
      qc.invalidateQueries({ queryKey: ["foods"] });
      setBulkSelection(new Map());
      setBulkDeleteOpen(false);
      const { deleted, blocked, notFound } = result;
      if (blocked.length === 0 && notFound.length === 0) {
        toast.success(`${deleted.length} food${deleted.length === 1 ? "" : "s"} removed from library`);
      } else {
        const skipped = blocked.length + notFound.length;
        toast.warning(
          `${deleted.length} removed, ${skipped} skipped` +
            (blocked.length > 0 ? ` (${blocked.length} in use)` : ""),
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            {/* flex-wrap, not ScrollArea — with 11+ category pills this row doesn't fit in one
                line at standard viewport widths, and ScrollArea here had no horizontal ScrollBar
                affordance so overflow pills (e.g. Sweets) just clipped invisibly. Wrapping to a
                second line keeps every pill visible and clickable instead. */}
            <div className="flex flex-wrap gap-1.5">
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
          </Card>

          {/* Bulk-action bar — only shown once at least one food is selected */}
          {bulkSelection.size > 0 && (
            <Card className="mb-4 flex items-center justify-between gap-3 border-primary/30 bg-primary-soft/40 px-4 py-2.5">
              <div className="text-sm font-medium text-primary">
                {bulkSelection.size} selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBulkSelection(new Map())}
                >
                  Clear selection
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  Delete selected
                </Button>
              </div>
            </Card>
          )}

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="text-sm text-muted-foreground">
                {pageTotal === 0 ? (
                  <span className="font-medium text-foreground">0</span>
                ) : (
                  <>
                    Showing <span className="font-medium text-foreground">{rangeStart}</span>–
                    <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
                    <span className="font-medium text-foreground">{pageTotal}</span>
                  </>
                )}{" "}
                foods
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
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAllOnPage}
                        aria-label="Select all foods on this page"
                      />
                    </TableHead>
                    <TableHead>Food</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">kcal</TableHead>
                    <TableHead className="text-right">P</TableHead>
                    <TableHead className="text-right">C</TableHead>
                    <TableHead className="text-right">F</TableHead>
                    <TableHead className="text-right">Fib</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => {
                    const src = SOURCE_META[f.source];
                    return (
                      <TableRow
                        key={f.id}
                        onClick={() => setSelected(f)}
                        className="cursor-pointer"
                      >
                        <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={bulkSelection.has(f.id)}
                            onCheckedChange={() => toggleSelectOne(f)}
                            aria-label={`Select ${f.name}`}
                          />
                        </TableCell>
                        <TableCell>
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
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {f.usedInPlans}× · {f.lastUsed}
                        </TableCell>
                        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditTarget(f)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-rose-600"
                                onSelect={() => setDeleteTarget(f)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove from library
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                        No foods match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            )}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === "ellipsis" ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-1.5 text-xs text-muted-foreground"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="w-8 px-0"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <FoodDrawer food={selected} onClose={() => setSelected(null)} />
      <NewFoodDialog
        open={newOpen || !!editTarget}
        onOpenChange={(o) => {
          if (!o) {
            setNewOpen(false);
            setEditTarget(null);
          }
        }}
        editFoodId={editTarget?.id ?? null}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the food from your library. This can't be undone. If it's
              used in a recipe, meal plan, or journal entry, the removal will be blocked instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {bulkSelection.size} food{bulkSelection.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This permanently removes the selected food{bulkSelection.size === 1 ? "" : "s"}{" "}
                  from your library. This can't be undone. Any that are used in a recipe, meal
                  plan, or journal entry will be skipped instead of deleted — same protection as
                  removing one food at a time.
                </p>
                {bulkSelection.size <= 10 && (
                  <ul className="list-inside list-disc text-muted-foreground">
                    {Array.from(bulkSelection.values()).map((name, i) => (
                      <li key={i} className="truncate">
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate(Array.from(bulkSelection.keys()))}
            >
              {bulkDeleteMutation.isPending
                ? "Removing…"
                : `Remove ${bulkSelection.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------- Search USDA (live, ephemeral — separate data path from the local library table
   above; results have no _id and aren't usable anywhere until imported) ---------- */

interface BulkImportResult {
  fdcId: number;
  name: string;
  ok: boolean;
  error?: string;
}

// Small groups rather than one call per selected item at once — USDA's API (and our own
// usda-import round-trip to it) has real rate limits, so a batch of 20 fired simultaneously
// risks 429s. importUsdaFood is idempotent by fdcId (dedupe happens server-side, backed by a
// DB unique index), so re-running a batch after a partial failure is always safe.
const BULK_IMPORT_BATCH_SIZE = 4;

function UsdaSearchPanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkState, setBulkState] = useState<{ total: number; results: BulkImportResult[] } | null>(
    null,
  );
  // Only one result's micronutrient preview open at a time — keeps this to at most one lazy
  // details fetch in flight rather than a fetch per expanded row.
  const [expandedFdcId, setExpandedFdcId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // A fresh search invalidates any selection/results made against the previous result set.
  useEffect(() => {
    setSelected(new Set());
    setBulkState(null);
    setExpandedFdcId(null);
  }, [debounced]);

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
  const bulkRunning = !!bulkState && bulkState.results.length < bulkState.total;

  // Bulk existence check for "Added" state — one request per result set, not one per row.
  // Keying on the joined fdcIds (rather than just `debounced`) means the invalidateQueries
  // calls below (shared "foods" key prefix) correctly refetch this too, so items just
  // imported this session flip to "Added" without a page refresh.
  const resultFdcIdsKey = results.map((r) => r.fdcId).join(",");
  const { data: importedFdcIds } = useQuery({
    queryKey: ["foods", "usda-imported", resultFdcIdsKey],
    queryFn: () => fetchImportedUsdaFdcIds(results.map((r) => r.fdcId)),
    enabled: results.length > 0,
  });
  const importedSet = useMemo(() => new Set(importedFdcIds ?? []), [importedFdcIds]);

  function toggleOne(fdcId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fdcId)) next.delete(fdcId);
      else next.add(fdcId);
      return next;
    });
  }

  const selectableResults = results.filter((r) => !importedSet.has(r.fdcId));
  const allSelected =
    selectableResults.length > 0 && selectableResults.every((r) => selected.has(r.fdcId));
  const someSelected = selectableResults.some((r) => selected.has(r.fdcId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableResults.map((r) => r.fdcId)));
  }

  async function handleBulkImport() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const nameById = new Map(results.map((r) => [r.fdcId, r.name]));
    setBulkState({ total: ids.length, results: [] });

    const collected: BulkImportResult[] = [];
    for (let i = 0; i < ids.length; i += BULK_IMPORT_BATCH_SIZE) {
      const batch = ids.slice(i, i + BULK_IMPORT_BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((fdcId) => importUsdaFood(fdcId)));
      settled.forEach((outcome, idx) => {
        const fdcId = batch[idx];
        const fallbackName = nameById.get(fdcId) ?? `fdcId ${fdcId}`;
        if (outcome.status === "fulfilled") {
          collected.push({ fdcId, name: outcome.value.name || fallbackName, ok: true });
        } else {
          const message =
            outcome.reason instanceof Error ? outcome.reason.message : "Import failed";
          collected.push({ fdcId, name: fallbackName, ok: false, error: message });
        }
      });
      setBulkState({ total: ids.length, results: [...collected] });
    }

    qc.invalidateQueries({ queryKey: ["foods"] });
    setSelected(new Set());

    const succeeded = collected.filter((r) => r.ok).length;
    const failed = collected.length - succeeded;
    if (failed === 0) {
      toast.success(`${succeeded} food${succeeded === 1 ? "" : "s"} added to your library`);
    } else if (succeeded === 0) {
      toast.error(
        `Couldn't add any of the ${failed} selected food${failed === 1 ? "" : "s"} — see details below`,
      );
    } else {
      toast.error(`${succeeded} added, ${failed} failed — see details below`);
    }
  }

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

      {(selected.size > 0 || bulkRunning) && (
        <Card className="flex items-center justify-between gap-3 border-primary/30 bg-primary-soft/40 px-4 py-2.5">
          <div className="text-sm font-medium text-primary">
            {bulkRunning
              ? `Importing ${bulkState!.results.length} of ${bulkState!.total}…`
              : `${selected.size} selected`}
          </div>
          <div className="flex items-center gap-2">
            {!bulkRunning && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            )}
            <Button size="sm" onClick={handleBulkImport} disabled={bulkRunning}>
              {bulkRunning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Download className="size-3.5" />
                  Add to library
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {bulkState && bulkState.results.length === bulkState.total && (
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              Import results — {bulkState.results.filter((r) => r.ok).length} of {bulkState.total}{" "}
              added
            </span>
            <Button size="sm" variant="ghost" onClick={() => setBulkState(null)}>
              <X className="size-3.5" />
              Dismiss
            </Button>
          </div>
          <ul className="space-y-1">
            {bulkState.results.map((r) => (
              <li key={r.fdcId} className="flex items-center gap-2 text-sm">
                {r.ok ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="size-3.5 shrink-0 text-destructive" />
                )}
                <span className={cn("truncate", !r.ok && "text-muted-foreground")}>{r.name}</span>
                {!r.ok && r.error && (
                  <span className="truncate text-xs text-destructive">— {r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

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
          {/* table-fixed + explicit widths on every column except Food: under the default
              auto-layout, an unbounded Food column grows to fit the longest untruncated
              USDA description in the current page of results (some run 50+ characters, plus a
              dataType badge) — that's what was forcing the table past the available content
              width. With table-fixed, column widths come from these header cells' declared
              widths regardless of content length; Food (the one column with no explicit width)
              absorbs whatever's left, so `truncate` on its name span actually has a box to
              truncate against instead of being able to grow the column indefinitely. */}
          <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    disabled={bulkRunning}
                    aria-label="Select all USDA results"
                  />
                </TableHead>
                <TableHead className="w-8" />
                <TableHead>Food</TableHead>
                <TableHead className="w-16 text-right">kcal</TableHead>
                <TableHead className="w-12 text-right">P</TableHead>
                <TableHead className="w-12 text-right">C</TableHead>
                <TableHead className="w-12 text-right">F</TableHead>
                <TableHead className="w-14 text-right">Fib</TableHead>
                <TableHead className="w-14 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r: UsdaSearchResult) => {
                const importing = importMutation.isPending && importMutation.variables === r.fdcId;
                const alreadyAdded = importedSet.has(r.fdcId);
                const expanded = expandedFdcId === r.fdcId;
                return (
                  <>
                  <TableRow key={r.fdcId}>
                    <TableCell className="w-10 pl-4">
                      <Checkbox
                        checked={selected.has(r.fdcId)}
                        onCheckedChange={() => toggleOne(r.fdcId)}
                        disabled={bulkRunning || alreadyAdded}
                        aria-label={`Select ${r.name}`}
                      />
                    </TableCell>
                    <TableCell className="w-8">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => setExpandedFdcId(expanded ? null : r.fdcId)}
                        aria-label={expanded ? "Hide micronutrients" : "View micronutrients"}
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {/* min-w-0 on the name span itself, not just its ancestors — it's a
                              flex item here (of the "flex items-center" row below), and flex
                              items default to min-width:auto, which overrides `truncate`'s
                              overflow:hidden and lets the span grow to its full text width
                              regardless of the column's now-fixed width. */}
                          <span
                            className="min-w-0 truncate font-medium text-foreground"
                            title={r.name}
                          >
                            {r.name}
                          </span>
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
                      {/* Icon-only + title/aria-label instead of a text-labeled button — the
                          "Add to library"/"Already in library" text was the single widest thing
                          in this row, and this column doesn't need to say it out loud when every
                          other row-level action in this app (kebab menus, the chevron above)
                          already communicates via icon + tooltip alone. */}
                      {alreadyAdded ? (
                        <span
                          className="inline-flex size-7 items-center justify-center"
                          title="Already in library"
                          aria-label="Already in library"
                        >
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        </span>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          disabled={importing || bulkRunning}
                          onClick={() => importMutation.mutate(r.fdcId)}
                          title={importing ? "Adding…" : "Add to library"}
                          aria-label={importing ? "Adding…" : "Add to library"}
                        >
                          {importing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow key={`${r.fdcId}-details`}>
                      {/* 9 columns in the header row above (checkbox, chevron, Food, kcal, P, C,
                          F, Fib, Action) — colSpan was 8 here, a pre-existing off-by-one that
                          left the Action column's width unspanned in this row. Fixed in passing
                          since it's directly adjacent to this edit. */}
                      <TableCell colSpan={9} className="bg-muted/20 p-4">
                        <UsdaDetailsPreview fdcId={r.fdcId} />
                      </TableCell>
                    </TableRow>
                  )}
                  </>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

// Lazy, on-demand preview of a single USDA result's full micronutrient breakdown — only fetched
// once its row is expanded, never eagerly for the whole result list. Reuses the exact same
// getUsdaFoodDetails/previewUsdaFood call and toMicronutrients mapping the actual import uses,
// so what's previewed here is guaranteed to match what gets stored if this result is imported.
function UsdaDetailsPreview({ fdcId }: { fdcId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["foods", "usda-details", fdcId],
    queryFn: () => fetchUsdaFoodDetails(fdcId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="py-2 text-center text-sm text-destructive">
        Couldn't load micronutrient details for this result. Try again shortly.
      </p>
    );
  }

  return (
    <MicronutrientSection
      food={{
        macros: { carbs: data.carbs, fiber: data.fiber },
        micros: toMicronutrients(data),
      }}
    />
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
  const [favoriting, setFavoriting] = useState(false);
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

          {/* Micronutrients — full profile, collapsed by default. Does not touch the macro
              grid/MicroStat row above; "No Data" is the expected state for most USDA imports. */}
          <MicronutrientSection food={food} />

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
            <Button
              size="sm"
              variant="outline"
              disabled={favoriting}
              onClick={async () => {
                setFavoriting(true);
                try {
                  if (food.isFavorite) {
                    await removeFavoriteFood(food.id);
                  } else {
                    await addFavoriteFood(food.id);
                  }
                  qc.invalidateQueries({ queryKey: ["foods"] });
                } catch (err) {
                  console.error("Failed to toggle favorite:", err);
                } finally {
                  setFavoriting(false);
                }
              }}
            >
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

// Sums whichever of the given sub-component values are present; null (not 0) if none are, so
// "no data at all" and "measured zero" stay visually distinct downstream.
function partialSum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) * 100) / 100;
}

// Widened from `FoodItem` so the Search USDA preview (which has no FoodItem — just a raw,
// unimported USDA result) can reuse this directly instead of a second display implementation.
// Only ever reads macros.carbs/fiber and micros, so this is a strict subset of FoodItem's shape.
interface MicronutrientSectionFood {
  macros: { carbs: number; fiber: number };
  micros?: Micronutrients;
}

function MicronutrientSection({ food }: { food: MicronutrientSectionFood }) {
  const micros = food.micros ?? EMPTY_MICROS;
  const netCarbs = Math.round((food.macros.carbs - food.macros.fiber) * 10) / 10;
  const omega3Sum = partialSum([micros.omega3Ala, micros.omega3Epa, micros.omega3Dha]);
  const omega6Sum = partialSum([micros.omega6La, micros.omega6Aa]);
  const omega6IsApprox = micros.omega6LaApprox || micros.omega6AaApprox;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Micronutrients</h3>

      <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
        <MicroStat label="Net carbs" value={`${netCarbs} g`} />
        <MicroStat
          label="Omega-3 (partial)"
          value={omega3Sum == null ? "No Data" : `${omega3Sum} g`}
        />
        <MicroStat
          label={`Omega-6 (partial)${omega6IsApprox ? "*" : ""}`}
          value={omega6Sum == null ? "No Data" : `${omega6Sum} g`}
        />
      </div>
      <p className="mb-3 text-[10px] leading-snug text-muted-foreground">
        Net carbs = carbs − fiber, computed here, not stored. Omega-3/6 are a partial sum of
        only the named sub-components below — USDA never reports one verified total, and other
        unmeasured fatty acids in the family may exist.
        {omega6IsApprox &&
          " * includes a sub-component pulled from USDA's generic (non-n-6-confirmed) fatty acid id — see that field below."}
      </p>

      <Accordion type="multiple" className="rounded-md border px-3">
        {MICRO_FIELD_GROUPS.map((group) => (
          <AccordionItem key={group.id} value={group.id} className="last:border-b-0">
            <AccordionTrigger>{group.label}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-1.5">
                {group.fields.map((f) => {
                  const value = micros[f.key];
                  const isApproxOmega =
                    (f.key === "omega6La" && micros.omega6LaApprox) ||
                    (f.key === "omega6Aa" && micros.omega6AaApprox);
                  const sourceUnit =
                    f.key === "vitaminA"
                      ? micros.vitaminASourceUnit
                      : f.key === "vitaminD"
                        ? micros.vitaminDSourceUnit
                        : null;
                  return (
                    <div
                      key={f.key}
                      className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="flex items-center gap-1 font-medium tabular-nums">
                        {value == null ? (
                          <span className="text-muted-foreground">No Data</span>
                        ) : (
                          `${value} ${f.unit}`
                        )}
                        {sourceUnit === "iu" && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 px-1 py-0 text-[9px] text-amber-700"
                          >
                            IU
                          </Badge>
                        )}
                        {isApproxOmega && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 px-1 py-0 text-[9px] text-amber-700"
                          >
                            approx
                          </Badge>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
