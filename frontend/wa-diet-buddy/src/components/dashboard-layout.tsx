import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          <AppTopbar />
          {/* min-w-0: same flexbox min-width:auto fix as SidebarInset itself (see
              ui/sidebar.tsx) — without it, a wide page (e.g. a data table) can still force this
              item wider than available space even with the fix one level up. A plain `div`, not
              `main`, since SidebarInset itself already renders as the page's one `<main>`
              landmark — nesting a second `<main>` inside it is invalid HTML. */}
          <div className="min-w-0 flex-1 p-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
