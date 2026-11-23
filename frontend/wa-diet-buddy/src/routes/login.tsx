import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation(["auth", "nav"]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      // The server's message is shown as the server sends it (English for now) — only our own
      // fallback for a non-Error throw is localised.
      setError(err instanceof Error ? err.message : t("auth:login.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/70 shadow-soft">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("nav:brand")}
          </CardTitle>
          <CardDescription>{t("auth:login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth:login.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nutri.app"
                required
                autoFocus
                // An email address is a Latin token: forced LTR so it is not right-aligned and
                // re-ordered around the "@" when the page is Arabic.
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth:login.password")}</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth:login.passwordPlaceholder")}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth:login.submitting") : t("auth:login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
