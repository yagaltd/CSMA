# Location Module

## Purpose

Geolocation tracking with optional geofencing and persistence.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `location` via `LocationService` |
| Contracts | Location start/stop, geofence add/remove, updated, triggered, and error contracts. |

## Runtime Integration

Loaded with `FEATURES.LOCATION_MODULE`; runtime passes localStorage when available.

## Storage / Side Effects

Uses browser geolocation and may persist location/geofence state through configured storage.

## Tests

`tests/contracts.test.js`; lifecycle coverage appears in runtime tests.
