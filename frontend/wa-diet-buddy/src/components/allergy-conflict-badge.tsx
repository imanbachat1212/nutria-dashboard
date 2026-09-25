import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatAllergyConflicts } from "@/lib/allergy-matching";

// "This item conflicts with THIS client's recorded allergies" (prompt-104).
//
// Deliberately ROSE, not the amber this app already uses for "this item carries an allergen
// tag" (food-database.tsx's Allergens section, meal-library.tsx's "Contains allergens"). Those
// two statements look alike and mean very different things: amber is a neutral fact about the
// food, this is a statement about the person being planned for. Sharing a colour would blur
// them exactly where the distinction matters.
//
// It names the allergy rather than showing a bare icon — a dietitian scanning a list needs to
// know WHICH allergy fired, and "Allergy: Peanuts" answers that without a hover.
//
// Advisory only. Nothing anywhere disables, blocks or confirms on the strength of this; see the
// matching caveats in lib/allergy-matching.ts for what it cannot catch.
export function AllergyConflictBadge({
  conflicts,
  className,
  compact = false,
}: {
  conflicts: string[];
  className?: string;
  // Icon + names with no chip background, for dense rows that already carry their own padding.
  compact?: boolean;
}) {
  if (!conflicts.length) return null;
  const label = formatAllergyConflicts(conflicts);
  return (
    <span
      title={`Conflicts with this client's recorded ${conflicts.join(", ")} allergy`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-medium text-rose-700",
        compact
          ? "text-[10px]"
          : "rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px]",
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
