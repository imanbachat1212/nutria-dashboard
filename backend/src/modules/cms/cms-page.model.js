import mongoose from "mongoose";

// Reusable bilingual text sub-schema: EN is required (source language), AR is optional
const bil = new mongoose.Schema(
  { en: { type: String, default: "" }, ar: { type: String, default: null } },
  { _id: false }
);

const faqItemSchema = new mongoose.Schema(
  { q: { type: bil, default: () => ({}) }, a: { type: bil, default: () => ({}) } },
  { _id: false }
);

// Flat catch-all block sub-schema — `type` discriminates which fields apply.
// All field groups are optional at the schema level; the service/validation layer
// enforces the correct shape per block type.
const blockSchema = new mongoose.Schema(
  {
    id:         { type: String, required: true },  // client-side UUID for React key
    type:       { type: String, enum: ["hero", "heading", "paragraph", "image", "cta", "faq"], required: true },
    // hero
    heading:    { type: bil },
    subheading: { type: bil },
    ctaLabel:   { type: bil },
    // heading / paragraph
    level:      { type: Number, enum: [2, 3] },
    text:       { type: bil },
    // image  (src/url deferred — separate media upload phase)
    caption:    { type: bil },
    alt:        { type: bil },
    // cta
    label:      { type: bil },
    href:       { type: String },
    variant:    { type: String, enum: ["primary", "outline"] },
    // faq
    items:      [faqItemSchema],
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    en: { type: String, maxlength: 160, default: "" },
    ar: { type: String, maxlength: 160, default: null },
  },
  { _id: false }
);

const cmsPageSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true, trim: true },
    slug:           { type: String, required: true, unique: true, index: true, trim: true },
    status:         { type: String, enum: ["draft", "published", "scheduled"], default: "draft" },
    scheduledAt:    { type: Date, default: null },

    // EN is always present (source language). AR is optional.
    // Note: both dietitian and assistant roles have cms.* permissions — adjust seed.js if
    // you later want to restrict CMS editing to dietitian-only.
    languages:      { type: [String], enum: ["en", "ar"], default: ["en"] },

    seoDescription: { type: seoSchema, default: () => ({}) },
    views30d:       { type: Number, default: 0 },
    blocks:         [blockSchema],
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("CmsPage", cmsPageSchema);
