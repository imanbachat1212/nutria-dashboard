import * as React from "react";
import RPNInput, { type Country, isValidPhoneNumber } from "react-phone-number-input";
import { getExampleNumber } from "libphonenumber-js/min";
import examples from "libphonenumber-js/examples.mobile.json";
import "react-phone-number-input/style.css";

import { cn } from "@/lib/utils";

export { isValidPhoneNumber };
export type { Country };

// Bare number field — no border/shadow/padding of its own. The wrapper below (the actual
// `.nutria-phone-input` container) supplies the Input-matching box, so the flag/country
// selector and the digits read as one control instead of two nested boxes.
const NumberField = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
NumberField.displayName = "PhoneNumberField";

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

// Reusable international phone input: country selector (flag + dial code, defaulting to
// Lebanon), formatting-as-you-type, and E.164-native storage via libphonenumber-js (bundled
// with react-phone-number-input) — meant to be the one phone-entry component used wherever a
// phone number is collected in the app, rather than a plain `<Input type="tel">`.
//
// `value`/`onChange` are plain strings, not the library's branded `Value` type — this is
// deliberate: it lets a caller pass an existing, possibly-unparseable legacy number (e.g. a
// client record saved before this component existed) straight in as the initial value. The
// library's own `value` prop is explicitly documented to accept an arbitrary string "received
// from an external source such as a database" and falls back to displaying it as raw digits
// instead of throwing — so editing a client with a malformed stored number won't crash this
// component, it just won't show a recognized flag/format for it until corrected.

// A real, country-specific example number (e.g. "71 234 567" for Lebanon, "(201) 555-0123"
// for the US) — not just decorative. Recomputed whenever the country selector changes, so
// switching countries visibly changes the placeholder as proof the library is actually driving
// per-country format rules, not just swapping a flag icon.
function examplePlaceholder(country: Country): string | undefined {
  try {
    return getExampleNumber(country, examples)?.formatNational();
  } catch {
    return undefined;
  }
}

export function PhoneInput({
  id,
  value,
  onChange,
  defaultCountry = "LB",
  placeholder,
  disabled,
  invalid,
  className,
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<Country | undefined>(defaultCountry);

  return (
    <RPNInput
      id={id}
      international
      defaultCountry={defaultCountry}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onCountryChange={setCountry}
      placeholder={placeholder ?? (country ? examplePlaceholder(country) : undefined)}
      disabled={disabled}
      inputComponent={NumberField}
      className={cn(
        "nutria-phone-input flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        invalid && "border-destructive focus-within:ring-destructive",
        className,
      )}
    />
  );
}
