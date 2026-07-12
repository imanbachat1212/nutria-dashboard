import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  Dumbbell,
  Utensils,
  Plus,
  Minus,
  Send,
  Loader2,
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
import { cn } from "@/lib/utils";
import {
  fetchJournalEntries,
  updateJournalEntry,
  FLAG_LABEL,
  SOURCE_LABEL,
  SLOT_LABEL,
  timeAgo,
  type JournalEntry,
  type JournalConfidence,
  type JournalSource,
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

function JournalReviewPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [openLog, setOpenLog] = useState<JournalEntry | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal"],
    queryFn: () => fetchJournalEntries({ from: defaultFrom(), limit: 200 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => updateJournalEntry(id, { status: "approved" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => updateJournalEntry(id, { status: "rejected" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  async function approveAllClean() {
    const clean = entries.filter(
      (e) => e.status === "pending" && e.flags.length === 0 && e.confidence !== "low",
    );
    await Promise.all(clean.map((e) => updateJournalEntry(e.id, { status: "approved" })));
    qc.invalidateQueries({ queryKey: ["journal"] });
  }

  const stats = useMemo(
    () => ({
      pending: entries.filter((e) => e.status === "pending").length,
      flagged: entries.filter((e) => e.status === "pending" && e.flags.length > 0).length,
      approved: entries.filter((e) => e.status === "approved").length,
      lowConf: entries.filter((e) => e.status === "pending" && e.confidence === "low").length,
    }),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [tab, query, entries]);

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
            <Button size="sm" className="gap-1.5" onClick={approveAllClean}>
              <CheckCircle2 className="h-4 w-4" />
              Approve all clean
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending review"
          value={stats.pending.toString()}
          hint="awaiting your eyes"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Flagged"
          value={stats.flagged.toString()}
          hint="needs attention"
          accent="warn"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Low confidence"
          value={stats.lowConf.toString()}
          hint="AI < 70% sure"
          accent="info"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approved today"
          value={stats.approved.toString()}
          hint="in client charts"
          accent="success"
        />
      </div>

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

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="font-display text-lg font-semibold">All caught up</p>
          <p className="text-sm text-muted-foreground">
            No logs match this view. Take a sip of coffee.
          </p>
        </Card>
      ) : (
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
      )}

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

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: "success" | "warn" | "info";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground",
            accent === "success" && "bg-emerald-100 text-emerald-700",
            accent === "warn" && "bg-amber-100  text-amber-700",
            accent === "info" && "bg-blue-100   text-blue-700",
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </Card>
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
}: {
  log: JournalEntry;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
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
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {log.clientInitials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{log.clientName}</span>
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

          {log.rawMessage && (
            <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground italic">
              "{log.rawMessage}"
            </p>
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
