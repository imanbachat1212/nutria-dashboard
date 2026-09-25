import { Leaf } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// A recipe's diet tags, with the ones this client actually asked for pulled forward visually
// (prompt-109).
//
// ── Why emerald, and why not amber or rose ──────────────────────────────────────────────────
// This app already uses two allergy colours that must not be confused with this one: amber for
// "this item carries an allergen tag" (food-database.tsx, meal-library.tsx) and rose for "this
// conflicts with THIS client's recorded allergy" (allergy-conflict-badge.tsx). Diet tags are
// neither — they're positive, informational, and never block anything. Emerald + Leaf is the
// language meal-plans.tsx already uses for the client's own dietary-preference chips in the
// plan header, so a dietitian learns one colour for "diet preference" across the app.
//
// ── Matched vs unmatched ────────────────────────────────────────────────────────────────────
// Every tag is shown — knowing a recipe is "Vegan, Gluten-free" is useful even for a client who
// only recorded "Vegan" — but a tag the client actually asked for is the actionable one, so it
// gets the filled emerald treatment and the leaf, while the rest stay as quiet outlines in the
// same hue family. Exact string equality is all that's needed: diet tags and client preferences
// are filled from the one shared Settings list (settings.service.js's DIETARY_PREFERENCES).
export function DietTagBadges({
  diets,
  clientDietaryPrefs = [],
  className,
}: {
  diets: string[] | undefined;
  clientDietaryPrefs?: string[];
  className?: string;
}) {
  if (!diets?.length) return null;
  const wanted = new Set(clientDietaryPrefs);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {diets.map((diet) => {
        const matches = wanted.has(diet);
        return (
          <Badge
            key={diet}
            variant="outline"
            className={cn(
              "gap-0.5 px-1.5 py-0 text-[9px] font-normal",
              matches
                ? "border-emerald-500/50 bg-emerald-500/15 font-medium text-emerald-700"
                : "border-border bg-transparent text-muted-foreground",
            )}
          >
            {matches && <Leaf className="h-2.5 w-2.5 shrink-0" />}
            {diet}
          </Badge>
        );
      })}
    </div>
  );
}
