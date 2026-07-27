# Chat UI Components — Plan

## Purpose

`src/ui/components/chat/` contains **pure rendering primitives** for chat
surfaces. These components are reusable by any module (slides, dashboard,
mindmap, visual-editor). They follow CSMA's aiui-native archetype: all DOM
built via `spec()` + `getComposer().mountTree()`, all state carried by
`data-*` attributes and CSS classes, zero `innerHTML`.

The components do NOT import service modules directly. They receive data and
callbacks through factory function parameters. The host (demo assembly script)
wires them to the `ChatService` from `src/modules/chat/`.

## Dependencies

| Dependency | Role | Status |
|------------|------|--------|
| `ai-ui` (specHelpers) | `spec()`, `getComposer()`, `mountTree()` | Exists |
| CSMA tokens | CSS custom properties for all visual values | Exists |
| `archetypes/overlay-manager` | Drawer shell hosting (used by ChatDrawer) | Exists |
| `comments` (data) | Message rendering — but accessed through ChatService proxy | Exists |
| `chat` (module) | Events + query methods — consumed via factory params, not imports | New |

The UI components do NOT import `comments`, `ai`, `media`, `file-upload`, or
`mentions` directly. They only know about the `ChatService` API surface passed
in at construction time.

## File Structure

```
src/ui/components/chat/
├── plan.md                  ← this file
├── manifest.json            ← aiui catalog entry
├── ChatDrawer.js            ← main panel: message list + composer + scope rail
├── ChatMessageCard.js       ← single message rendering
├── ChatComposer.js          ← textarea + send + attachment/camera/mic buttons
├── ChatBadge.js             ← unread count / presence indicator
├── ChatAttachmentPreview.js ← image/video/audio thumbnails in composer
├── ChatTypingIndicator.js   ← "X is typing..." animated dots
├── chat.css                 ← all styles, token-driven
└── chat-base.css            ← base layout tokens (optional split)
```

## Components

### ChatDrawer

The main panel. Replaces `CommentsDrawer.js` but uses the same generic pattern.
It renders into an `OverlayManager.openDrawer()` shell.

```js
const drawer = createChatDrawer({
  eventBus,                    // CSMA EventBus
  chatService,                 // ChatService instance from src/modules/chat/
  overlayManager,              // createOverlayManager result
  // Host hooks (same pattern as CommentsDrawer):
  scopeOf,                     // (idx) → roomId
  scopeLabel,                  // (roomId) → display name ("Slide 3")
  onScopeNavigate,             // (roomId) → navigate handler
  enableElementPicker,         // show 📍 for anchored comments
  scopeRail,                   // { render(container) → cleanup } — thumbnail picker
  documentRef,                 // optional document reference
});
```

**Internal structure:**
```
.csma-chat-drawer
├── .csma-chat-scoperail        ← horizontal thumbnail picker (host-rendered)
├── .csma-chat-toolbar
│   ├── .csma-chat-filters       ← [Open] [All] [Chat] [Reviews] filter tabs
│   └── .csma-chat-count         ← "3 open" / "12 total"
├── .csma-chat-list              ← message list (scrollable, scrollbar hidden)
│   └── ChatMessageCard × N
├── .csma-chat-typing            ← "Aurel is typing..." (conditional)
└── .csma-chat-composer
    └── ChatComposer
```

**Events subscribed:**
- `CHAT_MESSAGE_ADDED` → re-render list
- `CHAT_PRESENCE_UPDATED` → update presence indicators
- `CHAT_TYPING` → show/hide typing indicator
- `CHAT_AI_THINKING` → show AI thinking state
- `COMMENTS_DRAWER_OPENED` → open(roomId)
- `COMMENTS_DRAWER_CLOSED` → close()
- `INTENT_CHAT_FOCUS` → highlight + scroll to message

**Events published:**
- `INTENT_CHAT_SEND` (from composer)
- `INTENT_CHAT_RESOLVE` (from message card)
- `INTENT_CHAT_REOPEN` (from message card)
- `INTENT_CHAT_DELETE` (from message card)
- `INTENT_CHAT_REPLY` (from message card)
- `INTENT_CHAT_CAPTURE` (from composer buttons)
- `INTENT_CHAT_ATTACH` (from composer buttons)

**Reuses from CommentsDrawer:**
- Filter toolbar pattern (just adds more filter options)
- Threaded reply rendering (flat, left-border indent)
- Inline edit/reply form toggling
- Focus highlight (temp border glow, auto-scroll)
- Scope rail delegate (`scopeRail.render(container)`)
- Ctrl+Enter submit shortcut
- `scopeAnchor()` helper for element-anchored comments

**Key differences from CommentsDrawer:**
- Filter tabs: [Open] [Resolved] [All] [Chat] [Reviews]
  - "Chat" = type:user + type:assistant (exclude system events)
  - "Reviews" = type:user + status:open (unresolved human comments)
- Message type badge on each card (🤖 AI / 👤 User / ⚡ System)
- AI thinking state (shimmer/skeleton card while AI responds)
- Presence indicators on user messages (green dot for online)
- Media attachment thumbnails inline in message body
- Composer has action row: [Send] [📎] [📷] [🎤]
- No "Resolve" button on system messages (only on user + assistant)

### ChatMessageCard

Renders a single message. Pure function — no subscriptions, no side effects.

```js
function buildMessageCard(message, {
  isEditing,        // boolean — show edit textarea
  isReplying,       // boolean — show reply form
  isFocused,        // boolean — highlight border
  scopeLabel,       // (scope) → "Slide 3" chip
  onScopeNavigate,  // (scope) → navigate
  onResolve,        // () => intent
  onReopen,         // () => intent
  onDelete,         // () => intent
  onEdit,           // () => enter edit mode
  onReply,          // () => enter reply mode
  onLocate,         // () → jump to anchored element
  onEditSave,       // (body) => intent
  onEditCancel,     // () => exit edit mode
  onReplySave,      // (body) => intent
  onReplyCancel,    // () => exit reply mode
}) → { root: HTMLElement }
```

**Rendering per type:**

| type | Avatar | Status badge | Resolve button |
|------|--------|-------------|----------------|
| `user` | 👤 or user avatar | Open/Resolved/Reopened | Yes |
| `assistant` | 🤖 or AI icon | Open/Resolved | Yes (accept/reject AI suggestion) |
| `system` | ⚡ or info icon | None (auto-resolved) | No |

**Visual states (via data-* attrs):**
```css
.csma-chat-message[data-type="user"]      { /* user styling */ }
.csma-chat-message[data-type="assistant"] { /* AI styling — subtle blue tint */ }
.csma-chat-message[data-type="system"]    { /* system — centered, muted, smaller */ }
.csma-chat-message[data-status="resolved"] .csma-chat-message-body { text-decoration: line-through; }
.csma-chat-message[data-focused]          { /* blue border glow */ }
```

**Structure:**
```
.csma-chat-message  [data-type] [data-status] [data-focused]
├── .csma-chat-message-meta
│   ├── .csma-chat-message-type-badge    ← 🤖/👤/⚡
│   ├── .csma-chat-message-scope-chip    ← "Slide 3" (clickable, optional)
│   ├── .csma-chat-message-author        ← name + presence dot
│   ├── .csma-chat-message-time          ← timestamp
│   └── .csma-chat-message-status        ← Open/Resolved badge
├── .csma-chat-message-body              ← text (with attachment embeds)
│   └── .csma-chat-message-attachments   ← image/video/audio previews
├── .csma-chat-message-actions           ← [Resolve] [Reply] [Edit] [Delete] [📍Locate]
├── (edit textarea + [Save] [Cancel])     ← conditional
├── (reply textarea + [Reply] [Cancel])   ← conditional
└── .csma-chat-message-replies           ← left-border threaded replies
```

### ChatComposer

Textarea + action buttons. Manages pending attachments in local state.

```js
const composer = createChatComposer({
  container,        // HTMLElement to mount into
  eventBus,
  roomId,           // current room scope
  enableAttachments, // show 📎 button
  enableCamera,      // show 📷 button
  enableMicrophone,  // show 🎤 button
  documentRef,
});
```

**Structure:**
```
.csma-chat-composer
├── .csma-chat-attachment-previews   ← pending attachments before send
│   └── ChatAttachmentPreview × N
├── textarea                         ← message body (auto-grow, maxlength 20000)
└── .csma-chat-composer-actions
    ├── [📎 Attach]                   ← INTENT_CHAT_ATTACH
    ├── [📷 Photo]                    ← INTENT_CHAT_CAPTURE { mediaType: 'photo' }
    ├── [🎤 Audio]                    ← INTENT_CHAT_CAPTURE { mediaType: 'audio' }
    └── [Send]                        ← INTENT_CHAT_SEND (disabled when empty)
```

**Behaviors:**
- Ctrl+Enter / Cmd+Enter = Send
- Send clears textarea + pending attachments
- Send disabled when body empty AND no attachments
- Auto-grow textarea (max 6 rows, then scroll)
- Placeholder: "Add a message..." (or "Reply..." in reply mode)

### ChatBadge

Small badge for dock buttons or tab labels. Shows unread count or presence dot.

```js
const badge = createChatBadge({
  container,    // HTMLElement to mount into (position: relative)
  eventBus,
  roomId,       // optional — scoped to a specific room
  showPresence, // boolean — show green dot instead of count
  documentRef,
});
```

**Structure:**
```
.csma-chat-badge [data-has-open="true"] [data-has-unread="true"]
└── count or dot
```

**Events subscribed:**
- `CHAT_MESSAGE_ADDED` → increment unread if drawer closed
- `COMMENTS_DRAWER_OPENED` → clear unread for that room
- `CHAT_PRESENCE_UPDATED` → update dot color

### ChatAttachmentPreview

Thumbnail preview for pending or sent attachments.

```js
function buildAttachmentPreview(attachment, {
  onRemove,     // () => remove from pending (only for pending)
}) → { root: HTMLElement }
```

**Per type rendering:**

| attachment.type | Preview |
|-----------------|---------|
| `image` | thumbnail `<img>` with filename caption |
| `video` | thumbnail with ▶ overlay + duration |
| `audio` | waveform placeholder + duration + filename |
| `file` | file icon + filename + size |

**Structure:**
```
.csma-chat-attachment [data-type="image"|"video"|"audio"|"file"]
├── .csma-chat-attachment-thumb    ← img or placeholder
├── .csma-chat-attachment-name     ← filename
├── .csma-chat-attachment-size     ← file size (for files)
└── [✕ Remove]                     ← only for pending (not sent)
```

### ChatTypingIndicator

Animated dots when a user is typing.

```js
function buildTypingIndicator(typingUsers) → { root: HTMLElement }
```

**Structure:**
```
.csma-chat-typing
├── .csma-chat-typing-dot (×3)     ← CSS animation: pulse + stagger
└── "Aurel is typing..."           ← text label
```

## CSS Approach

All styles in `chat.css`. Token-driven — no hardcoded values.

```css
/* Theme tokens used */
--color-chat-user-bg         /* user message background */
--color-chat-assistant-bg    /* AI message background (subtle blue tint) */
--color-chat-system-bg       /* system message background (muted gray) */
--color-chat-typing-dot      /* typing indicator dot color */
--chat-avatar-size            /* avatar dimensions */
--chat-message-gap            /* spacing between messages */
--chat-composer-min-height    /* textarea min height */

/* Scrollbar hidden */
.csma-chat-list { scrollbar-width: none; }
.csma-chat-list::-webkit-scrollbar { display: none; }
.csma-chat-scoperail { scrollbar-width: none; }
.csma-chat-scoperail::-webkit-scrollbar { display: none; }
```

State via `data-*` attributes (no inline styles at runtime):
- `[data-type="user"]` / `[data-type="assistant"]` / `[data-type="system"]`
- `[data-status="open"]` / `[data-status="resolved"]`
- `[data-focused="true"]`
- `[data-has-open="true"]` (badge)
- `[data-has-unread="true"]` (badge)
- `[data-online="true"]` (presence dot)

## Manifest

```json
{
  "id": "chat-ui",
  "name": "Chat UI Components",
  "version": "1.0.0",
  "description": "Pure rendering primitives for chat surfaces — drawer, message cards, composer, badges. Reusable by any module.",
  "components": {
    "chat-drawer": {
      "name": "Chat Drawer",
      "description": "Right-side chat panel with message list, filters, scope rail, and composer",
      "factory": "createChatDrawer",
      "props": ["eventBus", "chatService", "overlayManager", "scopeOf", "scopeLabel", "onScopeNavigate", "scopeRail"]
    },
    "chat-message-card": {
      "name": "Chat Message Card",
      "description": "Single chat message with type badge, threading, inline forms",
      "factory": "buildMessageCard",
      "props": ["message", "isEditing", "isReplying", "isFocused"]
    },
    "chat-composer": {
      "name": "Chat Composer",
      "description": "Message input with attachment, camera, and microphone buttons",
      "factory": "createChatComposer",
      "props": ["container", "eventBus", "roomId", "enableAttachments", "enableCamera", "enableMicrophone"]
    },
    "chat-badge": {
      "name": "Chat Badge",
      "description": "Unread count or presence indicator for dock buttons",
      "factory": "createChatBadge",
      "props": ["container", "eventBus", "roomId", "showPresence"]
    }
  }
}
```

## Integration Pattern (Demo Assembly)

The demo (`slides.html`) wires ChatService to ChatDrawer:

```js
// 1. Create services
const commentsService = new AnchorableCommentsService(eventBus);
const chatService = new ChatService(eventBus);
await chatService.init({
  comments: commentsService,
  ai: aiService,
  media: mediaService,
  fileUpload: fileUploadService,
  mentions: mentionResolver,
  storage: storageService,
});

// 2. Create chat room for each slide
for (let i = 0; i < slides.length; i++) {
  chatService.createRoom(scopeOf(i), {
    aiParticipant: {
      provider: 'assistant',
      context: () => getSlideSpec(i),
    },
    media: { camera: true, microphone: true, fileUpload: true },
  });
}

// 3. Create UI
const chatDrawer = createChatDrawer({
  eventBus,
  chatService,
  overlayManager,
  scopeOf, scopeLabel, onScopeNavigate,
  enableElementPicker: true,
  scopeRail: { render: (container) => { /* thumbnails */ } },
});

// 4. Mount dock with chat badge
mountDeck(root, slideService, eventBus, {
  chatService,
  chatBadge: createChatBadge({ container: dockBtn, eventBus, showPresence: true }),
});
```

## What NOT to implement here

- **Service logic** — all in `src/modules/chat/`. These components only render.
- **Persistence** — delegated to ChatService → comments service.
- **AI orchestration** — ChatService handles it. UI just shows `CHAT_AI_THINKING` state.
- **Media capture** — ChatService wraps the media module. UI just publishes `INTENT_CHAT_CAPTURE`.
- **File upload** — ChatService wraps file-upload module. UI shows progress from events.
- **Mention autocomplete** — rendered by a subcomponent that calls mentionResolver,
  but the resolver is owned by ChatService.
- **Overlay shell** — provided by `archetypes/overlay-manager`. ChatDrawer calls
  `overlayManager.openDrawer()`.

## Implementation Order

### Phase 1 — Core UI (week 1, parallel with chat module Phase 1)
- [ ] `chat.css` — base styles, token-driven, data-* states, scrollbar hiding
- [ ] `ChatMessageCard.js` — message rendering per type, status badges, threading
- [ ] `ChatComposer.js` — textarea, send button, Ctrl+Enter
- [ ] `ChatDrawer.js` — port from CommentsDrawer, add type badges, filters, AI states
- [ ] `manifest.json` — component catalog entry

### Phase 2 — Attachments + media buttons (week 2)
- [ ] `ChatAttachmentPreview.js` — image/video/audio/file previews
- [ ] Add 📎 📷 🎤 buttons to ChatComposer
- [ ] Attachment pending state (before send)
- [ ] Upload progress indicator

### Phase 3 — Presence + polish (week 3)
- [ ] `ChatTypingIndicator.js` — animated dots + label
- [ ] `ChatBadge.js` — unread count + presence dot
- [ ] Presence green dot on message author
- [ ] AI thinking state (skeleton card, shimmer animation)
- [ ] System message styling (centered, muted, compact)
- [ ] Reduced motion media query

### Phase 4 — Accessibility + edge cases (week 4)
- [ ] Focus trap within drawer
- [ ] ARIA labels on all interactive elements
- [ ] Screen reader announcements for new messages
- [ ] Empty state for each filter
- [ ] Error state for failed sends
- [ ] Offline state indicator
- [ ] Long message truncation (expand/collapse)
- [ ] RTL support
