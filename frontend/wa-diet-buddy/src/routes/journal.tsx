import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Pencil,
  AlertTriangle,
  MessageCircle,
  Camera,
  Smartphone,
  Sparkles,
  Clock,
  Flame,
  ChevronRight,
  ChevronDown,
  Dumbbell,
  Utensils,
  Plus,
  Minus,
  Send,
  Loader2,
  Users,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  fetchJournalEntries,
  fetchJournalQueue,
  updateJournalEntry,
  FLAG_LABEL,
  SOURCE_LABEL,
  SLOT_LABEL,
  timeAgo,
  type JournalEntry,
  type JournalConfidence,
  type JournalSource,
  type JournalStatus,
  type JournalQueueClient,
} from "@/lib/journal-api";
import { NewJournalEntryDialog } from "@/components/new-journal-entry-dialog";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal Review — Nutria" },
      {
        name: "description",
        content:
          "Spot-check text and photo WhatsApp meal logs, fix anomalies, and approve them into client charts.",
      },
    ],
  }),
  component: JournalReviewPage,
});

type Tab = "pending" | "flagged" | "approved" | "all";

// last 30 days by default
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

type ViewMode = "client" | "timeline";

// One row of the client queue: everything Sura needs to decide who to open next.
//
// Comes from GET /api/journal/queue now (prompt-124), not from grouping a page of entries, so
// the counts are over EVERY entry in the window rather than over whichever 200 the list endpoint
// returned. It deliberately carries no `entries` array — the selected client's entries are
// fetched on their own, so opening a client no longer depends on them having survived that cap.
interface ClientGroup {
  key: string;
  clientId: string;
  name: string;
  initials: string;
  entryCount: number;
  pending: number;
  approved: number;
  flagged: number;
  lowConf: number;
  cleanPending: number;
  oldestPendingMs: number | null;
  lastMs: number;
}

function toGroup(c: JournalQueueClient): ClientGroup {
  return {
    key: c.clientId,
    clientId: c.clientId,
    name: c.clientName,
    initials: c.clientInitials,
    entryCount: c.entryCount,
    pending: c.pending,
    approved: c.approved,
    flagged: c.flagged,
    lowConf: c.lowConf,
    cleanPending: c.cleanPending,
    oldestPendingMs: c.oldestPendingAt ? new Date(c.oldestPendingAt).getTime() : null,
    lastMs: c.lastEntryAt ? new Date(c.lastEntryAt).getTime() : 0,
  };
}

// "Clean" = safe to approve without looking: pending, nothing flagged, AI not unsure.
const isClean = (e: JournalEntry) =>
  e.status === "pending" && e.flags.length === 0 && e.confidence !== "low";

function dayLabel(d: Date): string {
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function JournalReviewPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [openLog, setOpenLog] = useState<JournalEntry | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("client");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const lastIdxRef = useRef(0);
  // Per-day open/closed overrides, keyed "<client>|<day>". A day with no override falls back to
  // a default (see dayDefaultOpen): the newest day, or any day that still has pending entries.
  const [dayOpen, setDayOpen] = useState<Record<string, boolean>>({});

  const from = defaultFrom();
  const trimmedQuery = query.trim();

  // The queue is always fetched with status "all": every client with an entry in the window,
  // each row carrying its pending / flagged / approved counts. The tabs then just filter those
  // rows, so switching tabs needs no refetch and the tab counts stay right on every tab (a
  // status-filtered queue made the Pending and Flagged counts read 0 on the Approved tab, and
  // hid clients without pending entries from the All tab).
  const queueStatus = "all" as const;
  const entryStatus: JournalStatus | undefined =
    tab === "approved" ? "approved" : tab === "all" ? undefined : "pending";

  // The queue + the four stat cards. One row per client, so nothing here is truncated.
  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ["journal-queue", from, queueStatus, trimmedQuery],
    queryFn: () => fetchJournalQueue({ from, status: queueStatus, q: trimmedQuery || undefined }),
  });

  // Timeline only. This is the old capped fetch, now behind `enabled` so the by-client view —
  // where everything is server-counted — doesn't pay for 200 rows it no longer reads.
  const { data: entries = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["journal", "timeline", from],
    queryFn: () => fetchJournalEntries({ from, limit: 200 }),
    enabled: view === "timeline",
  });

  // Both caches, after every write: ["journal"] covers the timeline fetch and the per-client
  // fetch below (react-query matches by key prefix), ["journal-queue"] covers the counts.
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["journal"] });
    qc.invalidateQueries({ queryKey: ["journal-queue"] });
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => updateJournalEntry(id, { status: "approved" }),
    onSuccess: invalidateAll,
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => updateJournalEntry(id, { status: "rejected" }),
    onSuccess: invalidateAll,
  });

  // Approve in small batches so 100+ entries don't fire 100 requests at once.
  async function approveMany(list: JournalEntry[]) {
    if (!list.length) return;
    setBulkBusy(true);
    try {
      await approveIds(list.map((e) => e.id));
    } finally {
      setBulkBusy(false);
      invalidateAll();
    }
  }

  async function approveIds(ids: string[]) {
    for (let i = 0; i < ids.length; i += 10) {
      await Promise.all(
        ids.slice(i, i + 10).map((id) => updateJournalEntry(id, { status: "approved" })),
      );
    }
  }

  // "Approve all clean" asks the SERVER which entries are clean rather than approving whatever
  // happens to be loaded — the loaded page is capped at 200 and the oldest pending entries are
  // the first to fall off it, so the old version could quietly skip the ones waiting longest.
  //
  // Loops because the fetch is still capped: each pass approves the clean entries it can see,
  // which removes them from `status=pending`, so the next pass sees further back. It stops when a
  // pass finds nothing clean. The guard bounds a single press at 20 × 200 entries; if anything
  // clean remains after that the count beside the button simply stays non-zero and she can press
  // again — the button reflects the server's number, so it can't claim to have finished when it
  // hasn't.
  async function approveAllClean() {
    setBulkBusy(true);
    try {
      for (let pass = 0; pass < 20; pass += 1) {
        const page = await fetchJournalEntries({ from, status: "pending", limit: 200 });
        const ids = page.filter(isClean).map((e) => e.id);
        if (!ids.length) break;
        await approveIds(ids);
      }
    } finally {
      setBulkBusy(false);
      invalidateAll();
    }
  }

  // Server-computed, so they describe every entry in the window rather than a page of it.
  const stats = {
    pending: queue?.totals.pending ?? 0,
    flagged: queue?.totals.flagged ?? 0,
    lowConf: queue?.totals.lowConf ?? 0,
    approved: queue?.totals.approved ?? 0,
    cleanPending: queue?.totals.cleanPending ?? 0,
    clients: queue?.totals.clients ?? 0,
  };

  // Timeline rows only — the by-client view no longer reads this.
  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    return entries.filter((e) => {
      if (tab === "pending" && e.status !== "pending") return false;
      if (tab === "flagged" && !(e.status === "pending" && e.flags.length)) return false;
      if (tab === "approved" && e.status !== "approved") return false;
      if (!q) return true;
      return (
        e.clientName.toLowerCase().includes(q) ||
        (e.rawMessage || "").toLowerCase().includes(q) ||
        e.items.some((i) => i.label.toLowerCase().includes(q))
      );
    });
  }, [tab, trimmedQuery, entries]);

  // ── By-client view ───────────────────────────────────────────────────────
  // Straight from the queue endpoint: already counted over the whole window, already name-
  // searched, and already ordered (flagged desc, then longest-waiting). The Flagged tab narrows
  // to clients who actually have one — the server returns the pending queue, and "flagged" is a
  // subset of it rather than a separate status.
  const groups = useMemo(() => {
    const rows = (queue?.clients ?? []).map(toGroup);
    if (tab === "pending") return rows.filter((g) => g.pending > 0);
    if (tab === "flagged") return rows.filter((g) => g.flagged > 0);
    if (tab === "approved") {
      // Most recently active first; the server order is built for the pending queue.
      return rows.filter((g) => g.approved > 0).sort((a, b) => b.lastMs - a.lastMs);
    }
    return rows; // All: everyone, server order (flagged / longest-waiting first)
  }, [queue, tab]);

  // Keep a client selected. When the selected one drops out (their last pending entry was
  // approved), land on whoever now sits in their place in the queue — i.e. the next client.
  useEffect(() => {
    if (view !== "client" || groups.length === 0) return;
    const idx = groups.findIndex((g) => g.key === selectedKey);
    if (idx >= 0) {
      lastIdxRef.current = idx;
      return;
    }
    setSelectedKey(groups[Math.min(lastIdxRef.current, groups.length - 1)].key);
  }, [groups, selectedKey, view]);

  const activeGroup = groups.find((g) => g.key === selectedKey) ?? null;

  // The selected client's entries, fetched for that client alone (prompt-124). Previously these
  // were filtered out of the global 200-row page, so a client whose entries had been pushed past
  // the cap opened to a queue row that said "6 pending" above an empty panel.
  const { data: activeEntries = [], isLoading: activeLoading } = useQuery({
    queryKey: ["journal", "client", activeGroup?.clientId, from, entryStatus ?? "all"],
    queryFn: () =>
      fetchJournalEntries({ client: activeGroup!.clientId, from, status: entryStatus, limit: 200 }),
    enabled: view === "client" && !!activeGroup?.clientId,
  });

  // The queue search is a client-name match server-side; within an open client the same box
  // still narrows by message text and item name, exactly as it did before.
  const activeVisible = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    return activeEntries.filter((e) => {
      if (tab === "flagged" && !(e.status === "pending" && e.flags.length)) return false;
      if (!q) return true;
      return (
        e.clientName.toLowerCase().includes(q) ||
        (e.rawMessage || "").toLowerCase().includes(q) ||
        e.items.some((i) => i.label.toLowerCase().includes(q))
      );
    });
  }, [activeEntries, tab, trimmedQuery]);

  const activeClean = useMemo(() => activeEntries.filter(isClean), [activeEntries]);

  // Clients holding at least one clean pending entry — for the confirm dialog's "across N
  // clients". Counted from the queue rows, which are server-computed, so it stays correct past
  // the 200-entry page the old version counted from.
  const cleanClientCount = (queue?.clients ?? []).filter((c) => c.cleanPending > 0).length;

  const days = useMemo(() => {
    if (!activeGroup) return [];
    const sorted = [...activeVisible].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const out: { key: string; label: string; kcal: number; entries: JournalEntry[] }[] = [];
    for (const e of sorted) {
      const d = new Date(e.date);
      const k = d.toDateString();
      let day = out.find((x) => x.key === k);
      if (!day) {
        day = { key: k, label: dayLabel(d), kcal: 0, entries: [] };
        out.push(day);
      }
      day.entries.push(e);
      if (e.kind === "meal" && e.status !== "rejected") day.kcal += e.totals.kcal;
    }
    return out;
  }, [activeGroup, activeVisible]);

  const dayDefaultOpen = (
    day: { entries: JournalEntry[] },
    index: number,
  ) => index === 0 || day.entries.some((e) => e.status === "pending");

  function setAllDays(open: boolean) {
    if (!activeGroup) return;
    setDayOpen((prev) => {
      const next = { ...prev };
      for (const d of days) next[`${activeGroup.key}|${d.key}`] = open;
      return next;
    });
  }

  function goNextClient() {
    if (groups.length < 2) return;
    const idx = groups.findIndex((g) => g.key === selectedKey);
    setSelectedKey(groups[(idx + 1) % groups.length].key);
  }

  return (
    <div className="mx-auto max-w-350">
      <PageHeader
        eyebrow="Daily review"
        title="Journal Review"
        description="Spot-check text and photo WhatsApp logs, correct portions or macros, and push clean entries into the client chart."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Log entry
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={bulkBusy}
              onClick={() => setConfirmAllOpen(true)}
            >
              {bulkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve all clean{stats.cleanPending > 0 ? ` (${stats.cleanPending})` : ""}
            </Button>
          </div>
        }
      />

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Pending
              <CountBadge n={stats.pending} />
            </TabsTrigger>
            <TabsTrigger value="flagged" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Flagged
              <CountBadge n={stats.flagged} tone="warn" />
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
              <CountBadge n={stats.approved} />
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="client" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                By client
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, items, messages…"
              className="h-9 w-72 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </div>
      </div>

      {/* The by-client queue and the stat cards are server-counted now (prompt-124), so this no
          longer applies to them and the `view === "timeline"` guard retires it there. It is NOT
          removed outright: Timeline still renders the capped 200-row fetch, so for that view the
          warning is still true, and deleting it would make Timeline quietly claim completeness it
          doesn't have. The counts wording goes, since the counts above are no longer affected. */}
      {view === "timeline" && entries.length >= 200 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Timeline shows up to 200 entries from the last 30 days, newest first — older ones are
            not listed here. Switch to By client for complete per-client counts.
          </span>
        </div>
      )}

      {(view === "client" ? queueLoading : timelineLoading) ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (view === "timeline" ? filtered.length === 0 : groups.length === 0) ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="font-display text-lg font-semibold">All caught up</p>
          <p className="text-sm text-muted-foreground">
            No logs match this view. Take a sip of coffee.
          </p>
        </Card>
      ) : view === "timeline" ? (
        <div className="space-y-2.5">
          {filtered.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              onOpen={() => setOpenLog(log)}
              onApprove={() => approveMutation.mutate(log.id)}
              onReject={() => rejectMutation.mutate(log.id)}
              approving={approveMutation.isPending && approveMutation.variables === log.id}
              rejecting={rejectMutation.isPending && rejectMutation.variables === log.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Client queue */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {groups.length} client{groups.length === 1 ? "" : "s"}
            </div>
            <div className="max-h-[calc(100vh-22rem)] min-h-40 divide-y overflow-y-auto">
              {groups.map((g) => (
                <ClientQueueRow
                  key={g.key}
                  g={g}
                  active={g.key === activeGroup?.key}
                  badge={
                    tab === "approved"
                      ? { n: g.approved, title: "Approved" }
                      : tab === "all"
                        ? { n: g.entryCount, title: "Entries" }
                        : { n: g.pending, title: "Pending" }
                  }
                  onSelect={() => setSelectedKey(g.key)}
                />
              ))}
            </div>
          </Card>

          {/* Selected client's logs */}
          {activeGroup && (
            <div className="min-w-0 space-y-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {activeGroup.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-display text-lg font-semibold tracking-tight">
                        {activeGroup.name}
                      </h2>
                      {activeGroup.clientId && (
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: activeGroup.clientId }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Open client profile"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activeGroup.pending} pending
                      {activeGroup.flagged > 0 && ` · ${activeGroup.flagged} flagged`}
                      {activeGroup.lowConf > 0 && ` · ${activeGroup.lowConf} low confidence`}
                      {` · ${activeVisible.length} in this view`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={bulkBusy || activeClean.length === 0}
                      onClick={() => approveMany(activeClean)}
                    >
                      {bulkBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {activeClean.length > 0
                        ? `Approve ${activeClean.length} clean`
                        : "No clean entries"}
                    </Button>
                    {groups.length > 1 && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={goNextClient}>
                        Next client
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* The selected client's entries load on their own now, so the panel can be
                  fetching while the queue beside it is already drawn. */}
              {activeLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : days.length === 0 ? (
                <Card className="flex flex-col items-center gap-1.5 p-8 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <p className="text-sm font-medium">Nothing to review here</p>
                  <p className="text-xs text-muted-foreground">
                    No entries match this view for {activeGroup.name}.
                  </p>
                </Card>
              ) : null}

              {days.length > 1 && (
                <div className="flex justify-end gap-1 px-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAllDays(true)}
                  >
                    Expand all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAllDays(false)}
                  >
                    Collapse all
                  </Button>
                </div>
              )}

              {days.map((day, i) => {
                const id = `${activeGroup.key}|${day.key}`;
                const open = dayOpen[id] ?? dayDefaultOpen(day, i);
                const pendingInDay = day.entries.filter((e) => e.status === "pending").length;
                return (
                  <section key={day.key}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setDayOpen((prev) => ({ ...prev, [id]: !open }))}
                      className="mb-2 flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-xs transition hover:bg-muted/50"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          !open && "-rotate-90",
                        )}
                      />
                      <span className="font-semibold text-foreground">{day.label}</span>
                      {day.kcal > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Flame className="h-3 w-3 text-orange-500" />
                          {Math.round(day.kcal)} kcal logged
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        · {day.entries.length} {day.entries.length === 1 ? "entry" : "entries"}
                      </span>
                      {/* Visible while collapsed too, so a closed day can't hide unreviewed work. */}
                      {pendingInDay > 0 && (
                        <Badge
                          variant="outline"
                          className="ml-auto rounded-md border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700"
                        >
                          {pendingInDay} pending
                        </Badge>
                      )}
                    </button>
                    {open && (
                      <div className="space-y-2.5">
                        {day.entries.map((log) => (
                          <LogRow
                            key={log.id}
                            log={log}
                            hideClient
                            onOpen={() => setOpenLog(log)}
                            onApprove={() => approveMutation.mutate(log.id)}
                            onReject={() => rejectMutation.mutate(log.id)}
                            approving={
                              approveMutation.isPending && approveMutation.variables === log.id
                            }
                            rejecting={
                              rejectMutation.isPending && rejectMutation.variables === log.id
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          {stats.cleanPending > 0 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve all clean entries?</AlertDialogTitle>
                {/* Counts come from the server's totals, so they describe every clean pending
                    entry in the window — not just the ones on the loaded page. */}
                <AlertDialogDescription>
                  This approves {stats.cleanPending}{" "}
                  {stats.cleanPending === 1 ? "entry" : "entries"} across {cleanClientCount} client
                  {cleanClientCount === 1 ? "" : "s"} without opening them individually. Only
                  entries with no flags and AI confidence above "low" are included
                  {stats.pending > stats.cleanPending &&
                    `; the other ${stats.pending - stats.cleanPending} pending need a manual look`}
                  . To review one client at a time, cancel and use "Approve clean" on that client
                  instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={approveAllClean}>
                  Approve {stats.cleanPending}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Nothing to approve automatically</AlertDialogTitle>
                <AlertDialogDescription>
                  {stats.pending === 0
                    ? "There are no pending entries right now."
                    : `All ${stats.pending} pending ${stats.pending === 1 ? "entry needs" : "entries need"} a manual look — each one is either flagged (${stats.flagged}) or has low AI confidence (${stats.lowConf}), so they are never approved in bulk. Open the Flagged tab to review them one by one.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!openLog} onOpenChange={(o) => !o && setOpenLog(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {openLog && (
            <LogDetail
              log={openLog}
              onClose={() => setOpenLog(null)}
              onReject={() => {
                rejectMutation.mutate(openLog.id);
                setOpenLog(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <NewJournalEntryDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ClientQueueRow({
  g,
  active,
  badge,
  onSelect,
}: {
  g: ClientGroup;
  active: boolean;
  badge: { n: number; title: string };
  onSelect: () => void;
}) {
  const sinceIso =
    g.oldestPendingMs !== null ? new Date(g.oldestPendingMs).toISOString() : new Date(g.lastMs).toISOString();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-left transition hover:bg-muted/50",
        active && "border-primary bg-primary/5",
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
          {g.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{g.name}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {g.oldestPendingMs !== null ? "waiting " : "last entry "}
          <TimeAgo iso={sinceIso} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {g.flagged > 0 && (
          <Badge
            variant="outline"
            className="gap-1 rounded-md border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700"
            title={`${g.flagged} flagged`}
          >
            <AlertTriangle className="h-3 w-3" />
            {g.flagged}
          </Badge>
        )}
        <Badge variant="secondary" className="px-1.5 text-[10px]" title={badge.title}>
          {badge.n}
        </Badge>
      </div>
    </button>
  );
}

function CountBadge({ n, tone }: { n: number; tone?: "warn" }) {
  if (!n) return null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "ml-1 h-5 px-1.5 text-[10px]",
        tone === "warn" && "bg-amber-100 text-amber-700",
      )}
    >
      {n}
    </Badge>
  );
}

function KindIcon({ kind, className }: { kind: "meal" | "exercise"; className?: string }) {
  const Icon = kind === "exercise" ? Dumbbell : Utensils;
  return <Icon className={className} />;
}

function SourceIcon({ source }: { source: JournalSource }) {
  const map: Record<JournalSource, typeof MessageCircle> = {
    dashboard: Smartphone,
    "whatsapp-text": MessageCircle,
    "whatsapp-photo": Camera,
  };
  const Icon = map[source] ?? Smartphone;
  return <Icon className="h-3 w-3" />;
}

// null-safe: dashboard entries have confidence=null → render nothing
function ConfidencePill({ c }: { c: JournalConfidence }) {
  if (!c) return null;
  const map = {
    high: { label: "High", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    medium: { label: "Medium", cls: "border-amber-200  bg-amber-50  text-amber-700" },
    low: { label: "Low", cls: "border-rose-200   bg-rose-50   text-rose-700" },
  } as const;
  const m = map[c];
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-md text-[10px]", m.cls)}>
      <Sparkles className="h-3 w-3" />
      AI {m.label}
    </Badge>
  );
}

function StatusPill({ status }: { status: JournalEntry["status"] }) {
  if (status === "approved")
    return (
      <Badge
        variant="outline"
        className="rounded-md border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
      >
        Approved
      </Badge>
    );
  if (status === "edited")
    return (
      <Badge
        variant="outline"
        className="rounded-md border-blue-200   bg-blue-50   text-[10px] text-blue-700"
      >
        Edited
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge
        variant="outline"
        className="rounded-md border-rose-200   bg-rose-50   text-[10px] text-rose-700"
      >
        Rejected
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="rounded-md border-amber-200 bg-amber-50 text-[10px] text-amber-700"
    >
      Pending
    </Badge>
  );
}

function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(timeAgo(iso));
    const id = setInterval(() => setLabel(timeAgo(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return <span>{label ?? "—"}</span>;
}

function SlotBadge({ log }: { log: JournalEntry }) {
  const text = log.mealSlot ? SLOT_LABEL[log.mealSlot] : log.kind;
  return (
    <Badge variant="secondary" className="gap-1 rounded-md text-[10px] capitalize">
      <KindIcon kind={log.kind} className="h-3 w-3" />
      {text}
    </Badge>
  );
}

function LogRow({
  log,
  onOpen,
  onApprove,
  onReject,
  approving,
  rejecting,
  hideClient,
}: {
  log: JournalEntry;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
  hideClient?: boolean;
}) {
  return (
    <Card
      onClick={onOpen}
      className={cn(
        "group cursor-pointer p-4 transition hover:shadow-md hover:-translate-y-0.5",
        log.flags.length > 0 && log.status === "pending" && "border-amber-200",
      )}
    >
      <div className="flex items-start gap-3">
        {!hideClient && (
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {log.clientInitials}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {!hideClient && <span className="font-medium text-sm">{log.clientName}</span>}
            <SlotBadge log={log} />
            <Badge variant="outline" className="gap-1 rounded-md text-[10px]">
              <SourceIcon source={log.source} />
              {SOURCE_LABEL[log.source]}
            </Badge>
            <ConfidencePill c={log.confidence} />
            <StatusPill status={log.status} />
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <TimeAgo iso={log.date} />
            </span>
          </div>

          <div className="mt-1.5 flex items-start gap-2">
            {/* Photo thumbnail (prompt-91) — this page's own description promises "spot-check
                text and photo WhatsApp meal logs", and a photo log is not reviewable without
                the photo. Small here, full size in the detail sheet. */}
            {log.photo && (
              <img
                src={log.photo.url}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-md border object-cover"
              />
            )}
            {log.rawMessage && (
              <p className="line-clamp-1 text-sm text-muted-foreground italic">
                "{log.rawMessage}"
              </p>
            )}
          </div>

          {/* The activity itself, in the same position a meal's items occupy — this is the
              line that tells Sura what she's reviewing. */}
          {log.kind === "exercise" && log.exercise && (
            <div className="mt-2 text-xs">
              <span className="font-medium capitalize text-foreground/80">{log.exercise.type}</span>
            </div>
          )}

          {log.items.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              {log.items.slice(0, 4).map((it, idx) => (
                <span key={idx} className="text-foreground/80">
                  <span className="font-medium">{it.label}</span>
                  {it.grams != null && (
                    <span className="text-muted-foreground"> · {it.grams}g</span>
                  )}
                </span>
              ))}
              {log.items.length > 4 && (
                <span className="text-muted-foreground">+{log.items.length - 4} more</span>
              )}
            </div>
          )}

          {log.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {log.flags.map((f) => (
                <Badge
                  key={f}
                  variant="outline"
                  className="gap-1 rounded-md border-amber-200 bg-amber-50 text-[10px] text-amber-700"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {FLAG_LABEL[f] ?? f}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {log.kind === "meal" && log.totals.kcal > 0 && (
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 font-display text-xl font-semibold tracking-tight">
              <Flame className="h-4 w-4 text-orange-500" />
              {log.totals.kcal}
            </div>
            <div className="text-[10px] uppercase text-muted-foreground">kcal</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span>P {log.totals.protein}</span>
              <span>C {log.totals.carbs}</span>
              <span>F {log.totals.fat}</span>
            </div>
          </div>
        )}

        {/* Activity (prompt-95). Sky, not the orange used for eaten calories, and labelled
            "burned" — the two numbers must never be mistakable for one another at a glance,
            since nothing in this app subtracts one from the other. */}
        {log.kind === "exercise" && log.exercise && (
          <div className="text-right shrink-0">
            {log.exercise.burnedCalories != null ? (
              <>
                <div className="flex items-center justify-end gap-1 font-display text-xl font-semibold tracking-tight text-sky-700">
                  <Dumbbell className="h-4 w-4 text-sky-600" />
                  {log.exercise.burnedCalories}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">kcal burned</div>
              </>
            ) : (
              <div className="text-[10px] uppercase text-muted-foreground">no estimate</div>
            )}
            <div className="mt-1 text-[10px] capitalize text-muted-foreground">
              {[log.exercise.minutes != null ? `${log.exercise.minutes} min` : null, log.exercise.intensity]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}

        <ChevronRight className="h-4 w-4 self-center text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      {log.status === "pending" && (
        <>
          <Separator className="my-3" />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              disabled={rejecting}
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
            >
              {rejecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1"
              disabled={approving}
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function LogDetail({
  log,
  onClose,
  onReject,
}: {
  log: JournalEntry;
  onClose: () => void;
  onReject: () => void;
}) {
  const qc = useQueryClient();
  const [editItems, setEditItems] = useState(
    log.items.map((i) => ({
      food: i.food,
      label: i.label,
      grams: i.grams != null ? String(i.grams) : "",
      calories: i.macros?.calories ?? 0,
      protein: i.macros?.protein ?? 0,
      carbs: i.macros?.carbs ?? 0,
      fat: i.macros?.fat ?? 0,
    })),
  );
  const [note, setNote] = useState(log.note ?? "");
  const [saving, setSaving] = useState(false);

  const totals = editItems.reduce(
    (a, i) => ({
      kcal: a.kcal + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function updateItem(idx: number, patch: Partial<(typeof editItems)[0]>) {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function handleApprove() {
    setSaving(true);
    try {
      await updateJournalEntry(log.id, {
        status: "approved",
        items: editItems
          .filter((i) => i.label.trim())
          .map((i) => ({
            food: i.food || undefined,
            label: i.label.trim(),
            grams: i.grams ? Number(i.grams) : undefined,
          })),
        note: note || undefined,
      });
      qc.invalidateQueries({ queryKey: ["journal"] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {log.clientInitials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <SheetTitle className="font-display text-lg">{log.clientName}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {SOURCE_LABEL[log.source]} · <TimeAgo iso={log.date} />
            </p>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-4 flex flex-wrap gap-2">
        <SlotBadge log={log} />
        <ConfidencePill c={log.confidence} />
        <StatusPill status={log.status} />
      </div>

      {log.photo && (
        <a href={log.photo.url} target="_blank" rel="noreferrer" className="mt-4 block">
          <img
            src={log.photo.url}
            alt="Meal photo sent by the client"
            className="max-h-72 w-full rounded-lg border object-contain"
          />
        </a>
      )}

      {log.rawMessage && (
        <Card className="mt-4 bg-muted/40 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Original message
          </div>
          <p className="mt-1 text-sm italic">"{log.rawMessage}"</p>
        </Card>
      )}

      {log.flags.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Why this was flagged
          </div>
          <ul className="mt-1.5 space-y-1 text-xs text-amber-900/90">
            {log.flags.map((f) => (
              <li key={f}>· {FLAG_LABEL[f] ?? f}</li>
            ))}
            {log.note && <li className="mt-1 text-amber-800">— {log.note}</li>}
          </ul>
        </div>
      )}

      {/* Activity detail (prompt-95) — occupies the place the Items editor holds for a meal.
          Read-only: correcting an AI burn estimate needs its own input, which this version
          doesn't have; Sura can still approve or reject the session. */}
      {log.kind === "exercise" && log.exercise && (
        <>
          <Separator className="my-5" />
          <h3 className="mb-2 text-sm font-semibold">Activity</h3>
          <Card className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">{log.exercise.type}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {[
                      log.exercise.minutes != null ? `${log.exercise.minutes} min` : null,
                      log.exercise.intensity,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No duration reported"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold tracking-tight text-sky-700">
                  {log.exercise.burnedCalories ?? "—"}
                </p>
                <p className="text-[10px] uppercase text-muted-foreground">kcal burned</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Estimated from the activity, duration and the client's weight. Not subtracted from
              their daily target — approving this records the session, it doesn't give back
              calories.
            </p>
          </Card>
        </>
      )}

      {log.kind === "meal" && (
        <>
          <Separator className="my-5" />
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                setEditItems((p) => [
                  ...p,
                  { food: null, label: "", grams: "", calories: 0, protein: 0, carbs: 0, fat: 0 },
                ])
              }
            >
              <Plus className="h-3 w-3" /> Add item
            </Button>
          </div>

          <div className="space-y-2">
            {editItems.map((it, idx) => (
              <Card key={idx} className="p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    value={it.label}
                    onChange={(e) => updateItem(idx, { label: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Item name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                    onClick={() => setEditItems((p) => p.filter((_, i) => i !== idx))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  <LabeledInput
                    label="Grams"
                    value={it.grams}
                    onChange={(v) => updateItem(idx, { grams: v })}
                    isText
                  />
                  <LabeledInput
                    label="kcal"
                    value={String(it.calories)}
                    onChange={(v) => updateItem(idx, { calories: Number(v) || 0 })}
                  />
                  <LabeledInput
                    label="P"
                    value={String(it.protein)}
                    onChange={(v) => updateItem(idx, { protein: Number(v) || 0 })}
                  />
                  <LabeledInput
                    label="C"
                    value={String(it.carbs)}
                    onChange={(v) => updateItem(idx, { carbs: Number(v) || 0 })}
                  />
                  <LabeledInput
                    label="F"
                    value={String(it.fat)}
                    onChange={(v) => updateItem(idx, { fat: Number(v) || 0 })}
                  />
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-4 bg-primary/5 p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Meal totals
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              <TotalCell label="kcal" value={totals.kcal} />
              <TotalCell label="Protein" value={`${totals.protein}g`} />
              <TotalCell label="Carbs" value={`${totals.carbs}g`} />
              <TotalCell label="Fat" value={`${totals.fat}g`} />
            </div>
          </Card>
        </>
      )}

      <Separator className="my-5" />
      <label className="text-xs font-medium text-muted-foreground">Coach note (optional)</label>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Great choice — let's swap the croissant for fruit next time."
        className="mt-1.5 min-h-15 text-sm"
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" className="flex-1 gap-1.5" onClick={handleApprove} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {saving ? "Saving…" : "Approve & push to chart"}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onClose}>
          <Send className="h-3.5 w-3.5" />
          Reply on WhatsApp
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          onClick={onReject}
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  isText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isText?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={isText ? "text" : "decimal"}
        className="h-8 px-2 text-xs"
      />
    </div>
  );
}

function TotalCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
