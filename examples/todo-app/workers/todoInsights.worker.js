// Web Worker for Todo insights/stats computation

self.onmessage = (event) => {
  const payload = event.data || {};
  if (!payload.requestId || !Array.isArray(payload.todos)) {
    return;
  }

  const stats = buildStats(payload.todos);
  const insights = buildInsights(payload.todos, stats);

  self.postMessage({
    requestId: payload.requestId,
    stats,
    insights
  });
};

function buildStats(todos) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const active = total - completed;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, active, completionRate };
}

function buildInsights(todos, stats) {
  const focus = todos.find((todo) => !todo.completed);
  const lastUpdated = todos.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return {
    completionRate: stats.completionRate,
    focusTask: focus?.title || 'All caught up',
    lastUpdated: lastUpdated ? lastUpdated.updatedAt : null
  };
}
