import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { acceptInvite, errorMessage, fetchInviteByToken, type InviteDetails } from "@/lib/team-api";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accept invitation — Nutria" }] }),
  component: AcceptInvitePage,
});

// Public page (prompt-125): the person has no account yet, so __root.tsx renders this outside the
// authenticated shell exactly as it does /login.
function AcceptInvitePage() {
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
      setLoadError("This link is missing its invitation code.");
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
        setLoadError(errorMessage(err, "This invitation link is not valid."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      setSubmitError(errorMessage(err, "Could not complete the invitation."));
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
            <p className="font-display text-lg font-semibold tracking-tight">Nutria</p>
            <p className="text-[11px] text-muted-foreground">Dietitian dashboard</p>
          </div>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your invitation…
            </div>
          ) : loadError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">Invitation not valid</p>
                  <p className="text-xs text-amber-800">{loadError}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Invitation links expire after 7 days and can only be used once. They also stop
                working if a newer invitation was sent to the same address. Ask whoever invited you
                to send a fresh one.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.navigate({ to: "/login" })}
              >
                Go to sign in
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-lg font-semibold">Join the team</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invite?.invitedByName
                    ? `${invite.invitedByName} invited you`
                    : "You've been invited"}
                  {invite?.roleName ? ` as ${invite.roleName}` : ""}. Choose a password to finish.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                {/* Read-only: the address is what the invite was issued for, and letting it be
                    edited would mean the account created no longer matches what was approved. */}
                <Input id="invite-email" value={invite?.email ?? ""} readOnly disabled />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Your name</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Hart"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={submitting}
                />
                {passwordTooShort && (
                  <p className="text-[11px] text-rose-600">Use at least 8 characters.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">Confirm password</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) submit();
                  }}
                  disabled={submitting}
                />
                {mismatch && (
                  <p className="text-[11px] text-rose-600">Passwords don&apos;t match.</p>
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
                {submitting ? "Setting up your account…" : "Create account"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
