/**
 * Syncy v7 — Dev server: Vite + WebSocket room sync on same port
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createServer as createVite } from 'vite';

const app = express();
const http = createServer(app);

// ─── WebSocket Room Server ────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: http, path: '/ws/room' });

// rooms: Map<roomId, Set<{ws, userId, username, isHost}>>
const rooms = new Map();

function broadcast(roomId, payload, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

function roomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room].map(c => ({ userId: c.userId, username: c.username, isHost: c.isHost }));
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const roomId  = url.searchParams.get('room')   || '';
  const userId  = url.searchParams.get('user')   || '';
  const username = decodeURIComponent(url.searchParams.get('name') || 'Guest');
  const isHost  = url.searchParams.get('host') === '1';

  if (!roomId || !userId) { ws.close(1008, 'Missing params'); return; }

  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const client = { ws, userId, username, isHost };
  rooms.get(roomId).add(client);

  // Notify everyone of new member
  broadcast(roomId, { t: 'members', members: roomMembers(roomId) });

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      msg._serverTime = Date.now();
      broadcast(roomId, msg, ws); // relay to all except sender
    } catch {}
  });

  ws.on('close', () => {
    rooms.get(roomId)?.delete(client);
    if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
    else broadcast(roomId, { t: 'members', members: roomMembers(roomId) });
  });
});

// ─── Vite middleware ──────────────────────────────────────────────────────────
const vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);

http.listen(5173, () => {
  console.log('\n  🎵 Syncy v7\n  http://localhost:5173\n  ws://localhost:5173/ws/room\n');
});
