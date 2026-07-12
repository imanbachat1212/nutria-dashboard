import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { fetchClients } from "@/lib/clients-api";
import type { ClientRecord } from "@/lib/clients-mock";
import { duplicateMealPlan } from "@/lib/mealplans-api";
import type { MealPlan } from "@/lib/meal-plans-mock";

interface DuplicatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePlan: MealPlan;
  onCreated: (plan: MealPlan) => void;
}

export function DuplicatePlanDialog({
  open,
  onOpenChange,
  sourcePlan,
  onCreated,
}: DuplicatePlanDialogProps) {
  const [name, setName] = useState(sourcePlan.name);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(sourcePlan.clientId);
  const [saving, setSaving] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setName(sourcePlan.name);
      setSearch("");
      setDebouncedSearch("");
      setSelectedClientId(sourcePlan.clientId);
    }
  }, [open, sourcePlan.name, sourcePlan.clientId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "duplicate-dialog", debouncedSearch],
    queryFn: () =>
      fetchClients({ search: debouncedSearch || undefined, limit: 50 }),
    enabled: open,
  });
  const clients = clientsData?.clients ?? [];

  const selectedClient = clients.find((c: ClientRecord) => c.id === selectedClientId);

  async function handleConfirm() {
    setSaving(true);
    try {
      // Only send name if the user changed it; otherwise let backend append "(copy)"
      const chosenName = name.trim() !== sourcePlan.name ? name.trim() : undefined;
      const copy = await duplicateMealPlan(sourcePlan.id, {
        name: chosenName,
        client: selectedClientId !== sourcePlan.clientId ? selectedClientId : undefined,
      });
      onCreated(copy);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Duplicate plan</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Plan name */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Plan name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${sourcePlan.name} (copy)`}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Leave unchanged to use "{sourcePlan.name} (copy)".
            </p>
          </div>

          {/* Client picker */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Assign to client
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="pl-8 h-9 text-sm"
              />
            </div>
            <ScrollArea className="h-50 border rounded-md">
              <div className="p-1">
                {clients.map((c: ClientRecord) => {
                  const selected = c.id === selectedClientId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                        selected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {c.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.targets.calories > 0
                            ? `${c.targets.calories} kcal target`
                            : "No targets set"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {c.serviceType.map((s) => ({ diet: "Diet", gym: "Gym", classes: "Classes" }[s] ?? s)).join(" + ") || "—"}
                      </Badge>
                      {selected && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
                {clients.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No clients found
                  </p>
                )}
              </div>
            </ScrollArea>
            {selectedClient && selectedClientId !== sourcePlan.clientId && (
              <p className="text-[10px] text-primary">
                Targets will be copied from {selectedClient.name}'s profile.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/10 flex-row justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={saving || !selectedClientId}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? "Creating…" : "Create copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
