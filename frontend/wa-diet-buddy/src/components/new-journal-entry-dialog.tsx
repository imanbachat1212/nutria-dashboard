import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Search, Loader2, Check } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { fetchClients } from "@/lib/clients-api";
import { fetchFoods } from "@/lib/foods-api";
import {
  createJournalEntry,
  SLOT_LABEL,
  type JournalKind,
  type MealSlot,
} from "@/lib/journal-api";
import type { ClientRecord } from "@/lib/clients-mock";

interface DraftItem {
  food:     string | null;  // food ObjectId when linked
  foodName: string;         // display name for linked food (per-100g display)
  label:    string;         // human text e.g. "½ manoushe" or food name
  grams:    string;         // string for input; parsed on submit
  // preview macros (client-side from food per100g)
  previewKcal:    number | null;
  previewProtein: number | null;
  previewCarbs:   number | null;
  previewFat:     number | null;
}

function blankItem(): DraftItem {
  return { food: null, foodName: "", label: "", grams: "", previewKcal: null, previewProtein: null, previewCarbs: null, previewFat: null };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewJournalEntryDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const [clientId, setClientId]   = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [kind, setKind]           = useState<JournalKind>("meal");
  const [slot, setSlot]           = useState<MealSlot>("breakfast");
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 16));
  const [items, setItems]         = useState<DraftItem[]>([blankItem()]);
  const [note, setNote]           = useState("");
  const [saving, setSaving]       = useState(false);

  // Food search per-item
  const [activeFoodIdx, setActiveFoodIdx] = useState<number | null>(null);
  const [foodSearch, setFoodSearch]       = useState("");
  const [debouncedFoodSearch, setDebouncedFoodSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setClientId(""); setClientSearch(""); setKind("meal"); setSlot("breakfast");
      setDate(new Date().toISOString().slice(0, 16));
      setItems([blankItem()]); setNote(""); setActiveFoodIdx(null); setFoodSearch("");
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFoodSearch(foodSearch), 250);
    return () => clearTimeout(t);
  }, [foodSearch]);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "journal-dialog", debouncedClientSearch],
    queryFn: () => fetchClients({ search: debouncedClientSearch || undefined, limit: 30 }),
    enabled: open,
  });
  const clients = clientsData?.clients ?? [];

  const { data: foodsData, isLoading: foodsLoading } = useQuery({
    queryKey: ["foods", "journal-dialog", debouncedFoodSearch],
    queryFn: () => fetchFoods({ search: debouncedFoodSearch || undefined, limit: 20 }),
    enabled: open && activeFoodIdx !== null,
  });
  const foods = foodsData?.foods ?? [];

  function selectClient(c: ClientRecord) {
    setClientId(c.id);
    setClientSearch(c.name);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function selectFood(idx: number, food: { id: string; name: string; macros: { kcal: number; protein: number; carbs: number; fat: number } }) {
    const grams = items[idx].grams || "100";
    const factor = (Number(grams) || 0) / 100;
    updateItem(idx, {
      food:         food.id,
      foodName:     food.name,
      label:        food.name,
      grams,
      previewKcal:    Math.round(food.macros.kcal    * factor),
      previewProtein: Math.round(food.macros.protein * factor * 10) / 10,
      previewCarbs:   Math.round(food.macros.carbs   * factor * 10) / 10,
      previewFat:     Math.round(food.macros.fat     * factor * 10) / 10,
    });
    setActiveFoodIdx(null);
    setFoodSearch("");
  }

  function handleGramsChange(idx: number, val: string) {
    const it = items[idx];
    const g = Number(val) || 0;
    if (it.food) {
      const food = foods.find((f) => f.id === it.food);
      if (food) {
        const factor = g / 100;
        updateItem(idx, {
          grams: val,
          previewKcal:    Math.round(food.macros.kcal    * factor),
          previewProtein: Math.round(food.macros.protein * factor * 10) / 10,
          previewCarbs:   Math.round(food.macros.carbs   * factor * 10) / 10,
          previewFat:     Math.round(food.macros.fat     * factor * 10) / 10,
        });
        return;
      }
    }
    updateItem(idx, { grams: val });
  }

  function clearFood(idx: number) {
    updateItem(idx, { food: null, foodName: "", previewKcal: null, previewProtein: null, previewCarbs: null, previewFat: null });
  }

  const previewTotals = kind === "meal"
    ? items.reduce((t, it) => ({
        kcal:    t.kcal    + (it.previewKcal    ?? 0),
        protein: t.protein + (it.previewProtein ?? 0),
        carbs:   t.carbs   + (it.previewCarbs   ?? 0),
        fat:     t.fat     + (it.previewFat     ?? 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    : null;

  async function handleSubmit() {
    if (!clientId) return;
    setSaving(true);
    try {
      await createJournalEntry({
        client:   clientId,
        date:     new Date(date).toISOString(),
        kind,
        mealSlot: kind === "meal" ? slot : null,
        source:   "dashboard",
        items: kind === "meal"
          ? items.filter((i) => i.label.trim()).map((i) => ({
              food:  i.food || undefined,
              label: i.label.trim(),
              grams: i.grams ? Number(i.grams) : undefined,
            }))
          : [],
        note: note || undefined,
      });
      qc.invalidateQueries({ queryKey: ["journal"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!clientId && (kind === "exercise" || items.some((i) => i.label.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Log entry</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-5 py-4 space-y-4">

            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Client</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); if (clientId) setClientId(""); }}
                  placeholder="Search clients…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              {clientSearch && !clientId && (
                <div className="border rounded-md p-1 space-y-0.5">
                  {clients.map((c: ClientRecord) => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c)}
                      className="w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-muted/40 flex items-center gap-2"
                    >
                      <span className="flex-1">{c.name}</span>
                      {clientId === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                  {clients.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2.5 py-2">No clients found</p>
                  )}
                </div>
              )}
              {clientId && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Check className="h-3 w-3" /> {clientSearch}
                </p>
              )}
            </div>

            {/* Kind + Slot + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Kind</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as JournalKind)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meal">Meal</SelectItem>
                    <SelectItem value="exercise">Exercise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "meal" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Slot</Label>
                  <Select value={slot} onValueChange={(v) => setSlot(v as MealSlot)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SLOT_LABEL) as [MealSlot, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date & time</Label>
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Items (meal only) */}
            {kind === "meal" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Items</Label>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setItems((p) => [...p, blankItem()])}>
                    <Plus className="h-3 w-3" /> Add item
                  </Button>
                </div>

                {items.map((it, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={it.label}
                        onChange={(e) => updateItem(idx, { label: e.target.value })}
                        placeholder='e.g. "½ manoushe" or search a food →'
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600 shrink-0"
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Food link */}
                    <div className="flex gap-2 items-center">
                      {it.food ? (
                        <div className="flex items-center gap-2 flex-1 text-xs">
                          <span className="text-primary font-medium truncate">{it.foodName}</span>
                          <button onClick={() => clearFood(idx)} className="text-muted-foreground hover:text-rose-600 underline shrink-0">unlink</button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-primary underline"
                          onClick={() => { setActiveFoodIdx(idx); setFoodSearch(""); }}
                        >
                          + Link to food database
                        </button>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          value={it.grams}
                          onChange={(e) => handleGramsChange(idx, e.target.value)}
                          placeholder="grams"
                          className="h-7 w-20 text-xs text-right"
                        />
                        <span className="text-xs text-muted-foreground">g</span>
                      </div>
                    </div>

                    {/* Macro preview */}
                    {it.previewKcal !== null && (
                      <div className="flex gap-3 text-[11px] tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">{it.previewKcal} kcal</span>
                        <span>P {it.previewProtein}</span>
                        <span>C {it.previewCarbs}</span>
                        <span>F {it.previewFat}</span>
                      </div>
                    )}

                    {/* Food search dropdown */}
                    {activeFoodIdx === idx && (
                      <div className="border rounded-md">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                          <Input
                            value={foodSearch}
                            onChange={(e) => setFoodSearch(e.target.value)}
                            placeholder="Search foods…"
                            className="pl-7 h-8 text-xs border-0 border-b rounded-none rounded-t-md"
                            autoFocus
                          />
                        </div>
                        <div className="p-1 max-h-36 overflow-y-auto">
                          {foodsLoading ? (
                            <div className="flex justify-center py-3"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div>
                          ) : foods.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-2 py-2">No foods found</p>
                          ) : foods.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => selectFood(idx, f)}
                              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/40"
                            >
                              <span className="font-medium">{f.name}</span>
                              <span className="text-muted-foreground ml-1.5 tabular-nums">
                                {f.macros.kcal} kcal/100g
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="border-t p-1">
                          <button className="text-xs text-muted-foreground px-2 py-1 hover:text-foreground" onClick={() => setActiveFoodIdx(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Totals preview */}
                {previewTotals && (previewTotals.kcal > 0) && (
                  <div className="rounded-md bg-muted/30 px-3 py-2 flex items-center gap-4 text-[11px] tabular-nums">
                    <span className="font-semibold">{previewTotals.kcal} kcal</span>
                    <span className="text-muted-foreground">P {Math.round(previewTotals.protein * 10) / 10}</span>
                    <span className="text-muted-foreground">C {Math.round(previewTotals.carbs * 10) / 10}</span>
                    <span className="text-muted-foreground">F {Math.round(previewTotals.fat * 10) / 10}</span>
                  </div>
                )}
              </div>
            )}

            {kind === "exercise" && (
              <p className="text-xs text-muted-foreground italic">
                Exercise entries are stored with the note below. Macro impact is not tracked in this version.
              </p>
            )}

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any context for this log…"
                className="min-h-15 text-sm"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t bg-muted/10 flex-row justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Log entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
