import { useEffect, useState } from "react";
import { AlertCircle, ClipboardPaste, Link as LinkIcon, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  importErrorCode,
  importRecipeFromText,
  importRecipeFromUrl,
  type ImportedRecipe,
} from "@/lib/recipe-import-api";

interface ImportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands the parsed draft to the caller, which opens the New Recipe dialog pre-filled. */
  onImported: (recipe: ImportedRecipe) => void;
}

type Mode = "url" | "text";

// Codes where offering the paste box is the right next step: the page couldn't be read, so Sura
// copying the text herself is the actual workaround. A bad URL isn't one of those — the fix
// there is to correct the address, and pushing a textarea at her would be noise.
const FALLBACK_CODES = new Set(["FETCH_FAILED", "NO_RECIPE_DATA"]);

export function ImportRecipeDialog({ open, onOpenChange, onImported }: ImportRecipeDialogProps) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerPaste, setOfferPaste] = useState(false);

  // Clearing on open rather than on close: the close animation would otherwise blank the form
  // while it's still visible. Same reason new-recipe-dialog defers its own reset.
  useEffect(() => {
    if (!open) return;
    setMode("url");
    setUrl("");
    setRawText("");
    setError(null);
    setOfferPaste(false);
    setLoading(false);
  }, [open]);

  const canSubmit = loading
    ? false
    : mode === "url"
      ? url.trim().length > 3
      : rawText.trim().length >= 20;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const recipe =
        mode === "url"
          ? await importRecipeFromUrl(url.trim())
          : await importRecipeFromText(rawText.trim());
      onImported(recipe);
      onOpenChange(false);
    } catch (err) {
      const code = importErrorCode(err);
      const message = err instanceof Error ? err.message : "Import failed.";
      if (mode === "url" && code && FALLBACK_CODES.has(code)) {
        setError(`${message} Please copy and paste the recipe text instead.`);
        setOfferPaste(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Import a recipe
          </DialogTitle>
          <DialogDescription>
            Paste a link to a recipe page and we&apos;ll pull in the ingredients, method, times and
            photo. You&apos;ll review and confirm everything before it saves.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "url" ? (
            <div className="space-y-1.5">
              <Label htmlFor="import-url">Recipe URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="import-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) run();
                  }}
                  placeholder="https://www.example.com/a-recipe/"
                  className="pl-9"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="import-text">Recipe text</Label>
              <Textarea
                id="import-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Paste the whole recipe here — title, ingredient list and method."}
                className="min-h-[200px] font-mono text-xs"
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Include the ingredient list and the method. The intro story isn&apos;t imported.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-900 dark:text-amber-200">{error}</p>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {mode === "url"
                ? "Fetching the page and matching ingredients to your food library…"
                : "Reading the text and matching ingredients to your food library…"}
              <span className="text-muted-foreground/70">this can take a few seconds.</span>
            </p>
          )}

          {/* Always available, not only after a failure — some sites Sura already knows are
              blocked, and making her fail once first would be pointless. The failure path just
              makes it louder by flipping `offerPaste`. */}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "url" ? "text" : "url"));
              setError(null);
              setOfferPaste(false);
            }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
          >
            <ClipboardPaste className="h-3 w-3" />
            {mode === "url"
              ? offerPaste
                ? "Paste the recipe text instead →"
                : "Or paste the recipe text instead"
              : "Back to importing from a link"}
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!canSubmit} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Importing…" : mode === "url" ? "Fetch recipe" : "Read recipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
