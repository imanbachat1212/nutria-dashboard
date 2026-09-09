import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  measureOptionLabels,
  measureOptionGroups,
  type RealMeasure,
} from "@/lib/measure-options";

// One shared measure picker for Meal Library's ingredient picker and Meal Plan's item picker
// (prompt-45) — dropdown options come from the selected food's real, food-specific portions
// (e.g. "1 pitted date" -> 7.1g) when available, falling back to the app's generic g/ml/cup/
// tbsp/tsp/oz/piece list only when a food has none at all. Fully controlled: `count` is "how
// many of `option`," and the caller resolves the actual submittable {quantity, unit} via
// resolveMeasure() in lib/measure-options.ts (also used for live macro previews) — this
// component only renders the two inputs and reports raw selection changes upward.
export function MeasureSelect({
  realMeasures,
  option,
  count,
  onOptionChange,
  onCountChange,
  quantityClassName,
  unitClassName,
}: {
  realMeasures: RealMeasure[] | undefined;
  option: string;
  count: number | "";
  onOptionChange: (option: string) => void;
  onCountChange: (count: number | "") => void;
  quantityClassName?: string;
  unitClassName?: string;
}) {
  // The currently-selected option is always included (prompt-79) so an item stored in a unit
  // this food doesn't list — e.g. a plain "tbsp" on a food that has real portions — is still
  // shown as what it actually is instead of silently reading "Grams (g)".
  const options = measureOptionLabels(realMeasures, option);
  const groups = measureOptionGroups(realMeasures, option);
  // Kept as a guard for a genuinely empty/unset option; with the current unit now always in
  // `options`, a real selection can no longer fall through to "g".
  const selectValue = options.includes(option) ? option : "g";

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        step="any"
        placeholder="0"
        value={count}
        onChange={(e) => {
          const v = e.target.value;
          onCountChange(v === "" ? "" : Math.max(0, Number(v)));
        }}
        className={quantityClassName ?? "w-20"}
      />
      <Select value={selectValue} onValueChange={onOptionChange}>
        <SelectTrigger className={unitClassName ?? "w-28"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Grouped (prompt-84) so the food's own measured portions stay visually distinct from
              the standard units now listed alongside them. A food with no portions yields a
              single group, which renders without a heading exactly as it always did. */}
          {groups.map((g, gi) =>
            groups.length === 1 ? (
              g.options.map((o) => (
                <SelectItem key={o} value={o} className="max-w-72">
                  <span className="truncate">{o === "g" ? "Grams (g)" : o}</span>
                </SelectItem>
              ))
            ) : (
              <SelectGroup key={g.label}>
                <SelectLabel className={gi > 0 ? "mt-1 border-t pt-2" : undefined}>
                  {g.label}
                </SelectLabel>
                {g.options.map((o) => (
                  <SelectItem key={o} value={o} className="max-w-72">
                    <span className="truncate">{o === "g" ? "Grams (g)" : o}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
