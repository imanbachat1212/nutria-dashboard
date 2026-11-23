import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Search,
  Plus,
  ArrowUpDown,
  Filter,
  Phone,
  Users as UsersIcon,
  Circle,
  Loader2,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ServiceBadge } from "@/components/service-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent } from "@/components/ui/card";
import { NewClientDialog } from "@/components/new-client-dialog";
import type { ServiceType, ClientRecord } from "@/lib/clients-mock";
import { fetchClients, fetchClientStats, archiveClient, restoreClient } from "@/lib/clients-api";

type Filter = "all" | ServiceType | "active" | "paused" | "lead";

export const Route = createFileRoute("/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Nutria" },
      { name: "description", content: "All clients across diet, gym, and combined programs." },
    ],
  }),
  component: ClientsListPage,
});

// Only the KEYS live here now — these are also the values sent to the API, so they stay English.
// The displayed text is looked up from clients.list.filters.* at render time.
const FILTER_TABS: Filter[] = ["all", "active", "diet", "gym", "classes", "paused", "lead"];

const CLIENTS_PAGE_SIZE = 20;

// Windowed page numbers with ellipsis once there are enough pages that showing every number
// would crowd the bar — mirrors the Food Database page's pager exactly.
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

// Frontend "paused"/status-tab values → server query params. Diet/Gym/Classes filter by
// program (serviceType), Active/Paused/Lead filter by status — the two are mutually exclusive
// on the FILTER_TABS select, so at most one of these is ever set at a time.
function filterToStatus(filter: Filter): string | undefined {
  if (filter === "active") return "active";
  if (filter === "paused") return "inactive";
  if (filter === "lead") return "lead";
  return undefined;
}

function filterToServiceType(filter: Filter): ServiceType | undefined {
  if (filter === "diet" || filter === "gym" || filter === "classes") return filter;
  return undefined;
}

function ClientsListPage() {
  const { t } = useTranslation(["clients", "common"]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientRecord | null>(null);
  const queryClient = useQueryClient();

  // A stale page number after changing any filter could otherwise land on an empty page —
  // same reasoning as the Food Database page's identical effect.
  useEffect(() => {
    setPage(1);
  }, [query, filter, sort, showArchived]);

  const status = filterToStatus(filter);
  const serviceType = filterToServiceType(filter);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", query, status, serviceType, sort, showArchived, page],
    queryFn: () =>
      fetchClients({
        search: query || undefined,
        status,
        serviceType,
        sort,
        archived: showArchived,
        page,
        limit: CLIENTS_PAGE_SIZE,
      }),
  });

  const clients = data?.clients ?? [];
  const pageTotal = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(pageTotal / CLIENTS_PAGE_SIZE));
  const rangeStart = pageTotal === 0 ? 0 : (page - 1) * CLIENTS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * CLIENTS_PAGE_SIZE, pageTotal);

  // Archiving enough clients (or narrowing a filter) can shrink totalPages below the page
  // currently being viewed — land back on the new last page instead of showing an empty one.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // True counts for the mini-stat strip — a dedicated backend aggregate, always scoped to the
  // active (non-archived) roster and independent of the table's current search/filter/page, so
  // it never freezes once the roster exceeds one page (same class of bug fixed on the Food
  // Database page).
  const { data: statsData } = useQuery({
    queryKey: ["clients", "stats"],
    queryFn: fetchClientStats,
  });
  const totals = statsData ?? { total: 0, active: 0, diet: 0, gym: 0, classes: 0 };

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveClient(id),
    onSuccess: (_client, id) => {
      const name = archiveTarget?.id === id ? archiveTarget.name : t("clients:list.fallbackName");
      toast.success(t("clients:list.archivedToast", { name }));
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setArchiveTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreClient(id),
    onSuccess: (restored) => {
      toast.success(t("clients:list.restoredToast", { name: restored.name }));
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={t("clients:eyebrow")}
        title={t("clients:title")}
        description={t("clients:description")}
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("clients:newClient")}
          </Button>
        }
      />

      {/* Mini stat strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <MiniStat
          label={t("clients:list.stats.total")}
          value={totals.total}
          hint={t("clients:list.stats.totalHint", { count: totals.active })}
        />
        <MiniStat
          label={t("clients:serviceType.diet")}
          value={totals.diet}
          hint={t("clients:list.stats.program")}
        />
        <MiniStat
          label={t("clients:serviceType.gym")}
          value={totals.gym}
          hint={t("clients:list.stats.program")}
        />
        <MiniStat
          label={t("clients:serviceType.classes")}
          value={totals.classes}
          hint={t("clients:list.stats.program")}
        />
      </div>

      <Card className="border-border/70 shadow-soft">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("clients:list.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 ps-9 bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-border"
              />
            </div>

            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="h-9 w-40">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_TABS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`clients:list.filters.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-40">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("clients:list.sort.newest")}</SelectItem>
                <SelectItem value="name">{t("clients:list.sort.name")}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="h-3.5 w-3.5" />
              {t("clients:list.archived")}
            </Button>
          </div>

          <div className="flex items-center justify-between px-4 pt-3 text-sm text-muted-foreground">
            {/* One whole sentence. It was five JSX fragments interleaved with <span>s, which
                hard-codes English word order: Arabic puts the range and the total in different
                positions, so the pieces cannot be reordered by the translator. The emphasis
                styling on the numbers is the cost of that, and it is worth it. */}
            {pageTotal === 0
              ? t("clients:list.showingEmpty")
              : t("clients:list.showing", {
                  from: rangeStart,
                  to: rangeEnd,
                  total: pageTotal,
                })}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[60%]">{t("clients:list.columns.client")}</TableHead>
                  <TableHead className="w-[39%]">{t("clients:list.columns.program")}</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer transition-colors hover:bg-primary-soft/30"
                    >
                      <TableCell className="py-3">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                              {c.avatarInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{c.name}</span>
                              <StatusDot status={c.status} />
                              {c.archived && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {t("clients:list.badgeArchived")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{c.phone}</span>
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ServiceBadge types={c.serviceType} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t("clients:list.actions.openMenu")}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                                <Eye className="h-3.5 w-3.5" />
                                {t("clients:list.actions.view")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEditTarget(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                              {t("clients:list.actions.edit")}
                            </DropdownMenuItem>
                            {c.archived ? (
                              <DropdownMenuItem onSelect={() => restoreMutation.mutate(c.id)}>
                                <ArchiveRestore className="h-3.5 w-3.5" />
                                {t("clients:list.actions.restore")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-rose-600"
                                onSelect={() => setArchiveTarget(c)}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                {t("clients:list.actions.archive")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-8 w-8 opacity-50" />
                        <p className="text-sm">
                          {showArchived
                            ? t("clients:list.emptyArchived")
                            : t("clients:list.emptyFiltered")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <div className="text-xs text-muted-foreground">
                {t("clients:list.page", { page, total: totalPages })}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("common:actions.previous")}
                </Button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">
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
                  {t("common:actions.next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NewClientDialog
        open={newOpen || !!editTarget}
        onOpenChange={(o) => {
          if (!o) {
            setNewOpen(false);
            setEditTarget(null);
          }
        }}
        editClientId={editTarget?.id ?? null}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("clients:list.archiveTitle", { name: archiveTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("clients:list.archiveBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>
              {t("common:actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={archiveMutation.isPending}
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
            >
              {archiveMutation.isPending
                ? t("clients:list.archiving")
                : t("clients:list.archiveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: "active" | "paused" | "lead" }) {
  const tone =
    status === "active"
      ? "text-success fill-success"
      : status === "paused"
        ? "text-warning-foreground fill-warning"
        : "text-muted-foreground fill-muted-foreground";
  return <Circle className={`h-2 w-2 ${tone}`} />;
}
