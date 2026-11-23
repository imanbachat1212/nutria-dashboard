import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { DEFAULT_LANGUAGE, type Language, languageFromCookieString } from "./config";

/**
 * Resolve the active language the same way on both sides of the SSR boundary.
 *
 * WHY THE COOKIE IS THE SOURCE OF TRUTH FOR RENDERING, not localStorage:
 * the server has no access to localStorage, so if the client resolved from localStorage first
 * the two sides could disagree and React would blow up with a hydration mismatch on <html>
 * itself — the least recoverable place to have one. Both sides therefore read the SAME cookie
 * string and nothing else. localStorage is still written (see provider.tsx) and is used only to
 * re-seed a cookie that has gone missing, which happens after hydration where a change is safe.
 *
 * `createIsomorphicFn` is compiled away per environment by the TanStack Start plugin, so the
 * `@tanstack/react-start/server` import above never reaches the browser bundle.
 */
export const detectLanguage = createIsomorphicFn()
  .server((): Language => languageFromCookieString(getRequestHeader("cookie")) ?? DEFAULT_LANGUAGE)
  .client(
    (): Language =>
      languageFromCookieString(typeof document === "undefined" ? null : document.cookie) ??
      DEFAULT_LANGUAGE,
  );
