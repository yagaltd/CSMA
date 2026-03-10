# CSMA Extension Roadmap

Audience: engineering team evolving CSMA as a secure, reactive, framework-free frontend template for web, mobile, and desktop.

## Current Status

Status: **Phase 1 implemented**

Implemented in this repo:
- modules-first extension direction is now the official CSMA position
- canonical module manifests are enforced with `id`, `services`, and optional `contributes`
- runtime contribution registries exist for commands, routes, navigation, panels, and adapters
- `ModuleManager` registers contributions on load and removes them on unload
- lifecycle-safe teardown remains part of the runtime ownership model
- core docs, README, AGENTS guidance, and skills were updated to match the new extension story

Still deferred:
- plugin runtime
- plugin SDK
- sandboxing and capability negotiation for third-party code
- runtime-installed add-ons and marketplace/distribution workflows
- multi-platform plugin adapters

## Position

CSMA is **modules-first**.

Plugins are **not** part of the core CSMA vision today.

The primary extension story for CSMA is:
- trusted modules
- stable runtime contracts
- feature flags
- contribution registries
- lifecycle-safe load/unload

Plugins should only be considered later if CSMA needs:
- third-party extensions
- runtime-installed add-ons
- tenant/customer extension packs
- user-authored extensions outside the app codebase

## Why

CSMA is meant to be:
- headless
- secure
- reactive
- lightweight
- robust
- portable across web/mobile/desktop
- framework-free

That vision does not require a plugin platform.

It does require:
- a strong runtime
- clear boundaries
- safe lifecycle management
- portable modules
- backend-agnostic integration points

CSMA already has the right foundations:
- `EventBus`
- `Contracts`
- `ServiceManager`
- `ModuleManager`
- feature flags in `src/config.js`
- lifecycle ownership and teardown

## Implemented Architecture

### Runtime

The current host platform remains:
- `src/runtime/*`
- `src/modules/*`
- `src/ui/*`

There is no parallel `src/core/*` extension architecture.

### Modules

Modules remain first-class feature packages.

They:
- register services through `ServiceManager`
- load through `ModuleManager`
- expose standardized manifests
- use `EventBus` contracts for interaction
- clean up all resources on unload

### Contribution Registries

The current runtime registries are:
- command registry
- route registry
- navigation registry
- panel registry
- adapter registry

Each registry:
- tracks ownership by module id
- supports registration and unregistration
- removes contributions on module unload
- remains contract-driven where runtime events are published

### Contracts vs Registries

This repo keeps both:

- `Contracts` validate data and runtime messages
- registries track installed contributions and ownership
- modules and services implement behavior

Registries do **not** replace validation.

## Public Interface Now

### Module Manifest

Canonical manifest fields:
- `id`
- `name`
- `version`
- `description`
- `dependencies`
- `services`
- optional `contracts`
- optional `contributes`

### Contributes

The currently supported contribution types are:
- `commands`
- `routes`
- `navigation`
- `panels`
- `adapters`

### Lifecycle

All module-owned resources must remain unload-safe:
- services
- EventBus subscriptions
- timers
- observers
- channels
- workers
- DOM listeners

This follows the lifecycle hardening already added to the runtime.

## Recommended Next Steps

Highest-value next work:
- add a real `create module` scaffold/generator
- add more examples of adapter-backed integrations
- expand load/unload stress coverage
- document recommended patterns for router/navigation rendering from registries

Only after that should CSMA re-evaluate whether plugins are needed at all.

## Final Recommendation

CSMA should continue positioning itself as:
- a lifecycle-safe frontend runtime and template
- with first-class modules
- stable contracts
- backend-agnostic integration
- optional future plugins only if justified

Official extension story:

**Modules now. Plugins maybe later.**
