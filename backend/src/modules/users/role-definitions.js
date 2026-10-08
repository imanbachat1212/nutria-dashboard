// The five team roles and exactly what each one can do (prompt-125).
//
// Single source of truth: seed.js, migrate-team-roles.js and the roles API all read this file, so
// a permission is granted in one place or nowhere. Before this, seed.js built roles inline and
// gave "dietitian" EVERY permission including users.* — which is why every user in the database
// today can administer every other user.
//
// Keys are the real `resource.action` strings from seed.js's PERMISSION_KEYS. The Team page's
// previous 11 invented keys (clients.view, plans.publish, …) existed nowhere in the backend and
// are deliberately not carried over.

// ── Machine-only keys ───────────────────────────────────────────────────────────────────────
//
// Held by the scoped service keys in middleware/auth.js, never by a Role. They are excluded from
// every role below AND rejected by PATCH /api/roles, so the Team page cannot hand a human the
// WhatsApp intake scope by ticking a box. The service keys don't read Role at all, so nothing
// here affects n8n.
export const MACHINE_ONLY_PERMISSIONS = [
  "journal.intake",
  "automation.context.read",
  "automation.messages.write",
  // The Automation entity CRUD. No route enforces these today and no human screen uses them;
  // leaving them unassignable keeps "automation" meaning "the machine side".
  "automation.create",
  "automation.read",
  "automation.update",
  "automation.delete",
];

// ── Human-assignable registry ───────────────────────────────────────────────────────────────
// Grouped by the module they belong to. The roles API returns this so the permission matrix in
// the UI is driven by what the backend actually knows about, not a hardcoded frontend list.
//
// NOTE on reach: several of these gate nothing yet — billing.*, leads.*, intake.*, outbox.read
// and audit.read's module were empty stub routers at the time of writing (audit.read is wired up
// by this same prompt). They are included so roles are already correct when those modules land,
// but granting them today confers nothing. Flagged in the report rather than silently implied.
export const PERMISSION_GROUPS = [
  { module: "clients", label: "Clients", keys: ["clients.create", "clients.read", "clients.update", "clients.delete"] },
  { module: "clinical", label: "Clinical records", keys: ["clients.clinical.read", "clients.clinical.write"] },
  { module: "foods", label: "Food database", keys: ["foods.create", "foods.read", "foods.update", "foods.delete"] },
  { module: "meals", label: "Meal library", keys: ["meals.create", "meals.read", "meals.update", "meals.delete"] },
  { module: "mealplans", label: "Meal plans", keys: ["mealplans.create", "mealplans.read", "mealplans.update", "mealplans.delete"] },
  { module: "mealplantemplates", label: "Plan templates", keys: ["mealplantemplates.create", "mealplantemplates.read", "mealplantemplates.update", "mealplantemplates.delete"] },
  { module: "journal", label: "Journal", keys: ["journal.create", "journal.read", "journal.update", "journal.delete"] },
  { module: "appointments", label: "Appointments", keys: ["appointments.create", "appointments.read", "appointments.update", "appointments.delete"] },
  { module: "messages", label: "Messages", keys: ["messages.create", "messages.read", "messages.update", "messages.delete"] },
  { module: "intake", label: "Intake forms", keys: ["intake.create", "intake.read", "intake.update", "intake.delete"] },
  { module: "leads", label: "Leads", keys: ["leads.create", "leads.read", "leads.update", "leads.delete"] },
  { module: "billing", label: "Billing", keys: ["billing.create", "billing.read", "billing.update", "billing.delete"] },
  { module: "reports", label: "Reports", keys: ["reports.create", "reports.read"] },
  { module: "cms", label: "Website / CMS", keys: ["cms.create", "cms.read", "cms.update", "cms.delete"] },
  { module: "settings", label: "Settings", keys: ["settings.read", "settings.update"] },
  { module: "users", label: "Team & access", keys: ["users.create", "users.read", "users.update", "users.delete"] },
  { module: "audit", label: "Audit log", keys: ["audit.read"] },
  { module: "media", label: "Media uploads", keys: ["media.upload"] },
  { module: "integrations", label: "Integrations", keys: ["webhooks.manage", "outbox.read"] },
];

export const ASSIGNABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.keys);

const all = (...modules) =>
  PERMISSION_GROUPS.filter((g) => modules.includes(g.module)).flatMap((g) => g.keys);

// settings.read is granted to EVERY role on purpose. It is not an administrative permission —
// it backs GET /api/settings/allergies and /dietary-preferences, the shared vocabulary lists the
// client, recipe and food dialogs populate their pills from. Without it those dialogs render
// empty for that role. settings.update, which is the administrative half, stays owner-only.
const BASE = ["settings.read"];

export const ROLE_DEFINITIONS = [
  {
    name: "owner",
    label: "Owner",
    description: "Full access, including team, roles, billing and the audit log.",
    // Every human-assignable permission. Not a wildcard: a literal list means adding a new
    // permission key never silently widens an existing role without someone re-running seed.
    permissions: [...ASSIGNABLE_PERMISSIONS],
  },
  {
    name: "dietitian",
    label: "Dietitian",
    description: "Full clinical and nutrition work. No team administration, no settings changes, no billing writes.",
    permissions: [
      ...all("clients", "clinical", "foods", "meals", "mealplans", "mealplantemplates",
             "journal", "appointments", "messages", "intake", "leads"),
      "reports.read",
      "billing.read",
      "cms.read",
      "media.upload",
      ...BASE,
    ],
  },
  {
    name: "intern",
    label: "Intern",
    description: "Read-only across clinical work, plus drafting meal plans. No clinical records, no deletes, cannot message clients.",
    permissions: [
      "clients.read",
      "foods.read",
      "meals.read",
      "journal.read",
      "appointments.read",
      "messages.read",
      // Drafting is the one thing an intern creates. Deliberately no mealplans.delete.
      "mealplans.create", "mealplans.read", "mealplans.update",
      // Read templates so a draft can start from one — a plan builder that cannot see templates
      // is half a tool. An addition to the brief's list; flagged in the report.
      "mealplantemplates.read",
      ...BASE,
    ],
  },
  {
    name: "reception",
    label: "Reception",
    description: "Front desk: scheduling, intake, leads, and basic client contact. No clinical records.",
    permissions: [
      ...all("appointments", "intake", "leads"),
      "clients.read", "clients.create",
      "messages.read", "messages.create",
      ...BASE,
    ],
  },
  {
    name: "accountant",
    label: "Accountant",
    description: "Billing and reporting only. No clinical records, no nutrition work.",
    permissions: [
      ...all("billing"),
      "reports.read",
      "clients.read",
      ...BASE,
    ],
  },
];

export const ROLE_NAMES = ROLE_DEFINITIONS.map((r) => r.name);

/** The role whose permissions may never be edited and which only an owner may grant. */
export const OWNER_ROLE = "owner";

export function roleDefinition(name) {
  return ROLE_DEFINITIONS.find((r) => r.name === name) || null;
}

/** Keys that are real permissions AND assignable to a human. Used to validate PATCH /api/roles. */
export function isAssignable(key) {
  return ASSIGNABLE_PERMISSIONS.includes(key);
}
