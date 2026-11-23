import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { useRoleMeta } from "@/lib/team-mock";
import { useLanguage } from "@/lib/i18n/provider";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  MessageSquare,
  Database,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  Wallet,
  Globe,
  Shield,
  Settings,
  CalendarClock,
  Stethoscope,
  Layers,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// `permission` gates the item (prompt-125). Items without one are visible to anyone signed in,
// which is every item that existed before this — the sidebar had no gating at all, so Team &
// Access was offered to every role and only 403'd once you clicked into it.
//
// `titleKey` is a key into the `nav` namespace rather than a literal, so these module-level
// arrays stay plain data and are not rebuilt on every language change.
type NavItem = {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
};

const overview: NavItem[] = [{ titleKey: "items.overview", url: "/", icon: LayoutDashboard }];

const practice: NavItem[] = [
  { titleKey: "items.clients", url: "/clients", icon: Users },
  { titleKey: "items.leads", url: "/leads", icon: UserPlus },
  { titleKey: "items.messages", url: "/messages", icon: MessageSquare },
  { titleKey: "items.appointments", url: "/appointments", icon: CalendarClock },
];

const nutrition: NavItem[] = [
  { titleKey: "items.mealPlans", url: "/meal-plans", icon: CalendarDays },
  { titleKey: "items.mealTemplates", url: "/meal-plan-templates", icon: Layers },
  { titleKey: "items.mealLibrary", url: "/meal-library", icon: BookOpen },
  { titleKey: "items.foodDatabase", url: "/food-database", icon: Database },
  // { titleKey: "items.intakeForms", url: "/intake-forms", icon: FileText }, // hidden — not built yet
];

const operations: NavItem[] = [
  { titleKey: "items.journalReview", url: "/journal", icon: ClipboardCheck },
  { titleKey: "items.reports", url: "/reports", icon: FileBarChart },
  { titleKey: "items.billing", url: "/billing", icon: Wallet },
];

const admin: NavItem[] = [
  { titleKey: "items.cms", url: "/cms", icon: Globe },
  { titleKey: "items.team", url: "/team", icon: Shield, permission: "users.read" },
  { titleKey: "items.settings", url: "/settings", icon: Settings },
];

const groups: { labelKey: string; items: NavItem[] }[] = [
  { labelKey: "", items: overview },
  { labelKey: "groups.practice", items: practice },
  { labelKey: "groups.nutrition", items: nutrition },
  { labelKey: "groups.operations", items: operations },
  { labelKey: "groups.admin", items: admin },
];

export function AppSidebar() {
  const { t } = useTranslation("nav");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const { can, user } = useAuth();
  const { dir } = useLanguage();
  const roleMeta = useRoleMeta();
  // The footer card used to be a hardcoded "Sura Hawli / Lead Dietitian" for everyone. It now shows
  // whoever is actually signed in, with the role they hold.
  const displayName = user?.name?.trim() || user?.email || t("signedIn");
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  // Drop items this user cannot use, then drop groups that end up empty — otherwise hiding the
  // only item in a group leaves its heading floating above nothing.
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    // Flipping `side` rather than rewriting ui/sidebar.tsx's physical classes: the primitive
    // already has a complete, tested right-hand variant (fixed positioning, the collapse
    // offset, the border side, and the mobile Sheet's slide direction all key off `side`).
    // Converting its `left-0`/`-left-…` to logical properties would instead mean maintaining a
    // second implementation of something shadcn already ships.
    <Sidebar collapsible="icon" side={dir === "rtl" ? "right" : "left"}>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <Stethoscope className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            {/* The product name is a proper noun — it stays "Nutria" in both languages. */}
            <span className="font-display text-base font-semibold tracking-tight">
              {t("brand")}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("brandTagline")}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group, idx) => (
          <SidebarGroup key={idx}>
            {group.labelKey && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {t(group.labelKey)}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={t(item.titleKey)}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            {/* The signed-in person's own name is user data — never translated. */}
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="text-[11px] text-muted-foreground">
              {roleMeta(user?.role?.name).label}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
