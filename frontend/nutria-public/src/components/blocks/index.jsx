import { useState } from "react";
import { Link } from "react-router-dom";
import { t, useLang } from "../../App.jsx";

// ── Hero ────────────────────────────────────────────────────────────────────

export function HeroBlock({ block }) {
  const { lang } = useLang();
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-brand-900 py-24 text-white">
      {/* Subtle decorative circle */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {t(block.heading, lang)}
        </h1>
        {block.subheading && (
          <p className="mx-auto mt-5 max-w-xl text-lg text-stone-300 leading-relaxed">
            {t(block.subheading, lang)}
          </p>
        )}
        {block.ctaLabel && (
          <div className="mt-8">
            <Link
              to="/book"
              className="inline-block rounded-full bg-brand-600 px-8 py-3 font-semibold text-white shadow-lg hover:bg-brand-500 transition-colors text-sm sm:text-base"
            >
              {t(block.ctaLabel, lang)}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Heading ──────────────────────────────────────────────────────────────────

export function HeadingBlock({ block }) {
  const { lang } = useLang();
  const text = t(block.text, lang);
  return block.level === 2 ? (
    <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">{text}</h2>
  ) : (
    <h3 className="text-xl font-semibold text-stone-800 sm:text-2xl">{text}</h3>
  );
}

// ── Paragraph ────────────────────────────────────────────────────────────────

export function ParagraphBlock({ block }) {
  const { lang } = useLang();
  return (
    <p className="text-base leading-relaxed text-stone-600 sm:text-lg">
      {t(block.text, lang)}
    </p>
  );
}

// ── Image ────────────────────────────────────────────────────────────────────
// No real src yet (Cloudflare storage is a separate future phase).
// Show a branded placeholder with caption.

export function ImageBlock({ block }) {
  const { lang } = useLang();
  const caption = t(block.caption, lang);
  const alt     = t(block.alt, lang);
  return (
    <figure className="overflow-hidden rounded-2xl">
      <div
        role="img"
        aria-label={alt}
        className="flex aspect-video items-center justify-center bg-gradient-to-br from-brand-50 via-stone-100 to-stone-200"
      >
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
            <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18l5-5m0 0l5 5M3 18h18M3 7.5h.008v.008H3V7.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-xs text-stone-400">{alt || "Image"}</p>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-stone-500 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── CTA button ───────────────────────────────────────────────────────────────

export function CtaBlock({ block }) {
  const { lang } = useLang();
  const label   = t(block.label, lang);
  const href    = block.href || "/book";
  const primary = block.variant !== "outline";

  // Internal vs external link
  const isInternal = href.startsWith("/");
  const cls = primary
    ? "inline-block rounded-full bg-brand-600 px-8 py-3 font-semibold text-white shadow hover:bg-brand-500 transition-colors"
    : "inline-block rounded-full border-2 border-brand-600 px-8 py-3 font-semibold text-brand-700 hover:bg-brand-50 transition-colors";

  return (
    <div className="text-center">
      {isInternal ? (
        <Link to={href} className={cls}>{label}</Link>
      ) : (
        <a href={href} className={cls} target="_blank" rel="noreferrer">{label}</a>
      )}
    </div>
  );
}

// ── FAQ accordion ────────────────────────────────────────────────────────────

export function FaqBlock({ block }) {
  const { lang } = useLang();
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 overflow-hidden">
      {(block.items || []).map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpenIdx(open ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left font-medium text-stone-900 hover:bg-stone-50 transition-colors"
            >
              <span>{t(item.q, lang)}</span>
              <span className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-bold text-sm transition-transform ${open ? "rotate-45" : ""}`}>
                +
              </span>
            </button>
            {open && (
              <div className="border-t border-stone-100 bg-stone-50 px-5 py-4 text-stone-600 text-sm leading-relaxed">
                {t(item.a, lang)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export default function BlockRenderer({ block }) {
  switch (block.type) {
    case "hero":      return <HeroBlock      block={block} />;
    case "heading":   return <HeadingBlock   block={block} />;
    case "paragraph": return <ParagraphBlock block={block} />;
    case "image":     return <ImageBlock     block={block} />;
    case "cta":       return <CtaBlock       block={block} />;
    case "faq":       return <FaqBlock       block={block} />;
    default:          return null;
  }
}
