import { Link, useRouterState } from "@tanstack/react-router";
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

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const overview: NavItem[] = [{ title: "Overview", url: "/", icon: LayoutDashboard }];

const practice: NavItem[] = [
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Leads", url: "/leads", icon: UserPlus },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Appointments", url: "/appointments", icon: CalendarClock },
];

const nutrition: NavItem[] = [
  { title: "Meal Plans", url: "/meal-plans", icon: CalendarDays },
  { title: "Meal Library", url: "/meal-library", icon: BookOpen },
  { title: "Food Database", url: "/food-database", icon: Database },
  // { title: "Intake Forms", url: "/intake-forms", icon: FileText }, // hidden — not built yet
];

const operations: NavItem[] = [
  { title: "Journal Review", url: "/journal", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Billing", url: "/billing", icon: Wallet },
];

const admin: NavItem[] = [
  { title: "Website / CMS", url: "/cms", icon: Globe },
  { title: "Team & Access", url: "/team", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

const groups: { label: string; items: NavItem[] }[] = [
  { label: "", items: overview },
  { label: "Practice", items: practice },
  { label: "Nutrition", items: nutrition },
  { label: "Operations", items: operations },
  { label: "Admin", items: admin },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <Stethoscope className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-base font-semibold tracking-tight">Nutria</span>
            <span className="text-[11px] text-muted-foreground">Dietitian dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, idx) => (
          <SidebarGroup key={idx}>
            {group.label && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
            LD
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Sura Hawli</span>
            <span className="text-[11px] text-muted-foreground">Lead Dietitian</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
