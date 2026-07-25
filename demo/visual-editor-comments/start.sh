#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "=== CSMA Visual Editor Comments Sync Demo ==="
echo ""

# Kill any previous instances
echo "Cleaning up previous instances..."
lsof -ti:9090 | xargs kill 2>/dev/null || true
lsof -ti:5173 | xargs kill 2>/dev/null || true
lsof -ti:5174 | xargs kill 2>/dev/null || true
sleep 1

# Start relay
echo "Starting WebSocket relay on :9090..."
bun run "$DIR/relay-server.js" &
RELAY_PID=$!
sleep 1

# Verify relay is up
if ! kill -0 $RELAY_PID 2>/dev/null; then
    echo "ERROR: Relay failed to start"
    exit 1
fi
echo "Relay PID: $RELAY_PID"

# Start two Vite dev servers
echo "Starting Vite server A on :5173..."
npx vite --port 5173 --strictPort &
VITE_A_PID=$!
sleep 2

echo "Starting Vite server B on :5174..."
npx vite --port 5174 --strictPort &
VITE_B_PID=$!
sleep 2

echo ""
echo "=========================================="
echo "Demo running!"
echo "=========================================="
echo ""
echo "  Server A: http://localhost:5173/demo/visual-editor-comments/"
echo "  Server B: http://localhost:5174/demo/visual-editor-comments/"
echo "  Relay:    ws://localhost:9090"
echo ""
echo "Open both URLs side by side."
echo "Add a comment on A -> appears on B."
echo ""
echo "Press Ctrl+C to stop all servers."
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $RELAY_PID 2>/dev/null || true
    kill $VITE_A_PID 2>/dev/null || true
    kill $VITE_B_PID 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT INT TERM

# Wait for any server to exit
wait
