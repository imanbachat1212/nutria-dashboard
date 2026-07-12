import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Dumbbell,
  Search,
  Sparkles,
  MessageCircle,
  Instagram,
  Globe,
  UserCheck,
  Loader2,
  Check,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import {
  ALL_STAFF,
  SIDEBAR_FEED,
  getStaff,
  TODAY_KEY,
  apptDateKey,
  formatDayHeading,
  formatMonthYear,
  formatShortDay,
  formatTime,
  fmtRelative,
  typeMeta,
  isCapacityType,
  type AppointmentRecord,
  type AppointmentStatus,
  type AttendeeStatus,
} from "@/lib/appointments-mock";
import { fetchAppointments, addAttendee, updateAttendeeStatus } from "@/lib/appointments-api";
import { fetchClients } from "@/lib/clients-api";
import type { ClientRecord } from "@/lib/clients-mock";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — Nutria" },
      {
        name: "description",
        content: "Diet consultations and gym sessions in one unified calendar.",
      },
    ],
  }),
  component: AppointmentsPage,
});

type ViewMode = "day" | "week" | "list";
type GroupFilter = "all" | "diet" | "gym";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = out.getUTCDay(); // 0 = Sun
  out.setUTCDate(out.getUTCDate() - dow);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function utcKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const STATUS_META: Record<
  AppointmentStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-900 border-amber-200",
    icon: AlertCircle,
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-foreground border-border",
    icon: CheckCircle2,
  },
  "no-show": {
    label: "No-show",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
  },
};

function bookedAttendeeNames(a: AppointmentRecord): string[] {
  return a.attendees
    .filter((x) => x.status === "booked" || x.status === "checked-in")
    .map((x) => x.name);
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// gym-machine shows whoever's on it (same pattern as a 1:1 type like try-out) rather than
// the generic resource name; gym-class keeps its title and gets the roster shown alongside
// separately via attendeeNamesLine, since a class can have many attendees under one name.
function displayName(a: AppointmentRecord): string {
  if (a.type === "gym-machine") {
    const names = bookedAttendeeNames(a);
    return names.length > 0 ? names.join(", ") : a.name || typeMeta(a.type).label;
  }
  if (isCapacityType(a.type)) return a.name || typeMeta(a.type).label;
  return a.client?.name || "Unknown";
}

function displayInitials(a: AppointmentRecord): string {
  if (a.type === "gym-machine") {
    const names = bookedAttendeeNames(a);
    return names.length > 0 ? initialsOf(names[0]) : "GM";
  }
  if (isCapacityType(a.type)) return "GC";
  return a.client?.initials || "?";
}

// group-class only — the roster to show alongside the class name; null for every other type
function attendeeNamesLine(a: AppointmentRecord): string | null {
  if (a.type !== "gym-class") return null;
  const names = bookedAttendeeNames(a);
  return names.length > 0 ? names.join(", ") : null;
}

function bookedCount(a: AppointmentRecord): number {
  return bookedAttendeeNames(a).length;
}

function AppointmentsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("day");
  const [cursor, setCursor] = useState<Date>(new Date(`${TODAY_KEY}T00:00:00Z`));
  const [group, setGroup] = useState<GroupFilter>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", group, staffFilter],
    queryFn: () =>
      fetchAppointments({
        category: group === "all" ? undefined : group,
        staffId: staffFilter === "all" ? undefined : staffFilter,
      }),
  });
  const appointments = data?.appointments ?? [];

  const filtered = useMemo(() => {
    if (!query) return appointments;
    const q = query.toLowerCase();
    return appointments.filter((a) => displayName(a).toLowerCase().includes(q));
  }, [appointments, query]);

  const todayAppts = useMemo(
    () => appointments.filter((a) => apptDateKey(a.startIso) === TODAY_KEY),
    [appointments],
  );

  const stats = useMemo(() => {
    const total = todayAppts.length;
    const confirmed = todayAppts.filter((a) => a.status === "confirmed").length;
    const pending = todayAppts.filter((a) => a.status === "pending").length;
    const noShow = appointments.filter((a) => a.status === "no-show").length;
    return { total, confirmed, pending, noShow };
  }, [todayAppts, appointments]);

  const selected = selectedId ? (appointments.find((a) => a.id === selectedId) ?? null) : null;

  const invalidateAppointments = () => qc.invalidateQueries({ queryKey: ["appointments"] });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        description="Diet consultations and gym sessions in one unified calendar."
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            New appointment
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Today" value={String(stats.total)} hint="scheduled" tone="primary" />
        <StatCard
          label="Confirmed"
          value={String(stats.confirmed)}
          hint="ready to go"
          tone="emerald"
        />
        <StatCard
          label="Pending"
          value={String(stats.pending)}
          hint="awaiting reply"
          tone="amber"
        />
        <StatCard label="No-shows" value={String(stats.noShow)} hint="follow up" tone="rose" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-soft">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(addDays(cursor, view === "week" ? -7 : -1))}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(`${TODAY_KEY}T00:00:00Z`))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(addDays(cursor, view === "week" ? 7 : 1))}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {view === "week"
              ? `Week of ${formatMonthYear(startOfWeek(cursor))}`
              : formatDayHeading(cursor)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search client or class..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-48 pl-8 text-sm"
            />
          </div>
          <Tabs value={group} onValueChange={(v) => setGroup(v as GroupFilter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              <TabsTrigger value="diet" className="text-xs gap-1">
                <Users className="h-3 w-3" />
                Diet
              </TabsTrigger>
              <TabsTrigger value="gym" className="text-xs gap-1">
                <Dumbbell className="h-3 w-3" />
                Gym
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="all">All staff</option>
            {ALL_STAFF.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs">
                Day
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs">
                Week
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs">
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main view */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {view === "day" && (
                <DayView date={cursor} appts={filtered} onSelect={setSelectedId} />
              )}
              {view === "week" && (
                <WeekView
                  weekStart={startOfWeek(cursor)}
                  appts={filtered}
                  onSelect={setSelectedId}
                  setCursor={setCursor}
                  setView={setView}
                />
              )}
              {view === "list" && <ListView appts={filtered} onSelect={setSelectedId} />}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Inbox</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Appointment reminders and AI-reviewed gym booking requests, in one feed.
              </p>
              <ScrollArea className="h-90">
                <div className="space-y-2 pr-2">
                  {SIDEBAR_FEED.map((item) =>
                    item.kind === "reminder" ? (
                      <ReminderRow key={item.id} item={item} />
                    ) : (
                      <BookingRequestRow key={item.id} item={item} />
                    ),
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Staff</h3>
              <div className="space-y-2">
                {ALL_STAFF.map((s) => {
                  const count = appointments.filter(
                    (a) => a.staffId === s.id && apptDateKey(a.startIso) === TODAY_KEY,
                  ).length;
                  return (
                    <div key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", s.color)} />
                        <div className="leading-tight">
                          <p className="text-sm">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.role}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[11px]">
                        {count} today
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected &&
            (isCapacityType(selected.type) ? (
              <ClassDetail appt={selected} onChanged={invalidateAppointments} />
            ) : (
              <AppointmentDetail appt={selected} />
            ))}
        </SheetContent>
      </Sheet>

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={() => invalidateAppointments()}
        defaultDate={cursor}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    primary: "text-primary",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 font-display text-2xl font-semibold", toneClass)}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- COMBINED SIDEBAR FEED ----------------------------- */

function ReminderRow({
  item,
}: {
  item: { id: string; clientName: string; whenLabel: string; status: "confirmed" | "pending" };
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5">
      <div className="leading-tight">
        <p className="text-sm">{item.clientName}</p>
        <p className="text-[11px] text-muted-foreground">{item.whenLabel}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px]",
          item.status === "confirmed"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-900",
        )}
      >
        {item.status}
      </Badge>
    </div>
  );
}

function BookingRequestRow({
  item,
}: {
  item: {
    id: string;
    contactName: string;
    initials: string;
    sessionName: string;
    channel: "whatsapp" | "instagram" | "web";
    receivedIso: string;
    preview: string;
    aiConfidence: number;
    status: "pending" | "auto-booked" | "declined";
  };
}) {
  const ChIcon =
    item.channel === "whatsapp" ? MessageCircle : item.channel === "instagram" ? Instagram : Globe;
  return (
    <div className="rounded-md border border-border p-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px] bg-accent">{item.initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{item.contactName}</span>
            <ChIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{item.preview}</p>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {fmtRelative(item.receivedIso)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-9 text-[11px] text-muted-foreground">
        <Dumbbell className="h-3 w-3" />
        <span className="truncate">{item.sessionName}</span>
      </div>
      <div className="flex items-center justify-between pl-9">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-muted-foreground">
            AI {item.aiConfidence}% confident
          </span>
        </div>
        {item.status === "auto-booked" ? (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-200 hover:bg-emerald-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Auto-booked
          </Badge>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs">
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-6 px-2 text-xs">
              Confirm
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- DAY VIEW ----------------------------- */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 6); // 6 AM → 5 PM (UTC slots used as local clock)

function DayView({
  date,
  appts,
  onSelect,
}: {
  date: Date;
  appts: AppointmentRecord[];
  onSelect: (id: string) => void;
}) {
  const dayKey = utcKey(date);
  const dayAppts = appts.filter((a) => apptDateKey(a.startIso) === dayKey);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-[64px_1fr]">
          {HOURS.map((h) => {
            const slotStart = h * 60;
            const slotEnd = slotStart + 60;
            const slotAppts = dayAppts.filter((a) => {
              const d = new Date(a.startIso);
              const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
              return mins >= slotStart && mins < slotEnd;
            });
            const label = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
            return (
              <div key={h} className="contents">
                <div className="border-b border-r px-2 py-3 text-[11px] text-muted-foreground">
                  {label}
                </div>
                <div className="min-h-16 border-b p-2">
                  {slotAppts.length === 0 ? (
                    <div className="h-full" />
                  ) : (
                    <div className="space-y-1.5">
                      {slotAppts.map((a) => (
                        <AppointmentBlock key={a.id} appt={a} onSelect={onSelect} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {dayAppts.length === 0 && (
          <div className="border-t p-6 text-center text-sm text-muted-foreground">
            No appointments scheduled.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentBlock({
  appt,
  onSelect,
}: {
  appt: AppointmentRecord;
  onSelect: (id: string) => void;
}) {
  const meta = typeMeta(appt.type);
  const staff = getStaff(appt.staffId);
  const isClass = isCapacityType(appt.type);
  const roster = attendeeNamesLine(appt);
  return (
    <button
      type="button"
      onClick={() => onSelect(appt.id)}
      className={cn(
        "group w-full rounded-md border-l-4 bg-card px-3 py-2 text-left shadow-soft transition hover:shadow-md",
        meta.tone,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">{displayInitials(appt)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{displayName(appt)}</span>
          {isClass && (
            <Badge variant="outline" className="shrink-0 border-border text-[10px]">
              {bookedCount(appt)}/{appt.capacity}
            </Badge>
          )}
        </div>
        <div className="shrink-0 text-[11px] text-muted-foreground">
          {formatTime(appt.startIso)} · {appt.durationMin}m
        </div>
      </div>
      {roster && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{roster}</div>}
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{meta.label}</span>
        <span className="flex items-center gap-1">
          {staff && <span className={cn("h-1.5 w-1.5 rounded-full", staff.color)} />}
          {staff?.name.split(" ").slice(-1)[0]}
        </span>
      </div>
    </button>
  );
}

/* ----------------------------- WEEK VIEW ----------------------------- */

function WeekView({
  weekStart,
  appts,
  onSelect,
  setCursor,
  setView,
}: {
  weekStart: Date;
  appts: AppointmentRecord[];
  onSelect: (id: string) => void;
  setCursor: (d: Date) => void;
  setView: (v: ViewMode) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium text-muted-foreground">
          {days.map((d) => {
            const { weekday, date } = formatShortDay(d);
            const isToday = utcKey(d) === TODAY_KEY;
            return (
              <button
                key={utcKey(d)}
                type="button"
                onClick={() => {
                  setCursor(d);
                  setView("day");
                }}
                className={cn(
                  "border-r px-2 py-2 last:border-r-0 transition hover:bg-muted",
                  isToday && "bg-primary/10 text-primary",
                )}
              >
                <div>{weekday}</div>
                <div className="text-base font-semibold">{date}</div>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-105">
          {days.map((d) => {
            const key = utcKey(d);
            const dayAppts = appts
              .filter((a) => apptDateKey(a.startIso) === key)
              .sort((a, b) => a.startIso.localeCompare(b.startIso));
            return (
              <div key={key} className="space-y-1.5 border-r p-2 last:border-r-0">
                {dayAppts.length === 0 ? (
                  <div className="pt-6 text-center text-[11px] text-muted-foreground">—</div>
                ) : (
                  dayAppts.map((a) => {
                    const meta = typeMeta(a.type);
                    const roster = attendeeNamesLine(a);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect(a.id)}
                        className={cn(
                          "block w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition hover:shadow-soft",
                          meta.tone,
                        )}
                      >
                        <div className="font-medium">{formatTime(a.startIso)}</div>
                        <div className="truncate">{displayName(a)}</div>
                        {roster && <div className="truncate opacity-70">{roster}</div>}
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- LIST VIEW ----------------------------- */

function ListView({
  appts,
  onSelect,
}: {
  appts: AppointmentRecord[];
  onSelect: (id: string) => void;
}) {
  const sorted = [...appts].sort((a, b) => a.startIso.localeCompare(b.startIso));
  const groups = new Map<string, AppointmentRecord[]>();
  sorted.forEach((a) => {
    const k = apptDateKey(a.startIso);
    const arr = groups.get(k) ?? [];
    arr.push(a);
    groups.set(k, arr);
  });

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([key, list]) => {
        const d = new Date(`${key}T00:00:00Z`);
        return (
          <Card key={key}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <span className="text-sm font-semibold">{formatDayHeading(d)}</span>
                <span className="text-xs text-muted-foreground">{list.length} appointments</span>
              </div>
              <div className="divide-y">
                {list.map((a) => {
                  const meta = typeMeta(a.type);
                  const status = STATUS_META[a.status];
                  const staff = getStaff(a.staffId);
                  const roster = attendeeNamesLine(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a.id)}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/40"
                    >
                      <div className="w-20 text-right">
                        <div className="text-sm font-semibold">{formatTime(a.startIso)}</div>
                        <div className="text-[11px] text-muted-foreground">{a.durationMin} min</div>
                      </div>
                      <div className={cn("h-10 w-1 rounded-full", meta.tone.split(" ")[0])} />
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">{displayInitials(a)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{displayName(a)}</span>
                          {isCapacityType(a.type) && (
                            <Badge variant="outline" className="text-[10px]">
                              {bookedCount(a)}/{a.capacity}
                            </Badge>
                          )}
                        </div>
                        {roster && (
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {roster}
                          </div>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{meta.label}</span>
                          <span>·</span>
                          <MapPin className="h-3 w-3" />
                          <span>{a.room ?? "Clinic"}</span>
                          {staff && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <span className={cn("h-1.5 w-1.5 rounded-full", staff.color)} />
                                {staff.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px]", status.className)}>
                        {status.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {sorted.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No appointments match your filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ----------------------------- 1:1 DETAIL DRAWER ----------------------------- */

function AppointmentDetail({ appt }: { appt: AppointmentRecord }) {
  const meta = typeMeta(appt.type);
  const status = STATUS_META[appt.status];
  const staff = getStaff(appt.staffId);
  const StatusIcon = status.icon;
  return (
    <>
      <SheetHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{appt.client?.initials}</AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle>{appt.client?.name}</SheetTitle>
            <SheetDescription>{appt.client?.phone}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("border", meta.tone)}>
            {meta.label}
          </Badge>
          <Badge variant="outline" className={status.className}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </SheetHeader>

      <Separator className="my-4" />

      <div className="space-y-4 text-sm">
        <DetailRow icon={Clock} label="When">
          {formatDayHeading(new Date(appt.startIso))} · {formatTime(appt.startIso)} ·{" "}
          {appt.durationMin} min
        </DetailRow>
        <DetailRow icon={MapPin} label="Location">
          {appt.room ?? "Clinic"}
        </DetailRow>
        {staff && (
          <DetailRow icon={Users} label="With">
            <span className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", staff.color)} />
              {staff.name} · {staff.role}
            </span>
          </DetailRow>
        )}
        {appt.notes && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Notes
            </p>
            <p className="mt-1 text-sm">{appt.notes}</p>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm">
          <Phone className="h-4 w-4" />
          Call
        </Button>
        <Button variant="outline" size="sm">
          Send reminder
        </Button>
        <Button variant="outline" size="sm">
          Reschedule
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          Cancel
        </Button>
        <Button size="sm" className="col-span-2">
          <CheckCircle2 className="h-4 w-4" />
          Mark completed
        </Button>
      </div>
    </>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------- GYM-CLASS DETAIL DRAWER (real attendee roster) ----------------------------- */

const ATTENDEE_STATUS_LABEL: Record<AttendeeStatus, string> = {
  booked: "Booked",
  waitlist: "Waitlist",
  "checked-in": "Checked in",
  "no-show": "No-show",
  cancelled: "Cancelled",
};

function ClassDetail({ appt, onChanged }: { appt: AppointmentRecord; onChanged: () => void }) {
  const staff = getStaff(appt.staffId);
  const booked = bookedCount(appt);
  const meta = typeMeta(appt.type);
  const [addOpen, setAddOpen] = useState(false);

  const grouped = {
    "checked-in": appt.attendees.filter((a) => a.status === "checked-in"),
    booked: appt.attendees.filter((a) => a.status === "booked"),
    waitlist: appt.attendees.filter((a) => a.status === "waitlist"),
    other: appt.attendees.filter((a) => a.status === "no-show" || a.status === "cancelled"),
  };

  const statusMutation = useMutation({
    mutationFn: ({ clientId, status }: { clientId: string; status: AttendeeStatus }) =>
      updateAttendeeStatus(appt.id, clientId, status),
    onSuccess: onChanged,
  });

  return (
    <>
      <SheetHeader className="space-y-2">
        <Badge variant="outline" className={cn("w-fit text-[10px] border", meta.tone)}>
          {meta.label}
        </Badge>
        <SheetTitle className="font-display text-2xl">{displayName(appt)}</SheetTitle>
        <SheetDescription>{appt.notes}</SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <DetailStat
          icon={Clock}
          label="Time"
          value={`${formatTime(appt.startIso)} · ${appt.durationMin}m`}
        />
        <DetailStat icon={MapPin} label="Room" value={appt.room || "—"} />
        <DetailStat icon={Dumbbell} label="Trainer" value={staff?.name ?? "Unassigned"} />
        <DetailStat icon={Users} label="Capacity" value={`${booked}/${appt.capacity}`} />
      </div>

      {statusMutation.isError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {(statusMutation.error as Error).message}
        </div>
      )}

      <Separator className="my-5" />

      <div className="space-y-5">
        {grouped["checked-in"].length > 0 && (
          <AttendeeGroup
            title="Checked in"
            tone="emerald"
            items={grouped["checked-in"]}
            onSetStatus={(clientId, status) => statusMutation.mutate({ clientId, status })}
          />
        )}
        {grouped.booked.length > 0 && (
          <AttendeeGroup
            title="Booked"
            tone="default"
            items={grouped.booked}
            onSetStatus={(clientId, status) => statusMutation.mutate({ clientId, status })}
          />
        )}
        {grouped.waitlist.length > 0 && (
          <AttendeeGroup
            title="Waitlist"
            tone="amber"
            items={grouped.waitlist}
            onSetStatus={(clientId, status) => statusMutation.mutate({ clientId, status })}
          />
        )}
        {grouped.other.length > 0 && (
          <AttendeeGroup
            title="No-show / cancelled"
            tone="default"
            items={grouped.other}
            onSetStatus={(clientId, status) => statusMutation.mutate({ clientId, status })}
          />
        )}
        {appt.attendees.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No attendees yet — add the first one below.
          </p>
        )}
      </div>

      <Separator className="my-5" />

      {addOpen ? (
        <AddAttendeeForm
          appointmentId={appt.id}
          existingClientIds={appt.attendees.map((a) => a.clientId)}
          onDone={() => {
            setAddOpen(false);
            onChanged();
          }}
          onCancel={() => setAddOpen(false)}
        />
      ) : (
        <Button className="w-full" onClick={() => setAddOpen(true)}>
          <UserCheck className="h-4 w-4" />
          Add attendee
        </Button>
      )}
    </>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function AttendeeGroup({
  title,
  tone,
  items,
  onSetStatus,
}: {
  title: string;
  tone: "default" | "emerald" | "amber";
  items: AppointmentRecord["attendees"];
  onSetStatus: (clientId: string, status: AttendeeStatus) => void;
}) {
  const dotCls =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-muted-foreground";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("h-2 w-2 rounded-full", dotCls)} />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title} · {items.length}
        </h4>
      </div>
      <div className="space-y-1.5">
        {items.map((a) => (
          <div
            key={a.clientId}
            className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-muted/40 transition-colors"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] bg-accent">
                {a.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{a.name}</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {a.source === "whatsapp" && <MessageCircle className="h-3 w-3" />}
                <span className="capitalize">{a.source}</span>
              </div>
            </div>
            <Select
              value={a.status}
              onValueChange={(v) => onSetStatus(a.clientId, v as AttendeeStatus)}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ATTENDEE_STATUS_LABEL) as AttendeeStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {ATTENDEE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddAttendeeForm({
  appointmentId,
  existingClientIds,
  onDone,
  onCancel,
}: {
  appointmentId: string;
  existingClientIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["clients", "attendee-picker", search],
    queryFn: () => fetchClients({ search: search || undefined, limit: 20 }),
  });
  const candidates = (data?.clients ?? []).filter(
    (c: ClientRecord) => !existingClientIds.includes(c.id),
  );

  const addMutation = useMutation({
    mutationFn: (vars: { client: ClientRecord; status?: AttendeeStatus }) =>
      addAttendee(appointmentId, {
        clientId: vars.client.id,
        name: vars.client.name,
        status: vars.status,
      }),
    onSuccess: onDone,
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="pl-8"
        />
      </div>
      {addMutation.isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center justify-between gap-2">
          <span>{(addMutation.error as Error).message}</span>
          {addMutation.variables && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] shrink-0"
              onClick={() =>
                addMutation.mutate({ client: addMutation.variables!.client, status: "waitlist" })
              }
            >
              Add to waitlist
            </Button>
          )}
        </div>
      )}
      <ScrollArea className="h-40 border rounded-md">
        <div className="p-1">
          {candidates.map((c: ClientRecord) => (
            <button
              key={c.id}
              onClick={() => addMutation.mutate({ client: c })}
              disabled={addMutation.isPending}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px]">{c.avatarInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.phone}</div>
              </div>
              <Check className="h-4 w-4 text-transparent" />
            </button>
          ))}
          {candidates.length === 0 && (
            <div className="text-xs text-muted-foreground p-6 text-center">No clients match</div>
          )}
        </div>
      </ScrollArea>
      <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
