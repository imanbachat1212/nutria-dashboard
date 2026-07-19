// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, componentTagger (dev-only),
//     VITE_* env injection, @ path alias, React/TanStack dedupe, error logger plugins, and
//     sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

// @netlify/vite-plugin-tanstack-start's local-dev emulation (configureServer) assumes Vite's
// project root IS the Netlify site's repository root. That's false here: netlify.toml's
// `base = "frontend/wa-diet-buddy"` is relative to the actual repo root one level up (this is
// a monorepo), but the plugin resolves `base` against Vite's own root (this directory) instead
// — doubling the path to ".../frontend/wa-diet-buddy/frontend/wa-diet-buddy" and crashing
// `vite dev` on startup ("Base directory does not exist"). Its build-time behavior (preparing
// the Netlify Functions bundle from nitro's output) is unaffected — that only runs during
// `vite build` via separate hooks, not configureServer — so scoping the plugin to build-only
// keeps the Netlify deploy working while fixing local dev. See:
// node_modules/@netlify/vite-plugin/dist/main.js (`projectRoot: viteDevServer.config.root`)
// node_modules/@netlify/dev/dist/main.js (`repositoryRoot: this.#projectRoot`)
const isBuild = process.argv.includes("build");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hard-pin the nitro build target to Netlify (outside a Lovable sandbox, nitro is
  // otherwise skipped entirely unless explicitly enabled, and its own fallback target
  // is cloudflare-module — this project deploys to Netlify, not Cloudflare).
  nitro: {
    preset: "netlify",
  },
  plugins: isBuild ? [netlify()] : [],
});
