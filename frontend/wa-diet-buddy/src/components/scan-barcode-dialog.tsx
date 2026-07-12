import { useMemo, useState } from "react";
import {
  Barcode,
  Search,
  Plus,
  PackageSearch,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOODS, CATEGORY_META, SOURCE_META, type FoodItem } from "@/lib/food-database-mock";
import { cn } from "@/lib/utils";

interface ScanBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (food: FoodItem) => void;
  onCreateNew: (barcode: string) => void;
}

type ScanState = "idle" | "searching" | "found" | "not-found";

export function ScanBarcodeDialog({
  open,
  onOpenChange,
  onFound,
  onCreateNew,
}: ScanBarcodeDialogProps) {
  const [barcode, setBarcode] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [found, setFound] = useState<FoodItem | null>(null);

  const normalized = useMemo(() => barcode.replace(/\s|-/g, "").trim(), [barcode]);
  const canSearch = normalized.length >= 8;

  const reset = () => {
    setBarcode("");
    setState("idle");
    setFound(null);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSearch = () => {
    if (!canSearch) return;
    setState("searching");
    setFound(null);

    // Simulate a brief lookup for UX; in production this would hit an API.
    setTimeout(() => {
      const match = FOODS.find((f) => f.barcode?.replace(/\s|-/g, "") === normalized);
      if (match) {
        setFound(match);
        setState("found");
      } else {
        setState("not-found");
      }
    }, 400);
  };

  const handleOpenFound = () => {
    if (found) {
      onFound(found);
      handleClose(false);
    }
  };

  const handleCreateNew = () => {
    onCreateNew(normalized);
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="size-5" /> Scan barcode
          </DialogTitle>
          <DialogDescription>
            Type or paste a product barcode (EAN / UPC) to look it up in the food database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Barcode className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={barcode}
              onChange={(e) => {
                // Allow digits, spaces, and dashes only.
                const val = e.target.value.replace(/[^0-9\s-]/g, "");
                setBarcode(val);
                if (state !== "idle") setState("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. 5201054001234"
              className="pl-8 font-mono tracking-wide"
              maxLength={14}
            />
          </div>

          <Button
            className="w-full"
            disabled={!canSearch || state === "searching"}
            onClick={handleSearch}
          >
            {state === "searching" ? (
              <>Searching…</>
            ) : (
              <>
                <Search className="size-4" /> Search database
              </>
            )}
          </Button>

          {state === "found" && found && (
            <div className="rounded-lg border bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="size-4" />
                <span className="text-sm font-medium">Found in database</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xl">
                  {CATEGORY_META[found.category].emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{found.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {found.brand && <span>{found.brand} · </span>}
                    {CATEGORY_META[found.category].label} · {found.macros.kcal} kcal / 100g
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary" className={cn("text-[10px]", SOURCE_META[found.source].color)}>
                      {SOURCE_META[found.source].label}
                    </Badge>
                    {found.verified && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Separator className="my-3" />
              <Button size="sm" className="w-full" onClick={handleOpenFound}>
                Open food details <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {state === "not-found" && (
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <PackageSearch className="mx-auto size-6 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium text-foreground">No match found</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Barcode <span className="font-mono font-medium">{normalized}</span> is not in your library yet.
              </p>
              <Button size="sm" className="mt-3 w-full" variant="outline" onClick={handleCreateNew}>
                <Plus className="size-4" /> Create new food
              </Button>
            </div>
          )}

          {state === "idle" && !canSearch && barcode.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="size-4 shrink-0" />
              Barcodes are usually 8–14 digits.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
