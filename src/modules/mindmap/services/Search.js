/**
 * Search — fuzzy match over topic + filter by status / tag.
 *
 * Returns SearchResult[] with the path-from-root for highlighting.
 * Lightweight scoring (subsequence match + position bonus). No external
 * deps so the module stays local-first.
 */

function fuzzyScore(query, target) {
  if (!query) return 1;
  if (!target) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) {
    // Substring match: higher score for earlier match.
    return 100 - t.indexOf(q);
  }
  // Subsequence match.
  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (lastMatchIndex === ti - 1) score += 5; // consecutive bonus
      lastMatchIndex = ti;
      qi += 1;
    }
  }
  if (qi < q.length) return 0; // not all query chars matched
  return score;
}

export class Search {
  search(root, query, { status = null, tag = null } = {}) {
    if (!root) return [];
    const results = [];
    const walk = (node, path) => {
      const currentPath = [...path, node];
      const statusOk = !Array.isArray(status) || status.length === 0 || status.includes(node.status);
      const tagOk = !Array.isArray(tag) || tag.length === 0 || (node.tag && tag.includes(node.tag));
      if (statusOk && tagOk) {
        const score = fuzzyScore(query, node.topic);
        if (score > 0) {
          results.push({
            nodeId: node.id,
            topic: node.topic,
            status: node.status,
            tag: node.tag || null,
            schemaType: node.schemaType,
            score,
            path: currentPath.map((n) => ({ id: n.id, topic: n.topic }))
          });
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child, currentPath);
      }
    };
    walk(root, []);
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
