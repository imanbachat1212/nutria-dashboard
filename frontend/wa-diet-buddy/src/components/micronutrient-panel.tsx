import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CLAIM_LEVEL_META } from "@/lib/food-database-mock";

// One micronutrient panel, shared by Meal Library's recipe drawer (prompt-82) and Meal Plans'
// day/slot sheet (prompt-83), so the nutrient list, the priority ordering and the row layout
// exist once rather than in two drifting copies.
//
// The two surfaces measure against DIFFERENT references on purpose, which is why a row can
// carry either or both:
//   - `dv`  — the FDA Daily Value: a single generic label reference (adults and children 4+).
//     It's what a nutrient content claim is legally defined against, so it's the right basis
//     for "is this recipe a Good Source of iron?" and it's the ONLY basis that carries a
//     High/Good Source badge.
//   - `dri` — this client's own Dietary Reference Intake target, derived from their age, sex
//     and activity (lib/calc/dri.js). It's the right basis for "did this client meet their
//     iron needs today?" and it is frequently far from the DV — for one real client here, iron
//     is 8 mg against the DV's 18 mg, so a day that exactly meets her requirement would read as
//     a discouraging "44% DV" if the DV were the only reference shown.
//
// Claim badges are deliberately gated behind `showClaims` and only ever used with `dv`. FDA
// High/Good Source is defined per serving of a food; a whole day of eating sitting above 20% of
// a Daily Value is unremarkable, so labelling a day or a meal slot that way would misuse the
// vocabulary prompt-65 was careful to reserve.
export interface MicronutrientRow {
  nutrient: string;
  label: string;
  unit: string;
  value: number | null;
  dv?: { pct: number; level: "high" | "good" | null } | null;
  dri?: { target: number; pct: number } | null;
}

// The nutrients the dietitian checks most, shown ahead of the rest. Everything not named here
// keeps the caller's order, which on both surfaces is the FDA table's own order.
export const PRIORITY_NUTRIENTS = [
  "iron",
  "calcium",
  "vitaminA",
  "vitaminC",
  "vitaminB12",
  "folate",
  "potassium",
];

export function sortByPriority<T extends { nutrient: string }>(rows: T[]): T[] {
  const rank = (n: string) => {
    const i = PRIORITY_NUTRIENTS.indexOf(n);
    return i === -1 ? PRIORITY_NUTRIENTS.length : i;
  };
  return [...rows].sort((a, b) => rank(a.nutrient) - rank(b.nutrient));
}

export function priorityCount(rows: { nutrient: string }[]): number {
  return rows.filter((r) => PRIORITY_NUTRIENTS.includes(r.nutrient)).length;
}

// A unit string like "mcg RAE" or "mg alpha-tocopherol" carries a qualifier that's useful in the
// FDA table but noise beside a number in a narrow row.
const shortUnit = (unit: string) => unit.split(" ")[0];

export function MicronutrientPanel({
  rows,
  title,
  caption,
  showClaims = false,
  emptyText = "No micronutrient data for these items.",
}: {
  rows: MicronutrientRow[];
  title?: string;
  caption?: string;
  showClaims?: boolean;
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  const ordered = sortByPriority(rows);
  const split = priorityCount(ordered);
  const callouts = showClaims ? ordered.filter((r) => r.dv?.level) : [];
  const anyDri = ordered.some((r) => r.dri);

  return (
    <div className="space-y-2">
      {(title || caption) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </div>
          )}
          {caption && <span className="text-[10px] text-muted-foreground">{caption}</span>}
        </div>
      )}

      {callouts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {callouts.map((r) => (
            <Badge
              key={r.nutrient}
              className={cn("text-[10px] font-medium", CLAIM_LEVEL_META[r.dv!.level!].color)}
              title={`${r.value} ${r.unit} per serving — ~${r.dv!.pct}% of the Daily Value`}
            >
              {CLAIM_LEVEL_META[r.dv!.level!].label} of {r.label} ~{r.dv!.pct}% DV
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-md border divide-y">
        {ordered.map((r, i) => (
          <div
            key={r.nutrient}
            className={cn(
              "px-2.5 py-1.5 text-xs",
              // A hairline under the last priority nutrient, so "the ones she checks most" read
              // as a group rather than the list just happening to start with them.
              i === split - 1 && "border-b-2",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate">{r.label}</span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                <span className="font-medium">
                  {r.value == null ? "—" : r.value}
                  {r.dri ? ` / ${r.dri.target}` : ""} {shortUnit(r.unit)}
                </span>
                {r.dri && (
                  <span className="w-16 text-right font-semibold text-foreground">
                    {r.dri.pct}% DRI
                  </span>
                )}
                {r.dv && (
                  <span className="w-14 text-right text-muted-foreground">{r.dv.pct}% DV</span>
                )}
                {showClaims &&
                  (r.dv?.level ? (
                    <Badge
                      className={cn(
                        "w-12 justify-center text-[9px]",
                        CLAIM_LEVEL_META[r.dv.level].color,
                      )}
                    >
                      {CLAIM_LEVEL_META[r.dv.level].short}
                    </Badge>
                  ) : (
                    <span className="w-12" />
                  ))}
              </span>
            </div>
            {/* The bar tracks the CLIENT's target, never the DV — it answers "how close is this
                person to what they need", which is the question a progress bar implies. */}
            {r.dri && <Progress value={Math.min(100, r.dri.pct)} className="mt-1 h-1" />}
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        {anyDri
          ? "% DRI is against this client's own target (age, sex, activity). % DV is the FDA's generic Daily Value for adults and children 4+ — shown for context; the two differ for most nutrients."
          : "FDA thresholds (21 CFR 101.54): High Source ≥20% DV, Good Source 10–19% DV. Daily Values for adults and children 4+."}{" "}
        Nutrients no item reported are omitted rather than shown as zero.
      </p>
    </div>
  );
}
