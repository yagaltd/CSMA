# Flow: `<flow name>`

## Trigger

| Field | Decision |
|:--|:--|
| Starts when | `<user/system trigger>` |
| Entry points | `<pages/components/routes>` |

## Steps

| Order | User action | System response |
|:--|:--|:--|
| 1 | `<action>` | `<response>` |

## States

| State | UI behavior |
|:--|:--|
| Idle | `<default>` |
| Loading | `<spinner/skeleton/disabled>` |
| Success | `<confirmation/redirect/state update>` |
| Error | `<message/retry/recovery>` |
| Empty | `<if applicable>` |
| Disabled | `<if applicable>` |

## Validation

| Input / payload | Rule | Contract |
|:--|:--|:--|
| `<field/event>` | `<rule>` | `<contract name>` |

## Events

| Event | Payload | Publisher | Subscriber |
|:--|:--|:--|:--|
| `INTENT_*` | `<payload>` | `<UI>` | `<service>` |
| `*_CHANGED` | `<payload>` | `<service>` | `<UI>` |

## Persistence

| Data | Storage | Notes |
|:--|:--|:--|
| `<data>` | `<local/session/server/none>` | `<privacy/security>` |

## Failure Modes

| Failure | Recovery |
|:--|:--|
| `<failure>` | `<retry/cancel/manual support>` |
