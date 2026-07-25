# Component specs for MorphMap mindmap

## branch-node

Represents a `##` heading in the mindmap (a branch with leaves).

### Manifest

```json
{
  "eccac": { "version": "1.0.0", "spec": "1.0.0" },
  "component": {
    "name": "branch-node",
    "type": "I",
    "owner": "mindmap",
    "lifecycle": "stable",
    "stability": "stable"
  },
  "contracts": { "published": [], "subscribed": [] },
  "dependencies": { "runtime": [], "components": ["leaf-node", "connector-line"] },
  "metadata": { "description": "Mindmap branch node — represents a ## branch with children" },
  "aiUi": {
    "enabled": true,
    "alias": "branch-node",
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
      "leaves": { "description": "Container for leaf-node children", "maxChildren": 200 }
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
<div class="branch-node" data-status="in_progress" data-tag="phase">
  <div class="branch-node__header">
    <span class="branch-node__emoji">🔄</span>
    <span class="branch-node__topic">e2e-test</span>
    <span class="branch-node__tag">phase</span>
    <button class="branch-node__collapse" aria-label="Collapse">▾</button>
  </div>
  <div class="branch-node__leaves" data-slot="leaves">
    <!-- leaf-node instances mounted here by AIUIComposer or mind-elixir -->
  </div>
  <div class="branch-node__actions">
    <button class="branch-node__add-leaf">+ Add leaf</button>
    <span class="branch-node__count">3/5 done</span>
  </div>
</div>
```

### Source reference

- morphmap.mindmap.md lines 27-31: `## e2e-test 🔄 [phase]` format
- CSMA card component: `src/ui/components/card/` (similar slot structure)

---

## leaf-node

Represents a `- ✅` list item in the mindmap (a leaf).

### Manifest

```json
{
  "eccac": { "version": "1.0.0", "spec": "1.0.0" },
  "component": {
    "name": "leaf-node",
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
    "alias": "leaf-node",
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
<div class="leaf-node" data-status="pending" data-bottleneck="standard">
  <span class="leaf-node__status">⬜</span>
  <span class="leaf-node__topic">test /morphmap-review</span>
  <a class="leaf-node__spec" href="#" data-path="specs/e2e/review.spec.md">📎</a>
  <span class="leaf-node__bottleneck" data-bottleneck="standard">⚪</span>
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
