# Nutria — Deferred Work & Automation TODO

> Tag legend: **AUTOMATION** = will be driven by WhatsApp/n8n when that phase starts.
> Update this file whenever something is deliberately deferred — one entry per item, under
> the relevant page/module.

---

## Meal Plans

- [ ] **Adherence %** — always 0 in the stat card and plan cards. Needs the Journal module
      (actual eaten vs planned) to compute. Formula lives in `backend/src/lib/calc/adherence.js`
      (stub). **AUTOMATION:** fed by WhatsApp meal-photo logging.
- [ ] **Templates** — hidden (button + panel commented out in `meal-plans.tsx`). Mock data
      (`PLAN_TEMPLATES`) and UI code preserved. Build when there's demand; duplicate covers
      most of the use case for now.
- [ ] **Meal-slot ⋯ menu** — the `MoreHorizontal` button on each slot card does nothing.
      Planned actions: edit slot time, rename slot, clear slot.
- [ ] **Copy day ↔ paste** — Copy day Popover replaces target-day items; no undo. Add undo
      or at least a confirmation step before overwriting.
- [ ] **"Send to client" button** — placeholder in the plan header. **AUTOMATION:** real
      WhatsApp send via outbox module (write to `outbox` collection for n8n to pick up).
- [ ] **Add custom meal slot** — the "＋ Add custom meal slot" button is unwired.
- [ ] **Plan sharing state** — `sharedVia` field exists on the model but is never set.
      Update on send.
- [ ] **Ended plan editing** — items can still be added/removed on Ended plans (no guard).
      Consider blocking writes when `status === "ended"`.

---

## Client Detail (`/clients/:id`)

- [ ] **"New plan" button** (header) — opens nothing. Wire to pre-fill the New Plan dialog
      with this client selected.
- [ ] **"Assign plan" button** (Plans tab) — wire to the New Plan dialog or a plan-picker.
- [ ] **"⋯" three-dot menu** (header) — no actions. Needs: Edit client, Archive, Delete.
- [ ] **"WhatsApp" button** (header) — placeholder. **AUTOMATION:** opens a compose UI that
      writes to the outbox collection for n8n to send.
- [ ] **"Edit targets" button** (Goals tab) — does nothing. Wire to `PATCH /api/clients/:id`
      with `targets.method = "manual"`.
- [ ] **"Add" on Lab values** (Clinical tab) — unwired. Needs `POST /api/clients/:id/labs`
      or extend the clinical PATCH endpoint.
- [ ] **"Add note" button** (ADIME notes) — wire to `POST /api/clients/:id/notes` (endpoint
      already exists; dialog not built).
- [ ] **Journal tab** — shows "Logs from WhatsApp will appear here automatically." No journal
      entries yet. **AUTOMATION:** populated by WhatsApp meal-photo webhook → journal module.
- [ ] **Plans tab** — shows `plans: []` (zero plans). Wire to
      `GET /api/mealplans?client=:id` so the client's real plans appear.
- [ ] **Payments tab / outstanding balance** — hardcoded to 0. Needs billing module.
- [ ] **Files tab** — empty. Needs media/file upload UI.

---

## Meal Library (Recipes)

- [ ] **Recipe photo upload** — `uploadMedia()` is wired in the dialog but Cloudinary is
      geo-blocked and no fallback provider is set up. `storage.js` is provider-agnostic;
      swap `CLOUDINARY_URL` for R2/S3/etc when ready.
- [ ] **Unit conversion for non-gram units** — `cup`, `tbsp`, `piece` in recipe ingredients
      fall back to rough gram weights. Needs per-food gram-weight table. `TODO` comments in
      `backend/src/lib/calc/recipeMacros.js` (lines 10 and 37) and
      `frontend/src/components/new-recipe-dialog.tsx` (line 72).
- [ ] **`rating`, `usedInPlans`, `lastUsed`, `author`, `isFavorite`** — all hardcoded to
      defaults in `meals-api.ts:toRecipe()`. Wire `usedInPlans` / `lastUsed` once the
      mealplans module can report which recipes appear in active plans.

---

## Foods

- [ ] **Unit conversion / per-food gram weights** — same issue as Meal Library. Non-gram
      serving units (cup, tbsp, piece) have no conversion table; macros are approximated.
- [ ] **`usedInPlans`, `lastUsed`, `isFavorite`** — hardcoded in `foods-api.ts:toFoodItem()`.

---

## Journal (`/journal`) — AUTOMATION scope

> The dashboard (manual) path is **built and live**. The items below are deferred until the
> WhatsApp/n8n integration phase. Do NOT wire the frontend Journal Review page to real data
> until all of these are in place.

- [ ] **WhatsApp webhook** — `POST /api/webhooks/whatsapp` (module stub exists). Receives
      inbound Green API payloads, routes text to Groq text parser and photos to Groq vision.
      // AUTOMATION: entry point in `modules/webhooks/webhooks.controller.js`
- [ ] **n8n → Groq pipeline** — n8n workflow intercepts the webhook, calls Groq
      (text or vision model), receives structured JSON: `{ items, confidence, flags }`.
- [ ] **Groq output → journal entry** — n8n calls `POST /api/journal` with `source:
      "whatsapp-text"` or `"whatsapp-photo"`, `confidence`, `flags`, and pre-computed
      `macros` on each item (Groq-estimated). Auth via `x-api-key` header (dual-path auth
      already supports this — no backend change needed).
      // AUTOMATION: seam in `journal.service.js:createEntry()` — source check already
      // preserves confidence/flags for non-dashboard entries.
- [ ] **Confidence mapping** — map Groq score to `"high"` / `"medium"` / `"low"`. Set
      `status: "pending"` when confidence is `"medium"` or `"low"`.
- [ ] **Flag detection** — portion uncertainty → push `"portion-uncertain"` to `flags[]`.
      Other flags (`"macro-outlier"`, `"off-plan"`, `"duplicate"`) require comparing against
      the client's active plan and recent entries.
- [ ] **Open decision (flag for Iman before building):** should `confidence` be a single
      score per entry, or per-item (e.g. separate confidence for food ID vs. portion size)?
      The schema currently stores one value per entry. Decide before starting Groq integration.
- [ ] **Frontend Journal Review page** — currently on `journal-mock.ts`; do NOT switch to
      real API until the items above are done. When ready:
      - Approve/Edit/Reject actions call `PATCH /api/journal/:id` (endpoint already exists)
      - "Approve all clean" loops the same endpoint
      - Stat cards (Pending/Flagged/Low confidence/Approved today) are simple counts
        filtered from `GET /api/journal` by `status` + `confidence` — no new backend logic

---

## Leads (`/leads`)

- [ ] **Entire page is mock** — uses `leads-mock.ts`. Backend `leads` module is a stub.
      Build: model (`source` enum: whatsapp/instagram/website/dashboard/automation), CRUD
      endpoints, then replace the page. **AUTOMATION:** WhatsApp contacts → leads via webhook.
- [ ] **"Convert to client" action** — shown in the UI, not wired.
- [ ] **Lead source "automation"** — `source` enum value reserved for n8n-created leads.

---

## Appointments (`/appointments`)

- [ ] **Entire page is mock** — uses `appointments-mock.ts`. Backend module is a stub.
      Build: model (client ref, dateTime, type, status), CRUD endpoints, then replace.
- [ ] **Calendar integration** — calendar shows current-date mock data. Real integration
      needs appointments CRUD + recurring-event support.
- [ ] **Booking requests panel** — mock data; wire to leads or a separate `booking_requests`
      collection. **AUTOMATION:** WhatsApp "I want to book" → booking request.

---

## Gym (`/gym`)

- [ ] **Entire page is mock** — uses `gym-mock.ts`. Backend module is a stub.
      Build: booking model (client ref, dateTime, trainer ref), CRUD, capacity enforcement
      (max 4 clients/hour already in the dialog UI).

---

## Messages (`/messages`)

- [ ] **Entire page is mock** — uses `messages-mock.ts`. Backend module is a stub.
      **AUTOMATION:** core of the WhatsApp phase. The `outbox` + `messages` modules handle
      outbound queuing (n8n polls outbox) and inbound logging (webhook → messages).

---

## Journal (`/journal`) — dashboard path built

- [x] **Backend module** — model, service, controller, validation, routes all implemented.
      `POST /GET /PATCH /DELETE /api/journal`. Macros computed server-side from food refs.
- [x] **Frontend mapping layer** — `journal-api.ts` with field reconciliation.
- [x] **New entry dialog** — `new-journal-entry-dialog.tsx`; food search + free-text items,
      live macro preview, client picker.
- [ ] **Frontend Journal Review page** — still on `journal-mock.ts`; intentionally deferred
      until the WhatsApp/Groq pipeline is built (see Journal AUTOMATION section above).
- [ ] **`adherence.js` calc** — stub at `backend/src/lib/calc/adherence.js`. Implement
      once journal entries exist to compare against plan targets.
- [ ] **Meal Plans adherence stat card** — shows 0%; needs journal entries + adherence calc.

---

## Billing (`/billing`)

- [ ] **Entire page is mock** — uses `billing-mock.ts`. Backend stub.
      Build: Invoice + Payment models, CRUD, PDF export.

---

## Reports (`/reports`)

- [ ] **Entire page is mock** — uses `reports-mock.ts`. Backend stub.
      Build after Journal + Billing data exists.
- [ ] **`projection.js` calc** — stub at `backend/src/lib/calc/projection.js`. Weight/body-
      composition trend projection; implement once Journal has enough data points.

---

## Intake Forms (`/intake-forms`)

- [ ] **Hidden from nav for now** — build later (client intake questionnaire → creates/updates
      client profile). Route file and component preserved; link commented out in `app-sidebar.tsx`.
- [ ] **Entire page is mock** — uses `intake-mock.ts`. Backend stub.
      Build: `IntakeForm` + `IntakeSubmission` models, public submission URL, PDF export.
      **AUTOMATION:** link sent via WhatsApp to new leads.

---

## CMS (`/cms`) — Pages tab built

- [x] **Pages tab** — `CmsPage` model with embedded bilingual blocks (EN + AR), full CRUD,
      publish/unpublish/schedule endpoints. Block editor wired with React Query. French removed.
- [ ] **Blog tab** — still on `BLOG_POSTS` mock. Build: BlogPost model + CRUD endpoints.
- [ ] **Services tab** — still on `SERVICES` mock. Build: ServiceCard model + CRUD.
- [ ] **Testimonials tab** — still on `TESTIMONIALS` mock. Build: Testimonial model + CRUD.
- [ ] **Image blocks** — `type: "image"` blocks are placeholder-only (no `src` field yet).
      Deferred until Cloudflare R2 / S3 storage is wired up. The block shape is already
      defined in the schema — add `src: imageSchema` when storage is ready.
- [ ] **views30d analytics** — stored as a plain number, not derived from real traffic.
      Wire to Plausible / GA4 / Vercel Analytics when the public site is live.
      **AUTOMATION:** analytics could push daily counts via a cron/webhook.
- [ ] **"Publish changes" button** (site-wide deploy trigger) — currently does nothing.
      Wire to a deployment webhook (Vercel, Netlify, etc.) when the public site build is set up.
- [x] **Public-facing render layer** — `/frontend/nutria-public` SPA built. Vite + React,
      Tailwind, React Router. Fetches `/api/public/pages` (nav) and `/api/public/pages/:slug`
      (content). Renders all 6 block types with EN/AR language toggle and RTL support.
- [x] **Public API** — `GET /api/public/pages` + `GET /api/public/pages/:slug*`, no auth,
      no RBAC, published-only, strips internal fields. Mounted at `/api/public`.
- [ ] **DEPLOY BLOCKER — backend hosting** — the backend is localhost:4000 only. The Netlify
      site CANNOT fetch live data until the backend is deployed to a cloud host. Options:
      Render / Railway / Fly.io / your own VPS. Once deployed, set `VITE_API_URL` in the
      Netlify dashboard to the backend's public URL (e.g. `https://api.nutria.health`).
      `netlify.toml` is ready at `/frontend/nutria-public/netlify.toml`.
- [ ] **CORS for production** — add `https://nutria.health` (and the Netlify preview URL)
      to `CORS_ORIGINS` env var on the backend. The public router already sends
      `Access-Control-Allow-Origin: *`, so this only matters for dashboard API calls from
      the production Netlify domain.
- [ ] **"Publish changes" button** — wire to a Netlify deploy hook webhook so publishing a
      CMS page also triggers a redeploy of the public site.
      **AUTOMATION:** CMS content can be pushed to WhatsApp broadcast lists.

---

## Team (`/team`)

- [ ] **Entire page is mock** — users exist in the DB (`users` module is real), but the
      `/team` page reads from mock data. Wire to `GET /api/users`.

---

## Automation (`/automation`)

- [ ] **Placeholder page** — renders `<PlaceholderPage>`. The `automation` backend module
      is a stub. This is the control panel for n8n flows. **AUTOMATION:** entire page.

---

## Settings (`/settings`)

- [ ] **Clinic profile, notification preferences, integrations** — UI exists but nothing
      is persisted. Wire to `PATCH /api/settings` (stub) or `PATCH /api/users/:id`.

---

## Backend Stubs (no routes implemented yet)

These modules have models but only stub routes/services/controllers:

| Module | Model(s) | Priority |
|---|---|---|
| `leads` | Lead | High — needed before WhatsApp phase |
| `journal` | JournalEntry | High — adherence + WhatsApp logging |
| `appointments` | Appointment | Medium |
| `messages` | Message | High — core WhatsApp phase |
| `outbox` | OutboxMessage | High — WhatsApp send queue for n8n |
| `webhooks` | (delegates to services) | High — inbound WhatsApp events |
| `gym` | Workout, Booking | Medium |
| `billing` | Invoice, Payment | Medium |
| `intake` | IntakeForm, IntakeSubmission | Medium |
| `reports` | (aggregations) | Low — needs data first |
| `automation` | Automation, AutomationRun | High — WhatsApp phase |
| `audit` | AuditLog | Low — infrastructure |
| `cms` | CmsPage, CmsBlock | Low |
| `settings` | (config) | Low |

---

## Infrastructure / Cross-cutting

- [ ] **Image storage provider** — Cloudinary geo-blocked. `storage.js` is provider-agnostic
      (`uploadImage` / `deleteImage`). Swap `CLOUDINARY_URL` for Cloudflare R2 or AWS S3
      when a provider is set up. Affects: client photos, meal/recipe photos, food images,
      journal entry photos.
- [ ] **PDF export won't run on Render** — `mealplans.service.js` launches Chrome via
      `puppeteer-core` for meal-plan PDF export. `CHROME_PATH` now flows through
      `env.js` (optional, defaults to `""`), but the code's fallback is a macOS-only
      binary path — there is no Chrome/Chromium binary on Render's Linux containers at
      all, so setting `CHROME_PATH` alone won't fix it in production. Real fix: either
      (a) swap `puppeteer-core` for a serverless-friendly Chromium package (e.g.
      `@sparticuz/chromium` + `puppeteer-core` pointed at its bundled binary — the
      standard approach for AWS Lambda/Render-style containers), or (b) use a Render
      buildpack/Docker base image that ships Chromium and set `CHROME_PATH` to that
      binary's path. Known gap, not fixed yet — PDF export will 500 in production
      until one of these lands.
- [ ] **WhatsApp / n8n phase** — the `outbox` module is the send queue; the `webhooks`
      module is the receive point. Both are stubs. When this phase starts, implement:
      1. `webhooks` controller calls existing services (journal, leads, messages).
      2. `outbox` is polled by n8n; mark messages as sent on acknowledgement.
      3. Wire all **AUTOMATION** items above.
