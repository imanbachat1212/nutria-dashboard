import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Language } from "./config";
import { useLanguage } from "./provider";

/**
 * BCP-47 tag for Intl, with the numbering system pinned to Latin digits.
 *
 * `ar` on its own makes Intl emit Arabic-Indic digits (٢٠٢٦‏/١٠‏/٨). The practice works with
 * grams, kcal and phone numbers all day; mixing numeral systems between screens would be worse
 * than not translating at all, and Sura asked for 0-9 in both languages. The `-u-nu-latn`
 * extension is the supported way to say so.
 */
export function intlLocale(language: Language): string {
  return language === "ar" ? "ar-u-nu-latn" : "en-US";
}

export type Formatters = {
  locale: string;
  /** e.g. "8 Oct 2026" */
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  /** e.g. "14:30" */
  time: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
};

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function createFormatters(language: Language): Formatters {
  const locale = intlLocale(language);
  return {
    locale,
    date: (value, options) => {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(
        locale,
        options ?? { day: "numeric", month: "short", year: "numeric" },
      );
    },
    time: (value, options) => {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString(locale, options ?? { hour: "2-digit", minute: "2-digit" });
    },
    number: (value, options) => {
      if (!Number.isFinite(value)) return "—";
      return value.toLocaleString(locale, options);
    },
  };
}

export function useFormatters(): Formatters {
  const { language } = useLanguage();
  return useMemo(() => createFormatters(language), [language]);
}

/**
 * "3 hours ago" / "منذ 3 ساعات".
 *
 * There was already one of these per module — `relativeTime` in mealplans-api.ts and
 * `fmtRelative` in team-mock.ts — each with English glued together by hand ("`${h}h ago`"), which
 * is unlocalisable: Arabic needs the dual form for 2 and a different noun shape for 3-10. This is
 * the one implementation the translated screens use. mealplans-api.ts's copy is deliberately left
 * alone: foods-api and meals-api bake its output into mapped data for the Food Database and Meal
 * Library pages, which are out of scope for this round.
 *
 * `tail` picks what happens past a month: "weeks" keeps counting (what the old mealplans-api
 * version did), "date" switches to an absolute date (what the old team-mock version did).
 */
export function useRelativeTime(tail: "weeks" | "date" = "date") {
  const { t } = useTranslation("common");
  const fmt = useFormatters();

  return useCallback(
    (value: Date | string | number | null | undefined): string => {
      if (!value) return "";
      const ms = toDate(value).getTime();
      if (Number.isNaN(ms)) return "—";
      const minutes = Math.round((Date.now() - ms) / 60000);
      if (minutes < 1) return t("time.justNow");
      if (minutes < 60) return t("time.minutesAgo", { count: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24) return t("time.hoursAgo", { count: hours });
      const days = Math.round(hours / 24);
      if (days < 30) return t("time.daysAgo", { count: days });
      if (tail === "weeks") return t("time.weeksAgo", { count: Math.round(days / 7) });
      return fmt.date(value as Date | string | number, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    },
    [t, fmt, tail],
  );
}

/**
 * Wrap a value so the bidi algorithm cannot reorder it inside an Arabic sentence.
 *
 * Without this, "-3 new in 7d" renders in RTL as "3- جديد…": the leading "-" is a neutral
 * character, so it gets absorbed into the surrounding right-to-left run and lands on the wrong
 * side of the digits. Same hazard for "+5", "3/8" and "$40". U+2066 LRI … U+2069 PDI marks the
 * span as a self-contained left-to-right run, which is exactly what a signed number is.
 *
 * Spotted by reading a rendered Arabic screenshot, not by reading the code — the string itself
 * is perfectly correct, it is only the display order that was wrong.
 */
export function ltrIsolate(value: string | number): string {
  return `\u2066${value}\u2069`;
}
