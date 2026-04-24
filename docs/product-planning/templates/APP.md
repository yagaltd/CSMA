# APP

## App Goal

| Field | Decision |
|:--|:--|
| Job to be done | `<user job>` |
| Primary users | `<roles/personas>` |
| Success state | `<what good looks like>` |

## Public Presence / Distribution

| Field | Decision |
|:--|:--|
| Product type | `<site/web-app/hybrid/mobile-app>` |
| Web surface enabled | `<true/false>` |
| Indexable | `<true/false>` |
| Companion site | `<yes/no>` |
| Base URL | `<https://example.com or none>` |
| Legal page expectation | `<privacy/terms/cookies as applicable>` |

## Screens

| Screen | Route | State owner | Primary action |
|:--|:--|:--|:--|
| `<screen>` | `<route>` | `<service/module>` | `<action>` |

## Navigation

| Area | Rule |
|:--|:--|
| Desktop | `<sidebar/top nav/tabs>` |
| Mobile | `<bottom nav/drawer/stack>` |
| Auth state | `<anonymous/authenticated/admin behavior>` |

## Modules

| Module | Use | Integration notes |
|:--|:--|:--|
| `<module>` | `<why needed>` | `<contracts/events/storage>` |

## State Model

| Domain | Service | Events | Persistence |
|:--|:--|:--|:--|
| `<domain>` | `<service>` | `<INTENT_*, *_CHANGED>` | `<local/session/server>` |

## Critical Flows

| Flow | Spec | Notes |
|:--|:--|:--|
| `<flow>` | `flows/<flow>.md` | `<risk/edge cases>` |
