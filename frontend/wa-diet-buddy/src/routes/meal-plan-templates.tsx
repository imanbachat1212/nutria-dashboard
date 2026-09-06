import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route only — mirrors clients.tsx exactly. Its actual content lives in the nested
// meal-plan-templates.index.tsx (list) and meal-plan-templates.$templateId.tsx (per-template
// editor) files. This file previously held the list page's own content directly, which meant
// meal-plan-templates.$templateId.tsx — nested under this route per TanStack Router's file-based
// convention — had nowhere to render: the URL changed on navigation, but this component (with no
// <Outlet/>) just kept showing the list underneath, since it was the only thing actually mounted.
// That was the real root cause of "New template"/pencil-icon navigation silently going nowhere.
export const Route = createFileRoute("/meal-plan-templates")({
  component: () => <Outlet />,
});
