import CmsPage from "./cms-page.model.js";
import { ApiError } from "../../lib/ApiError.js";

const LIST_PROJECTION = "title slug status scheduledAt languages seoDescription views30d updatedAt createdAt";

export async function createPage(data, actor) {
  await assertSlugFree(data.slug);
  return CmsPage.create({
    title:     data.title,
    slug:      data.slug,
    status:    "draft",
    languages: ["en"],
    blocks:    [],
    views30d:  0,
    createdBy: actor._id,
  });
}

export async function listPages({ status, q } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { slug:  { $regex: q, $options: "i" } },
    ];
  }
  return CmsPage.find(filter).select(LIST_PROJECTION).sort("slug").lean();
}

export async function getPage(id) {
  const page = await CmsPage.findById(id).lean();
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}

export async function updatePage(id, data) {
  if (data.slug) await assertSlugFree(data.slug, id);

  if (data.status === "scheduled") {
    if (!data.scheduledAt) throw new ApiError(400, "scheduledAt is required when status is 'scheduled'");
    const d = new Date(data.scheduledAt);
    if (isNaN(d.getTime())) throw new ApiError(400, "scheduledAt must be a valid date");
  }
  // Clearing scheduled status also clears the date
  if (data.status && data.status !== "scheduled") {
    data.scheduledAt = null;
  }

  const page = await CmsPage.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}

export async function publishPage(id) {
  const page = await CmsPage.findByIdAndUpdate(
    id,
    { status: "published", scheduledAt: null },
    { new: true },
  ).lean();
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}

export async function unpublishPage(id) {
  const page = await CmsPage.findByIdAndUpdate(
    id,
    { status: "draft", scheduledAt: null },
    { new: true },
  ).lean();
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}

export async function schedulePage(id, scheduledAt) {
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) throw new ApiError(400, "scheduledAt must be a valid date");
  if (d <= new Date())     throw new ApiError(400, "scheduledAt must be in the future");
  const page = await CmsPage.findByIdAndUpdate(
    id,
    { status: "scheduled", scheduledAt: d },
    { new: true },
  ).lean();
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}

export async function deletePage(id) {
  const page = await CmsPage.findByIdAndDelete(id);
  if (!page) throw new ApiError(404, "Page not found");
}

// ── Public (unauthenticated) helpers ──────────────────────────────────────

// Strips internal fields and fixes the items[] bleed-through on non-faq blocks.
function serializePublicBlock(block) {
  // faq keeps items[]; every other type should not have it
  if (block.type === "faq") return block;
  const { items: _items, ...rest } = block;
  return rest;
}

function serializePublicPage(page) {
  return {
    title:          page.title,
    slug:           page.slug,
    languages:      page.languages,
    seoDescription: page.seoDescription,
    updatedAt:      page.updatedAt,
    blocks:         (page.blocks || []).map(serializePublicBlock),
  };
}

export async function listPublicPages() {
  const pages = await CmsPage.find({ status: "published" })
    .select("title slug languages")
    .sort("slug")
    .lean();
  return pages.map((p) => ({ slug: p.slug, title: p.title, languages: p.languages }));
}

export async function getPublicPage(slug) {
  const page = await CmsPage.findOne({ slug, status: "published" }).lean();
  if (!page) return null;
  return serializePublicPage(page);
}

async function assertSlugFree(slug, excludeId = null) {
  const filter = { slug };
  if (excludeId) filter._id = { $ne: excludeId };
  const conflict = await CmsPage.findOne(filter).select("_id").lean();
  if (conflict) throw new ApiError(409, `Slug "${slug}" is already in use by another page`);
}
