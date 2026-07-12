import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Search,
  Clock,
  CalendarDays,
  Stethoscope,
  Users,
  Dumbbell,
  ClipboardList,
  Calendar,
  DoorOpen,
  Check,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  typeMeta,
  staffPoolForType,
  isCapacityType,
  categoryForStaff,
  type AppointmentType,
  type AppointmentStatus,
  type AppointmentRecord,
} from "@/lib/appointments-mock";
import { fetchClients } from "@/lib/clients-api";
import type { ClientRecord } from "@/lib/clients-mock";
import { createAppointment, type CreateAppointmentPayload } from "@/lib/appointments-api";
import { fetchClassTypes } from "@/lib/settings-api";

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (appt: AppointmentRecord) => void;
  defaultDate?: Date;
}

const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Review" },
];

const APPT_TYPES: AppointmentType[] = [
  "consult-initial",
  "consult-followup",
  "try-out",
  "assessment",
  "gym-machine",
  "gym-class",
];

const DURATIONS = [15, 20, 30, 45, 50, 60, 90];

export function NewAppointmentDialog({
  open,
  onOpenChange,
  onCreate,
  defaultDate,
}: NewAppointmentDialogProps) {
  const [step, setStep] = useState(1);

  const initialDate = defaultDate ?? new Date();

  const [type, setType] = useState<AppointmentType>("consult-followup");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [className, setClassName] = useState("");
  const [capacity, setCapacity] = useState(8);
  // Roster picked directly in the dialog for capacity types (gym-machine, gym-class). Kept
  // as full ClientRecord objects (not just ids) so a selection survives the search text
  // changing underneath it and dropping the client out of the current results page.
  const [attendees, setAttendees] = useState<ClientRecord[]>([]);
  const [status, setStatus] = useState<AppointmentStatus>("confirmed");
  const [date, setDate] = useState(() => formatDateForInput(initialDate));
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(30);
  const [staffId, setStaffId] = useState(staffPoolForType("consult-followup")[0].id);
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");

  const isCapacity = isCapacityType(type);
  const staffPool = staffPoolForType(type);

  // Switching types swaps the staff pool — reset selection if the currently picked staffer
  // isn't in the new pool. All other type-specific selections (client, class name, attendee
  // roster) are cleared unconditionally on every type change, not just between the two
  // capacity types — a client picked under Try out has no business surviving a switch to
  // Gym machine, and vice versa.
  useEffect(() => {
    if (!staffPool.some((s) => s.id === staffId)) {
      setStaffId(staffPool[0].id);
    }
    setClassName("");
    setClientId(null);
    setAttendees([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const toggleAttendee = (c: ClientRecord) => {
    setAttendees((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev.filter((x) => x.id !== c.id);
      if (prev.length >= capacity) return prev;
      return [...prev, c];
    });
  };

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(clientSearch), 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "appt-picker", debouncedSearch],
    queryFn: () => fetchClients({ search: debouncedSearch || undefined, limit: 50 }),
    enabled: open,
  });
  const allClients = clientsData?.clients ?? [];

  // Settings → Services list — same source the New Appointment dialog and the Settings
  // Services tab both read from, so adding/removing a class type there shows up here on
  // next fetch with no code change.
  const { data: classTypes = [] } = useQuery({
    queryKey: ["settings", "class-types"],
    queryFn: fetchClassTypes,
    enabled: open && type === "gym-class",
  });
  const selectedClient = allClients.find((c: ClientRecord) => c.id === clientId);

  const reset = () => {
    setStep(1);
    setType("consult-followup");
    setClientId(null);
    setClientSearch("");
    setClassName("");
    setCapacity(8);
    setAttendees([]);
    setStatus("confirmed");
    setDate(formatDateForInput(initialDate));
    setTime("09:00");
    setDurationMin(30);
    setStaffId(staffPoolForType("consult-followup")[0].id);
    setRoom("");
    setNotes("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const startIso = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    const [y, mo, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, m, 0)).toISOString();
  }, [date, time]);

  const startLabel = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }, [time]);

  const meta = typeMeta(type);
  const staff = staffPool.find((s) => s.id === staffId) ?? staffPool[0];
  const staffLabel =
    meta.group === "gym" ? "Trainer" : meta.group === "diet" ? "Dietitian" : "Staff";

  const overCapacity = isCapacity && attendees.length > capacity;

  // Only gym-class has a name to fill in — gym-machine has no name field at all.
  const nameValid = isCapacity
    ? type === "gym-class"
      ? className.trim().length > 0
      : true
    : !!clientId;

  // Review-step title: gym-class shows its picked class type; gym-machine has no name, so it
  // shows attendee names once booked or a generic "Gym machine" placeholder before that — same
  // fallback the calendar tile uses (typeMeta(type).label) once name goes unset in the payload.
  const reviewTitle = isCapacity
    ? type === "gym-class"
      ? className || "New class"
      : attendees.length > 0
        ? attendees.map((a) => a.name).join(", ")
        : meta.label
    : selectedClient?.name || "New appointment";

  const canAdvance = step === 1 && !!staffId && nameValid && !overCapacity;

  const mutation = useMutation({
    mutationFn: () => {
      const base = {
        staffId,
        dateTime: startIso,
        durationMin,
        status,
        room: room.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      let payload: CreateAppointmentPayload;
      if (type === "gym-class" || type === "gym-machine") {
        payload = {
          type,
          // gym-machine intentionally omits `name` — sending "" would fail the backend's
          // z.string().min(1) instead of hitting the optional() branch.
          ...(type === "gym-class" ? { name: className.trim() } : {}),
          capacity,
          attendees: attendees.map((c) => ({ clientId: c.id, name: c.name })),
          ...base,
        };
      } else if (type === "try-out") {
        payload = {
          type,
          client: clientId as string,
          category: categoryForStaff(staffId),
          ...base,
        };
      } else {
        payload = { type, client: clientId as string, ...base };
      }
      return createAppointment(payload);
    },
    onSuccess: (appt) => {
      onCreate(appt);
      handleClose(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
          <DialogDescription>Schedule a diet or gym session on the calendar.</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > s.id ? <CheckCircle2 className="size-4" /> : s.id}
              </div>
              <div
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  step === s.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </div>
              {i < STEPS.length - 1 && <Separator className="flex-1" />}
            </div>
          ))}
        </div>

        <div className="min-h-85 py-2">
          {step === 1 && (
            <div className="space-y-4">
              {/* Appointment type */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="size-4" /> Appointment type
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {APPT_TYPES.map((t) => {
                    const m = typeMeta(t);
                    const active = type === t;
                    const Icon =
                      m.group === "diet" ? Stethoscope : m.group === "gym" ? Dumbbell : Sparkles;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background hover:bg-accent",
                        )}
                      >
                        <Icon className="size-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              {/* Client (1:1 types) or class type/capacity (gym-class) or capacity only (gym-machine) */}
              {isCapacity ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="size-4" /> {meta.label}
                  </h3>
                  {type === "gym-class" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="className">Class type *</Label>
                        <Select value={className} onValueChange={setClassName}>
                          <SelectTrigger id="className">
                            <SelectValue placeholder="Select a class type" />
                          </SelectTrigger>
                          <SelectContent>
                            {classTypes.map((c: string) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="capacity">Capacity</Label>
                        <Input
                          id="capacity"
                          type="number"
                          min={1}
                          max={50}
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value) || 8)}
                        />
                      </div>
                    </div>
                  ) : (
                    // Gym machine has no name field — the resource is generic ("Gym machine"
                    // on the tile/Sheet until attendees are booked, then their names take over).
                    <div className="space-y-1.5 max-w-40">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min={1}
                        max={50}
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value) || 8)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Attendees</Label>
                    {attendees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {attendees.map((a) => (
                          <Badge key={a.id} variant="secondary" className="gap-1 pr-1 font-normal">
                            {a.name}
                            <button
                              type="button"
                              onClick={() => toggleAttendee(a)}
                              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                              aria-label={`Remove ${a.name}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients…"
                        className="pl-8"
                      />
                    </div>
                    <ScrollArea className="h-40 border rounded-md">
                      <div className="p-1">
                        {allClients.map((c: ClientRecord) => {
                          const selected = attendees.some((a) => a.id === c.id);
                          const blocked = !selected && attendees.length >= capacity;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleAttendee(c)}
                              disabled={blocked}
                              className={cn(
                                "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                                selected
                                  ? "bg-primary/10 ring-1 ring-primary/30"
                                  : blocked
                                    ? "opacity-40 cursor-not-allowed"
                                    : "hover:bg-muted/40",
                              )}
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[11px]">
                                  {c.avatarInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{c.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {c.phone}
                                </div>
                              </div>
                              {selected && <Check className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                        {allClients.length === 0 && (
                          <div className="text-xs text-muted-foreground p-6 text-center">
                            No clients match "{clientSearch}"
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <p
                      className={cn(
                        "text-xs",
                        overCapacity ? "text-destructive font-medium" : "text-muted-foreground",
                      )}
                    >
                      {overCapacity
                        ? `${attendees.length} selected exceeds capacity of ${capacity}. Remove ${attendees.length - capacity} or increase capacity.`
                        : `${attendees.length}/${capacity} selected`}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    More attendees can be added from the appointment detail view after it's created.
                  </p>
                </section>
              ) : (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="size-4" /> Client
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients…"
                      className="pl-8"
                    />
                  </div>
                  <ScrollArea className="h-40 border rounded-md">
                    <div className="p-1">
                      {allClients.map((c: ClientRecord) => {
                        const selected = c.id === clientId;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setClientId(c.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                              selected
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : "hover:bg-muted/40",
                            )}
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[11px]">
                                {c.avatarInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{c.name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {c.phone}
                              </div>
                            </div>
                            {selected && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                      {allClients.length === 0 && (
                        <div className="text-xs text-muted-foreground p-6 text-center">
                          No clients match "{clientSearch}"
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </section>
              )}

              <Separator />

              {/* Status */}
              <section className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="no-show">No-show</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <Separator />

              {/* Date / time / duration */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="size-4" /> Date & time
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <Select
                      value={durationMin.toString()}
                      onValueChange={(v) => setDurationMin(Number(v))}
                    >
                      <SelectTrigger>
                        <Clock className="size-4 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATIONS.map((d) => (
                          <SelectItem key={d} value={d.toString()}>
                            {d} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Staff / room */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="size-4" /> Staff & room
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{staffLabel}</Label>
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {staffPool.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} · {s.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="room">Room / location</Label>
                    <div className="relative">
                      <DoorOpen className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="room"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="e.g. Room 1"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Notes */}
              <section className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything staff should know before the session."
                  rows={2}
                />
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {isCapacity ? (
                      <Dumbbell className="size-4" />
                    ) : (
                      selectedClient?.avatarInitials || "??"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{reviewTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {isCapacity
                        ? `${attendees.length}/${capacity} attendees booked`
                        : selectedClient?.phone || "—"}
                    </div>
                    {isCapacity && attendees.length > 0 && (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {attendees.map((a) => a.name).join(", ")}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className={cn("text-[10px]", meta.tone)}>
                        {meta.label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] capitalize",
                          status === "confirmed" && "bg-emerald-100 text-emerald-700",
                          status === "pending" && "bg-amber-100 text-amber-700",
                          status === "completed" && "bg-muted text-foreground",
                          status === "no-show" && "bg-destructive/10 text-destructive",
                          status === "cancelled" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Date
                    </div>
                    <div>{date}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Time
                    </div>
                    <div>
                      {startLabel} · {durationMin} min
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {staffLabel}
                    </div>
                    <div>{staff.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Room
                    </div>
                    <div>{room || "—"}</div>
                  </div>
                </div>
                {notes && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Notes
                      </div>
                      <p className="text-sm text-muted-foreground">{notes}</p>
                    </div>
                  </>
                )}
              </div>
              {mutation.isError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {(mutation.error as Error).message}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Next <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <CheckCircle2 className="size-4" />
              {mutation.isPending ? "Saving…" : "Save appointment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDateForInput(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
