# Syncy v7 — Setup

## Stack
- Svelte 4 + Vite (pure SPA, no SSR)
- Express + ws (WebSocket room sync, same process as Vite)
- Supabase (auth + DB for rooms)
- JioSaavn API (primary), Jamendo (fallback)
- localStorage for playlists, liked, downloads (per-user, scoped by user ID)

## 1. Install
```bash
npm install
```

## 2. Environment
Create `.env`:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```
Values from: Supabase → Settings → API

## 3. Database
Supabase → SQL Editor → New query → paste `SUPABASE_RUN_THIS.sql` → Run

## 4. Run
```bash
npm run dev
# Opens http://localhost:5173
# WebSocket at ws://localhost:5173/ws/room
```

## Key Features
| Feature | Notes |
|---|---|
| Autoplay | `audio.ended` → updates `qIdx` → App.svelte reactive → `playSong()` |
| Offline play | Cache API blob URL resolved before playback |
| Mobile titles | `display:-webkit-box; -webkit-line-clamp:2` — never truncates |
| Swipe navigation | `touchstart`/`touchend` on `<svelte:window>` in BottomNav |
| Room sync | Host → 200ms WS broadcast → listener drift-corrects if >250ms off |
| Playlists | Full CRUD via localStorage, per-user isolated |

## Room Sync Details
```
Host audio.currentTime → every 200ms → ws.send({ t:'sync', pos, playing, _serverTime })
                                          ↓ (relay to all others)
Listener receives → latency = (now - _serverTime) / 2000
                 → expected = msg.pos + latency
                 → |audio.currentTime - expected| > 0.25 → seek
                 → status mismatch → play/pause
```
Same-WiFi latency: 10–40ms. Sub-250ms threshold prevents drift loops.
