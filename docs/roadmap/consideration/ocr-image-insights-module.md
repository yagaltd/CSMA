## OCR & Image Insights Module (SmolDocling-256M-preview via transformer.js)

### Objective
- Process uploaded images locally (no network inference) to extract descriptions, layout-aware text, and tags for later search/filtering.
- Store derived metadata in IndexedDB via the existing `storage` + `file-system` modules.
- Run inference inside a Web Worker to keep the main thread responsive.

### Module Blueprint
- **New module**: `modules/ocr` (or `modules/image-intel`) with `OCRService.js` orchestrating a dedicated worker (`ocr.worker.js`).
- **Worker** loads `docling-project/SmolDocling-256M-preview` through the already-installed `@xenova/transformers` (no custom WASM plumbing; use built-in backend selection).
- **EventBus contracts** (examples):
  - `FILE_UPLOADED` → `{ fileId, handle, mime, size, name }` (from `file-system`).
  - `IMAGE_OCR_REQUESTED` → `{ fileId, priority?, language? }`.
  - `IMAGE_OCR_COMPLETED` → `{ fileId, description, tags, ocrText, blocks, modelInfo, durationMs }`.
  - `IMAGE_OCR_FAILED` → `{ fileId, error, stage }`.
- **ServiceManager wiring**: `OCRService` registers listeners on `FILE_UPLOADED` (gate by mime/size) and publishes completion/failure events; exposes `process(fileId, options)` for imperative use.
- **Validation**: add contracts under `runtime/validation` for request/response payloads; enforce mime allowlist (`image/png`, `image/jpeg`, `image/webp`), size cap (e.g., 6–10MB), dimension cap (optionally via `ImageOptimizerService` downscale before OCR).

### Worker Pipeline
1. **Init**: lazy-load transformer.js (already in deps), fetch model weights; cache with `transformer.js` local storage/IndexedDB (align with `file-system` storage for persistence).
2. **Preprocess**: read file via `file-system` handle (stream or blob), optional downscale/compress (reuse `image-optimizer`).
3. **Inference**: run SmolDocling to get structured output (text blocks, layout hints, tokens); derive:
   - `description` (short alt-text / caption)
   - `tags` (top keywords/categories)
   - `ocrText` (full text) and `blocks` (positions/roles if available)
4. **Postprocess**: sanitize strings, trim to size limits, dedupe tags, attach latency + model hash.
5. **Persist**: emit `IMAGE_OCR_COMPLETED`; consumer persists via `storage` module (IndexedDB) keyed by `fileId` with `{ meta: { mime, size, checksum }, insights: { description, tags, ocrText } }`.

### Dependencies & Integration Points
- **Libraries**: `@xenova/transformers` (already installed); model id `docling-project/SmolDocling-256M-preview` (ensure license/redistribution review, pin exact revision). Backend auto-selects (WebGPU/CPU/wasm) with no extra setup.
- **Existing modules to reuse**:
  - `file-system`: file handles, streaming, checksum; hook for chunked reads to avoid memory spikes.
  - `storage`: IndexedDB wrapper for metadata persistence.
  - `image-optimizer`: optional downscale/convert before OCR to control latency and VRAM/RAM.
  - `log-accumulator`: capture errors/perf metrics (duration, cache hits, worker restarts) in dev mode.
  - `network-status`: gate model download; show offline-ready if weights are cached.
- **Security/Privacy**: keep inference local; enforce CSP to block external model fetch unless explicitly allowed; sanitize OCR text; avoid storing raw image pixels in IndexedDB—store handles plus checksums.

### CSMA Process Flow (happy path)
1. UI/upload triggers `FILE_UPLOADED` (from `file-system`).
2. `OCRService` validates payload (size/mime), optionally requests `image-optimizer` downscale, then posts message to worker.
3. Worker ensures model is loaded, runs inference, returns structured result.
4. `OCRService` publishes `IMAGE_OCR_COMPLETED`; consumer writes to `storage` and updates UI via CSS-class reactivity (e.g., attach tags/description to card).
5. Errors publish `IMAGE_OCR_FAILED` with sanitized message; UI shows non-intrusive toast and leaves file intact.

### Data Model (IndexedDB via storage)
```json
{
  "id": "<fileId>",
  "meta": { "mime": "image/png", "size": 123456, "checksum": "sha256" },
  "insights": {
    "description": "two receipts on a table",
    "tags": ["receipt", "text", "table"],
    "ocrText": "...",
    "blocks": [{ "text": "Total", "bbox": [x,y,w,h], "role": "heading" }]
  },
  "model": { "id": "docling-project/SmolDocling-256M-preview", "rev": "pinned", "backend": "wasm" },
  "perf": { "durationMs": 850, "fromCache": true }
}
```

### MVP Tasks
- Add `modules/ocr/OCRService.js` with contracts + EventBus wiring; register in `modules/ocr/index.js`.
- Add `modules/ocr/ocr.worker.js` to load transformer.js + SmolDocling, expose `init` and `runOcr` messages.
- Extend `runtime/validation` contracts for OCR request/response; add mime/size allowlist.
- Add `scripts` entry to prefetch/cache model in dev? (optional CLI helper).
- UI hook (file-upload demo):
  - Extend `ui/components/file-upload/file-upload.demo.html` with a “Process to summary” button per uploaded item.
  - Button triggers `OCRService.process(fileId)`; show loading state tied to EventBus events.
  - Render the returned description (trim to 248 chars, add ellipsis) below the file name; allow copy-to-clipboard.
  - Provide option to export as markdown/plain text snippet within the demo pane for quick preview.

### Risks & Mitigations
- **Bundle/weight size**: load transformer.js + model only in worker, behind user action; prefer CDN-with-integrity or packaged assets; pin revision.
- **Memory**: stream read and optional downscale; cap resolution; release tensors after inference.
- **Latency**: warm worker at idle; cache model in IndexedDB; surface progress events.
- **Compliance**: keep processing local; avoid sending images externally; gate by consent when images may contain personal data.

### Future Enhancements
- Multi-language OCR selection; language detection fallback.
- Region-level tagging and semantic search integration (FlexSearch ingest of `description` + `tags`).
- Batch mode for galleries; queueing/priorities via `sync-queue`.
- Optional cloud-offload plug: swap worker provider with remote inference behind the same contracts.
