# Media Module

## Purpose

Unified media capture and image optimization. Handles photo, video, audio, and
screen recording, plus client-side image compression, format conversion, and
resizing — all using browser Canvas APIs with zero external dependencies.

## Public Surface

| Surface | Details |
|---------|---------|
| Service(s) | `media` via `MediaService` |
| Contracts | See `contracts/media-contracts.js` — capture + transform intents/events |

## Runtime Integration

Loaded with `FEATURES.MEDIA`. The `file-system` module is optional — only needed
when capture persistence is enabled.

```js
// features.js handles module loading
// With file-system (persistence):
media.init({ fileSystemService });
// Without file-system (transform-only):
media.init();
```

## Capture API

| Method | Description |
|--------|-------------|
| `capturePhoto(metadata?)` | Photo via file picker or camera |
| `startVideoCapture(metadata?)` | Start video recording |
| `stopVideoCapture(metadata?)` | Stop video recording |
| `startAudioCapture(metadata?)` | Start audio recording |
| `stopAudioCapture(metadata?)` | Stop audio recording |
| `startScreenCapture(metadata?)` | Start screen recording via `getDisplayMedia()` |
| `stopScreenCapture(metadata?)` | Stop screen recording |
| `cancel()` | Cancel any active recording |
| `requestPermission(type)` | Request camera/microphone/screen permission |

## Transform API

| Method | Description |
|--------|-------------|
| `transform({ blob, format, quality?, resize? })` | Single format encode |
| `optimize({ blob, targets, quality?, resize?, metadata? })` | Multi-variant optimization |
| `resize({ blob, width?, height?, maxWidth?, maxHeight? })` | Resize only |
| `registerCodec(mimeType, codec)` | Register custom codec (e.g. WASM avif) |

## Encoding Pipeline — Browser Tiers

| Tier | Method | Browser support |
|------|--------|-----------------|
| Tier 1 | Worker + `OffscreenCanvas` + `convertToBlob` | Chrome 69+, Firefox 105+, Safari 16.4+ |
| Tier 2 | Main thread + `OffscreenCanvas` + `convertToBlob` | Safari 15–16.3, some WebViews |
| Tier 3 | Main thread + `HTMLCanvasElement` + `toDataURL` | iOS < 16, older browsers |

Tier detection runs at init time. Encoding uses the highest available tier.

ArrayBuffer transfer is used in the Worker path (Blob is structured-cloneable
but not Transferable).

## Built-in Codecs

| Format | Codec | Notes |
|--------|-------|-------|
| `image/webp` | `WebpCodec` | Primary optimization target, quality 0.85 |
| `image/jpeg` | `JpegCodec` | White bg fill, EXIF orientation correction, quality 0.92 |
| `image/png` | `PngCodec` | Lossless, quality ignored |

Codec interface for custom/WASM codecs:

```js
{
  encode(blob, options) → Promise<{ blob, metadata }>,
  decode(blob) → Promise<ImageBitmap>
}
```

## EXIF Handling

`JpegCodec` and `CanvasCodec` automatically read JPEG EXIF orientation (tag
0x0112) and apply the correct rotation/flip transform before encoding.

## file-system Dependency

`file-system` is **optional**. `transform()` and `optimize()` work without any
persistence layer. Persistence is only wired when the host app provides a
`fileSystemService` during init and `persistCaptures` is enabled (default).

## Deprecated Contract Aliases

Old contract names from `camera`, `media-capture`, `media-transform`, and
`image-optimizer` modules are aliased during the deprecation window (v2.0).
The EventBus subscriptions in `MediaService` handle both old and new names.

## Storage / Side Effects

- Capture: optionally writes blobs via `file-system` to OPFS/IndexedDB
- Transform: processes blobs in memory (Worker or main thread)
- Canvas cleanup: Safari memory workaround (WebKit #195325)

## Tests

`tests/media-*.test.js` — unit tests with mocked canvas APIs.
`tests/browser/media-*.spec.js` — Playwright browser smoke tests.
