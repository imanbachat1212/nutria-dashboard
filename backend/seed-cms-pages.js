/**
 * One-time seed: create / upsert the 6 core site pages with bilingual block content.
 * Uses upsert-by-slug so it is safe to run repeatedly — existing pages are updated,
 * not duplicated.  Run with:  node seed-cms-pages.js
 */

import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import CmsPage from "./src/modules/cms/cms-page.model.js";

const bil = (en, ar = null) => ({ en, ar });

// The shared 5-block template used by all pages except FAQ.
// AR fields are null — the original mock carried "ar" in languages[] but had no
// translated text.  A translator fills these in via the page editor.
function seedBlocks(heroHeading, heroSubheading) {
  return [
    {
      id: "b-hero",
      type: "hero",
      heading:    bil(heroHeading),
      subheading: bil(heroSubheading),
      ctaLabel:   bil("Book a consultation"),
    },
    {
      id: "b-h2",
      type:  "heading",
      level: 2,
      text:  bil(`Why ${heroHeading.toLowerCase()}?`),
    },
    {
      id:   "b-p1",
      type: "paragraph",
      text: bil(
        "Evidence-based, personalised and built around your life. " +
        "No fad diets, no calorie shaming — just sustainable results.",
      ),
    },
    {
      id:      "b-img",
      type:    "image",
      caption: bil("Sura with a client during a follow-up"),
      alt:     bil(`${heroHeading} cover image`),
    },
    {
      id:      "b-cta",
      type:    "cta",
      label:   bil("Get started"),
      href:    "/book",
      variant: "primary",
    },
  ];
}

const PAGES = [
  {
    title:       "Home",
    slug:        "/",
    status:      "published",
    languages:   ["en", "ar"],
    seoDescription: {
      en: "Nutrition, gym programming and clinical plans by Sura Hawli.",
      ar: null,
    },
    views30d: 2840,
    blocks: seedBlocks(
      "Eat better. Train smarter. Feel like yourself again.",
      "Personalised nutrition and training, delivered weekly.",
    ),
  },
  {
    title:     "About Sura",
    slug:      "/about",
    status:    "published",
    languages: ["en", "ar"],         // fr removed — not supported in the new schema
    seoDescription: {
      en: "Meet Sura — registered dietitian with 8+ years of clinical practice.",
      ar: null,
    },
    views30d: 920,
    blocks: seedBlocks(
      "About Sura",
      "Registered dietitian, mum of two, marathon-runner-in-progress.",
    ),
  },
  {
    title:     "Services & Packages",
    slug:      "/services",
    status:    "published",
    languages: ["en", "ar"],
    seoDescription: {
      en: "Choose between consultations, monthly plans and combined diet + gym programming.",
      ar: null,
    },
    views30d: 1180,
    blocks: seedBlocks(
      "Services & Packages",
      "Pick the plan that fits your goals and your week.",
    ),
  },
  {
    title:     "Book a Consultation",
    slug:      "/book",
    status:    "published",
    languages: ["en", "ar"],
    seoDescription: {
      en: "Book a 60-minute initial consultation with Sura.",
      ar: null,
    },
    views30d: 740,
    blocks: seedBlocks(
      "Book a Consultation",
      "60 minutes, online or in-clinic. Pick a time that works.",
    ),
  },
  {
    title:       "Ramadan Plan 2026",
    slug:        "/ramadan-2026",
    status:      "scheduled",
    scheduledAt: new Date("2027-02-28T06:00:00Z"), // approximate next Ramadan start
    languages:   ["en", "ar"],
    seoDescription: {
      en: "Seasonal Ramadan nutrition and hydration package.",
      ar: null,
    },
    views30d: 0,
    blocks: seedBlocks(
      "Ramadan Plan 2026",
      "Suhoor, iftar and hydration — done right.",
    ),
  },
  {
    title:     "FAQ",
    slug:      "/faq",
    status:    "draft",
    languages: ["en"],
    seoDescription: {
      en: "Answers to the most common questions about Nutria plans.",
      ar: null,
    },
    views30d: 0,
    blocks: [
      {
        id:    "b-h2",
        type:  "heading",
        level: 2,
        text:  bil("Frequently asked questions"),
      },
      {
        id:    "b-faq",
        type:  "faq",
        items: [
          {
            q: bil("How long until I see results?"),
            a: bil("Most clients see meaningful change within 4–6 weeks of consistent follow-through."),
          },
          {
            q: bil("Do you support vegetarian / halal diets?"),
            a: bil("Yes — all plans are tailored to your dietary preferences and culture."),
          },
          {
            q: bil("Can I cancel anytime?"),
            a: bil("Monthly packages can be cancelled at the end of any billing cycle."),
          },
        ],
      },
    ],
  },
];

async function run() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Remove the test "New page" drafts created during development testing
  const deleted = await CmsPage.deleteMany({
    title: "New page",
    status: "draft",
    $expr: { $eq: [{ $size: "$blocks" }, 0] },
  });
  if (deleted.deletedCount > 0) {
    console.log(`Removed ${deleted.deletedCount} empty test draft(s)`);
  }

  for (const page of PAGES) {
    const result = await CmsPage.findOneAndUpdate(
      { slug: page.slug },
      {
        $set: {
          title:          page.title,
          status:         page.status,
          scheduledAt:    page.scheduledAt ?? null,
          languages:      page.languages,
          seoDescription: page.seoDescription,
          views30d:       page.views30d,
          blocks:         page.blocks,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const action = result.createdAt?.getTime() === result.updatedAt?.getTime() ? "created" : "updated";
    console.log(`  ${action}: "${result.title}" (${result.slug}) — ${result.blocks.length} blocks`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
