# CSMA Template

A lean, secure, and reactive application kit using the CSMA (Client-Side Microservices Architecture) pattern.

## Features

✅ **Zero frameworks** - Pure vanilla JavaScript<br>
✅ **17KB gzipped** - Minimal bundle size<br>
✅ **CSS-class reactivity** - 10x faster than manual DOM manipulation<br>
✅ **Zero-trust security** - CSP, contracts, sanitization, honeypot, rate limiting<br>
✅ **Type-safe EventBus** - Contract-validated pub/sub<br>
✅ **Telemetry/Analytics** - LogAccumulator with CSS tracking  
✅ **SEO-ready** - MetaManager for meta tags<br>
✅ **Dark mode** - Theme switching via CSS custom properties<br>

## Template Usage

This repository is a template source for developers to copy into their local repo and customize.

If you prefer guided setup with selective template extraction, use:

- https://github.com/yagaltd/csma-ssma-cli/


## SSMA Gateway Middleware (JavaScript and Rust)

For CSMA projects that need gateway middleware, see **SSMA**:

- Repository: https://github.com/yagaltd/SSMA
- Includes gateway middleware implementations in **JavaScript** and **Rust**.

Use this CSMA template for the client/app side, and SSMA when you need gateway/runtime integration.

## What You Get in This Template

- CSMA runtime (`src/runtime`)
- Modular services and contracts (`src/modules`, `src/services`)
- UI components/patterns (`src/ui`)
- Security and validation primitives
- Multi-target packaging hooks (web, Capacitor, Neutralino)
- Tests and examples

## AI System Map

`ai-system-map.json` is a machine-readable map of the runtime/modules, an automatic context for AI coding agents (add manually to AGENTS.md or CLAUDE.md).

Reference: `docs/operations/ai-system-map.md`

## Docs

- Main docs index: `docs/README.md`
- Getting started: `docs/guides/getting-started.md`
- CSMA overview: `docs/guides/csma-in-a-nutshell.md`
- Full guide: `docs/complete-csma-guide.md`
- Template catalog details: `templates/README.md`

## Acknowledgements

* [Enrico Piovesan](https://medium.com/@enricopiovesan) - For the numerous medium articles on [Client Side Microservices Architecture].
* Inspired by [JurisJS](https://github.com/jurisjs/juris), [VanJS](https://github.com/vanjs-org/van)


## License

MIT
