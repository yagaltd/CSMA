# CSMA Hybrid Templates

We keep authored pages in `src/pages/**` so they can be compiled into static shells or dynamic routes. Suggested starter set (feel free to extend):

1. `src/pages/products/detail.html` – product detail page with multiple islands (inventory, reviews).
2. `src/pages/blog/post.html` – mostly static article with a comment island.
3. `src/pages/about/index.html` – pure static marketing page to validate non-island builds.

To add a new template:

1. Drop the HTML file under `src/pages/...` (nested folders map to route segments).
2. Use `data-island`, `data-contract`, and `data-trigger` attributes to mark dynamic regions.
3. Run `npm run build:hybrid` (or `npm run build` which already chains Vite + hybrid build) to produce `dist/pages/**` + `_islands/registry.json`.
4. For local iteration, `npm run build:hybrid -- --incremental` will reuse the previous manifest and rebuild only changed templates.

Keep templates framework-free (vanilla HTML + Mikado-friendly structure). Use `{{ }}` placeholders only if your authoring workflow replaces them prior to running the hybrid builder.
