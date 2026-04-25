---
name: csma-rigor
description: Rigor selection guide for CSMA. Decides when standard CSMA is enough and when to add property tests, service-local transitions, or stronger security verification. Use when designing module reliability strategy or deciding test depth.
---

<!-- version: 1.0.0 | tags: rigor, strategy, testing, transitions, security, services -->

# CSMA Rigor Skill

Use this skill to choose the **minimum rigor level** a module needs.

This is a decision skill. It routes you to more detailed guidance in:

- `docs/testing/SKILL.md`
- `docs/service-pattern/SKILL.md`
- `docs/security/SKILL.md`
- `docs/architecture/SKILL.md`

It is **not** a mandatory runtime subsystem and it does **not** replace
Contracts, EventBus, or the core CSMA rules.

Visual audit and refinement guidance lives in `docs/design/SKILL.md`, not here.
Use `csma-rigor` for reliability depth and verification scope, not for taste or
layout-polish decisions.

## What CSMA Already Guarantees

Standard CSMA already gives you:

- contract validation on EventBus payloads
- security-first runtime boundaries
- service/module separation
- CSS/data-attribute-driven UI state
- lifecycle-safe module/service ownership

For many modules, that is enough.

## What Rigor Adds

`csma-rigor` adds development-time discipline for modules where example tests
and basic contracts are not enough.

Possible additions:

- property tests with `fast-check`
- stateful/model-based test harnesses
- service-local transition maps
- stronger abuse-case and invariant verification for risky modules

## Rigor Levels

### Level 0: Standard CSMA

Use when the module is simple and low-risk.

Typical characteristics:

- trivial state
- mostly UI glue or presentational behavior
- low failure cost
- few meaningful edge-case combinations

Typical coverage:

- contract tests
- ordinary service/module tests
- cleanup/lifecycle tests

Examples:

- modal toggles
- simple view adapters
- presentational modules

### Level 1: Property-Tested Service

Use when the service has meaningful business state or many input/state
combinations.

Typical characteristics:

- totals, merges, retries, queues, or derived state
- example tests start looking repetitive
- edge cases matter more than single happy paths

Add:

- `fast-check`
- invariants
- stateful/model-based tests when needed

Examples:

- checkout totals
- optimistic sync
- sync queue

Read next:

- `docs/testing/SKILL.md`

### Level 2: Transition-Governed Service

Use only when the service has a real lifecycle and illegal state edges matter.

Typical characteristics:

- explicit statuses
- asynchronous workflow steps
- illegal transitions can cause bugs or corrupt state

Add:

- service-local transition map
- focused transition tests

Do **not**:

- add global EventBus guard enforcement
- force transitions onto every module

Examples:

- checkout flow
- some sync/retry workflows

Read next:

- `docs/service-pattern/SKILL.md`
- `docs/testing/SKILL.md`

### Level 3: Security-Critical Verification

Use when failure is financially, operationally, or security sensitive.

Typical characteristics:

- guest or untrusted payloads
- replay/tamper risks
- persistence, queueing, or auth-sensitive flows

Add:

- abuse-case tests
- malformed payload tests
- stronger invariant testing
- explicit security review

Read next:

- `docs/security/SKILL.md`
- `docs/testing/SKILL.md`

## Decision Rules

Use this sequence:

```text
Does the module have meaningful business state?
  no  -> Level 0
  yes -> Does it have many input/state combinations?
            yes -> Add Level 1
            no  -> Keep Level 0

Does it have strict lifecycle edges?
  yes -> Add Level 2
  no  -> Do not add transitions

Is failure security-critical or financially risky?
  yes -> Add Level 3
  no  -> Stop at the lowest sufficient level
```

## Anti-Patterns

- Do not treat `csma-rigor` as a mandatory framework for every module.
- Do not put transition enforcement into `EventBus`.
- Do not infer complex generators from under-described schemas by guessing.
- Do not add service-local transitions just because a module has a `status`
  field; add them only when illegal edges matter.
- Do not replace ordinary tests with property tests everywhere.

## Recommended Defaults

- Start at Level 0.
- Add Level 1 before Level 2 in most cases.
- Add Level 2 only for selected services.
- Keep runtime core lean; prefer tests and service-local helpers over global
  runtime complexity.

## Current Repo Guidance

Based on current CSMA experiments:

- manual property testing is validated
- service-local transitions are selectively useful
- auto-derived schema-to-generator systems are not yet proven
- global EventBus guard enforcement is a poor fit
