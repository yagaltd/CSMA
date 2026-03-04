# AI System Map (`ai-system-map.json`)

`ai-system-map.json` is a machine-readable context file for automation and AI agents working in this repository.

## Purpose

It captures:
- Project metadata (`name`, `version`, `description`)
- Declared architecture metadata
- Runtime capability summary
- Scanned `src/` file structure
- Detected agents/contracts summary
- Dependency inventory from `package.json`

## Source of Truth

- File: `ai-system-map.json` (repo root)
- Generator: `scripts/generate-ai-map.js`
- NPM script: `npm run generate-map`

## When It Is Updated

- Automatically on `npm install` via `postinstall`
- Manually when you run:

```bash
npm run generate-map
```

## Release Requirement

Before publishing a release, regenerate the map and commit it if changed:

```bash
npm run generate-map
git add ai-system-map.json
git commit -m "chore(docs): refresh ai-system-map"
```

## Current Limitations

- Contract extraction is summary-level and may not enumerate every contract schema.
- The map is intended for fast orientation; always verify implementation details in source files.

## Contributor Guidance

- Keep `scripts/generate-ai-map.js` aligned with runtime structure changes.
- If module layout or contract conventions change, update the scanner logic and regenerate the map in the same PR.
