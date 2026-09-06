import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { measureOptionLabels, type RealMeasure } from "@/lib/measure-options";

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
  const options = measureOptionLabels(realMeasures);
  // A stale option (e.g. leftover from before a food swap changed which measures are valid)
  // falls back to "g" rather than rendering a blank/invalid Select value.
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
          {options.map((o) => (
            <SelectItem key={o} value={o} className="max-w-72">
              <span className="truncate">{o === "g" ? "Grams (g)" : o}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
