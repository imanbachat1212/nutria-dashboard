import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AppTopbar() {
  const { t } = useTranslation("nav");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      {/* SidebarTrigger renders its own sr-only "Toggle Sidebar" inside ui/sidebar.tsx. An
          explicit aria-label wins the accessible-name computation, which localises the control
          without giving a shadcn primitive an i18n dependency. */}
      <SidebarTrigger className="-ms-1" aria-label={t("topbar.toggleSidebar")} />
      <Separator orientation="vertical" className="h-5" />

      <div className="ms-auto flex items-center gap-1">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label={t("topbar.notifications")}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
      </div>
    </header>
  );
}
