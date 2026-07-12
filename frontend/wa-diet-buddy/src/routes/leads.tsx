import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Plus,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  MessageCircle,
  Phone,
  Sparkles,
  TrendingUp,
  Clock,
  Instagram,
  Facebook,
  Globe,
  Users as UsersIcon,
  CheckCircle2,
  CircleSlash,
  Send,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEADS,
  STAGES,
  SOURCE_LABEL,
  INTEREST_LABEL,
  type LeadRecord,
  type LeadSource,
  type LeadStage,
} from "@/lib/leads-mock";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Nutria" },
      {
        name: "description",
        content: "WhatsApp-first CRM. Capture, qualify, and convert leads into paying clients.",
      },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | LeadSource>("all");
  const [openLead, setOpenLead] = useState<LeadRecord | null>(null);

  const filtered = useMemo(() => {
    return LEADS.filter((l) => {
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.tags.some((t) => t.includes(q))
      );
    });
  }, [query, sourceFilter]);

  const stats = useMemo(() => {
    const total = LEADS.length;
    const newLeads = LEADS.filter((l) => l.stage === "new").length;
    const booked = LEADS.filter((l) => l.stage === "consult-booked").length;
    const converted = LEADS.filter((l) => l.stage === "converted").length;
    const conv = total ? Math.round((converted / total) * 100) : 0;
    return { total, newLeads, booked, converted, conv };
  }, []);

  return (
    <div className="mx-auto max-w-350">
      <PageHeader
        eyebrow="Practice"
        title="Leads"
        description="Every WhatsApp, Instagram, and referral inquiry — captured, scored by the AI, and moved through your pipeline."
        actions={<></>}
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <StatCard
          icon={<UsersIcon className="h-4 w-4" />}
          label="Total leads"
          value={stats.total}
          hint="this month"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="New today"
          value={stats.newLeads}
          hint="awaiting reply"
          tone="primary"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Consults booked"
          value={stats.booked}
          hint="this week"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Conversion rate"
          value={`${stats.conv}%`}
          hint={`${stats.converted} converted`}
          tone="success"
        />
      </div>

      {/* Toolbar */}
      <Card className="border-border/70 shadow-soft mb-4">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-border"
            />
          </div>

          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
          >
            <SelectTrigger className="h-9 w-42.5">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="website">Website</SelectItem>
            </SelectContent>
          </Select>

          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            <ViewToggle
              active={view === "board"}
              onClick={() => setView("board")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label="Board"
            />
            <ViewToggle
              active={view === "list"}
              onClick={() => setView("list")}
              icon={<TableIcon className="h-3.5 w-3.5" />}
              label="List"
            />
          </div>
        </CardContent>
      </Card>

      {view === "board" ? (
        <KanbanBoard leads={filtered} onOpen={setOpenLead} />
      ) : (
        <LeadsList leads={filtered} onOpen={setOpenLead} />
      )}

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} />
    </div>
  );
}

/* ---------------- Stat ---------------- */

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint: string;
  tone?: "default" | "primary" | "success";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <span className={toneCls}>{icon}</span>
        </div>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------------- Kanban ---------------- */

function KanbanBoard({ leads, onOpen }: { leads: LeadRecord[]; onOpen: (l: LeadRecord) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {STAGES.map((s) => {
        const items = leads.filter((l) => l.stage === s.key);
        return (
          <div key={s.key} className="flex flex-col">
            <div
              className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs font-semibold ${s.tone}`}
            >
              <span>{s.label}</span>
              <span className="tabular-nums opacity-80">{items.length}</span>
            </div>
            <div className="mt-2 flex flex-col gap-2 min-h-25">
              {items.map((l) => (
                <LeadCard key={l.id} lead={l} onClick={() => onOpen(l)} />
              ))}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: LeadRecord; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-3 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary-soft text-primary text-[11px] font-semibold">
            {lead.avatarInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{lead.name}</p>
            {lead.unread > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {lead.unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <SourceIcon source={lead.source} />
            <span>{SOURCE_LABEL[lead.source]}</span>
            <span className="opacity-50">·</span>
            <span>{INTEREST_LABEL[lead.interest]}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.lastMessagePreview}</p>

      <div className="mt-3 flex items-center justify-between">
        <ScorePill score={lead.qualityScore} />
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lead.lastMessageAt}
        </div>
      </div>
    </button>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-success/15 text-success border-success/30"
      : score >= 65
        ? "bg-chart-4/15 text-chart-4 border-chart-4/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

function SourceIcon({ source }: { source: LeadSource }) {
  const cls = "h-3 w-3";
  switch (source) {
    case "whatsapp":
      return <MessageCircle className={cls} />;
    case "instagram":
      return <Instagram className={cls} />;
    case "facebook":
      return <Facebook className={cls} />;
    case "website":
      return <Globe className={cls} />;
    case "referral":
      return <UsersIcon className={cls} />;
    case "tiktok":
      return <Sparkles className={cls} />;
  }
}

/* ---------------- List ---------------- */

function LeadsList({ leads, onOpen }: { leads: LeadRecord[]; onOpen: (l: LeadRecord) => void }) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Lead</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-3">Last message</div>
          <div className="col-span-1 text-right">Score</div>
          <div className="col-span-1 text-right">Activity</div>
        </div>
        <div className="divide-y divide-border">
          {leads.map((l) => {
            const stage = STAGES.find((s) => s.key === l.stage)!;
            return (
              <button
                key={l.id}
                onClick={() => onOpen(l)}
                className="grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-soft/30"
              >
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary-soft text-primary text-[11px] font-semibold">
                      {l.avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.phone}</p>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SourceIcon source={l.source} />
                  {SOURCE_LABEL[l.source]}
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${stage.tone}`}
                  >
                    {stage.label}
                  </span>
                </div>
                <div className="col-span-3 truncate text-xs text-muted-foreground">
                  {l.lastMessagePreview}
                </div>
                <div className="col-span-1 flex justify-end">
                  <ScorePill score={l.qualityScore} />
                </div>
                <div className="col-span-1 text-right text-xs text-muted-foreground">
                  {l.lastMessageAt}
                </div>
              </button>
            );
          })}
          {leads.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No leads match your filters.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Drawer ---------------- */

function LeadDrawer({ lead, onClose }: { lead: LeadRecord | null; onClose: () => void }) {
  const [reply, setReply] = useState("");
  if (!lead) return null;
  const stage = STAGES.find((s) => s.key === lead.stage)!;

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-130 p-0 flex flex-col">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary-soft text-primary font-semibold">
                {lead.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg">{lead.name}</SheetTitle>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {lead.phone}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${stage.tone}`}
                >
                  {stage.label}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  <SourceIcon source={lead.source} />
                  <span className="ml-1">{SOURCE_LABEL[lead.source]}</span>
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {INTEREST_LABEL[lead.interest]}
                </Badge>
                <ScorePill score={lead.qualityScore} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage advance */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Move to stage
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s.key}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    s.key === lead.stage
                      ? s.tone
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <Fact label="City" value={lead.city ?? "—"} />
            <Fact label="Age range" value={lead.ageRange ?? "—"} />
            <Fact label="Budget" value={lead.budget ?? "—"} />
            <Fact label="Assigned to" value={lead.assignedTo ?? "Unassigned"} />
            <Fact label="Days in stage" value={`${lead.daysInStage}d`} />
            <Fact label="Captured" value={new Date(lead.capturedAt).toLocaleDateString()} />
          </div>

          {/* Tags */}
          {lead.tags.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              WhatsApp thread
            </p>
            <div className="space-y-2">
              {lead.thread.length === 0 && (
                <p className="text-xs text-muted-foreground">No messages yet.</p>
              )}
              {lead.thread.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from === "lead" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      m.from === "lead"
                        ? "bg-muted text-foreground"
                        : m.from === "ai"
                          ? "bg-primary-soft text-primary-foreground/90 border border-primary/20"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.from !== "lead" && (
                      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        {m.from === "ai" ? "AI agent" : "You"}
                      </p>
                    )}
                    <p>{m.text}</p>
                    <p className="mt-1 text-[9px] opacity-60">{m.at}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reply composer */}
        <div className="border-t border-border p-3 space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply via WhatsApp…"
            className="min-h-16 resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convert
              </Button>
              <Button variant="outline" size="sm">
                <CircleSlash className="h-3.5 w-3.5" />
                Lose
              </Button>
            </div>
            <Button size="sm" disabled={!reply.trim()}>
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
