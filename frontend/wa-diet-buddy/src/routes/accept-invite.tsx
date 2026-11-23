import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { acceptInvite, errorMessage, fetchInviteByToken, type InviteDetails } from "@/lib/team-api";
import { useRoleMeta } from "@/lib/team-mock";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accept invitation — Nutria" }] }),
  component: AcceptInvitePage,
});

// Public page (prompt-125): the person has no account yet, so __root.tsx renders this outside the
// authenticated shell exactly as it does /login.
function AcceptInvitePage() {
  const { t } = useTranslation(["auth", "nav"]);
  const roleMeta = useRoleMeta();
  const router = useRouter();
  const { adoptSession } = useAuth();

  // Read the token from the query string directly rather than through a typed search schema —
  // this route has no validated search params and the value is opaque to the client anyway.
  const [token] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("token") ?? ""),
  );

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError(t("auth:invite.missingToken"));
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchInviteByToken(token)
      .then((d) => {
        if (cancelled) return;
        setInvite(d);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // The backend returns one generic 404 for invalid / expired / used / revoked, on purpose
        // (it refuses to confirm whether a guessed token was ever real). So this message cannot
        // say which it was, and deliberately doesn't guess.
        setLoadError(errorMessage(err, t("auth:invite.invalidLink")));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    !submitting && name.trim().length > 0 && password.length >= 8 && password === confirm;

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await acceptInvite({ token, name: name.trim(), password });
      // Same storage path login uses, so there is one definition of "signed in".
      adoptSession(result.token, result.user);
      router.navigate({ to: "/" });
    } catch (err) {
      setSubmitError(errorMessage(err, t("auth:invite.failed")));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight">{t("nav:brand")}</p>
            <p className="text-[11px] text-muted-foreground">{t("nav:brandTagline")}</p>
          </div>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth:invite.checking")}
            </div>
          ) : loadError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">
                    {t("auth:invite.notValidTitle")}
                  </p>
                  <p className="text-xs text-amber-800">{loadError}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("auth:invite.expiryHelp")}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.navigate({ to: "/login" })}
              >
                {t("auth:invite.goToSignIn")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-lg font-semibold">{t("auth:invite.joinTitle")}</h1>
                {/* Four COMPLETE sentences rather than the previous fragment concatenation.
                    Gluing "X invited you" + " as role" + ". Choose a password" works in English
                    only by accident of word order — in Arabic the role phrase and the verb do
                    not sit in those positions, so each combination needs its own whole string.
                    The role is shown through roleMeta so it reads "Dietitian", not "dietitian". */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {invite?.invitedByName
                    ? invite?.roleName
                      ? t("auth:invite.introNamedRole", {
                          name: invite.invitedByName,
                          role: roleMeta(invite.roleName).label,
                        })
                      : t("auth:invite.introNamed", { name: invite.invitedByName })
                    : invite?.roleName
                      ? t("auth:invite.introRole", { role: roleMeta(invite.roleName).label })
                      : t("auth:invite.intro")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{t("auth:invite.email")}</Label>
                {/* Read-only: the address is what the invite was issued for, and letting it be
                    edited would mean the account created no longer matches what was approved. */}
                <Input id="invite-email" value={invite?.email ?? ""} readOnly disabled dir="ltr" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-name">{t("auth:invite.name")}</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth:invite.namePlaceholder")}
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-password">{t("auth:invite.password")}</Label>
                <PasswordInput
                  id="invite-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth:invite.passwordPlaceholder")}
                  disabled={submitting}
                />
                {passwordTooShort && (
                  <p className="text-[11px] text-rose-600">{t("auth:invite.passwordTooShort")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">{t("auth:invite.confirm")}</Label>
                <PasswordInput
                  id="invite-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) submit();
                  }}
                  disabled={submitting}
                />
                {mismatch && (
                  <p className="text-[11px] text-rose-600">{t("auth:invite.mismatch")}</p>
                )}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <p className="text-xs text-rose-900">{submitError}</p>
                </div>
              )}

              <Button className="w-full gap-2" onClick={submit} disabled={!canSubmit}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitting ? t("auth:invite.submitting") : t("auth:invite.submit")}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
