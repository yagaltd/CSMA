# Video Module — Implementation Plan

> **Status:** Deferred — slides module must ship and stabilize first.
> **Module ID:** `video`
> **Depends on:** `slides` (layouts), `media` (capture/transform/codecs), `ai` (TTS, content generation)
> **Optional adapters:** GSAP, Lottie, Three.js, Anime.js, Web Animations API, TypeGPU/WebGPU

---

## 1. Why a separate module

The slides module and the video module share layout code but have fundamentally different engines. Bolting a video mode onto an interaction engine (or vice versa) produces two conflicting mental models in one codebase — HyperFrames proved this with its slideshow mode monkey-patching a video timeline.

CSMA's answer: **two modules, two engines, shared layouts. Each does one thing well.**

| | `slides` module | `video` module |
|---|---|---|
| **Engine** | Interaction loop (keyboard → click counter → DOM swap) | Timeline loop (GSAP master timeline → seekable playback) |
| **Time model** | Discrete steps (slide index + click count) | Continuous seconds (`currentTime`) |
| **Navigation** | User-driven (clicker, keyboard, dock buttons) | Playback-driven (play/pause/seek/scrub) |
| **Animation** | CSS transitions on `data-*` toggle | GSAP timeline + adapters (Lottie, Three.js, WAAPI) |
| **Fragments** | `<Build at={n}>` — DOM elements toggle visibility | `fragments: [3.5, 5.2]` — timeline seek positions |
| **Media** | Static images, canvas charts, embedded `<video>` | Audio tracks, TTS, beat detection, video clips |
| **Export** | PNG/PDF via canvas codec | MP4 via WebCodecs or ffmpeg.wasm |
| **Presenter** | Cross-tab sync (presenter window ↔ audience) | Not applicable (output is a rendered video) |
| **State** | `SlideDeckService` (index + clicks + annotations) | `VideoCompositionService` (currentTime + playing + volume) |

---

## 2. Shared infrastructure

```
src/modules/slides/layouts/     ← both modules use these
  cover.js, split.js, bento.js, globe.js, charts.js,
  stat-grid.js, big-number.js, quote.js, comparison.js,
  steps.js, timeline.js, chat.js, pricing.js, ...

src/modules/slides/engine/      ← slides only
  deck.js, build.js, annotator.js

src/modules/video/engine/       ← video only
  timeline.js, composer.js, exporter.js

src/modules/media/              ← shared (already exists)
  codecs/, services/MediaService.js, workers/transform-worker.js
```

The video module declares `dependencies: ['slides']` in its manifest and imports layout factories from the slides module. No code duplication.

---

## 3. Module structure (planned)

```
src/modules/video/
├── index.js                       # manifest + services + contracts + re-exports
├── plan.md                        # this file
├── README.md
│
├── contracts/
│   └── video-contracts.js         # PLAYBACK_STARTED, TIMELINE_SEEK, RENDER_REQUESTED, etc.
│
├── services/
│   └── VideoCompositionService.js # timeline state machine, play/pause/seek
│
├── engine/
│   ├── timeline.js                # GSAP master timeline builder
│   ├── composer.js                # reads video config, instantiates layouts on timeline
│   ├── exporter.js                # WebCodecs / ffmpeg.wasm pipeline
│   └── timeline-scheduler.js      # deterministic frame scheduler for export
│
├── adapters/
│   ├── gsap.js                    # GSAP adapter (primary runtime)
│   ├── lottie.js                  # Lottie/dotLottie adapter
│   ├── three.js                   # Three.js / WebGL adapter
│   ├── animejs.js                 # Anime.js adapter
│   ├── waapi.js                   # Web Animations API adapter
│   ├── css-animations.js          # CSS keyframes adapter
│   └── typegpu.js                 # TypeGPU / WebGPU adapter
│
├── media/
│   ├── audio.js                   # Audio track manager (Web Audio API)
│   ├── beat-detection.js          # Onset/beat detection for music sync
│   ├── tts.js                     # TTS integration (consumes ai module)
│   └── video-clip.js              # Video clip compositing
│
├── video.css                      # timeline chrome (playhead, transport controls)
└── export.css                     # render-safe styles (no viewport dependencies)
```

---

## 4. Video composition model

### 4.1 Continuous timeline

Unlike slides (discrete steps), a video composition is a single continuous GSAP timeline. Every scene, transition, and media element has a time range:

```
Timeline:
  0s ───────── 8s ────────── 15s ───────── 22s ───────── 30s
  │ scene-cover │ scene-problem │ scene-solution │ scene-cta  │
       │              │                │               │
       ├─ enter 0s    ├─ enter 8s      ├─ enter 15s    ├─ enter 22s
       ├─ exit 7.8s   ├─ exit 14.8s    ├─ exit 21.8s   ├─ exit 30s
```

### 4.2 Config format (agent-authored)

```json
{
  "title": "Acme — Product Demo",
  "duration": 45,
  "fps": 30,
  "resolution": { "width": 1920, "height": 1080 },
  "audio": {
    "voiceover": "/assets/vo.mp3",
    "bgm": "/assets/bgm.mp3",
    "bgmVolume": 0.3
  },
  "scenes": [
    {
      "id": "cover",
      "layout": "cover",
      "start": 0,
      "duration": 8,
      "props": {
        "kicker": "Series A",
        "title": "Acme",
        "subtitle": "The future of widget delivery"
      },
      "enter": { "type": "fade-in", "duration": 0.6 },
      "exit": { "type": "slide-left", "duration": 0.4 }
    },
    {
      "id": "big-number",
      "layout": "big-number",
      "start": 8,
      "duration": 6,
      "props": {
        "kicker": "Every day",
        "value": { "number": 2.4, "decimals": 1, "suffix": "B" },
        "caption": "events answered in under a second."
      },
      "fragments": [9.5, 11.0, 12.5],
      "enter": { "type": "slide-right", "duration": 0.4 },
      "exit": { "type": "fade-out", "duration": 0.3 }
    }
  ]
}
```

### 4.3 Fragments on a timeline

Fragments in the video module are **absolute timeline positions** (seconds) within a scene's `[start, end]` range. The composer sets up GSAP tweens that animate elements in at those timestamps. Unlike slides (where the user clicks to reveal), video fragments fire automatically as the timeline plays.

### 4.4 Scene transitions

Between scenes, the composer inserts transition tweens. The exit of Scene A and the entry of Scene B overlap visually but the timeline owns the cut point:

```
Scene A: [0, 8]
Scene B: [8, 16]

A exit tween:  7.6s → 8.0s (fade out + slide left)
B enter tween: 8.0s → 8.4s (fade in + slide right)
```

The CSMA animation skill's CSS-first rules do NOT apply here — video motion is GSAP-first because the timeline must be seekable and deterministic for frame-accurate export.

---

## 5. Adapter model

Each adapter registers animations on a runtime-specific global so the engine can seek all of them in one pass:

| Adapter | Purpose | Registration |
|---|---|---|
| GSAP | Default — timeline orchestration, tweens, eases | `window.__csmaGasp = []` |
| Lottie | Pre-baked After Effects exports | `window.__csmaLottie = []` |
| Three.js | 3D scenes, camera motion, shaders | `window.__csmaThree = []` |
| Anime.js | Lightweight tweening alternative | `window.__csmaAnime = []` |
| WAAPI | Native browser keyframes | `window.__csmaWaapi = []` |
| CSS Animations | Keyframe-driven elements | `window.__csmaCssAnims = []` |
| TypeGPU | GPU compute/render pipelines | `window.__csmaGpu = []` |

Adapters are **optional** — not bundled in the module. The agent's SKILL.md references them as resources. GSAP is the default and the only adapter required for the video engine to function.

---

## 6. Export pipeline

### 6.1 Frame-accurate rendering

```js
// exporter.js — simplified
async function exportToMP4(composition, outputPath) {
  const { duration, fps, resolution } = composition;
  const totalFrames = duration * fps;

  const canvas = document.createElement('canvas');
  canvas.width = resolution.width;
  canvas.height = resolution.height;
  const ctx = canvas.getContext('2d');

  const encoder = new VideoEncoder({ /* WebCodecs config */ });

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;

    // Seek all adapters to this time
    seekAllAdapters(time);

    // Capture DOM to canvas
    // (simplified — real impl uses drawElementImage or html2canvas-style approach)
    ctx.drawImage(composition.rootElement, 0, 0);

    const videoFrame = new VideoFrame(canvas, { timestamp: frame * (1_000_000 / fps) });
    encoder.encode(videoFrame);
    videoFrame.close();
  }

  await encoder.flush();
  // mux audio + video tracks → MP4
}
```

### 6.2 WebCodecs vs ffmpeg.wasm

- **WebCodecs** — browser-native, fast, but available only in Chromium. Good for dev preview.
- **ffmpeg.wasm** — universal, slower, but runs in Node.js and any browser. Good for production export.

The exporter supports both. CLI defaults to ffmpeg.wasm for headless Node.js export.

---

## 7. Audio pipeline

The video module consumes audio from multiple sources, mixed at export time:

| Source | Integration |
|---|---|
| Voiceover | MP3/WAV file, pre-recorded. Aligned to timeline manually or via TTS word timestamps. |
| TTS | Generated by `ai` module (multi-provider). Timestamps from provider or forced-aligned via whisper. |
| BGM | Background music track, ducked under voiceover. Volume envelope controllable via fragments. |
| Beat detection | Onset detection for music-synced visual cuts. Uses Web Audio API `AnalyserNode`. |
| Sound effects | Short clips triggered at timeline positions. Layered above BGM. |

---

## 8. Motion doctrine (optional, for narrative videos)

For videos with a narrative arc (product launches, explainers, changelog videos), the video module can adopt HyperFrames' **motion doctrine** concepts:

- **Vector law:** How Scene A exits determines how Scene B enters — same axis, same direction, matched speed.
- **The current:** Every film picks one dominant direction (house default: LEFT). Other vectors are reserved for meaning (up = elevation, Z = depth).
- **Carriers:** The strongest seams hand a concrete carrier (cursor, container, mark) across the cut at matched position and velocity.
- **Causal motion:** Chain motion so each move is visibly launched by the last (click → squash → spring → flight → impact → recoil → reveal).

These are **SKILL.md-level rules**, not enforced by the engine. The agent follows them when authoring video configs.

---

## 9. Service skeleton

```js
export class VideoCompositionService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.composition = null;    // loaded config
    this.currentTime = 0;
    this.duration = 0;
    this.playing = false;
    this.fps = 30;
    this.masterTimeline = null; // GSAP timeline
    this.adapters = new Map();  // registered animation adapters
    this.listeners = [];
    this.setupSubscriptions();
  }

  init(config) {
    this.composition = config;
    this.duration = config.duration;
    this.fps = config.fps || 30;
    this.buildTimeline();
    this.eventBus.publish('VIDEO_LOADED', { duration: this.duration, scenes: config.scenes.length });
  }

  buildTimeline() {
    // Create GSAP master timeline
    // For each scene: instantiate layout factory, position on timeline
    // Insert enter/exit transitions between scenes
    // Register all animated elements with adapters
  }

  play() { /* start playback, publish PLAYBACK_STARTED */ }
  pause() { /* pause, publish PLAYBACK_PAUSED */ }
  seek(time) { /* seek all adapters, publish TIMELINE_SEEK */ }

  seekAllAdapters(time) {
    // GSAP: masterTimeline.seek(time)
    // Lottie: instance.goToAndStop(frame)
    // Three.js: mixer.setTime(time)
    // WAAPI: animation.currentTime = time * 1000
    // CSS: element.style.animationDelay = `-${time}s`
    // TypeGPU: uniforms.uTime = time
  }

  setupSubscriptions() { /* INTENT_VIDEO_PLAY, INTENT_VIDEO_PAUSE, INTENT_VIDEO_SEEK */ }
  destroy() { /* kill timeline, dispose adapters, unsubscribe */ }
}
```

---

## 10. Relation to HyperFrames

HyperFrames is the reference implementation for timeline-based HTML video. The CSMA video module learns from its architecture but differs in key ways:

| | HyperFrames | CSMA video module |
|---|---|---|
| **Framework** | Custom runtime + GSAP + adapters | CSMA module + GSAP + adapters |
| **State management** | Custom `SlideshowController` + player state | `VideoCompositionService` + EventBus contracts |
| **Security** | Lint rules, runtime guards | CSMA 6-layer security (contracts, rate limits, sanitization) |
| **Media capture** | External tools (ffmpeg, heygen CLI) | CSMA `media` module (built-in capture + codecs) |
| **AI integration** | External (heygen TTS) | CSMA `ai` module (multi-provider, built-in) |
| **Deployment** | GCP Cloud Run, AWS Lambda, Studio | CSMA SPA + CDN (same as any CSMA app) |
| **Skill system** | Multi-layered (entry → router → workflow → sub-skills) | Single `SKILL.md` per module |

The video module is not a port of HyperFrames — it's a CSMA-native implementation that reaches feature parity where it matters (timeline engine, GSAP adapters, frame-accurate export) while staying within CSMA's architecture (contracts, services, modules, security).

---

## 11. Implementation phases (future)

### Phase 1: Core timeline

- `VideoCompositionService` with play/pause/seek
- GSAP master timeline builder
- Scene composer (instantiates slide layout factories on timeline)
- Transport controls UI (play, pause, scrub, time display)

### Phase 2: Export

- WebCodecs frame capture
- ffmpeg.wasm fallback
- Audio/video muxing
- Per-frame DOM → canvas rendering

### Phase 3: Audio

- Audio track manager
- TTS integration (consume `ai` module)
- BGM ducking
- Beat detection

### Phase 4: Adapters

- Lottie adapter
- Three.js adapter
- WAAPI adapter
- CSS animations adapter
- Anime.js adapter
- TypeGPU adapter

### Phase 5: Agent skill

- `SKILL.md` for video authoring
- Config schema reference
- Motion doctrine rules
- Scene transition catalog

---

## 12. Prerequisites

Before the video module can be implemented:

- [ ] `slides` module shipped, tested, and stable (layouts are the shared foundation)
- [ ] `media` module verified for video capture + canvas export
- [ ] `ai` module verified for TTS generation with word timestamps
- [ ] GSAP integration path validated (CSMA animation skill § GSAP Escalation)
- [ ] WebCodecs API availability assessed (browser support, Node.js polyfills)
- [ ] ffmpeg.wasm bundle size + performance benchmarked

---

## 13. References

- `../slides/plan.md` — slides module implementation plan (layout factories, engine, chrome)
- `../media/` — media module (capture, transform, codecs, workers)
- `../../docs/animation/SKILL.md` — animation rules + GSAP escalation path
- `../../docs/security/SKILL.md` — contract validation + rate limits
- `../../docs/service-pattern/SKILL.md` — service implementation patterns
- `../../docs/MODULE_IMPLEMENTATION_PLAN.md` — module registration standards
- `../../../vibe/hyperframes/` — HyperFrames reference (timeline engine, slideshow mode, skill architecture)
- `../../../vibe/hyperframes/skills/slideshow/SKILL.md` — HyperFrames slideshow contract
