import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useMatch,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
// Arabic face, bundled the same way as the Latin ones above rather than fetched from Google —
// one less origin to whitelist, and it cannot fail to arrive. Applied only under html[lang=ar]
// (see styles.css), so English rendering is byte-for-byte unchanged.
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/500.css";
import "@fontsource/noto-sans-arabic/600.css";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { DashboardLayout } from "@/components/dashboard-layout";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { dirFor } from "@/lib/i18n/config";
import { detectLanguage } from "@/lib/i18n/detect";
import { I18nProvider, useLanguage } from "@/lib/i18n/provider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nutria — Dietitian Dashboard" },
      { name: "description", content: "WhatsApp-first practice management for dietitians: clients, meal plans, leads, and gym bookings in one place." },
      { name: "author", content: "Nutria" },
      { property: "og:title", content: "Nutria — Dietitian Dashboard" },
      { property: "og:description", content: "WhatsApp-first practice management for dietitians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Resolved from the language cookie, and from the SAME cookie on both sides of hydration (see
  // lib/i18n/detect.ts). That is what makes the first byte of HTML already carry dir="rtl" for
  // an Arabic user instead of painting English and correcting it after JS boots.
  //
  // This component is rendered OUTSIDE the root route match by TanStack (see
  // @tanstack/react-router Match.js), so it has no route context and cannot read the language
  // from React state — hence the direct call, and hence the imperative lang/dir sync in
  // I18nProvider for switches that happen after load.
  const language = detectLanguage();

  return (
    <html lang={language} dir={dirFor(language)}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
        <LocalisedToaster />
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Sonner positions and aligns its toasts from `dir`; it reads the DOM only at mount, so an
 *  in-session language switch needs the prop. */
function LocalisedToaster() {
  const { dir } = useLanguage();
  return <Toaster dir={dir} />;
}

function AuthGate() {
  const { t } = useTranslation("common");
  const { user, loading } = useAuth();
  const router = useRouter();
  const isLoginPage = !!useMatch({ from: "/login", shouldThrow: false });
  // Accepting an invite happens BEFORE the person has an account, so it must render outside the
  // authenticated shell exactly as /login does — otherwise the gate below would bounce the
  // invitee to the login page they cannot yet use (prompt-125).
  const isAcceptInvitePage = !!useMatch({ from: "/accept-invite", shouldThrow: false });
  const isPublicPage = isLoginPage || isAcceptInvitePage;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPage) {
      router.navigate({ to: "/login" });
    }
  }, [user, loading, isPublicPage, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("state.loading")}</p>
      </div>
    );
  }

  if (isPublicPage) {
    return <Outlet />;
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
