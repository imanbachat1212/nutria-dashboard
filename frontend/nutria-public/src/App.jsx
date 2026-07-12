import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { fetchPageList } from "./api.js";
import Nav from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import PageView from "./pages/PageView.jsx";
import NotFound from "./pages/NotFound.jsx";

// ── Language context ────────────────────────────────────────────────────────

export const LangContext = createContext({ lang: "en", setLang: () => {} });
export const useLang = () => useContext(LangContext);

/** Resolve a bilingual field — fall back to EN if the chosen language is null/empty. */
export function t(field, lang) {
  if (!field) return "";
  return field[lang] || field.en || "";
}

// ── Slug router helper ──────────────────────────────────────────────────────

function SlugPage() {
  const { slug } = useParams();
  return <PageView slug={`/${slug}`} />;
}

// ── App root ────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState("en");
  const [navPages, setNavPages] = useState([]);

  useEffect(() => {
    fetchPageList()
      .then(setNavPages)
      .catch(() => {}); // nav degrades gracefully if fetch fails
  }, []);

  // Mirror lang direction on <html> for full RTL support
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="flex min-h-screen flex-col">
        <Nav pages={navPages} />
        <main className="flex-1">
          <Routes>
            <Route path="/"       element={<PageView slug="/" />} />
            <Route path="/:slug"  element={<SlugPage />} />
            <Route path="*"       element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </LangContext.Provider>
  );
}
