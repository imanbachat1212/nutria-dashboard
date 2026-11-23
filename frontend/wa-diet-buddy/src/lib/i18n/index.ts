import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, DEFAULT_NAMESPACE, NAMESPACES, type Language } from "./config";

// Resources are STATICALLY imported so they end up in the bundle. i18next can lazy-load over
// HTTP, which we deliberately do not do: the dashboard is behind a login on a different origin
// from the API, and a translation that arrives one network round-trip after first paint is a
// guaranteed flash of untranslated text.
import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enAuth from "./locales/en/auth.json";
import enOverview from "./locales/en/overview.json";
import enClients from "./locales/en/clients.json";
import enMessages from "./locales/en/messages.json";
import enJournal from "./locales/en/journal.json";
import enAppointments from "./locales/en/appointments.json";
import enTeam from "./locales/en/team.json";

import arCommon from "./locales/ar/common.json";
import arNav from "./locales/ar/nav.json";
import arAuth from "./locales/ar/auth.json";
import arOverview from "./locales/ar/overview.json";
import arClients from "./locales/ar/clients.json";
import arMessages from "./locales/ar/messages.json";
import arJournal from "./locales/ar/journal.json";
import arAppointments from "./locales/ar/appointments.json";
import arTeam from "./locales/ar/team.json";

export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    overview: enOverview,
    clients: enClients,
    messages: enMessages,
    journal: enJournal,
    appointments: enAppointments,
    team: enTeam,
  },
  ar: {
    common: arCommon,
    nav: arNav,
    auth: arAuth,
    overview: arOverview,
    clients: arClients,
    messages: arMessages,
    journal: arJournal,
    appointments: arAppointments,
    team: arTeam,
  },
} as const;

/**
 * Build an i18next instance for one language.
 *
 * A FACTORY, not a module-level singleton, and that is load-bearing: the SSR process is shared
 * by every visitor, so a single mutable instance would mean request A calling changeLanguage("ar")
 * could flip the language of request B rendering concurrently. The provider creates one instance
 * per render tree instead (see provider.tsx).
 */
export function createI18n(language: Language = DEFAULT_LANGUAGE): I18nInstance {
  const instance = createInstance();

  instance.use(initReactI18next).init({
    lng: language,
    // Missing or empty Arabic keys fall through to the English string rather than rendering the
    // raw key — a half-translated screen stays usable.
    fallbackLng: DEFAULT_LANGUAGE,
    fallbackNS: DEFAULT_NAMESPACE,
    supportedLngs: ["en", "ar"],
    ns: NAMESPACES,
    defaultNS: DEFAULT_NAMESPACE,
    resources,
    // React already escapes everything it renders; i18next escaping on top of that turns an
    // apostrophe in "doesn't" into &#39;.
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    react: { useSuspense: false },
    // Quiet in production, loud in dev — a missing key should be a console warning a developer
    // actually sees while building a screen.
    debug: false,
    saveMissing: false,
  });

  return instance;
}
