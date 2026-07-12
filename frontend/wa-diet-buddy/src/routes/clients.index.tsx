import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  ArrowUpDown,
  Phone,
  Users as UsersIcon,
  Circle,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ServiceBadge } from "@/components/service-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { NewClientDialog } from "@/components/new-client-dialog";
import type { ServiceType } from "@/lib/clients-mock";
import { fetchClients, createClient } from "@/lib/clients-api";

type Filter = "all" | ServiceType | "active" | "paused";

export const Route = createFileRoute("/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Nutria" },
      { name: "description", content: "All clients across diet, gym, and combined programs." },
    ],
  }),
  component: ClientsListPage,
});

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "diet", label: "Diet" },
  { key: "gym", label: "Gym" },
  { key: "classes", label: "Classes" },
  { key: "paused", label: "Paused" },
];

function ClientsListPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  const [newOpen, setNewOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients({ limit: 100 }),
  });

  const clients = data?.clients ?? [];

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      setQuery("");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const filtered = useMemo(() => {
    let list = clients.filter((c) => c.status !== "lead");

    if (filter === "active") list = list.filter((c) => c.status === "active");
    else if (filter === "paused") list = list.filter((c) => c.status === "paused");
    else if (filter !== "all") list = list.filter((c) => c.serviceType.includes(filter as ServiceType));

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email?.toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.joinedAt.localeCompare(a.joinedAt);
    });

    return list;
  }, [clients, query, filter, sort]);

  const totals = useMemo(
    () => ({
      all: clients.filter((c) => c.status !== "lead").length,
      active: clients.filter((c) => c.status === "active").length,
      diet: clients.filter((c) => c.serviceType.includes("diet")).length,
      gym: clients.filter((c) => c.serviceType.includes("gym")).length,
      classes: clients.filter((c) => c.serviceType.includes("classes")).length,
    }),
    [clients],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Practice"
        title="Clients"
        description="Search, filter, and open any client to see their plans, journal, clinical notes, and billing."
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            New client
          </Button>
        }
      />

      {/* Mini stat strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <MiniStat label="Total clients" value={totals.all} hint={`${totals.active} active`} />
        <MiniStat label="Diet" value={totals.diet} hint="program" />
        <MiniStat label="Gym" value={totals.gym} hint="program" />
        <MiniStat label="Classes" value={totals.classes} hint="program" />
      </div>

      <Card className="border-border/70 shadow-soft">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9 bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-border"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filter === t.key
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-40">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead className="w-[60%]">Client</TableHead>
                  <TableHead className="w-[39%]">Program</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
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
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-8 w-8 opacity-50" />
                        <p className="text-sm">No clients match your filter.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewClientDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={async (client) => {
          await mutation.mutateAsync({
            name: client.name,
            phone: client.phone,
            email: client.email,
            serviceType: client.serviceType,
            status: client.status,
            age: client.age,
            sex: client.sex,
            heightCm: client.heightCm,
            weightKg: client.weightKg,
            startWeightKg: client.startWeightKg,
            targetWeightKg: client.targetWeightKg,
            activityFactor: client.activityFactor,
            goalType: client.goal.type,
            occupation: client.occupation,
            sleepHours: client.sleepHours,
            dietaryPrefs: client.dietaryPrefs,
            allergies: client.allergies,
            medicalHistory: client.medicalHistory,
            overrideTargets: client.targets.calories !== 0 && client.bmr !== 0,
            targets: client.targets,
          });
        }}
      />
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
