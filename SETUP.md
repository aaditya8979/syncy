# Syncy v8 — Setup Guide

## Stack
| Layer | Technology |
|---|---|
| Frontend | Svelte 4 + Vite (pure SPA, no SSR) |
| Auth & DB | Supabase (Auth, Postgres, Realtime) |
| Rooms | Supabase Realtime **Broadcast** (zero DB writes for playback state) |
| Music API | JioSaavn API (primary) |
| Offline Storage | IndexedDB via `idb-keyval` |
| Library | localStorage (playlists, liked, downloads — per-user, scoped by UID) |

---

## 1. Install
```bash
npm install
```

## 2. Environment
Create `.env` at project root:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_ADMIN_EMAIL=your_admin@email.com
```
Values from: **Supabase → Settings → API**

## 3. Database
Supabase → **SQL Editor** → New query → paste contents of `supabase/rooms_schema.sql` → Run

This creates:
- `rooms` — room metadata (host, name, passcode, queue, current_song)
- `room_members` — presence fallback / history
- `room_queue` — user song suggestions (host promotes)
- `room_polls` + `room_poll_votes` — live voting
- `playlists` + `playlist_tracks` — server-side playlist storage
- `user_activity` — activity log
- All **RLS policies** (owner-only access, host-only room controls)
- Realtime enabled on all relevant tables

## 4. Run Dev Server
```bash
npm run dev
# → http://localhost:5173
```

## 5. Production Build
```bash
npm run build
# → dist/ (deploy to Vercel, Netlify, etc.)
```

---

## Key Features & Architecture

### OS-Level Media Integration (MediaSession API)
- **Mac menubar / lock screen** — `navigator.mediaSession.metadata` updated on every song change
- **Media keys** (Play/Pause/Prev/Next/Seek) mapped via `setActionHandler`
- **7 handlers**: `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward`
- Position tracked via `requestAnimationFrame` for sub-16ms precision

### Rooms Architecture (Enterprise Broadcast)
```
Host audio.currentTime ──► broadcastPlaySong/Pause/Seek
                             │  (Supabase Realtime Broadcast — zero DB writes)
                             ▼
                        All listeners receive payload { action, song, pos, sentAt }
                             │
                             ├── latency compensation: truePos = pos + (now - sentAt) / 1000
                             └── audio.currentTime = truePos → play/pause/seek
```
- **Broadcast** for all real-time state (play/pause/seek/queue/poll)
- **Presence** for user list only
- **Postgres** only for room creation, deletion, and late-joiner state
- Room termination: host broadcasts `terminated` → all clients `leaveRoom()`

### Offline Downloads
- Tracks fetched as `Blob` via `fetch()` → stored in IndexedDB (`idb-keyval`)
- `playDownload()` resolves blob URL → `playNow({ ...song, url: blobUrl })`
- Fallback to network stream if blob not found
- Library → **Offline** tab shows all cached tracks

### Precision Lyrics Engine
- LRC parser with **regex-based binary search** for O(log n) line lookup
- `requestAnimationFrame`-driven scroll centering active lyric
- Blurred album-art background (`blur(60px) brightness(0.4)`)
- User-scroll detection pauses auto-scroll for 3 seconds

### Data Integrity
- `sanitizeTrackPayload()` in `supabase.js` strips non-JSONB-compatible JioSaavn fields before DB insertion
- All `#each` lists use **keyed blocks** `(song.id)` to prevent DOM thrashing
- `cubicOut` easing on all list transitions (capped at 200ms delay max)

### Security
- RLS on all tables — users can only read/write their own data
- Room passwords verified server-side (DB query), never client-side
- `ADMIN_EMAIL` env var gates the Admin panel

---

## File Map

```
src/
├── lib/
│   ├── stores/
│   │   ├── player.js      ← Audio engine + MediaSession + rAF tracking
│   │   └── app.js         ← Auth, nav, library (liked/playlists/downloads), toast
│   └── services/
│       ├── supabase.js    ← Auth, DB helpers, sanitizeTrackPayload
│       ├── room.js        ← Enterprise Broadcast rooms engine
│       └── musicApi.js    ← JioSaavn API wrapper
├── components/
│   ├── MiniPlayer.svelte  ← Persistent mini bar with marquee + progress
│   ├── SongRow.svelte     ← Reusable track row (play/like/download/queue/playlist)
│   ├── Lyrics.svelte      ← Precision LRC engine with rAF scroll
│   ├── BottomNav.svelte   ← Swipe-aware navigation
│   └── WaveCanvas.svelte  ← Ambient animated waveform
└── pages/
    ├── Home.svelte         ← Featured, charts, trending
    ├── Search.svelte       ← Omnisearch (tracks/artists/albums/playlists)
    ├── Player.svelte       ← Full-screen player with queue
    ├── Library.svelte      ← Playlists / Liked / Offline
    ├── Rooms.svelte        ← Room browser + create/join
    ├── RoomPlayer.svelte   ← Collaborative listening room
    ├── Collection.svelte   ← Album/Playlist detail view
    ├── Artist.svelte       ← Artist detail
    ├── Admin.svelte        ← Admin panel (ADMIN_EMAIL gated)
    ├── Login.svelte
    └── Signup.svelte
supabase/
└── rooms_schema.sql        ← Full schema + RLS — run this in Supabase SQL Editor
```
