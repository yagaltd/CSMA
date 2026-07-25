// WebSocket relay for visual-editor comment sync demo
// Usage: bun run demo/visual-editor-comments/relay-server.js

const PORT = parseInt(process.env.RELAY_PORT || '9090', 10);
const clients = new Set();

Bun.serve({
    port: PORT,
    fetch(req, server) {
        if (server.upgrade(req)) return;
        return new Response('WebSocket relay for CSMA visual-editor sync demo', {
            status: 426,
            headers: { 'Content-Type': 'text/plain' }
        });
    },
    websocket: {
        open(ws) {
            clients.add(ws);
            console.log(`[relay] client connected (${clients.size} total)`);
        },
        close(ws) {
            clients.delete(ws);
            console.log(`[relay] client disconnected (${clients.size} total)`);
        },
        message(ws, data) {
            const text = typeof data === 'string' ? data : (Buffer.isBuffer(data) ? data.toString() : String(data));
            let count = 0;
            for (const client of clients) {
                if (client !== ws) {
                    try {
                        client.send(text);
                        count++;
                    } catch (err) {
                        console.warn(`[relay] failed to send to client:`, err.message);
                    }
                }
            }
            if (count > 0) {
                console.log(`[relay] broadcast to ${count} client(s)`);
            }
        }
    }
});

console.log(`[relay] WebSocket relay listening on ws://localhost:${PORT}`);
