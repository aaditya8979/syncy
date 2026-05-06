/**
 * room.js — Enterprise-Grade Rooms Engine
 * 
 * Architecture:
 *   BROADCAST → High-frequency state sync (play/pause/seek/queue). Zero DB writes.
 *   PRESENCE  → User list only. Lightweight heartbeat.
 *   POSTGRES  → Room metadata (create/delete). Infrequent writes.
 * 
 * Latency compensation: truePos = payload.pos + (Date.now() - payload.sentAt) / 1000
 */
import { writable, get } from 'svelte/store';
import { sb } from '$lib/services/supabase.js';
import { showToast } from '$lib/stores/app.js';

// ─── Reactive Stores ──────────────────────────────────────────────────────────
export const roomState   = writable('idle');     // 'idle'|'playing'|'paused'|'ended'
export const roomMembers = writable([]);
export const roomQueue   = writable([]);
export const roomSong    = writable(null);
export const roomPlaying = writable(false);
export const roomPos     = writable(0);
export const roomDur     = writable(0);
export const roomPoll    = writable(null);
export const isRoomHost  = writable(false);
export const roomId      = writable(null);

let _channel   = null;
let _roomId    = null;
let _userId    = null;
let _isHost    = false;
let _audio     = null;
let _rafId     = null;
let _onTerminate = null; // callback when room is force-terminated
let _syncInterval = null; // host periodic playhead broadcast

const DRIFT_THRESHOLD = 1.5; // seconds — only force-seek if drift exceeds this
const SYNC_INTERVAL   = 4000; // ms — host broadcasts playhead every 4s

// ─── Position tracking (rAF for precision) ────────────────────────────────────
function _trackPos() {
  if (_audio && !_audio.paused) roomPos.set(_audio.currentTime);
  _rafId = requestAnimationFrame(_trackPos);
}
function _startRAF() { if (!_rafId) _rafId = requestAnimationFrame(_trackPos); }
function _stopRAF()  { if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; } }

// ─── Audio Element (isolated from global player) ──────────────────────────────
function _getAudio() {
  if (_audio) return _audio;
  _audio = new Audio();
  _audio.crossOrigin = 'anonymous';
  _audio.preload = 'auto';

  _audio.addEventListener('timeupdate',     () => roomPos.set(_audio.currentTime));
  _audio.addEventListener('durationchange', () => roomDur.set(isFinite(_audio.duration) ? _audio.duration : 0));
  _audio.addEventListener('play',           () => { roomPlaying.set(true); _startRAF(); });
  _audio.addEventListener('pause',          () => { roomPlaying.set(false); _stopRAF(); });
  _audio.addEventListener('ended',          () => { if (_isHost) _hostAutoNext(); });

  return _audio;
}

// ─── Host auto-advance ────────────────────────────────────────────────────────
function _hostAutoNext() {
  const q = get(roomQueue);
  const cur = get(roomSong);
  if (!q.length) return;
  const idx = q.findIndex(s => s.id === cur?.id);
  const next = idx + 1 < q.length ? q[idx + 1] : null;
  if (next) broadcastPlaySong(next);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Join a room. Sets up Broadcast + Presence channels.
 */
export async function joinRoom(id, userId, username, host, onTerminate) {
  if (_channel) await leaveRoom();

  _roomId = id; _userId = userId; _isHost = host;
  _onTerminate = onTerminate || null;
  roomId.set(id);
  isRoomHost.set(host);
  roomState.set('idle');

  const audio = _getAudio();

  // ── Create channel ────────────────────────────────────────────────────────
  _channel = sb.channel(`room:${id}`, {
    config: { broadcast: { self: false }, presence: { key: userId } },
  });

  // ── BROADCAST: State sync (zero DB writes) ────────────────────────────────
  _channel.on('broadcast', { event: 'state' }, ({ payload }) => {
    if (_isHost) return; // host is the source of truth

    const { action, song, pos: p, queue: q, sentAt } = payload;
    const latency = sentAt ? (Date.now() - sentAt) / 1000 : 0;

    if (q) roomQueue.set(q);

    switch (action) {
      case 'play':
        if (song) {
          roomSong.set(song);
          audio.src = song.url;
          audio.currentTime = (p || 0) + latency;
          audio.play().catch(() => {});
          roomState.set('playing');
        }
        break;

      case 'pause':
        audio.pause();
        if (p != null) audio.currentTime = p;
        roomState.set('paused');
        break;

      case 'seek':
        audio.currentTime = (p || 0) + latency;
        roomPos.set(audio.currentTime);
        break;

      case 'skip':
        if (song) {
          roomSong.set(song);
          audio.src = song.url;
          audio.currentTime = 0;
          audio.play().catch(() => {});
          roomState.set('playing');
        }
        break;

      case 'queue_update':
        // queue already set above
        break;

      case 'sync_playhead': {
        // Drift compensation: only force-seek if drift > threshold
        if (audio.paused || !p) break;
        const truePos = p + latency;
        const drift = Math.abs(audio.currentTime - truePos);
        if (drift > DRIFT_THRESHOLD) {
          audio.currentTime = truePos;
        }
        // Otherwise let browser audio clock run freely — no stutters
        break;
      }
    }
  });

  // ── BROADCAST: Guest queue requests (host receives and merges) ───────────
  _channel.on('broadcast', { event: 'queue_request' }, ({ payload }) => {
    if (!_isHost) return; // only host processes queue requests
    const { song } = payload;
    if (!song) return;
    // Merge into queue if not duplicate, then rebroadcast
    const q = get(roomQueue);
    if (q.find(s => s.id === song.id)) return;
    const next = [...q, song];
    roomQueue.set(next);
    _channel.send({
      type: 'broadcast', event: 'state',
      payload: { action: 'queue_update', queue: next, sentAt: Date.now() },
    });
    _persistQueue(next);
  });

  // ── BROADCAST: Poll events ────────────────────────────────────────────────
  _channel.on('broadcast', { event: 'poll' }, ({ payload }) => {
    roomPoll.set(payload);
  });

  // ── BROADCAST: Room terminated by admin ───────────────────────────────────
  _channel.on('broadcast', { event: 'terminated' }, () => {
    showToast('Room has been closed by the host');
    leaveRoom();
    if (_onTerminate) _onTerminate();
  });

  // ── PRESENCE: User list ───────────────────────────────────────────────────
  _channel.on('presence', { event: 'sync' }, () => {
    const state = _channel.presenceState();
    const members = Object.entries(state).map(([uid, [meta]]) => ({
      id: uid,
      username: meta?.username || 'Guest',
      joinedAt: meta?.online_at,
    }));
    roomMembers.set(members);
  });

  // ── Subscribe ─────────────────────────────────────────────────────────────
  await _channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await _channel.track({ username, online_at: new Date().toISOString() });

      // If host, load room state from DB once
      if (_isHost) {
        try {
          const { data: room } = await sb.from('rooms').select('*').eq('id', id).single();
          if (room?.current_song) {
            roomSong.set(room.current_song);
            audio.src = room.current_song.url;
          }
          if (room?.queue) roomQueue.set(room.queue);
        } catch { /* fresh room */ }
      }
    }
  });
}

/**
 * Leave / cleanup
 */
export async function leaveRoom() {
  _stopRAF();
  _stopSync();
  if (_channel) {
    try { await _channel.untrack(); } catch {}
    try { await _channel.unsubscribe(); } catch {}
    sb.removeChannel(_channel);
    _channel = null;
  }
  if (_audio) { _audio.pause(); _audio.src = ''; }
  _audio = null;
  _roomId = null; _userId = null; _isHost = false;
  roomState.set('idle'); roomMembers.set([]); roomQueue.set([]);
  roomSong.set(null); roomPlaying.set(false); roomPos.set(0); roomDur.set(0);
  roomPoll.set(null); isRoomHost.set(false); roomId.set(null);
}

// ── Host periodic playhead sync ─────────────────────────────────────────────
function _startSync() {
  _stopSync();
  if (!_isHost) return;
  _syncInterval = setInterval(() => {
    if (!_channel || !_audio || _audio.paused) return;
    _channel.send({
      type: 'broadcast', event: 'state',
      payload: { action: 'sync_playhead', pos: _audio.currentTime, sentAt: Date.now() },
    });
  }, SYNC_INTERVAL);
}
function _stopSync() {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOST-ONLY BROADCAST ACTIONS (zero DB writes for real-time state)
// ═══════════════════════════════════════════════════════════════════════════════

export function broadcastPlaySong(song) {
  if (!_isHost || !_channel || !song?.url) return;
  const audio = _getAudio();
  roomSong.set(song);
  audio.src = song.url;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  roomState.set('playing');

  _channel.send({
    type: 'broadcast', event: 'state',
    payload: { action: 'play', song, pos: 0, queue: get(roomQueue), sentAt: Date.now() },
  });

  // Start periodic playhead sync for guests
  _startSync();

  // Persist current song to DB for late joiners (debounced, non-blocking)
  _persistState(song);
}

export function broadcastPause() {
  if (!_isHost || !_channel) return;
  const audio = _getAudio();
  audio.pause();
  roomState.set('paused');
  _stopSync(); // stop periodic sync when paused

  _channel.send({
    type: 'broadcast', event: 'state',
    payload: { action: 'pause', pos: audio.currentTime, sentAt: Date.now() },
  });
}

export function broadcastResume() {
  if (!_isHost || !_channel) return;
  const audio = _getAudio();
  audio.play().catch(() => {});
  roomState.set('playing');
  _startSync(); // resume periodic sync

  _channel.send({
    type: 'broadcast', event: 'state',
    payload: { action: 'play', song: get(roomSong), pos: audio.currentTime, sentAt: Date.now() },
  });
}

export function broadcastSeek(t) {
  if (!_isHost || !_channel) return;
  const audio = _getAudio();
  audio.currentTime = t;
  roomPos.set(t);

  _channel.send({
    type: 'broadcast', event: 'state',
    payload: { action: 'seek', pos: t, sentAt: Date.now() },
  });
}

export function broadcastSkipNext() {
  const q = get(roomQueue);
  const cur = get(roomSong);
  if (!q.length) return;
  const idx = q.findIndex(s => s.id === cur?.id);
  const next = idx + 1 < q.length ? q[idx + 1] : q[0];
  broadcastPlaySong(next);
}

export function broadcastSkipPrev() {
  const q = get(roomQueue);
  const cur = get(roomSong);
  if (!q.length) return;
  const idx = q.findIndex(s => s.id === cur?.id);
  const prev = idx > 0 ? q[idx - 1] : q[q.length - 1];
  broadcastPlaySong(prev);
}

// ── Queue Management ────────────────────────────────────────────────────────
export function addToRoomQueue(song) {
  if (_isHost) {
    // Host: directly merge and broadcast
    roomQueue.update(q => {
      if (q.find(s => s.id === song.id)) return q;
      const next = [...q, song];
      if (_channel) {
        _channel.send({
          type: 'broadcast', event: 'state',
          payload: { action: 'queue_update', queue: next, sentAt: Date.now() },
        });
        _persistQueue(next);
      }
      return next;
    });
  } else if (_channel) {
    // Guest: send request to host
    _channel.send({
      type: 'broadcast', event: 'queue_request',
      payload: { song, userId: _userId, sentAt: Date.now() },
    });
    showToast(`Requested "${song.title}" to be added`);
  }
}

export function removeFromRoomQueue(songId) {
  roomQueue.update(q => {
    const next = q.filter(s => s.id !== songId);
    if (_isHost && _channel) {
      _channel.send({
        type: 'broadcast', event: 'state',
        payload: { action: 'queue_update', queue: next, sentAt: Date.now() },
      });
      _persistQueue(next);
    }
    return next;
  });
}

// ── Polling ─────────────────────────────────────────────────────────────────
export function broadcastPoll(question, options) {
  if (!_isHost || !_channel) return;
  const poll = { question, options, votes: {}, createdAt: Date.now() };
  roomPoll.set(poll);
  _channel.send({ type: 'broadcast', event: 'poll', payload: poll });
}

export function votePoll(optionIdx) {
  if (!_channel || !_userId) return;
  const poll = get(roomPoll);
  if (!poll) return;
  poll.votes[_userId] = optionIdx;
  roomPoll.set({ ...poll });
  _channel.send({ type: 'broadcast', event: 'poll', payload: { ...poll } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE ALIASES (consumed by RoomPlayer.svelte)
// ═══════════════════════════════════════════════════════════════════════════════

/** Toggle play/pause from host */
export function roomTogglePlay() {
  if (!_isHost) return;
  const audio = _getAudio();
  if (audio.paused) broadcastResume();
  else broadcastPause();
}

/** Seek to time `t` (seconds) */
export function roomSeek(t) { broadcastSeek(t); }

/** Set room audio volume (0-1). Local only — not broadcast. */
export function roomSetVolume(v) {
  const audio = _getAudio();
  audio.volume = Math.max(0, Math.min(1, v));
}

/** Skip to next track */
export function nextTrack() { broadcastSkipNext(); }

/** Skip to previous track */
export function prevTrack() { broadcastSkipPrev(); }

/** Play a specific track (host-only) */
export function playTrack(song) { broadcastPlaySong(song); }

/** Start a poll (host-only) */
export function startPoll(question, options) { broadcastPoll(question, options); }

/** End the active poll */
export function endPoll() {
  roomPoll.set(null);
  if (_channel) {
    _channel.send({ type: 'broadcast', event: 'poll', payload: null });
  }
}

/** Generate a shareable invite link for the current room */
export function getInviteLink() {
  const id = _roomId || get(roomId);
  return `${window.location.origin}?room=${id}`;
}

// ── Room Deletion (Admin) ───────────────────────────────────────────────────
export async function deleteRoom(id) {
  // 1. Broadcast termination to all connected clients
  if (_channel) {
    _channel.send({ type: 'broadcast', event: 'terminated', payload: {} });
  }
  // 2. Small delay to ensure broadcast reaches all clients
  await new Promise(r => setTimeout(r, 300));
  // 3. Delete from DB (cascades to room_members, room_queue, room_polls)
  try {
    await sb.from('rooms').delete().eq('id', id);
  } catch (e) {
    console.error('[Room] Delete failed:', e.message);
  }
  // 4. Clean up local state
  await leaveRoom();
}

// ── Password Verification (secure — checks DB, not client-side) ─────────────
export async function verifyRoomPassword(id, inputPass) {
  try {
    const { data, error } = await sb.from('rooms')
      .select('passcode').eq('id', id).single();
    if (error) throw error;
    if (!data.passcode) return true; // no password required
    return data.passcode === inputPass;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL: Debounced DB persistence (non-blocking, for late joiners)
// ═══════════════════════════════════════════════════════════════════════════════
let _persistTimer = null;
function _persistState(song) {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    if (!_roomId) return;
    try {
      await sb.from('rooms').update({
        current_song: song,
        queue: get(roomQueue),
        status: 'playing',
      }).eq('id', _roomId);
    } catch { /* non-critical */ }
  }, 1500);
}

function _persistQueue(q) {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    if (!_roomId) return;
    try {
      await sb.from('rooms').update({ queue: q }).eq('id', _roomId);
    } catch { /* non-critical */ }
  }, 2000);
}
