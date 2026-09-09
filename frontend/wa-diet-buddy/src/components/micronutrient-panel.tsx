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
  // `pct` is the rounded percentage the rest of the app stores and badges with. `pctExact` is
  // the same ratio before rounding, supplied purely so formatDvPct below can add a decimal on
  // the rows where the rounded integer would misstate the tier (prompt-88). It never takes part
  // in classification — the tier is always `level`, computed upstream on the exact value.
  dv?: { pct: number; level: "high" | "good" | null; pctExact?: number } | null;
  dri?: { target: number; pct: number } | null;
  // Short qualifier badge beside the value, e.g. "IU" for a vitamin A/D record stored in the
  // unit USDA reported rather than the one the DV is defined in (prompt-87). Such a row
  // deliberately carries a value but no `dv` — IU->mcg depends on the vitamer, so there is no
  // honest percentage to show, and 0% would be a lie rather than an absence.
  note?: string;
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

// 21 CFR 101.54's two boundaries. The authority for these is nutrientClaims.js (HIGH_MIN_PCT /
// GOOD_MIN_PCT) and every tier decision is made there; this is the display side restating them,
// as the footnote below already did in prose. Kept as one array so the rule and the footnote
// can't drift apart.
const DV_TIERS = { good: 10, high: 20 };

// How a %DV reads in the table and on the badges.
//
// ── The problem this solves (prompt-88) ──────────────────────────────────────────────────────
// Tiers are decided on the exact ratio, then the number is rounded for display. For ~1.4% of
// real nutrient rows those two steps disagree about which side of a boundary the value is on:
//
//   Pistachio nuts, Calcium   9.840% DV -> displayed "10% DV", correctly NO badge
//                                          (the footnote says Good Source starts at 10%)
//   Beans and tomatoes, B2   19.615% DV -> displayed "20% DV", badged "Good Source"
//                                          (the footnote says 20% is High Source)
//
// Both read as the panel contradicting itself. Neither is a data error — the tiers are right.
//
// ── The rule ─────────────────────────────────────────────────────────────────────────────────
// If rounding pushes the number onto or past a boundary its exact value never reached, show one
// decimal instead of a whole number. Everywhere else — 98.6% of rows — the integer is unchanged.
// The extra digit appears exactly where the integer would mislead, and nowhere else.
//
// Truncated, never rounded, so the digit shown cannot recreate the same problem: 9.97% must
// render "9.9", not "10.0". Truncation only ever moves the display away from the boundary, so
// it can never manufacture the contradiction it exists to remove.
export function formatDvPct(dv: { pct: number; pctExact?: number }): string {
  const exact = dv.pctExact;
  if (
    exact != null &&
    Object.values(DV_TIERS).some((t) => Math.round(exact) >= t && exact < t)
  ) {
    return (Math.floor(exact * 10) / 10).toFixed(1);
  }
  return String(dv.pct);
}

export function MicronutrientPanel({
  rows,
  title,
  caption,
  showClaims = false,
  showCallouts,
  nullText = "—",
  emptyText = "No micronutrient data for these items.",
}: {
  rows: MicronutrientRow[];
  title?: string;
  caption?: string;
  showClaims?: boolean;
  // The strip of "High Source of X" badges above the table. Defaults to following showClaims,
  // and is turned OFF in Food Database (prompt-87), which already shows the food's stored,
  // server-computed claim badges at the top of its drawer — the same claims, from the same
  // thresholds. Two identical badge strips in one sheet would read as two separate findings.
  showCallouts?: boolean;
  // What an unmeasured nutrient reads as. Recipes and meal plans drop null nutrients before
  // they get here, so the dash is only a fallback there; a single food keeps them and says
  // "No Data" (prompt-73) — for one food, "USDA never measured this" is itself information.
  nullText?: string;
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  const ordered = sortByPriority(rows);
  const split = priorityCount(ordered);
  const callouts = (showCallouts ?? showClaims) ? ordered.filter((r) => r.dv?.level) : [];
  const anyDri = ordered.some((r) => r.dri);
  const anyDv = ordered.some((r) => r.dv);
  const anyNull = ordered.some((r) => r.value == null);

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
              title={`${r.value} ${r.unit} per serving — ~${formatDvPct(r.dv!)}% of the Daily Value`}
            >
              {CLAIM_LEVEL_META[r.dv!.level!].label} of {r.label} ~{formatDvPct(r.dv!)}% DV
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
                {r.value == null ? (
                  <span className="text-muted-foreground">{nullText}</span>
                ) : (
                  <span className="font-medium">
                    {r.value}
                    {r.dri ? ` / ${r.dri.target}` : ""} {shortUnit(r.unit)}
                  </span>
                )}
                {r.note && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 px-1 py-0 text-[9px] text-amber-700"
                  >
                    {r.note}
                  </Badge>
                )}
                {r.dri && (
                  <span className="w-16 shrink-0 whitespace-nowrap text-right font-semibold text-foreground">
                    {r.dri.pct}% DRI
                  </span>
                )}
                {/* Reserved whenever ANY row has a %DV, so the rows that legitimately have
                    none — unmeasured, or stored in IU — leave a gap in the column instead of
                    sliding their value across into it. */}
                {/* w-16, not w-14: a decimal row ("19.9% DV") is two characters longer than the
                    integers around it and wrapped onto a second line at the old width. Sized to
                    the DRI column beside it, which already holds an 8-character "127% DRI". */}
                {anyDv && (
                  <span className="w-16 shrink-0 whitespace-nowrap text-right text-muted-foreground">
                    {r.dv ? `${formatDvPct(r.dv)}% DV` : ""}
                  </span>
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
          : `FDA thresholds (21 CFR 101.54): High Source ≥${DV_TIERS.high}% DV, Good Source ${DV_TIERS.good}–${DV_TIERS.high - 1}% DV. Daily Values for adults and children 4+.`}{" "}
        {anyNull
          ? `Nutrients the source never reported read as "${nullText}", never as a measured zero.`
          : "Nutrients no item reported are omitted rather than shown as zero."}
      </p>
    </div>
  );
}
