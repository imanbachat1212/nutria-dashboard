# CLAUDE.md — Backend Conventions

## Stack
- Node.js 20+, ES modules (import/export), async/await
- Express, MongoDB via Mongoose, JWT auth, Zod validation
- Cloudinary for image storage (never store binary in MongoDB)
- multer for file uploads

## Monorepo
- `/frontend` — React app (DO NOT MODIFY)
- `/backend` — this project

## Folder structure
```
src/
  config/         db.js, env.js
  app.js          Express app (middleware, routes, error handler)
  server.js       Connect DB + listen
  middleware/     auth.js, rbac.js, validate.js, audit.js, error.js
  lib/            ApiError.js, asyncHandler.js, phone.js, storage.js, imageSchema.js
  lib/calc/       targets.js, adherence.js, projection.js
  modules/        One folder per feature module
  routes/index.js Mounts all module routes under /api
  jobs/           Future cron/worker jobs
```

## Architecture rules

### Request flow
route → [auth → rbac → validate → audit] → controller → service → model

### Separation of concerns
- **Models**: schema + indexes only.
- **Services**: ALL business logic. Take plain arguments `(data, actor)` — NEVER `req`/`res`.
  This keeps services callable from controllers, automation, jobs, and webhooks.
- **Controllers**: thin — parse request, call service, send response. Wrapped in `asyncHandler`.
- **Routes**: middleware chain only — no logic.
- **Validation**: Zod schemas in `*.validation.js`. Wrapped via `validate(schema)` middleware
  which puts parsed data on `req.validated`.

### Module structure
Each module folder contains:
- `*.model.js` — Mongoose model(s)
- `*.routes.js` — Express router
- `*.controller.js` — thin controller functions
- `*.service.js` — business logic
- `*.validation.js` — Zod schemas
- Optional: `*.serializer.js` for response shaping

## Cross-cutting middleware

### auth.js
Dual-path authentication:
- `Authorization: Bearer <jwt>` → looks up user, populates `req.user` with `{ _id, email, name, role, permissions }`
- `x-api-key: <key>` → matches `SERVICE_API_KEY` env → synthetic `{ role: "automation", permissions: ["*"] }`

### rbac.js
`requirePermission("clients.update")` checks `req.user.permissions` array.
Wildcard `"*"` grants all permissions (used by automation role).

### audit.js
`auditAction(action, entity)` logs create/update/delete to `audit_log` collection.
`captureBeforeState(loader)` snapshots pre-update state for diff auditing.

### error.js
Central error handler. Catches `ApiError` instances and returns structured JSON.
Non-ApiError exceptions → 500.

## Data-model rules
- All cross-collection references use MongoDB ObjectId refs. NEVER link by phone.
- `clients.phone` is top-level, UNIQUE + INDEXED — the WhatsApp lookup key.
- `clients.profile` block: firstName, lastName, email, dateOfBirth, sex, height, weight,
  startWeight, goalWeight, activityLevel (enum), goal (enum), occupation, sleepHours,
  waterIntake, dietaryPreferences ([String]), allergies ([String]), intolerances ([String]),
  foodsToAvoid ([String]).
- `clients.targets` block (auto-computed server-side): { method: "auto"|"manual", bmr, tee,
  calories, protein, carbs, fat, fiber }. Computed via `lib/calc/targets.js` on create and
  on profile updates. If `method === "manual"`, auto-recompute is skipped.
- `clients.clinical` block is permission-gated:
  - `client.serializer.js` strips it if user lacks `clients.clinical.read`
  - `guardClinicalWrite()` rejects writes without `clients.clinical.write`
  - labs include a `reference` field (reference range string)
- `source` enum `(dashboard|whatsapp|automation)` on: journal_entries, leads, messages.

## Image / file storage
- Never store binary images in MongoDB.
- Use `src/lib/storage.js` → Cloudinary. Interface: `uploadImage(buffer, folder)` → `{ url, key, width, height }`, `deleteImage(key)`.
- Reusable embedded `imageSchema` in `src/lib/imageSchema.js` — `{ url, key, width, height }` (no _id).
- Used on: clients (photo), meals (photos — array, see below), foods (image), journal_entries (photo), cms_blocks (image).
- `media` module: `POST /api/media` accepts a single image via multer, calls `storage.uploadImage`.
  Multi-image upload (e.g. meals) is just calling `uploadImage`/`deleteImage` once per file —
  their signatures are single-file only, on purpose.
- When deleting a record with an image, call `storage.deleteImage(key)` in the service.
- WhatsApp meal photos: uploaded by n8n directly to storage; n8n posts the journal entry with the image URL already set.
- Env: `CLOUDINARY_URL` (optional — server starts without it).

### `meals.photos` migration pattern (single `photo` → array)
`Meal.photo` (single embedded `imageSchema`) was migrated to `Meal.photos` (array;
`photos[0]` is the cover shown on the card/grid). This was a **read-time normalization, not a
DB backfill** — old documents still physically have the legacy single `photo` field in Mongo.
`meals.service.js`'s `listMeals`/`getMealById` normalize `photo` → `photos: [photo]` on the way
out; `deleteMeal` checks both shapes (via `.lean()`, since a hydrated Mongoose document hides
fields the current schema doesn't declare) so legacy images still get cleaned up from storage.
Any future code that reads meal photos directly (bypassing this service layer) must handle both
shapes defensively — don't assume `photos` is always present/array-shaped on a raw document.

## Automation-readiness
- `modules/webhooks` — thin controllers that receive inbound payloads and ONLY call existing services.
- `modules/outbox` — outbound messages are written here for n8n to poll and send. Never call messaging providers directly from the backend.

## Module → entity ownership
- users → User, Role, Permission, Invite
- audit → AuditLog
- intake → IntakeForm, IntakeSubmission
- clients → Client, ClientNote
- mealplans → MealPlan, MealPlanBlock
- gym → Workout, Booking
- billing → Invoice, Payment
- automation → Automation, AutomationRun
- cms → CmsPage, CmsBlock, CmsTranslation
- All other modules own a single entity matching their name.

## Roles (seeded)
- `dietitian` — all permissions
- `assistant` — all permissions EXCEPT `clients.clinical.*`

## Conventions for new modules
1. Create folder under `src/modules/<name>/`
2. Add model, routes, controller, service, validation files
3. Register routes in `src/routes/index.js`
4. Add permission keys to seed.js and to both roles as appropriate
5. Follow the request flow: route → auth → rbac → validate → audit → controller → service → model

## lib/calc
- `targets.js` — BMR via Mifflin-St Jeor, TEE = BMR × activity factor (1.2–1.9), macro split
- `adherence.js` — stub (plan-vs-actual adherence metrics)
- `projection.js` — stub (weight/body-composition trend projection)

## lib/phone.js
Normalizes phone numbers to canonical format (strips non-digits, adds `+` prefix).

## Scripts
- `npm run dev` — nodemon
- `npm start` — production
- `npm run seed` — seed permissions, roles, admin user
