# Media Module Plan

> Status: **Draft** — consolidate 4 modules into 1 unified `media` module.
> Date: 2026-04-27

## Current State — 4 modules doing partial work

### `camera` module

Photo capture (file picker + `<input capture="environment">`) and video recording (`getUserMedia({ video, audio })` + `MediaRecorder`). Stores via `file-system`. Working but limited — no live stream preview, no snapshot from video track, no screencast.

### `media-capture` module

Audio recording only (`getUserMedia({ audio: true })` + `MediaRecorder`). Stores via `file-system`. Working. **Massive overlap** with camera's video recording — same `MediaRecorder` lifecycle, same start/stop/cancel pattern, same file-system integration.

### `media-transform` module

Shell. `MediaTransformService` has adapter architecture but only a passthrough `default` adapter. No actual encoding or resizing.

### `image-optimizer` module

Shell. Loops over target formats, calls `mediaTransform.transform()`, stores variants via `file-system`. Correctly designed orchestration with nothing to call.

### The problem

| Issue | Detail |
|-------|--------|
| **Duplicate recording** | `camera` and `media-capture` both implement `MediaRecorder` lifecycle with identical start/stop/cancel logic |
| **Duplicate storage** | Both store via `file-system` with nearly identical `#persistCapture` / `persistRecordings` code |
| **Two dead shells** | `media-transform` and `image-optimizer` do nothing |
| **Missing capture types** | No screencap (`getDisplayMedia`), no photo snapshot from live video stream |
| **No image pipeline** | No compression, no resize, no format conversion |
| **Wrong name** | `camera` implies photos only, but it also does video. `media-capture` is audio only. Naming is confusing. |

## Proposal — One `media` Module

Merge `camera` + `media-capture` + `media-transform` + `image-optimizer` into a single `media` module that owns the full pipeline:

```
capture (optional) → transform (optional) → persist
```

### Why one module

Every flow through these modules is the same 3-step pipeline:

| Flow | Capture | Transform | Persist |
|------|---------|-----------|---------|
| Take photo → compress → save | Photo capture | Webp encode | file-system |
| Record video → save | Video capture | (passthrough) | file-system |
| Record audio → save | Audio capture | (passthrough) | file-system |
| Screencast → save | Screen capture | (passthrough) | file-system |
| Upload image → resize + compress → save | (skip) | Resize + webp | file-system |
| Snapshot from live camera → save | Frame capture | Resize + jpeg | file-system |

One module, one service, one set of contracts, one optional dependency (`file-system` for persistence).

## Module Structure

```
src/modules/media/
  index.js                                     ← manifest + exports
  README.md
  contracts/
    media-contracts.js                         ← unified contracts for all capture + transform intents
  services/
    MediaService.js                            ← THE service: capture, record, transform, optimize, resize
  codecs/
    CanvasCodec.js                             ← base: createImageBitmap → OffscreenCanvas → convertToBlob
    JpegCodec.js                               ← extends CanvasCodec: EXIF orientation, white bg fill
    PngCodec.js                                ← extends CanvasCodec: PNG defaults
    WebpCodec.js                               ← extends CanvasCodec: WebP defaults
  exif/
    ExifReader.js                              ← parse JPEG EXIF orientation from ArrayBuffer
    ExifOrientation.js                         ← apply orientation transform to OffscreenCanvas
  resize/
    CanvasResize.js                            ← dimension-constrained resize via OffscreenCanvas.drawImage
  utils/
    CanvasPool.js                              ← OffscreenCanvas reuse, Safari memory cleanup, browser max-size clamping
    BlobUtils.js                               ← blob ↔ ImageBitmap ↔ ImageData conversion helpers
  workers/
    transform-worker.js                        ← Web Worker: runs codec encode/resize off main thread
```

## Modules Deleted

| Module | What happens |
|--------|-------------|
| `camera` | **Deleted.** Photo + video capture moves to `MediaService`. `ExifParser.js` replaced by `exif/ExifReader.js`. |
| `media-capture` | **Deleted.** Audio recording moves to `MediaService`. |
| `media-transform` | **Deleted.** Codec registry + worker dispatch moves to `MediaService`. |
| `image-optimizer` | **Deleted.** Multi-variant optimization loop moves to `MediaService`. |

## `MediaService` API

### Capture methods

```js
// Photo — file picker or live camera snapshot
capturePhoto(options?: { source, mimeType, metadata }) → { blob, metadata, file? }

// Video recording
startVideoCapture(options?: { mimeType, metadata }) → { id }
stopVideoCapture(metadata?) → { blob, duration, metadata, file? }

// Audio recording
startAudioCapture(options?: { mimeType, metadata }) → { id }
stopAudioCapture(metadata?) → { blob, duration, metadata, file? }

// Screencast / screen recording
startScreenCapture(options?: { mimeType, audio, metadata }) → { id }
stopScreenCapture(metadata?) → { blob, duration, metadata, file? }

// Cancel any active recording
cancel() → void

// Permission helpers
requestPermission(type: 'photo' | 'video' | 'audio' | 'screen') → boolean
```

### Transform methods

```js
// Single format encode
transform(options: { blob, format, quality, resize? }) → { blob, metadata }

// Multi-variant optimization (was image-optimizer)
optimize(options: { blob, targets, quality?, resize?, metadata? }) → { outputs, summary }

// Resize only
resize(options: { blob, width?, height?, maxWidth?, maxHeight?, maintainAspect? }) → { blob, metadata }

// Codec registry (for future WASM codecs)
registerCodec(mimeType, codec) → void
```

### Transform options accepted everywhere

Every method that produces an image blob accepts optional `resize` and `quality` params:

```js
// Capture photo, compress to webp, resize to max 1920px
media.capturePhoto({
  mimeType: 'image/webp',
  quality: 0.85,
  resize: { maxWidth: 1920, maxHeight: 1080 }
});

// Same transform params work on optimize()
media.optimize({
  blob: uploadedFile,
  targets: ['image/webp', 'image/jpeg'],
  resize: { maxWidth: 1920 }
});
```

## Codec Specification

### `CanvasCodec` (base)

The foundation. Every browser format codec extends this.

```
Constructor:
  - mimeType: string (e.g. 'image/webp')
  - defaultQuality: number (0.85)

encode(blob, options = {}):
  1. blobToImageBitmap(blob) — with Safari/iOS fallback
  2. Clamp dimensions to browser canvas max (per-browser limits)
  3. Apply EXIF orientation if JPEG (delegates to ExifOrientation)
  4. Apply resize if options.width or options.height set (delegates to CanvasResize)
  5. Create OffscreenCanvas, draw ImageBitmap
  6. canvas.convertToBlob({ type, quality })
  7. Return blob

decode(blob):
  1. createImageBitmap(blob)
  2. Return ImageBitmap
```

~120 lines.

### `JpegCodec`

Extends `CanvasCodec`. White background fill (JPEG has no alpha). EXIF orientation correction. Default quality 0.92. ~40 lines.

### `WebpCodec`

Extends `CanvasCodec`. Primary optimization target. Default quality 0.85. ~20 lines.

### `PngCodec`

Extends `CanvasCodec`. Lossless, quality param ignored. ~20 lines.

### `ExifReader`

Parse JPEG EXIF orientation tag (0x0112) from ArrayBuffer via DataView. ~80 lines.

### `ExifOrientation`

Apply rotation/flip to OffscreenCanvas via `ctx.transform()`. Handles orientations 2–8, passes through orientation 1. ~60 lines.

### `CanvasResize`

Dimension-constrained resize via `drawImage` scaling. Supports `maxWidth/maxHeight` (scale-down only) and exact `width/height`. Maintains aspect ratio by default. ~50 lines.

### `CanvasPool`

OffscreenCanvas reuse. Safari cleanup (zero width/height for WebKit #195325). Browser max-size detection and clamping. ~40 lines.

### `BlobUtils`

Shared conversion helpers. `blobToImageBitmap` with iOS/Safari `Image` + data URL fallback. `imageBitmapToBlob`. `canvasToBlob` with `convertToBlob` / `toDataURL` fallback. ~60 lines.

### `transform-worker.js`

Web Worker entry. Receives `{ blob, format, quality, resize }`. Imports codec for the requested format. Runs encode. Returns `{ blob, metadata }` via `postMessage`. Lazy-initialized by `MediaService`. Self-terminates after 60s idle. Main-thread fallback when Worker unavailable. ~60 lines.

## Encoding Pipeline — Browser Support Tiers

The image encoding pipeline has three execution paths. `MediaService` detects
browser capabilities at init time and selects the highest available tier.

### Tier detection

```js
detectTier() {
  // Tier 1: Worker + OffscreenCanvas + convertToBlob
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(1, 1);
      if (typeof c.convertToBlob === 'function') return 'tier1';
    } catch (_) { /* fall through */ }
  }
  // Tier 2: Main thread + OffscreenCanvas + convertToBlob
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(1, 1);
      if (typeof c.convertToBlob === 'function') return 'tier2';
    } catch (_) { /* fall through */ }
  }
  // Tier 3: Main thread + HTMLCanvasElement + toDataURL
  if (typeof document !== 'undefined') return 'tier3';
  // No image support
  return 'none';
}
```

### Tier 1 — Worker + OffscreenCanvas (Chrome 69+, Firefox 105+, Safari 16.4+)

```
Main Thread                              Worker Thread
──────────                              ─────────────
MediaService
  transform({blob, format, ...})
       │
       ├─ blob.arrayBuffer() → ab          (Blob is structured-cloneable
       │                                    but NOT a Transferable; transfer
       │                                    the underlying ArrayBuffer instead)
       ├─ postMessage({ab, type}, [ab]) ──→ receive
       │                                     │
       │                                 new Blob([ab], {type})
       │                                 createImageBitmap(blob)
       │                                 OffscreenCanvas + drawImage
       │                                 canvas.convertToBlob({ type, quality })
       │                                     │
       │                                 result.arrayBuffer()
       ├─ onmessage({ab, type}, [ab]) ←──────┘  (ArrayBuffer transfer back)
       │
       ├─ new Blob([ab], {type})
       │
  return { blob, metadata }
```

- **ArrayBuffer transfer** — zero-copy via Transferable. Blob itself is
  structured-cloneable but NOT a Transferable. Extract `.arrayBuffer()`,
  transfer the ArrayBuffer, reconstruct Blob on the other side.
- **Persistent worker** — created on first transform, reused, terminated on
  `destroy()`
- **Idle timeout** — worker self-terminates after 60s inactivity

### Tier 2 — Main thread + OffscreenCanvas (Safari 16.3, some WebViews)

```
MediaService (main thread)
  transform({blob, format, ...})
       │
       ├─ createImageBitmap(blob)         (no Worker available)
       ├─ new OffscreenCanvas(w, h)
       ├─ ctx.drawImage(bitmap)
       ├─ canvas.convertToBlob({ type, quality })
       │
  return { blob, metadata }
```

- Runs on main thread. No Worker.
- OffscreenCanvas + convertToBlob still avoids DOM.
- Log info: `[Media] Worker unavailable, encoding on main thread`

### Tier 3 — Main thread + HTMLCanvasElement (iOS < 16, older browsers)

```
MediaService (main thread)
  transform({blob, format, ...})
       │
       ├─ blob → data URL (URL.createObjectURL)
       ├─ new Image() + onload
       ├─ document.createElement('canvas')
       ├─ ctx.drawImage(image)
       ├─ canvas.toDataURL(type, quality) → base64
       ├─ base64 → Uint8Array → Blob
       │
  return { blob, metadata }
```

- Full DOM fallback. Main thread blocking.
- `createImageBitmap` may not exist; use `Image` element.
- `OffscreenCanvas` not available; use `HTMLCanvasElement`.
- `convertToBlob` not available; use `toDataURL` + base64 decode.
- Log warning: `[Media] Limited browser support, encoding via canvas fallback`

### Safari / iOS specific handling

| Browser | Tier | Known issues |
|---------|------|-------------|
| Safari 16.4+ | Tier 1 | OffscreenCanvas in Worker supported since 16.4 |
| Safari 15–16.3 | Tier 2 | `OffscreenCanvas` exists but not in Worker context |
| iOS Safari 15 | Tier 2 | `createImageBitmap` available but no Worker OffscreenCanvas |
| iOS Safari < 15 | Tier 3 | No `createImageBitmap`; must use `Image` element fallback |
| iOS (all) | All | Canvas memory bug (WebKit #195325): zero `width`/`height` after use |
| iOS (all) | All | Max canvas size: 4,096 × 4,096 (device-dependent), lower than desktop |

### Canvas max size per browser

```
Chrome/Edge:  65,536 × 65,536
Firefox:      32,767 × 32,767
Safari:       16,384 × 16,384
iOS Safari:    4,096 ×  4,096 (device-dependent)
```

`CanvasPool` detects the current browser limit and clamps dimensions before
creating any canvas.

## Contracts

### Unified contract namespace: `media` (owner: `media-module`)

#### Capture intents (from camera + media-capture)

```js
INTENT_MEDIA_CAPTURE_PHOTO        // capture a photo
INTENT_MEDIA_CAPTURE_VIDEO_START  // start video recording
INTENT_MEDIA_CAPTURE_VIDEO_STOP   // stop video recording
INTENT_MEDIA_CAPTURE_AUDIO_START  // start audio recording (was media-capture INTENT_MEDIA_CAPTURE_START)
INTENT_MEDIA_CAPTURE_AUDIO_STOP   // stop audio recording (was media-capture INTENT_MEDIA_CAPTURE_STOP)
INTENT_MEDIA_CAPTURE_SCREEN_START // start screencast recording (NEW)
INTENT_MEDIA_CAPTURE_SCREEN_STOP  // stop screencast recording (NEW)
INTENT_MEDIA_CAPTURE_CANCEL       // cancel any active recording
```

#### Capture events

```js
MEDIA_CAPTURE_COMPLETED           // any capture finished: { type: 'photo'|'video'|'audio'|'screen', ... }
MEDIA_CAPTURE_STARTED             // recording started
MEDIA_CAPTURE_ERROR               // capture failed
```

#### Transform intents (from media-transform + image-optimizer)

```js
INTENT_MEDIA_TRANSFORM            // single format encode
INTENT_MEDIA_OPTIMIZE             // multi-variant optimization
INTENT_MEDIA_RESIZE               // resize only
```

#### Transform events

```js
MEDIA_TRANSFORM_COMPLETED         // single encode done
MEDIA_OPTIMIZE_COMPLETED          // multi-variant done (was IMAGE_OPTIMIZE_COMPLETED)
MEDIA_RESIZE_COMPLETED            // resize done
MEDIA_TRANSFORM_ERROR             // transform failed
```

### Backward compatibility

Old contract names are aliased during a deprecation window:

| Old contract | New contract | Deprecation |
|---|---|---|
| `INTENT_CAMERA_CAPTURE_PHOTO` | `INTENT_MEDIA_CAPTURE_PHOTO` | v2.0 |
| `INTENT_CAMERA_CAPTURE_VIDEO_START` | `INTENT_MEDIA_CAPTURE_VIDEO_START` | v2.0 |
| `INTENT_CAMERA_CAPTURE_VIDEO_STOP` | `INTENT_MEDIA_CAPTURE_VIDEO_STOP` | v2.0 |
| `CAMERA_CAPTURE_COMPLETED` | `MEDIA_CAPTURE_COMPLETED` | v2.0 |
| `CAMERA_CAPTURE_ERROR` | `MEDIA_CAPTURE_ERROR` | v2.0 |
| `INTENT_MEDIA_CAPTURE_START` | `INTENT_MEDIA_CAPTURE_AUDIO_START` | v2.0 |
| `INTENT_MEDIA_CAPTURE_STOP` | `INTENT_MEDIA_CAPTURE_AUDIO_STOP` | v2.0 |
| `INTENT_MEDIA_CAPTURE_CANCEL` | `INTENT_MEDIA_CAPTURE_CANCEL` | v2.0 (unchanged) |
| `MEDIA_CAPTURE_STOPPED` | `MEDIA_CAPTURE_COMPLETED` | v2.0 |
| `INTENT_IMAGE_OPTIMIZE` | `INTENT_MEDIA_OPTIMIZE` | v2.0 |
| `IMAGE_OPTIMIZE_COMPLETED` | `MEDIA_OPTIMIZE_COMPLETED` | v2.0 |
| `IMAGE_OPTIMIZE_ERROR` | `MEDIA_TRANSFORM_ERROR` | v2.0 |
| `INTENT_MEDIA_TRANSFORM` | `INTENT_MEDIA_TRANSFORM` | v2.0 (unchanged) |
| `MEDIA_TRANSFORM_COMPLETED` | `MEDIA_TRANSFORM_COMPLETED` | v2.0 (unchanged) |

## `features.js` Changes

### Before (4 feature flags, 4 module loads)

```js
FEATURES.CAMERA_MODULE    → load 'camera' module
FEATURES.MEDIA_CAPTURE     → load 'media-capture' module
FEATURES.MEDIA_TRANSFORM   → load 'media-transform' module
FEATURES.IMAGE_OPTIMIZER   → load 'image-optimizer' module (depends on media-transform)
```

### After (1 feature flag, 1 module load)

```js
FEATURES.MEDIA             → load 'media' module
```

Feature flag migration:

| Old flag | New flag |
|----------|----------|
| `FEATURES.CAMERA_MODULE` | `FEATURES.MEDIA` |
| `FEATURES.MEDIA_CAPTURE` | `FEATURES.MEDIA` |
| `FEATURES.MEDIA_TRANSFORM` | `FEATURES.MEDIA` |
| `FEATURES.IMAGE_OPTIMIZER` | `FEATURES.MEDIA` |

Old flags remain as aliases that map to `FEATURES.MEDIA` with a deprecation warning during the transition period.

## Manifest

```js
{
  id: 'media',
  name: 'Media Module',
  version: '1.0.0',
  description: 'Photo, video, audio, and screen capture with image optimization',
  dependencies: [],  // file-system is optional, only needed for capture persistence
  services: ['media'],
  bundleSize: '+14KB',
  contracts: [
    // capture
    'INTENT_MEDIA_CAPTURE_PHOTO',
    'INTENT_MEDIA_CAPTURE_VIDEO_START',
    'INTENT_MEDIA_CAPTURE_VIDEO_STOP',
    'INTENT_MEDIA_CAPTURE_AUDIO_START',
    'INTENT_MEDIA_CAPTURE_AUDIO_STOP',
    'INTENT_MEDIA_CAPTURE_SCREEN_START',
    'INTENT_MEDIA_CAPTURE_SCREEN_STOP',
    'INTENT_MEDIA_CAPTURE_CANCEL',
    'MEDIA_CAPTURE_STARTED',
    'MEDIA_CAPTURE_COMPLETED',
    'MEDIA_CAPTURE_ERROR',
    // transform
    'INTENT_MEDIA_TRANSFORM',
    'INTENT_MEDIA_OPTIMIZE',
    'INTENT_MEDIA_RESIZE',
    'MEDIA_TRANSFORM_COMPLETED',
    'MEDIA_OPTIMIZE_COMPLETED',
    'MEDIA_RESIZE_COMPLETED',
    'MEDIA_TRANSFORM_ERROR'
  ]
}
```

## What Is NOT In Scope

| Out of scope | Reason |
|-------------|--------|
| WASM codecs (avif, jxl, oxipng) | Future plugin via `registerCodec()`. Browser APIs don't provide these. WASM adds 275KB–3.4MB per codec. Load on demand later. |
| Build-time image optimization | CSMA is a runtime framework. Vite/rollup plugin is a separate concern. |
| `<picture>` / `srcset` generation | Presentation concern. Media module produces blobs, not HTML. |
| Video encoding/transcoding | Browser `MediaRecorder` outputs whatever the browser supports. No runtime transcoding without `WebCodecs` API (limited support). |
| Audio processing/transcoding | Same as video. `MediaRecorder` output is browser-dependent. |
| Live stream preview component | UI concern, not module concern. The module provides the stream, the app renders it. |
| UPNG.js / custom PNG quantization | Browser PNG encoder is lossless and sufficient. ~1,400 lines for marginal benefit. |

## Future Codec Plugin Path

When a site needs avif or other WASM-based formats:

```js
const avifModule = await import('./codecs/wasm/AvifCodec.js');
const avifCodec = new avifModule.AvifCodec({ wasmUrl: '/wasm/avif_enc.wasm' });
media.registerCodec('image/avif', avifCodec);

// Now all transform/optimize calls support 'image/avif'
media.optimize({ blob, targets: ['image/webp', 'image/avif'] });
```

Codec interface:

```
{
  encode(blob, options) → Promise<Blob>
  decode(blob) → Promise<ImageBitmap | ImageData>
}
```

Any codec (WASM, WebGL, WebCodecs) implements this interface and registers. No service changes needed.

## Implementation Order

### Phase 1 — Core codecs (new code, no deletion)

| Step | File | Est. lines |
|------|------|------------|
| 1.1 | `codecs/utils/BlobUtils.js` — blob ↔ ImageBitmap helpers with Safari/iOS fallbacks | ~60 |
| 1.2 | `codecs/utils/CanvasPool.js` — OffscreenCanvas reuse, Safari cleanup, browser max-size clamping | ~40 |
| 1.3 | `codecs/exif/ExifReader.js` — parse JPEG EXIF orientation from ArrayBuffer | ~80 |
| 1.4 | `codecs/exif/ExifOrientation.js` — apply orientation transform to OffscreenCanvas | ~60 |
| 1.5 | `codecs/CanvasCodec.js` — base: ImageBitmap → canvas → convertToBlob | ~120 |
| 1.6 | `codecs/JpegCodec.js` — extends CanvasCodec + white fill + EXIF orientation | ~40 |
| 1.7 | `codecs/WebpCodec.js` — extends CanvasCodec, WebP defaults | ~20 |
| 1.8 | `codecs/PngCodec.js` — extends CanvasCodec, PNG defaults | ~20 |
| 1.9 | `codecs/resize/CanvasResize.js` — dimension-constrained resize via drawImage | ~50 |
| 1.10 | `codecs/workers/transform-worker.js` — Worker entry: codec import + encode + postMessage | ~60 |

**Phase 1 subtotal: ~550 lines**

### Phase 2 — MediaService (unified service)

| Step | File | Est. lines |
|------|------|------------|
| 2.1 | `services/MediaService.js` — unified service with capture, record, transform, optimize, resize, codec registry, worker dispatch | ~350 |
| 2.2 | `contracts/media-contracts.js` — full unified contract set with deprecation aliases | ~200 |
| 2.3 | `index.js` — manifest + exports | ~50 |
| 2.4 | `README.md` | — |

**Phase 2 subtotal: ~600 lines**

### Phase 3 — Integration + feature flag

| Step | File | Description |
|------|------|-------------|
| 3.1 | `src/runtime/features.js` | Replace 4 flags with `FEATURES.MEDIA`, add aliases |
| 3.2 | `src/runtime/Contracts.js` | Register new contract namespace |

### Phase 4 — Delete old modules

| Step | Action |
|------|--------|
| 4.1 | Delete `src/modules/camera/` |
| 4.2 | Delete `src/modules/media-capture/` |
| 4.3 | Delete `src/modules/media-transform/` |
| 4.4 | Delete `src/modules/image-optimizer/` |
| 4.5 | Remove old feature flags from `features.js` (after deprecation window) |

### Phase 5 — Unit tests (jsdom)

| Step | File | Description |
|------|------|-------------|
| 5.1 | `tests/media-service.test.js` | Service-level: codec registry, contract publishing, persistence opt-in/out |
| 5.2 | `tests/media-codecs.test.js` | Unit tests for each codec (encode, decode) with mocked canvas |
| 5.3 | `tests/media-worker.test.js` | Worker dispatch and ArrayBuffer transfer |
| 5.4 | `tests/media-exif.test.js` | EXIF orientation parsing and correction |
| 5.5 | `tests/media-resize.test.js` | Dimension constraints, aspect ratio maintenance |
| 5.6 | `tests/media-contracts.test.js` | Contract validation for all intents/events |
| 5.7 | `tests/media-tier-detection.test.js` | Tier detection logic for all 3 tiers + `none` |

### Phase 5b — Browser smoke tests (Playwright)

Unit tests cover codecs, contracts, and service logic in jsdom with mocked
canvas APIs. Camera, audio, and screen capture cannot be meaningfully tested
in jsdom — they require real browser `getUserMedia`, `getDisplayMedia`, and
`MediaRecorder` APIs.

| Step | File | Description |
|------|------|-------------|
| 5b.1 | `tests/browser/media-transform.spec.js` | Playwright: real image encode/resize in Chromium, Firefox, WebKit |
| 5b.2 | `tests/browser/media-worker.spec.js` | Playwright: Worker + OffscreenCanvas end-to-end, ArrayBuffer round-trip |
| 5b.3 | `tests/browser/media-tier-fallbacks.spec.js` | Playwright: force Tier 2/3 by disabling Worker/OffscreenCanvas, verify encode still works |
| 5b.4 | `tests/browser/media-capture-mock.spec.js` | Playwright: capture methods with `page.evaluate` + mocked `getUserMedia`/`getDisplayMedia` streams |
| 5b.5 | `tests/browser/media-safari-canvas.spec.js` | Playwright (WebKit): canvas size clamping, memory cleanup, `toDataURL` fallback |

Mocking strategy for capture tests:

```js
// Playwright: inject fake media stream before page loads
await page.addInitScript(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const stream = canvas.captureStream(30);
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream);
  navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
  // MediaRecorder mock that collects chunks
  window.__mockMediaRecorderChunks = [];
  class MockMediaRecorder {
    constructor(stream, opts) { this.stream = stream; this.opts = opts; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      const blob = new Blob([new Uint8Array(100)], { type: this.opts?.mimeType || 'video/webm' });
      this.ondataavailable?.({ data: blob });
      this.onstop?.();
    }
    ondataavailable = null;
    onstop = null;
    onerror = null;
  }
  window.MediaRecorder = MockMediaRecorder;
});
```

### Phase 6 — Documentation

| Step | File | Description |
|------|------|-------------|
| 6.1 | `src/modules/media/README.md` | Full module documentation |
| 6.2 | Update `AGENTS.md` module table | Replace 4 entries with 1 `media` entry |
| 6.3 | Update skill docs that reference old module names | `docs/architecture/SKILL.md` etc. |

## Bundle Size Estimate

| Component | Estimated size |
|-----------|---------------|
| MediaService (capture + record + transform + optimize + resize) | ~5 KB |
| CanvasCodec + JpegCodec + WebpCodec + PngCodec | ~3.5 KB |
| ExifReader + ExifOrientation | ~2 KB |
| CanvasResize | ~0.5 KB |
| CanvasPool + BlobUtils | ~1.5 KB |
| transform-worker.js | ~1 KB |
| Contracts | ~1.5 KB |
| **Total** | **~15 KB** |

Current total across 4 modules: 5KB (camera) + 4KB (media-capture) + 5KB (media-transform) + 3KB (image-optimizer) = **17KB** — and most of it doesn't work.

After merge: **15KB** — with full capture + working compression + resize + worker.

## Reference: External Libraries Analyzed

### `browser-image-compression` (v2.0.2, MIT)

57KB wrapping browser Canvas APIs. Evaluated and rejected as a dependency. Used as reference for:

- EXIF orientation parsing and correction patterns
- Safari/iOS `createImageBitmap` fallback to `Image` + data URL
- Per-browser canvas max-size table
- Iterative quality reduction loop
- Canvas memory cleanup (WebKit #195325)

These are standard browser API patterns, reimplemented from the API specification.

### `jSquash` (Apache-2.0)

WASM ports of Squoosh codecs (webp 275KB, avif 3.4MB, jpeg, png, jxl, resize). Evaluated and rejected as a dependency. The codec adapter pattern in this plan supports future lazy-loading of jSquash packages as optional WASM codecs via `registerCodec()`.

## Acceptance Criteria

- [ ] `MediaService.capturePhoto()` works via file picker (like current camera module)
- [ ] `MediaService.startVideoCapture()` / `stopVideoCapture()` works (like current camera module)
- [ ] `MediaService.startAudioCapture()` / `stopAudioCapture()` works (like current media-capture module)
- [ ] `MediaService.startScreenCapture()` / `stopScreenCapture()` works via `getDisplayMedia()` (NEW)
- [ ] `MediaService.transform()` encodes blobs to webp, jpeg, png via browser Canvas API
- [ ] JPEG encoding corrects EXIF orientation automatically
- [ ] All image encoding runs via highest available tier (Worker preferred, main-thread fallback, HTMLCanvas fallback)
- [ ] `MediaService.resize()` works via `transform({ resize })` and standalone method
- [ ] `MediaService.optimize()` produces multi-format variants (replaces image-optimizer)
- [ ] Tier detection correctly identifies Tier 1 / 2 / 3 / none
- [ ] Tier 2: main-thread OffscreenCanvas works when Worker unavailable
- [ ] Tier 3: HTMLCanvasElement + toDataURL works when OffscreenCanvas unavailable
- [ ] Safari/iOS fallback paths work (canvas memory cleanup, size clamping, Image element fallback)
- [ ] ArrayBuffer transfer used in Worker path (Blob is not Transferable)
- [ ] Playwright browser smoke tests pass on Chromium, Firefox, WebKit
- [ ] `file-system` is optional: `transform()` and `optimize()` work without it
- [ ] All old contracts aliased for backward compatibility during deprecation window
- [ ] `camera`, `media-capture`, `media-transform`, `image-optimizer` modules deleted
- [ ] `FEATURES.MEDIA` replaces 4 old feature flags
- [ ] No new npm dependencies
- [ ] Bundle stays under 15KB
- [ ] Tests cover capture, codecs, worker, EXIF, resize, and contracts
