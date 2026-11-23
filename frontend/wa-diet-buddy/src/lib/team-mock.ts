// Team & Access display helpers.
//
// prompt-125 made this page real: TEAM_MEMBERS, PENDING_INVITES, ACCESS_LOGS, ROLE_PERMISSIONS,
// PERMISSION_GROUPS and PermissionKey are GONE. The first three were arrays the page loaded into
// useState, so inviting or suspending someone rearranged the screen and saved nothing. The last
// three described eleven permissions — clients.view, plans.publish and friends — that exist
// nowhere in the backend; the real registry is `resource.action` keys served by GET /api/roles.
//
// What remains is purely presentational: colours, labels and date formatting. Data now comes from
// src/lib/team-api.ts.
//
// LOCALISATION: the label and description text moved out of this file into the `team` namespace
// (locales/*/team.json) and is reached through hooks. The ROLE NAMES themselves — "owner",
// "dietitian", … — are API values and stay English: they are compared against role.name coming
// off the backend, so translating them would break every lookup on the page.

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useFormatters, useRelativeTime } from "@/lib/i18n/format";

export type MemberStatus = "active" | "suspended";

/**
 * Badge colours, keyed by ROLE NAME as the backend spells it. A role added server-side needs no
 * change here — the hooks below fall back for anything unknown rather than rendering undefined.
 */
export const ROLE_STYLES: Record<string, string> = {
  owner: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  dietitian: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  intern: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  reception: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  accountant: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  // The retired role. Still listed so an install that hasn't run the migration yet renders it
  // with a label instead of a blank badge.
  assistant: "bg-slate-500/10 text-slate-700 border-slate-500/20",
};

const FALLBACK_CLS = "bg-slate-500/10 text-slate-700 border-slate-500/20";

export type RoleMeta = { label: string; cls: string; description: string };

/**
 * `roleMeta(name)` with the text localised.
 *
 * Returns a stable callback so it can sit in a dependency array. An unknown role name is shown
 * verbatim (it came from the backend and is more useful than "Unknown") with no description.
 */
export function useRoleMeta(): (name: string | null | undefined) => RoleMeta {
  const { t } = useTranslation("team");

  return useCallback(
    (name: string | null | undefined): RoleMeta => {
      if (!name) return { label: t("roles.unknown"), cls: FALLBACK_CLS, description: "" };
      const known = name in ROLE_STYLES;
      return {
        label: known ? t(`roles.${name}.label`) : name,
        cls: ROLE_STYLES[name] ?? FALLBACK_CLS,
        description: known ? t(`roles.${name}.description`) : "",
      };
    },
    [t],
  );
}

export function useStatusStyles(): Record<MemberStatus, { label: string; cls: string }> {
  const { t } = useTranslation("team");

  return useMemo(
    () => ({
      active: {
        label: t("status.active"),
        cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      },
      suspended: { label: t("status.suspended"), cls: FALLBACK_CLS },
    }),
    [t],
  );
}

/**
 * Relative and absolute dates for the Team page.
 *
 * Previously two module-level functions with `"en-US"` hardcoded into toLocaleDateString, which
 * would have kept these two columns English on an otherwise Arabic page. They are hooks now so
 * they can see the active language; the relative buckets come from the `common` namespace's
 * plural forms, which is what makes "منذ يومين" (dual) possible at all.
 */
export function useTeamDates() {
  const fmt = useFormatters();
  const relative = useRelativeTime("date");

  const date = useCallback(
    (iso: string): string =>
      fmt.date(iso, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    [fmt],
  );

  return useMemo(() => ({ relative, date }), [relative, date]);
}
