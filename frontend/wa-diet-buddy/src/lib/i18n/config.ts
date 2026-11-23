/**
 * Language configuration — the one place that knows which languages exist.
 *
 * Deliberately free of any server-only or browser-only import so it can be pulled into the
 * SSR shell, the client bundle and the `i18n:check` node script alike.
 */

export const LANGUAGES = ["en", "ar"] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

/** Cookie name. Read during SSR so the very first byte of HTML already carries the right dir. */
export const LANGUAGE_COOKIE = "nutria_lang";

/** Mirrored into localStorage under this key — see provider.tsx for why both exist. */
export const LANGUAGE_STORAGE_KEY = "nutria.lang";

export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LANGUAGE_META: Record<Language, { label: string; code: string; dir: "ltr" | "rtl" }> =
  {
    en: { label: "English", code: "EN", dir: "ltr" },
    ar: { label: "العربية", code: "AR", dir: "rtl" },
  };

/** The namespaces that exist. `i18n:check` walks exactly this list. */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "overview",
  "clients",
  "messages",
  "journal",
  "appointments",
  "team",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function dirFor(language: Language): "ltr" | "rtl" {
  return LANGUAGE_META[language].dir;
}

/**
 * Pull the language out of a raw Cookie header / document.cookie string.
 *
 * Hand-rolled rather than pulled from a library because it has to run identically in three
 * places (SSR, browser, and nothing else may be imported into the shell).
 */
export function languageFromCookieString(cookieString: string | null | undefined): Language | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(";")) {
    const [rawKey, ...rawValue] = part.split("=");
    if (rawKey?.trim() !== LANGUAGE_COOKIE) continue;
    const value = decodeURIComponent(rawValue.join("=").trim());
    return isLanguage(value) ? value : null;
  }
  return null;
}
