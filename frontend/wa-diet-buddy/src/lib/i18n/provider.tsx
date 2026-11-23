import { DirectionProvider } from "@radix-ui/react-direction";
import type { i18n as I18nInstance } from "i18next";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
  dirFor,
  isLanguage,
} from "./config";
import { detectLanguage } from "./detect";
import { createI18n } from "./index";

type LanguageContextValue = {
  language: Language;
  dir: "ltr" | "rtl";
  setLanguage: (next: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <I18nProvider>");
  return ctx;
}

function writeCookie(language: Language) {
  if (typeof document === "undefined") return;
  // SameSite=Lax so the cookie still rides along on the top-level navigation that follows a
  // language switch; no Secure flag because local dev is plain http.
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
}

function readStoredLanguage(): Language | null {
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(raw) ? raw : null;
  } catch {
    // Private mode / blocked site data. The cookie alone is enough.
    return null;
  }
}

function writeStoredLanguage(language: Language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // detectLanguage() reads the same cookie on the server and in the browser, so this first
  // value is identical on both sides and hydration sees the markup it expects.
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());

  // One instance per provider. On the server that means one per request — see createI18n.
  const [i18n] = useState<I18nInstance>(() => createI18n(language));

  const setLanguage = useCallback(
    (next: Language) => {
      if (!isLanguage(next)) return;
      writeCookie(next);
      writeStoredLanguage(next);
      void i18n.changeLanguage(next);
      setLanguageState(next);
    },
    [i18n],
  );

  // Cookie lost but localStorage survived (cookie expiry, a "clear cookies" that spared site
  // data). Runs AFTER hydration, so switching here is a normal state update rather than a
  // server/client mismatch. The common path — cookie present — does nothing.
  useEffect(() => {
    const fromCookie = detectLanguage();
    const stored = readStoredLanguage();
    if (stored && stored !== fromCookie && document.cookie.indexOf(`${LANGUAGE_COOKIE}=`) === -1) {
      setLanguage(stored);
      return;
    }
    // Keep the mirror honest for the default-language case, where nothing has ever been written.
    if (!stored) writeStoredLanguage(fromCookie);
  }, [setLanguage]);

  // RootShell renders <html lang dir> during SSR, but it lives outside this provider (TanStack
  // renders shellComponent outside the root match), so a client-side switch cannot re-render it.
  // Drive the two attributes imperatively instead.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", language);
    root.setAttribute("dir", dirFor(language));
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, dir: dirFor(language), setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>
        {/* Radix reads direction from here, not from the DOM — without it Tabs arrow keys,
            Select/DropdownMenu placement and Slider dragging all stay LTR in Arabic. */}
        <DirectionProvider dir={dirFor(language)}>{children}</DirectionProvider>
      </I18nextProvider>
    </LanguageContext.Provider>
  );
}

export { DEFAULT_LANGUAGE };
