import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { getMeal, type EditableMeal } from "@/lib/meals-api";
import type { MacroContributions, NutrientContribution } from "@/lib/meal-library-mock";

// "Where did this number come from" — one hover, used by every nutrient figure in the app
// (prompt-98): the Meal Library drawer's macro tiles and micronutrient rows, and the Meal Plan
// sheet's day/slot rows and macro bars.
//
// Percentage only, never absolute amounts. Confirmed with the client: the absolute figure is
// already on the ingredient/item row itself, and the share is what answers "which one do I
// change". Every contributor is listed — no top-N truncation — because a nutrient concentrated
// in one place and a nutrient spread thinly across nine are different answers, and truncating
// hides exactly that difference.
//
// Food Database is deliberately NOT a caller: a food there is atomic, so it has nothing to
// break down into.

// A contributor row. `mealId` only appears at meal-plan level 1, where a contributor may itself
// be a recipe and can therefore be opened one level deeper.
export interface ContributionEntry extends NutrientContribution {
  mealId?: string | null;
}

// Backend field names — `calories`, not the UI's `kcal`, so one key looks a nutrient up in both
// macroContributions and the micronutrients array.
const MACRO_KEYS = ["calories", "protein", "carbs", "fat", "fiber"];

// A fetched recipe's own contributor list for one nutrient. fiber legitimately appears in both
// places (it has a Daily Value AND is a macro); both are computed from the same rows by the
// same helper, so either lookup returns the same list.
function breakdownFor(meal: EditableMeal | undefined, field: string): NutrientContribution[] {
  if (!meal) return [];
  if (MACRO_KEYS.includes(field)) {
    return meal.macroContributions?.[field as keyof MacroContributions] ?? [];
  }
  return meal.micronutrients?.find((m) => m.nutrient === field)?.contributions ?? [];
}

function PctBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/50"
        style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function ContributionRow({
  entry,
  field,
  depth,
}: {
  entry: ContributionEntry;
  field: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  // Level 2 (prompt-98 phase 4): a recipe-type plan item expands into its own ingredients.
  // A food-type item has no mealId — it IS the whole contributor already, with nothing inside.
  const canDrill = !!entry.mealId && depth === 0;
  const { data, isFetching } = useQuery({
    queryKey: ["meal", entry.mealId],
    queryFn: () => getMeal(entry.mealId as string),
    // Lazy on purpose: a day can hold a dozen recipe items and fetching all of them to populate
    // a hover nobody has opened would be a burst of requests for nothing.
    enabled: open && canDrill,
  });
  // An ingredient's share WITHIN a recipe is scale-invariant — multiplying every ingredient by
  // the same servings factor leaves their ratios to each other untouched — so the fetched
  // recipe's own percentages are shown as-is, with no rescaling by the plan item's servings.
  const nested = breakdownFor(data, field);

  return (
    <li>
      <div className="flex items-baseline gap-2">
        {canDrill ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="-ml-1 flex min-w-0 flex-1 items-baseline gap-1 text-left hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 translate-y-0.5 transition-transform",
                open && "rotate-90",
              )}
            />
            <span className="truncate">{entry.name}</span>
          </button>
        ) : (
          <span className={cn("min-w-0 flex-1 truncate", depth > 0 && "text-muted-foreground")}>
            {entry.name}
          </span>
        )}
        <span className="shrink-0 tabular-nums font-medium">{entry.pct}%</span>
      </div>
      <PctBar pct={entry.pct} />
      {open && (
        <div className="mt-1.5 border-l pl-2.5">
          {isFetching && !data ? (
            <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading ingredients…
            </div>
          ) : nested.length ? (
            <>
              <div className="pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                within this recipe
              </div>
              <ul className="space-y-3">
                {nested.map((n) => (
                  <ContributionRow key={n.name} entry={n} field={field} depth={depth + 1} />
                ))}
              </ul>
            </>
          ) : (
            <div className="py-0.5 text-muted-foreground">
              No ingredient in this recipe reports it.
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ContributionHover({
  contributions,
  field,
  label,
  children,
  align = "start",
}: {
  contributions: ContributionEntry[] | undefined;
  // Backend nutrient key, used to look up the same nutrient one level deeper.
  field: string;
  // What the hover is explaining, e.g. "Calories" or "Iron".
  label: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  // No data is not the same as an empty breakdown, but neither is worth a hover that opens onto
  // nothing — so the trigger simply isn't a trigger, and the figure behaves as it always did.
  if (!contributions?.length) return <>{children}</>;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-help decoration-muted-foreground/40 decoration-dotted underline-offset-4 hover:underline">
          {children}
        </span>
      </HoverCardTrigger>
      {/* text-left is not decoration: this project's hover-card.tsx renders Content without a
          Portal, so it sits inside whatever wraps the trigger and inherits its alignment — and
          the macro tiles wrap theirs in `text-center`, which centred every row of the list. */}
      <HoverCardContent align={align} className="w-72 p-3 text-left text-xs">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label} — where it came from
        </div>
        {/* Capped height rather than a shorter list: every contributor is listed, and a day
            with twenty items scrolls instead of being silently cut to a "top 5". */}
        <ul className="max-h-64 space-y-3 overflow-y-auto">
          {contributions.map((c) => (
            <ContributionRow key={c.name} entry={c} field={field} depth={0} />
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
