# Chat Module — Plan

## Purpose

`src/modules/chat/` is the **service-layer orchestrator** for chat rooms. It owns chat
state (rooms, sessions, presence, AI participants) and wires six existing modules
into a cohesive chat surface. It exposes a `ChatService` consumed by the demo
assembly script (e.g. `demo/slides.html`) and renders through the pure-UI
components in `src/ui/components/chat/`.

The chat module never constructs DOM. It publishes events and exposes query
methods. The UI layer listens and renders.

## Dependencies

| Module | Role | Status |
|--------|------|--------|
| `comments` | Message persistence (CRUD, IDB, `type`/`status` fields) | Exists |
| `ai` | LLM integration (ChatSession, providers, streaming) | Exists |
| `ai-ui` | Not used here — consumed by `src/ui/components/chat/` only | Exists |
| `media` | Camera, microphone, screen capture | Exists |
| `file-upload` | Resumable attachment uploads with checkpoint persistence | Exists |
| `mentions` | @user parsing + resolution + AI bridge | Exists |
| `storage` | IndexedDB (passed through to comments service) | Exists |
| `network-status` | Online/offline awareness for sync queue | Exists |

## Architecture

```
ChatService (this module)
  ├── creates + manages ChatRoom instances
  │     roomId → maps to comments scope
  │     participants → [{ id, type: 'human'|'assistant', ... }]
  │     presence → Map<userId, { online, lastSeen }>
  ├── wraps AnchorableCommentsService
  │     sendMessage() → comments.add({ scope, type: 'user', ... })
  │     reply()       → comments.reply(parentId, ...)
  │     resolve()     → comments.resolve(id)
  │     delete()      → comments.delete(id)
  │     getMessages() → comments.getByScope(roomId)
  ├── orchestrates AI participant (ai module)
  │     on user message → ChatSession.send()
  │     on AI response → comments.add({ type: 'assistant', ... })
  │     on AI tool call (aiui) → apply to slide DOM
  ├── manages media capture pipeline
  │     📷 → media.capturePhoto() → file-upload → comment attachment
  │     🎤 → media.captureAudio() → file-upload → comment attachment
  └── broadcasts presence + typing indicators
        CHAT_PRESENCE_UPDATED, CHAT_TYPING
```

## File Structure

```
src/modules/chat/
├── plan.md                          ← this file
├── manifest.json
├── index.js                         ← module entry: exports manifest, services, contracts
├── services/
│   ├── ChatService.js               ← main orchestrator
│   ├── ChatMediaPipeline.js          ← camera/mic → blob → upload → attachment ref
│   ├── ChatAIBridge.js              ← user message → AI session → AIUI ops → comment
│   └── ChatPresenceTracker.js       ← online/typing state, BroadcastChannel fan-out
├── contracts/
│   └── chat-contracts.js            ← INTENT_CHAT_* and CHAT_* event payloads
└── aiui/                            ← (Phase 2) mountSurface('chat-room', container)
    └── manifest.json
```

## ChatService API

```js
const chat = new ChatService(eventBus);

// Lifecycle
await chat.init({
  comments: anchorableCommentsService,   // required — persistence
  ai: aiService,                          // optional — AI participants
  media: mediaService,                    // optional — camera/mic
  fileUpload: fileUploadService,          // optional — attachments
  mentions: mentionResolver,              // optional — @user autocomplete
  storage: storageService,                // optional — passed to comments
});

// Room management
const room = chat.createRoom('slide-3', {
  aiParticipant: {
    provider: 'assistant',
    systemPrompt: 'You are a slide design assistant...',
    context: () => getSlideSpec(3),       // live slide content for LLM
    tools: ['aiui_update_slide'],         // AI can emit AIUI ops
  },
  media: { camera: true, microphone: true, fileUpload: true },
  mentions: true,
});

chat.getRoom(roomId);   // → ChatRoom | null
chat.closeRoom(roomId);
chat.listRooms();       // → ChatRoom[]

// Messaging (delegates to comments service)
chat.sendMessage(roomId, { body, type, attachments, author });
chat.reply(roomId, parentId, { body, author });
chat.resolveMessage(id);
chat.reopenMessage(id);
chat.deleteMessage(id);

// Queries (delegates to comments service)
chat.getMessages(roomId, { filter, limit });  // type/status filters
chat.getOpenCount(roomId);

// Presence (local + cross-tab via BroadcastChannel)
chat.setPresence(roomId, { userId, online });
chat.getPresence(roomId);         // → Map<userId, Presence>
chat.setTyping(roomId, userId, isTyping);

// Media capture
chat.capturePhoto(roomId);        // opens camera → blob → upload
chat.captureAudio(roomId);        // opens mic → blob → upload
chat.captureVideo(roomId);        // opens camera → blob → upload
chat.attachFile(roomId);          // opens file picker → upload

// Cleanup
chat.destroy();
```

## Event Contracts

### Published events (ChatService → UI/listeners)

| Event | Payload | When |
|-------|---------|------|
| `CHAT_MESSAGE_ADDED` | `{ roomId, message }` | Any new message (user, assistant, system) |
| `CHAT_PRESENCE_UPDATED` | `{ roomId, users: [{ id, online, lastSeen }] }` | User joins/leaves room |
| `CHAT_TYPING` | `{ roomId, userId, isTyping }` | User starts/stops typing |
| `CHAT_AI_THINKING` | `{ roomId, status: 'thinking'|'responding'|'done' }` | AI is processing |
| `CHAT_MEDIA_UPLOADING` | `{ roomId, mediaType, progress }` | Attachment upload progress |
| `CHAT_ROOM_CREATED` | `{ roomId }` | Room created |
| `CHAT_ROOM_CLOSED` | `{ roomId }` | Room closed |

### Subscribed intents (UI → ChatService)

| Intent | Payload | Action |
|--------|---------|--------|
| `INTENT_CHAT_SEND` | `{ roomId, body, type?, attachments? }` | sendMessage() |
| `INTENT_CHAT_REPLY` | `{ roomId, parentId, body }` | reply() |
| `INTENT_CHAT_RESOLVE` | `{ roomId, id }` | resolveMessage() |
| `INTENT_CHAT_REOPEN` | `{ roomId, id }` | reopenMessage() |
| `INTENT_CHAT_DELETE` | `{ roomId, id }` | deleteMessage() |
| `INTENT_CHAT_CAPTURE` | `{ roomId, mediaType }` | capturePhoto/captureAudio/captureVideo |
| `INTENT_CHAT_ATTACH` | `{ roomId }` | attachFile() |
| `INTENT_CHAT_OPEN_ROOM` | `{ roomId }` | Open drawer for room |
| `INTENT_CHAT_CLOSE_ROOM` | `{ roomId }` | Close drawer |

## AI Participant Flow

```
User sends message
  ↓
ChatService.sendMessage() → comments.add({ type: 'user', ... })
  ↓
ChatAIBridge intercepts CHAT_MESSAGE_ADDED
  ↓
If room has AI participant AND message.type === 'user':
  1. Publish CHAT_AI_THINKING { status: 'thinking' }
  2. Build context: system prompt + slide spec + last N messages
  3. ai.ChatSession.send(userMessage)
  4. Stream response tokens → update "thinking" message in real-time
  5. On complete:
     a. comments.add({ type: 'assistant', body: responseText })
     b. If AI called aiui_update_slide tool:
        - Apply AIUI streaming ops to slide DOM (via ai-ui module)
        - Add tool-call summary as a system message
     c. Publish CHAT_AI_THINKING { status: 'done' }
```

## Media Pipeline

```
User clicks 📷 in composer
  ↓
ChatService.capturePhoto(roomId)
  ↓
media.capturePhoto() → Blob
  ↓
ChatMediaPipeline:
  1. Generate thumbnail (via CanvasCodec from media module)
  2. file-upload.upload(blob) → public URL
  3. Create attachment ref: { type: 'image', url, thumbnail, filename }
  ↓
Attach to composer state (not yet sent)
  ↓
User clicks Send
  ↓
chat.sendMessage(roomId, { body, attachments: [ref] })
  ↓
comments.add({ body, type: 'user', data: { attachments: [ref] } })
```

## Message Data Model

The chat module does NOT own its own message store. Messages are stored as
comments via `AnchorableCommentsService`. The fields map as follows:

| Chat concept | Comment field | Type |
|--------------|---------------|------|
| roomId | `scope` | string |
| message type | `type` | `'user'` \| `'assistant'` \| `'system'` |
| review status | `status` | `'open'` \| `'resolved'` \| `'reopened'` \| `'deleted'` |
| message body | `body` | string |
| author | `author` | `{ name, id, avatarUrl? }` |
| parent (reply) | `parent_id` | string |
| attachments | `data.attachments` | `[{type, url, thumbnail, filename}]` |
| AI prompt (hidden) | `data.aiPrompt` | `{ systemPrompt, context, toolCalls[] }` |

### Why reuse comments instead of a new store

1. IDB persistence already solved (via storage module + `COMMENTS_SCHEMA`)
2. `type` field already added for message type discrimination
3. `status` lifecycle already exists (open/resolved) — maps to review workflow
4. `AnchorableCommentsService` already handles scope-filtered queries, open-count,
   CRUD, and event fanout (`COMMENT_ADDED`, `COMMENT_RESOLVED`, etc.)
5. No migration needed — existing anchored comments become chat messages with
   `type: 'user'` (the default)

## What NOT to implement here

- **DOM construction** — belongs in `src/ui/components/chat/`. This module
  only publishes events and exposes query methods.
- **Overlay management** — the demo wires `createOverlayManager`. The chat
  module doesn't know about drawers, popups, or panels.
- **Slide-specific logic** — scope resolution (`scopeOf`, `scopeLabel`,
  `onScopeNavigate`) is provided by the host (demo). Chat only deals with
  opaque `roomId` strings.
- **CSS** — all visual styling lives in `src/ui/components/chat/chat.css`.
- **Component manifests** — `ui/` and `aiui/` folders cover that. The module
  only has `services/`, `contracts/`, `index.js`, `manifest.json`.

## Implementation Order

### Phase 1 — Core messaging (week 1)
- [ ] `ChatService.js` — init, createRoom, sendMessage, reply, getMessages
- [ ] `chat-contracts.js` — all INTENT_CHAT_* and CHAT_* events
- [ ] Integration test: ChatService → comments persistence round-trip
- [ ] Wire demo to replace `commentsDrawer` with `chatDrawer` (UI built in Phase 1 of UI plan)

### Phase 2 — AI participant (week 2)
- [ ] `ChatAIBridge.js` — user message → ChatSession → AI response → comment
- [ ] `CHAT_AI_THINKING` events + typing indicator state
- [ ] AIUI tool: LLM emits `aiui_update_slide` ops
- [ ] Integration test: user asks question → AI responds → slide updates

### Phase 3 — Media attachments (week 2-3)
- [ ] `ChatMediaPipeline.js` — capture → blob → upload → attachment ref
- [ ] Camera, microphone, file picker integration
- [ ] Thumbnail generation for images/videos
- [ ] Upload progress events

### Phase 4 — Presence + real-time (week 3)
- [ ] `ChatPresenceTracker.js` — BroadcastChannel for cross-tab presence
- [ ] Typing indicator debounce + fan-out
- [ ] Online status heartbeat
- [ ] (Optional) WebSocket transport for multi-user

### Phase 5 — Embeddable surface (week 4)
- [ ] `aiui/manifest.json` + `mountSurface('chat-room', container, props)`
- [ ] Inline chat embed without the drawer shell
