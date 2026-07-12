/**
 * Public API — no authentication, no RBAC, no audit.
 * Only published CMS pages are exposed. Draft and scheduled pages return 404
 * (same response as a nonexistent slug — nothing about their existence leaks).
 *
 * CORS: explicitly open to all origins so nutria.health (Netlify) can fetch
 * without needing the CORS_ORIGINS env var to list the frontend domain.
 */

import { Router } from "express";
import cors from "cors";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ApiError } from "../../lib/ApiError.js";
import { listPublicPages, getPublicPage } from "../cms/cms.service.js";

// strict: true makes trailing slashes significant, so GET /pages/ (home, empty slug)
// is distinct from GET /pages (list).
const router = Router({ strict: true });

// Allow all origins — this is intentionally a public API
router.use(cors({ origin: "*", credentials: false }));

// ── Validation ────────────────────────────────────────────────────────────

const slugSchema = z.string().min(1).regex(/^\//, 'Slug must start with "/"');

// ── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/public/pages
 * List all published pages (slug + title + languages only) for building nav.
 */
router.get(
  "/pages",
  asyncHandler(async (req, res) => {
    const pages = await listPublicPages();
    res.json({ data: pages });
  }),
);

/**
 * GET /api/public/pages?slug=/about
 * Return a single published page with full block content.
 * Query param `slug` must start with "/". Omit param to get the list above.
 *
 * Returns 404 (not 403 or 401) for draft/scheduled pages — intentionally
 * indistinguishable from a nonexistent slug.
 */
router.get(
  "/pages/:slug(*)",
  asyncHandler(async (req, res) => {
    // req.params.slug captures "" for /pages/ (home) and "about" for /pages/about
    const rawSlug = req.params.slug ?? "";
    const slug = `/${rawSlug}`;            // "" → "/" (home),  "about" → "/about"

    const result = slugSchema.safeParse(slug);
    if (!result.success) throw new ApiError(400, "Invalid slug format");

    const page = await getPublicPage(slug);
    if (!page) throw new ApiError(404, "Page not found");
    res.json({ data: page });
  }),
);

export default router;
