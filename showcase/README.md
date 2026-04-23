# CSMA Token Showcase

A standalone visual specimen for the current generated token seed.

Open it after changing `src/style/design-tokens.json` and running
`npm run tokens`:

```bash
npm run dev
# open http://localhost:5173/showcase/token-showcase.html
```

It can also be opened directly from disk:

```text
file:///.../CSMA/showcase/token-showcase.html
```

The showcase displays palette, typography, spacing, layout primitives, radius,
shadows, components, fields, badges, status, and motion tokens across light,
dark, and contrast themes. It reads generated CSS variables and does not replace
`DESIGN.md` or store app copy in the token file.
