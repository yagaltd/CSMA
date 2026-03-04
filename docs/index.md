# CSMA Kit Documentation

CSMA (Client-Side Microservices Architecture) is a lean, framework-free frontend architecture built around a shared EventBus, service orchestration, and contract validation.

## Start Here

1. Read [CSMA in a Nutshell](guides/csma-in-a-nutshell.md)
2. Follow [Getting Started](guides/getting-started.md)
3. Explore [Features](guides/features.md)
4. Build with [Building Components](guides/building-components.md)

## Core Concepts

- **EventBus**: typed event-driven communication
- **ServiceManager**: lifecycle and dependency management
- **Contracts**: runtime validation and security boundaries
- **ModuleManager**: dynamic optional module loading

See the [Complete CSMA Guide](complete-csma-guide.md) for full architecture details.

## Documentation Sections

- **Getting Started**: onboarding and first integration steps
- **Guides**: architecture, theming, implementation patterns
- **API**: core service contracts and usage
- **Advanced**: governance, optimistic sync, instructor patterns
- **Platforms**: Capacitor and Neutralino packaging
- **Examples**: reference Todo app walkthrough
- **Security**: implementation map and checklist
- **Operations**: release process and roadmap artifacts

## Local Preview

```bash
pip install mkdocs mkdocs-material
mkdocs serve
```

Then open `http://127.0.0.1:8000`.
