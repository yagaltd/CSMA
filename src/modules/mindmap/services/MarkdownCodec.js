/**
 * MarkdownCodec — serialization of a NodeObj tree to / from compact text.
 *
 * Markdown is NOT the runtime model and NOT the storage format. It is a
 * derived serialization used solely for agent context (and optional
 * export). The in-memory NodeObj tree is the source of truth.
 *
 * Output rules:
 *   - Root node is OMITTED (synthetic container; open Q4 lean default).
 *   - Branches render as `## <topic> <emoji> [<tag>] (done/leaf)` at the
 *     H2 level for top-level branches, then nested via indentation for
 *     deeper levels (so the outline stays compact).
 *   - Leaves render as `- <emoji> <topic>` list items.
 *   - Status emoji inline. No UUIDs unless `{ids:true}` is passed.
 *   - Filterable by `{status: [...], tag: [...]}` — non-matching nodes
 *     are pruned along with their descendants.
 *
 * Formats supported:
 *   - 'markdown'  nested `## / -` outline
 *   - 'ascii'     tree-drawing with ├─ └─
 *   - 'json'      minimal {topic, status, children} object
 */

const STATUS_EMOJI = {
  pending: '⬜',
  in_progress: '🔄',
  done: '✅',
  blocked: '🔴',
  failed: '❌',
  abandoned: '⬛'
};

const TAG_EMOJI = {
  module: '📦',
  feature: '✨',
  phase: '🔄',
  research: '🔍',
  brainstorm: '💭',
  log: '📝'
};

function statusEmoji(status) {
  return STATUS_EMOJI[status] || '⬜';
}

function tagEmoji(tag) {
  return TAG_EMOJI[tag] || '';
}

function branchHeading(branch, depth, opts) {
  const indent = depth <= 1 ? '' : '  '.repeat(depth - 1);
  const tag = branch.tag ? ` [${branch.tag}]` : '';
  const emoji = opts.emoji !== false ? `${statusEmoji(branch.status)} ` : '';
  const lc = branch.metadata?.leafCount || 0;
  const dc = branch.metadata?.doneCount || 0;
  const count = lc > 0 ? `  (${dc}/${lc})` : '';
  const idSuffix = opts.ids ? ` <${branch.id}>` : '';
  if (depth === 1) {
    return `## ${emoji}${branch.topic}${tag}${count}${idSuffix}`;
  }
  return `${indent}- ${emoji}**${branch.topic}**${tag ? ` ${tag}` : ''}${count}${idSuffix}`;
}

function leafLine(leaf, depth, opts) {
  const indent = '  '.repeat(depth);
  const emoji = opts.emoji !== false ? `${statusEmoji(leaf.status)} ` : '';
  const bottleneck = leaf.metadata?.bottleneck && leaf.metadata.bottleneck !== 'standard'
    ? ` 🔶${leaf.metadata.bottleneck}`
    : '';
  const idSuffix = opts.ids ? ` <${leaf.id}>` : '';
  return `${indent}- ${emoji}${leaf.topic}${bottleneck}${idSuffix}`;
}

function matchesFilter(node, filter) {
  if (!filter) return true;
  if (Array.isArray(filter.status) && filter.status.length > 0) {
    if (!filter.status.includes(node.status)) return false;
  }
  if (Array.isArray(filter.tag) && filter.tag.length > 0) {
    if (!filter.tag.includes(node.tag)) return false;
  }
  return true;
}

/**
 * Prune the tree: keep a node if it matches the filter OR any of its
 * descendants matches. Branches that fail the filter but have surviving
 * children are kept with a `(*)` indicator so the ancestor chain stays
 * intact for context.
 */
function pruneTree(node, filter) {
  if (!filter) return node;
  const selfMatches = matchesFilter(node, filter);
  const kids = Array.isArray(node.children) ? node.children.map((c) => pruneTree(c, filter)).filter(Boolean) : [];
  if (selfMatches || kids.length > 0) {
    return { ...node, children: kids };
  }
  return null;
}

export class MarkdownCodec {
  serialize(root, options = {}) {
    const format = options.format || 'markdown';
    if (format === 'json') return this.serializeJson(root, options);
    if (format === 'ascii') return this.serializeAscii(root, options);
    return this.serializeMarkdown(root, options);
  }

  serializeMarkdown(root, options = {}) {
    if (!root) return '';
    const pruned = pruneTree(root, options.filter);
    if (!pruned) return '';
    const lines = [];
    const walk = (node, depth) => {
      if (depth > 0) {
        // Skip synthetic root (depth 0); start children at depth 1.
        if (node.schemaType === 'mindmap/leaf') {
          lines.push(leafLine(node, depth, options));
        } else {
          lines.push(branchHeading(node, depth, options));
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child, depth + 1);
      }
    };
    walk(pruned, 0);
    return lines.join('\n');
  }

  serializeAscii(root, options = {}) {
    if (!root) return '';
    const pruned = pruneTree(root, options.filter);
    if (!pruned) return '';
    const lines = [];
    const walk = (node, prefix, isLast, isRoot) => {
      if (!isRoot) {
        const branch = prefix.slice(0, -1);
        const mark = isLast ? '└─' : '├─';
        const emoji = options.emoji !== false ? `${statusEmoji(node.status)} ` : '';
        const topic = node.schemaType === 'mindmap/leaf' ? node.topic : `${node.topic}/`;
        const tag = node.tag ? ` [${node.tag}]` : '';
        lines.push(`${branch}${mark}${emoji}${topic}${tag}`);
      }
      const kids = Array.isArray(node.children) ? node.children : [];
      for (let i = 0; i < kids.length; i += 1) {
        const last = i === kids.length - 1;
        const nextPrefix = prefix + (isRoot ? '' : (isLast ? '  ' : '│ '));
        walk(kids[i], nextPrefix, last, false);
      }
    };
    walk(pruned, '', true, true);
    return lines.join('\n');
  }

  serializeJson(root, options = {}) {
    if (!root) return null;
    const pruned = pruneTree(root, options.filter);
    if (!pruned) return null;
    const walk = (node, depth) => {
      if (depth === 0) {
        // Root is a synthetic container — represent as the children array.
        return (node.children || []).map((c) => walk(c, 1));
      }
      const out = {
        t: node.topic,
        s: node.status
      };
      if (node.tag) out.tag = node.tag;
      if (options.ids) out.id = node.id;
      if (Array.isArray(node.children) && node.children.length > 0) {
        out.children = node.children.map((c) => walk(c, depth + 1));
      }
      return out;
    };
    return walk(pruned, 0);
  }

  /**
   * Parse a markdown outline back into a NodeObj tree.
   * Best-effort: supports `##` for top-level branches and `-` for items
   * at any indentation. Used to round-trip for tests; not used at
   * runtime (storage is the source of truth).
   *
   * Depth model:
   *   - A heading at level L (number of `#`) sits at depth L in the
   *     stack. Bullets that follow it are children at depth L+1.
   *   - A bullet's depth = (last heading level | 0) + 1 + floor(indent/2).
   *   - When an item is added under what was parsed as a leaf, the leaf
   *     is promoted to a branch (leaves cannot have children).
   */
  parse(markdownText, options = {}) {
    if (typeof markdownText !== 'string' || markdownText.length === 0) return null;
    const lines = markdownText.split('\n');
    const root = {
      id: options.rootId || `root_${Date.now().toString(36)}`,
      topic: options.rootTopic || 'Imported map',
      schemaType: 'mindmap/branch',
      status: 'pending',
      children: [],
      expanded: true,
      direction: 0,
      metadata: { leafCount: 0, doneCount: 0 },
      updatedAt: Date.now()
    };
    const stack = [{ node: root, depth: 0 }];
    let lastHeadingLevel = 0;
    const promoteToBranchIfNeeded = (node) => {
      if (node.schemaType === 'mindmap/leaf') {
        node.schemaType = 'mindmap/branch';
        node.tag = node.tag || 'module';
        node.expanded = true;
        node.direction = 0;
      }
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) continue;
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      const item = !heading ? line.match(/^(\s*)[-*]\s+(.*)$/) : null;
      if (heading) {
        const level = heading[1].length;
        lastHeadingLevel = level;
        const depth = level;
        const payload = this._parseInline(heading[2]);
        const node = this._makeNode('mindmap/branch', payload);
        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
        const parent = stack[stack.length - 1].node;
        promoteToBranchIfNeeded(parent);
        parent.children.push(node);
        parent.metadata.leafCount += 1;
        stack.push({ node, depth });
      } else if (item) {
        const indent = item[1].length;
        const depth = lastHeadingLevel + 1 + Math.floor(indent / 2);
        const payload = this._parseInline(item[2]);
        const node = this._makeNode('mindmap/leaf', payload);
        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
        const parent = stack[stack.length - 1].node;
        promoteToBranchIfNeeded(parent);
        parent.children.push(node);
        parent.metadata.leafCount += 1;
        if (payload.status === 'done') parent.metadata.doneCount += 1;
        stack.push({ node, depth });
      }
    }
    return root;
  }

  _parseInline(text) {
    let rest = text.trim();
    let status = 'pending';
    let tag = null;
    let topic = rest;
    // Leading emoji → status.
    for (const [st, emoji] of Object.entries(STATUS_EMOJI)) {
      if (rest.startsWith(emoji)) {
        status = st;
        topic = rest.slice(emoji.length).trim();
        break;
      }
    }
    // Bold branch prefix **topic**.
    const bold = topic.match(/^\*\*(.+?)\*\*(.*)$/);
    if (bold) topic = `${bold[1]}${bold[2]}`.trim();
    // [tag]
    const tagMatch = topic.match(/\[(\w+)\]/);
    if (tagMatch) {
      tag = tagMatch[1];
      topic = topic.replace(tagMatch[0], '').trim();
    }
    // (done/total) count suffix
    topic = topic.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
    // <id>
    const idMatch = topic.match(/<([^>]+)>$/);
    let id;
    if (idMatch) {
      id = idMatch[1];
      topic = topic.slice(0, idMatch.index).trim();
    }
    return { topic, status, tag, id };
  }

  _makeNode(schemaType, payload) {
    return {
      id: payload.id || `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      topic: payload.topic,
      schemaType,
      status: payload.status,
      tag: payload.tag || (schemaType === 'mindmap/branch' ? 'module' : undefined),
      children: [],
      expanded: true,
      direction: 0,
      metadata: { leafCount: 0, doneCount: 0 },
      updatedAt: Date.now()
    };
  }
}

export const STATUS_EMOJI_MAP = STATUS_EMOJI;
export const TAG_EMOJI_MAP = TAG_EMOJI;
