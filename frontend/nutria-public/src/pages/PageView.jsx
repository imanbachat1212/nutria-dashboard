import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPage } from "../api.js";
import BlockRenderer from "../components/blocks/index.jsx";
import { useLang, t } from "../App.jsx";

// Blocks that render full-bleed (no content padding wrapper)
const FULL_BLEED = new Set(["hero"]);

export default function PageView({ slug }) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(null);

    fetchPage(slug)
      .then((data) => {
        if (!data) {
          navigate("/404", { replace: true });
          return;
        }
        setPage(data);
        // Update <title> and meta description
        const seoTitle = `${data.title} — Nutria`;
        document.title = seoTitle;
        const desc = t(data.seoDescription, lang);
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", desc);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-stone-500 text-sm">Something went wrong. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-brand-600 underline"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!page) return null;

  return (
    <article>
      {page.blocks.map((block, idx) =>
        FULL_BLEED.has(block.type) ? (
          <BlockRenderer key={block.id ?? idx} block={block} />
        ) : (
          <div key={block.id ?? idx} className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            <BlockRenderer block={block} />
          </div>
        ),
      )}
    </article>
  );
}
