import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────

// French removed — EN is source language, AR is optional second language
export type Language = "en" | "ar";
export type PageStatus = "published" | "draft" | "scheduled";

export interface BilingualString {
  en: string;
  ar: string | null;
}

export type PageBlockType = "hero" | "heading" | "paragraph" | "image" | "cta" | "faq";

export interface HeroBlock {
  id: string;
  type: "hero";
  heading: BilingualString;
  subheading: BilingualString;
  ctaLabel: BilingualString;
}
export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 2 | 3;
  text: BilingualString;
}
export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  text: BilingualString;
}
export interface ImageBlock {
  id: string;
  type: "image";
  caption: BilingualString;
  alt: BilingualString;
}
export interface CtaBlock {
  id: string;
  type: "cta";
  label: BilingualString;
  href: string;
  variant: "primary" | "outline";
}
export interface FaqBlock {
  id: string;
  type: "faq";
  items: { q: BilingualString; a: BilingualString }[];
}
export type PageBlock =
  | HeroBlock
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | CtaBlock
  | FaqBlock;

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  scheduledAt: string | null;
  languages: Language[];
  seoDescription: { en: string; ar: string | null };
  views30d: number;
  blocks: PageBlock[];
  updatedAt: string;
  createdAt: string;
}

// Lightweight shape returned by the list endpoint (no blocks)
export type SitePageListItem = Omit<SitePage, "blocks">;

// ── Raw API shape ──────────────────────────────────────────────────────────

interface APIPage {
  _id: string;
  title: string;
  slug: string;
  status: string;
  scheduledAt: string | null;
  languages: string[];
  seoDescription: { en?: string; ar?: string | null } | null;
  views30d: number;
  blocks?: PageBlock[];
  updatedAt: string;
  createdAt: string;
}

function toPage(raw: APIPage): SitePage {
  return {
    id: raw._id,
    title: raw.title,
    slug: raw.slug,
    status: raw.status as PageStatus,
    scheduledAt: raw.scheduledAt ?? null,
    languages: (raw.languages || ["en"]) as Language[],
    seoDescription: {
      en: raw.seoDescription?.en ?? "",
      ar: raw.seoDescription?.ar ?? null,
    },
    views30d: raw.views30d ?? 0,
    blocks: (raw.blocks || []) as PageBlock[],
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };
}

function toListItem(raw: APIPage): SitePageListItem {
  const { blocks: _blocks, ...rest } = toPage(raw);
  return rest;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchCmsPages(params?: {
  status?: PageStatus;
  q?: string;
}): Promise<SitePageListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const q = qs.toString();
  const raw = await api.get<APIPage[]>(`/api/cms/pages${q ? `?${q}` : ""}`);
  return raw.map(toListItem);
}

export async function fetchCmsPage(id: string): Promise<SitePage> {
  const raw = await api.get<APIPage>(`/api/cms/pages/${id}`);
  return toPage(raw);
}

export async function createCmsPage(data: { title: string; slug: string }): Promise<SitePage> {
  const raw = await api.post<APIPage>("/api/cms/pages", data);
  return toPage(raw);
}

export async function updateCmsPage(
  id: string,
  data: Partial<{
    title: string;
    slug: string;
    status: PageStatus;
    scheduledAt: string | null;
    languages: Language[];
    seoDescription: { en: string; ar: string | null };
    views30d: number;
    blocks: PageBlock[];
  }>,
): Promise<SitePage> {
  const raw = await api.patch<APIPage>(`/api/cms/pages/${id}`, data);
  return toPage(raw);
}

export async function publishCmsPage(id: string): Promise<SitePage> {
  const raw = await api.patch<APIPage>(`/api/cms/pages/${id}/publish`, {});
  return toPage(raw);
}

export async function unpublishCmsPage(id: string): Promise<SitePage> {
  const raw = await api.patch<APIPage>(`/api/cms/pages/${id}/unpublish`, {});
  return toPage(raw);
}

export async function scheduleCmsPage(id: string, scheduledAt: string): Promise<SitePage> {
  const raw = await api.patch<APIPage>(`/api/cms/pages/${id}/schedule`, { scheduledAt });
  return toPage(raw);
}

export async function deleteCmsPage(id: string): Promise<void> {
  await api.delete(`/api/cms/pages/${id}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function bil(en = "", ar: string | null = null): BilingualString {
  return { en, ar };
}

export function makeBlock(type: PageBlockType): PageBlock {
  const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "hero":
      return {
        id,
        type,
        heading: bil("New hero heading"),
        subheading: bil("Supporting subheading"),
        ctaLabel: bil("Get started"),
      };
    case "heading":
      return { id, type, level: 2, text: bil("Section heading") };
    case "paragraph":
      return { id, type, text: bil("Write a paragraph here.") };
    case "image":
      return { id, type, caption: bil("Image caption"), alt: bil("Descriptive alt text") };
    case "cta":
      return { id, type, label: bil("Call to action"), href: "/book", variant: "primary" };
    case "faq":
      return { id, type, items: [{ q: bil("A question?"), a: bil("A clear, short answer.") }] };
  }
}

// Computed: is every translatable field in the page non-empty for the given language?
export function isPageTranslated(page: SitePage | SitePageListItem, lang: Language): boolean {
  if (lang === "en") return true;
  if (!page.languages.includes(lang)) return false;
  if (!page.seoDescription?.ar) return false;
  if (!("blocks" in page)) return true; // list item — no blocks to check
  for (const block of (page as SitePage).blocks) {
    switch (block.type) {
      case "hero":
        if (!block.heading.ar || !block.subheading.ar || !block.ctaLabel.ar) return false;
        break;
      case "heading":
      case "paragraph":
        if (!block.text.ar) return false;
        break;
      case "image":
        if (!block.caption.ar || !block.alt.ar) return false;
        break;
      case "cta":
        if (!block.label.ar) return false;
        break;
      case "faq":
        if (block.items.some((i) => !i.q.ar || !i.a.ar)) return false;
        break;
    }
  }
  return true;
}

export const STATUS_STYLES: Record<PageStatus, { label: string; cls: string }> = {
  published: {
    label: "Published",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  draft: { label: "Draft", cls: "bg-slate-500/10  text-slate-700  border-slate-500/20" },
  scheduled: { label: "Scheduled", cls: "bg-amber-500/10  text-amber-700  border-amber-500/20" },
};

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
