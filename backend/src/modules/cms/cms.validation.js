import { z } from "zod";

const bil = z.object({
  en: z.string().default(""),
  ar: z.string().nullable().optional(),
});

const faqItemSchema = z.object({
  q: bil,
  a: bil,
});

const heroBlock   = z.object({ id: z.string(), type: z.literal("hero"),      heading: bil, subheading: bil, ctaLabel: bil });
const headingBlock= z.object({ id: z.string(), type: z.literal("heading"),   level: z.union([z.literal(2), z.literal(3)]), text: bil });
const paraBlock   = z.object({ id: z.string(), type: z.literal("paragraph"), text: bil });
const imageBlock  = z.object({ id: z.string(), type: z.literal("image"),     caption: bil, alt: bil });
const ctaBlock    = z.object({ id: z.string(), type: z.literal("cta"),       label: bil, href: z.string(), variant: z.enum(["primary", "outline"]) });
const faqBlock    = z.object({ id: z.string(), type: z.literal("faq"),       items: z.array(faqItemSchema).min(1) });

const blockSchema = z.discriminatedUnion("type", [
  heroBlock, headingBlock, paraBlock, imageBlock, ctaBlock, faqBlock,
]);

const seoSchema = z.object({
  en: z.string().max(160).default(""),
  ar: z.string().max(160).nullable().optional(),
});

export const createPageSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    slug:  z.string().min(1).regex(/^\//, "Slug must start with /"),
  }),
});

export const updatePageSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title:          z.string().min(1).optional(),
    slug:           z.string().min(1).regex(/^\//, "Slug must start with /").optional(),
    status:         z.enum(["draft", "published", "scheduled"]).optional(),
    scheduledAt:    z.string().nullable().optional(),
    languages:      z.array(z.enum(["en", "ar"])).optional(),
    seoDescription: seoSchema.optional(),
    views30d:       z.number().int().min(0).optional(),
    blocks:         z.array(blockSchema).optional(),
  }),
});

export const schedulePageSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    scheduledAt: z.string().min(1, "scheduledAt is required"),
  }),
});

export const listPagesSchema = z.object({
  query: z.object({
    status: z.enum(["draft", "published", "scheduled"]).optional(),
    q:      z.string().optional(),
  }),
});

export const pageParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
