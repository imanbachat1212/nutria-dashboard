#!/usr/bin/env node
/**
 * Fails if the locale files have drifted apart.
 *
 * Two separate checks, because "en and ar must have identical keys" is not literally true once
 * plurals are involved: English needs `foo_one` / `foo_other`, Arabic needs all six CLDR
 * categories. Comparing the raw key lists would therefore fail on every correctly translated
 * counted string. So:
 *
 *   1. STRUCTURE — compare key sets with plural suffixes collapsed to their base key. A key that
 *      exists in one language and not the other is an error either way round (a missing Arabic
 *      string, or an Arabic string for something English no longer says).
 *   2. PLURALS — for each base key that is plural anywhere, every category that language's own
 *      Intl.PluralRules reports must be present. The categories come from the runtime rather
 *      than a hardcoded list, so this stays right if a third language is ever added.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(here, "..", "src", "lib", "i18n", "locales");

const BASE_LANGUAGE = "en";
const ALL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];

const languages = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (!languages.includes(BASE_LANGUAGE)) {
  console.error(`i18n:check: no "${BASE_LANGUAGE}" directory in ${LOCALES_DIR}`);
  process.exit(1);
}

const categoriesFor = (lang) =>
  new Set(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);

/** Flatten nested objects to dotted paths -> string value. */
function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.set(path, child);
    }
  }
  return out;
}

/** "counts.results_few" -> { base: "counts.results", suffix: "few" } */
function splitPlural(path) {
  const match = /^(.*)_(zero|one|two|few|many|other)$/.exec(path);
  return match ? { base: match[1], suffix: match[2] } : { base: path, suffix: null };
}

const errors = [];
const warnings = [];

const namespacesOf = (lang) =>
  readdirSync(join(LOCALES_DIR, lang))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

const baseNamespaces = namespacesOf(BASE_LANGUAGE);

for (const lang of languages) {
  const nss = namespacesOf(lang);
  for (const ns of baseNamespaces) {
    if (!nss.includes(ns)) errors.push(`[${lang}] missing namespace file: ${ns}.json`);
  }
  for (const ns of nss) {
    if (!baseNamespaces.includes(ns)) errors.push(`[${lang}] extra namespace file: ${ns}.json`);
  }
}

let totalKeys = 0;

for (const ns of baseNamespaces) {
  const perLang = new Map();

  for (const lang of languages) {
    const file = join(LOCALES_DIR, lang, `${ns}.json`);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      errors.push(`[${lang}/${ns}] not valid JSON: ${err.message}`);
      continue;
    }
    perLang.set(lang, flatten(parsed));
  }

  // ---- 1. structure ----------------------------------------------------------------------
  const basesOf = (flat) => new Set([...flat.keys()].map((k) => splitPlural(k).base));
  const baseFlat = perLang.get(BASE_LANGUAGE);
  if (!baseFlat) continue;
  const baseBases = basesOf(baseFlat);
  totalKeys += baseBases.size;

  for (const lang of languages) {
    if (lang === BASE_LANGUAGE) continue;
    const flat = perLang.get(lang);
    if (!flat) continue;
    const bases = basesOf(flat);
    for (const key of baseBases) {
      if (!bases.has(key)) errors.push(`[${lang}/${ns}] missing key: ${key}`);
    }
    for (const key of bases) {
      if (!baseBases.has(key)) errors.push(`[${lang}/${ns}] key not in ${BASE_LANGUAGE}: ${key}`);
    }
  }

  // ---- 2. plural completeness -------------------------------------------------------------
  // A base key is "plural" if ANY language spells it with a category suffix. That catches the
  // case where English got `foo_one`/`foo_other` but Arabic was written as a single flat `foo`.
  const pluralBases = new Set();
  for (const flat of perLang.values()) {
    for (const key of flat.keys()) {
      const { base, suffix } = splitPlural(key);
      if (suffix) pluralBases.add(base);
    }
  }

  for (const lang of languages) {
    const flat = perLang.get(lang);
    if (!flat) continue;
    const required = categoriesFor(lang);
    for (const base of pluralBases) {
      if (flat.has(base)) {
        errors.push(
          `[${lang}/${ns}] "${base}" is a counted string elsewhere but written here without plural suffixes`,
        );
        continue;
      }
      const missing = [...required].filter((cat) => !flat.has(`${base}_${cat}`));
      if (missing.length) {
        errors.push(
          `[${lang}/${ns}] "${base}" missing plural form(s): ${missing.map((m) => `_${m}`).join(", ")} (${lang} needs ${[...required].join(", ")})`,
        );
      }
      const extra = ALL_SUFFIXES.filter((cat) => !required.has(cat) && flat.has(`${base}_${cat}`));
      if (extra.length) {
        warnings.push(
          `[${lang}/${ns}] "${base}" has unused plural form(s) for ${lang}: ${extra.map((m) => `_${m}`).join(", ")}`,
        );
      }
    }
  }

  // ---- 3. empty values --------------------------------------------------------------------
  for (const lang of languages) {
    const flat = perLang.get(lang);
    if (!flat) continue;
    for (const [key, value] of flat) {
      if (typeof value !== "string") {
        errors.push(`[${lang}/${ns}] ${key} is ${typeof value}, expected a string`);
      } else if (value.trim() === "") {
        errors.push(`[${lang}/${ns}] ${key} is empty`);
      }
    }
  }

  // ---- 4. interpolation placeholders must survive translation -----------------------------
  const placeholders = (s) =>
    new Set([...s.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1]));
  for (const lang of languages) {
    if (lang === BASE_LANGUAGE) continue;
    const flat = perLang.get(lang);
    if (!flat) continue;
    for (const [key, value] of flat) {
      if (typeof value !== "string") continue;
      const { base, suffix } = splitPlural(key);
      // Compare against the English string for the same category, else English "other", else base.
      const ref =
        baseFlat.get(key) ??
        (suffix ? baseFlat.get(`${base}_other`) : undefined) ??
        baseFlat.get(base);
      if (typeof ref !== "string") continue;
      const want = placeholders(ref);
      const got = placeholders(value);
      for (const p of want) {
        if (got.has(p)) continue;
        // A plural form is ALLOWED to drop {{count}}: Arabic encodes small numbers in the word
        // itself, so "منذ دقيقتين" ("two minutes ago") and "لا توجد نتائج" ("no results") are
        // correct precisely because they do not print the digit. Requiring it here would make
        // every properly translated counted string an error.
        if (suffix && p === "count") continue;
        errors.push(`[${lang}/${ns}] ${key} is missing placeholder {{${p}}}`);
      }
      for (const p of got) {
        // An unknown placeholder is still always wrong — it renders as literal braces.
        if (!want.has(p)) errors.push(`[${lang}/${ns}] ${key} has unknown placeholder {{${p}}}`);
      }
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);

if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\ni18n:check FAILED — ${errors.length} problem(s).`);
  process.exit(1);
}

console.log(
  `i18n:check OK — ${languages.join(", ")} × ${baseNamespaces.length} namespace(s), ${totalKeys} keys each${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`,
);
