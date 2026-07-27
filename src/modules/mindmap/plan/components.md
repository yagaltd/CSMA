# Component specs for MorphMap mindmap

## mind-node

Represents a `##` heading in the mindmap (a branch with leaves).

### Manifest

```json
{
  "eccac": { "version": "1.0.0", "spec": "1.0.0" },
  "component": {
    "name": "mind-node",
    "type": "I",
    "owner": "mindmap",
    "lifecycle": "stable",
    "stability": "stable"
  },
  "contracts": { "published": [], "subscribed": [] },
  "dependencies": { "runtime": [], "components": ["mind-node", "connector-line"] },
  "metadata": { "description": "Mindmap branch node — represents a ## branch with children" },
  "aiUi": {
    "enabled": true,
    "alias": "mind-node",
    "title": "Branch Node",
    "category": "Mindmap",
    "preferred": true,
    "summary": "Displays a branch heading with status, tag, and child leaves",
    "props": {
      "topic": { "type": "string", "required": true },
      "status": { "type": "enum", "values": ["pending","in_progress","done","blocked","abandoned"], "default": "pending" },
      "tag": { "type": "enum", "values": ["module","feature","phase","research","brainstorm","log"], "default": "module" },
      "collapsed": { "type": "boolean", "default": false },
      "childCount": { "type": "number", "default": 0 },
      "doneCount": { "type": "number", "default": 0 }
    },
    "slots": {
      "leaves": { "description": "Container for mind-node children", "maxChildren": 200 }
    }
  }
}
```

### Data states

| `data-status` | Visual |
|--------------|--------|
| `pending` | Muted border, no color |
| `in_progress` | Blue accent border, subtle pulse |
| `done` | Green border, 50% opacity |
| `blocked` | Red border, lock icon |
| `abandoned` | Grey border, strikethrough text |
| `collapsed` | Badge showing child count ("N items") |

### DOM structure

```html
<div class="mind-node" data-status="in_progress" data-tag="phase">
  <div class="mind-node__header">
    <span class="mind-node__emoji">🔄</span>
    <span class="mind-node__topic">e2e-test</span>
    <span class="mind-node__tag">phase</span>
    <button class="mind-node__collapse" aria-label="Collapse">▾</button>
  </div>
  <div class="mind-node__leaves" data-slot="leaves">
    <!-- mind-node instances mounted here by AIUIComposer or mind-elixir -->
  </div>
  <div class="mind-node__actions">
    <button class="mind-node__add-leaf">+ Add leaf</button>
    <span class="mind-node__count">3/5 done</span>
  </div>
</div>
```

### Source reference

- morphmap.mindmap.md lines 27-31: `## e2e-test 🔄 [phase]` format
- CSMA card component: `src/ui/components/card/` (similar slot structure)

---

## mind-node

Represents a `- ✅` list item in the mindmap (a leaf).

### Manifest

```json
{
  "eccac": { "version": "1.0.0", "spec": "1.0.0" },
  "component": {
    "name": "mind-node",
    "type": "I",
    "owner": "mindmap",
    "lifecycle": "stable",
    "stability": "stable"
  },
  "contracts": { "published": [], "subscribed": [] },
  "dependencies": { "runtime": [], "components": [] },
  "metadata": { "description": "Mindmap leaf node — a task/checklist item with status" },
  "aiUi": {
    "enabled": true,
    "alias": "mind-node",
    "title": "Leaf Node",
    "category": "Mindmap",
    "preferred": true,
    "summary": "Displays a leaf with status checkbox, topic, spec link, and bottleneck tag",
    "props": {
      "topic": { "type": "string", "required": true },
      "status": { "type": "enum", "values": ["pending","in_progress","done","blocked","failed"], "default": "pending" },
      "bottleneck": { "type": "enum", "values": ["blocking","risky","standard","time","verify"], "default": "standard" },
      "specPath": { "type": "string", "required": false },
      "note": { "type": "string", "maxLength": 500, "required": false }
    }
  }
}
```

### Data states

| `data-status` | Checkbox |
|--------------|----------|
| `pending` | `⬜` empty |
| `in_progress` | `🔄` spinner |
| `done` | `✅` green checkmark |
| `blocked` | `🔴` red blocked |
| `failed` | `❌` red cross |

### DOM structure

```html
<div class="mind-node" data-status="pending" data-bottleneck="standard">
  <span class="mind-node__status">⬜</span>
  <span class="mind-node__topic">test /morphmap-review</span>
  <a class="mind-node__spec" href="#" data-path="specs/e2e/review.spec.md">📎</a>
  <span class="mind-node__bottleneck" data-bottleneck="standard">⚪</span>
</div>
```

### Source reference

- morphmap.mindmap.md lines 34: `- ⬜ test /morphmap-review on E2ETest`
- CSMA badge component: `src/ui/components/badge/` (similar label/variant pattern)

---

## connector-line

SVG path connecting parent node to child node. Rendered inside mind-elixir's SVG layer (`<me-main> > <svg>`). Not a standalone CSMA component — mind-elixir's `generateBranch.ts` computes the path geometry.

### Styling override

```css
/* Override mind-elixir connector styles with CSMA tokens */
me-main svg line,
me-main svg path {
  stroke: var(--color-border);
  stroke-width: 2;
  fill: none;
  transition: stroke var(--duration-fast);
}

me-main svg line[data-status="done"],
me-main svg path[data-status="done"] {
  stroke: var(--color-success);
  opacity: 0.4;
}

me-main svg line[data-status="blocked"],
me-main svg path[data-status="blocked"] {
  stroke: var(--color-destructive);
}
```

### Source reference

- mind-elixir `src/utils/generateBranch.ts` (107 LOC)
- mind-elixir `src/linkDiv.ts` (connector rendering)
