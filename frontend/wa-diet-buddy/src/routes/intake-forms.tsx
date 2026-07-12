import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Send,
  Copy,
  Link2,
  MessageCircle,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleSlash,
  TrendingUp,
  ChevronRight,
  Languages,
  GripVertical,
  Eye,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  FORMS,
  SUBMISSIONS,
  CATEGORY_LABEL,
  FIELD_TYPE_LABEL,
  type IntakeForm,
  type IntakeSubmission,
} from "@/lib/intake-forms-mock";
import { NewFormDialog } from "@/components/new-form-dialog";

export const Route = createFileRoute("/intake-forms")({
  head: () => ({
    meta: [
      { title: "Intake Forms — Nutria" },
      {
        name: "description",
        content:
          "Structured intake, medical history, and check-in forms — sent in one tap via WhatsApp.",
      },
    ],
  }),
  component: IntakeFormsPage,
});

type Tab = "forms" | "submissions";

function IntakeFormsPage() {
  const [tab, setTab] = useState<Tab>("forms");
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState<IntakeForm | null>(null);
  const [openSub, setOpenSub] = useState<IntakeSubmission | null>(null);
  const [newFormOpen, setNewFormOpen] = useState(false);

  const stats = useMemo(() => {
    const sent = FORMS.reduce((a, f) => a + f.stats.sent, 0);
    const completed = FORMS.reduce((a, f) => a + f.stats.completed, 0);
    const rate = sent ? Math.round((completed / sent) * 100) : 0;
    const pending = SUBMISSIONS.filter(
      (s) => s.status === "pending" || s.status === "in-progress",
    ).length;
    const flagged = SUBMISSIONS.filter((s) => s.flagged?.length).length;
    return { sent, completed, rate, pending, flagged };
  }, []);

  const filteredForms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FORMS;
    return FORMS.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        CATEGORY_LABEL[f.category].toLowerCase().includes(q),
    );
  }, [query]);

  const filteredSubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUBMISSIONS;
    return SUBMISSIONS.filter(
      (s) =>
        s.client.name.toLowerCase().includes(q) ||
        s.formTitle.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-350">
      <PageHeader
        eyebrow="Practice"
        title="Intake Forms"
        description="Send onboarding, medical, and weekly check-in forms in one tap — clients answer on WhatsApp, answers sync straight to their chart."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New form
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
        <StatCard
          icon={<Send className="h-4 w-4" />}
          label="Forms sent"
          value={stats.sent.toString()}
          hint="all time"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completion rate"
          value={`${stats.rate}%`}
          hint={`${stats.completed} completed`}
          accent="success"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending"
          value={stats.pending.toString()}
          hint="awaiting reply"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Auto-flagged"
          value={stats.flagged.toString()}
          hint="needs review"
          accent="warn"
        />
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="forms" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Templates
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {FORMS.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Submissions
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {SUBMISSIONS.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "forms" ? "Search templates…" : "Search submissions…"}
              className="h-9 w-64 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </div>
      </div>

      {tab === "forms" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredForms.map((f) => (
            <FormCard key={f.id} form={f} onOpen={() => setOpenForm(f)} />
          ))}
        </div>
      ) : (
        <SubmissionsTable subs={filteredSubs} onOpen={setOpenSub} />
      )}

      {/* Form preview sheet */}
      <Sheet open={!!openForm} onOpenChange={(o) => !o && setOpenForm(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {openForm && <FormDetail form={openForm} />}
        </SheetContent>
      </Sheet>

      {/* Submission sheet */}
      <Sheet open={!!openSub} onOpenChange={(o) => !o && setOpenSub(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {openSub && <SubmissionDetail sub={openSub} />}
        </SheetContent>
      </Sheet>

      <NewFormDialog open={newFormOpen} onOpenChange={setNewFormOpen} />
    </div>
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
  accent?: "success" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground",
            accent === "success" && "bg-emerald-100 text-emerald-700",
            accent === "warn" && "bg-amber-100 text-amber-700",
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

function FormCard({ form, onOpen }: { form: IntakeForm; onOpen: () => void }) {
  const rate = form.stats.sent
    ? Math.round((form.stats.completed / form.stats.sent) * 100)
    : 0;
  const fieldCount = form.sections.reduce((a, s) => a + s.fields.length, 0);

  return (
    <Card
      onClick={onOpen}
      className="group cursor-pointer p-4 transition hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-md text-[10px] uppercase tracking-wide">
            {CATEGORY_LABEL[form.category]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "rounded-md text-[10px]",
              form.status === "live" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              form.status === "draft" && "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {form.status}
          </Badge>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      <h3 className="mt-2 font-display text-base font-semibold leading-tight">{form.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{form.description}</p>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {fieldCount} fields
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          ~{form.stats.avgMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Languages className="h-3 w-3" />
          {form.language}
        </span>
      </div>

      <Separator className="my-3" />

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] text-muted-foreground">Completion</div>
          <div className="font-display text-lg font-semibold">{rate}%</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">Sent</div>
          <div className="font-display text-lg font-semibold">{form.stats.sent}</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>
    </Card>
  );
}

function SubmissionsTable({
  subs,
  onOpen,
}: {
  subs: IntakeSubmission[];
  onOpen: (s: IntakeSubmission) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1.4fr_1fr_1fr_120px] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <div>Client</div>
        <div>Form</div>
        <div>Channel</div>
        <div>Status</div>
        <div className="text-right">Sent</div>
      </div>
      {subs.map((s) => (
        <button
          key={s.id}
          onClick={() => onOpen(s)}
          className="grid w-full grid-cols-[1.6fr_1.4fr_1fr_1fr_120px] items-center gap-3 border-b px-4 py-3 text-left text-sm transition last:border-0 hover:bg-muted/40"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary-soft text-primary text-xs font-medium">
                {s.client.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{s.client.name}</div>
              <div className="truncate text-xs text-muted-foreground">{s.client.phone}</div>
            </div>
          </div>
          <div className="truncate text-sm">{s.formTitle}</div>
          <div>
            <ChannelBadge channel={s.channel} />
          </div>
          <div>
            <StatusPill status={s.status} progress={s.progress} />
            {s.flagged && s.flagged.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {s.flagged[0]}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">{timeAgo(s.sentAt)}</div>
        </button>
      ))}
    </Card>
  );
}

function ChannelBadge({ channel }: { channel: IntakeSubmission["channel"] }) {
  const map = {
    whatsapp: { icon: MessageCircle, label: "WhatsApp", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    email: { icon: Mail, label: "Email", cls: "text-blue-700 bg-blue-50 border-blue-200" },
    link: { icon: Link2, label: "Link", cls: "text-violet-700 bg-violet-50 border-violet-200" },
  } as const;
  const m = map[channel];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-md text-[10px]", m.cls)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}

function StatusPill({
  status,
  progress,
}: {
  status: IntakeSubmission["status"];
  progress: number;
}) {
  if (status === "completed")
    return (
      <Badge variant="outline" className="gap-1 rounded-md border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
  if (status === "in-progress")
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="gap-1 rounded-md border-blue-200 bg-blue-50 text-[10px] text-blue-700">
          <Clock className="h-3 w-3" />
          {progress}%
        </Badge>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  if (status === "pending")
    return (
      <Badge variant="outline" className="gap-1 rounded-md border-amber-200 bg-amber-50 text-[10px] text-amber-700">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 rounded-md border-muted bg-muted/40 text-[10px] text-muted-foreground">
      <CircleSlash className="h-3 w-3" />
      Expired
    </Badge>
  );
}

function FormDetail({ form }: { form: IntakeForm }) {
  return (
    <>
      <SheetHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[form.category]}</Badge>
          <Badge variant="outline" className="text-[10px]">{form.language}</Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              form.status === "live" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              form.status === "draft" && "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {form.status}
          </Badge>
        </div>
        <SheetTitle className="font-display text-2xl">{form.title}</SheetTitle>
        <p className="text-sm text-muted-foreground">{form.description}</p>
      </SheetHeader>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Sent</div>
          <div className="font-display text-lg font-semibold">{form.stats.sent}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Completed</div>
          <div className="font-display text-lg font-semibold">{form.stats.completed}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Avg time</div>
          <div className="font-display text-lg font-semibold">{form.stats.avgMinutes}m</div>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Send via WhatsApp
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          Copy link
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      <Separator className="my-5" />

      <h3 className="mb-3 text-sm font-semibold">Form structure</h3>
      <div className="space-y-4">
        {form.sections.map((sec, i) => (
          <div key={sec.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{sec.title}</span>
            </div>
            <div className="space-y-1.5 pl-7">
              {sec.fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="truncate text-sm">{field.label}</span>
                    {field.required && <span className="text-xs text-rose-500">*</span>}
                  </div>
                  <Badge variant="outline" className="rounded text-[10px] text-muted-foreground">
                    {FIELD_TYPE_LABEL[field.type]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SubmissionDetail({ sub }: { sub: IntakeSubmission }) {
  return (
    <>
      <SheetHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary-soft text-primary font-medium">
              {sub.client.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="font-display text-xl">{sub.client.name}</SheetTitle>
            <p className="text-xs text-muted-foreground">{sub.client.phone}</p>
          </div>
        </div>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Form</div>
          <div className="mt-0.5 text-sm font-medium">{sub.formTitle}</div>
          <div className="mt-2 flex items-center gap-2">
            <ChannelBadge channel={sub.channel} />
            <StatusPill status={sub.status} progress={sub.progress} />
          </div>
        </Card>
      </SheetHeader>

      {sub.flagged && sub.flagged.length > 0 && (
        <Card className="mt-4 border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            AI flagged for review
          </div>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
            {sub.flagged.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
      )}

      <Separator className="my-5" />

      {sub.status === "completed" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Answers</h3>
          <div className="space-y-3">
            <Answer q="Primary goal" a="Lose 6 kg before September" />
            <Answer q="Activity frequency" a="3–4×/week (yoga + walking)" />
            <Answer q="Sleep" a="6 hours/night" />
            <Answer q="Stress level" a="7 / 10" />
            <Answer q="Allergies & intolerances" a="Lactose intolerance" />
            <Answer q="Why now?" a="Sister's wedding and want to feel confident in photos." />
          </div>
          <div className="mt-5 flex gap-2">
            <Button size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Push to chart
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Reply on WhatsApp
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Clock className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2">
            {sub.status === "expired"
              ? "Link expired before client finished."
              : `Client is ${sub.progress}% through the form.`}
          </p>
          <Button size="sm" variant="outline" className="mt-3 gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Send reminder
          </Button>
        </div>
      )}
    </>
  );
}

function Answer({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {q}
      </div>
      <div className="mt-1 text-sm">{a}</div>
    </div>
  );
}

function timeAgo(iso: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
