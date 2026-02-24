/**
 * player.js — Single global audio element, reactive Svelte stores
 * AUTOPLAY: when song ends → next song plays automatically
 * OFFLINE: supports blob: URLs from Cache API
 */
import { writable, derived, get } from 'svelte/store';

export const queue   = writable([]);
export const qIdx    = writable(0);
export const playing = writable(false);
export const pos     = writable(0);
export const dur     = writable(0);
export const vol     = writable(0.85);
export const muted   = writable(false);
export const shuffle = writable(false);
export const repeat  = writable('off'); // 'off'|'all'|'one'
export const buffering = writable(false);

export const currentSong = derived([queue, qIdx], ([$q,$i]) => $q[$i] ?? null);
export const pct         = derived([pos, dur],    ([$p,$d]) => $d > 0 ? ($p/$d)*100 : 0);

// ─── Single shared audio element ──────────────────────────────────────────────
let _audio = null;

export function getAudio() {
  if (_audio || typeof window === 'undefined') return _audio;

  _audio = new Audio();
  _audio.crossOrigin = 'anonymous';
  _audio.preload = 'metadata';

  _audio.addEventListener('timeupdate',     () => pos.set(_audio.currentTime));
  _audio.addEventListener('durationchange', () => dur.set(isFinite(_audio.duration) ? _audio.duration : 0));
  _audio.addEventListener('play',           () => { playing.set(true); buffering.set(false); });
  _audio.addEventListener('pause',          () => playing.set(false));
  _audio.addEventListener('waiting',        () => buffering.set(true));
  _audio.addEventListener('canplay',        () => buffering.set(false));
  _audio.addEventListener('error',          () => { playing.set(false); buffering.set(false); });

  // ── CRITICAL: Auto-advance on song end ──────────────────────────────────────
  _audio.addEventListener('ended', () => {
    const r = get(repeat);
    const q = get(queue);
    let i   = get(qIdx);

    if (r === 'one') {
      _audio.currentTime = 0;
      _audio.play().catch(() => {});
      return;
    }

    const next = get(shuffle)
      ? Math.floor(Math.random() * q.length)
      : i + 1;

    if (next >= q.length) {
      if (r === 'all') { qIdx.set(0); }
      else             { playing.set(false); return; }
    } else {
      qIdx.set(next);
    }
    // App.svelte watches qIdx and calls playSong reactively
  });

  _audio.volume = get(vol);
  vol.subscribe(v  => { if (_audio) _audio.volume = get(muted) ? 0 : v; });
  muted.subscribe(m => { if (_audio) _audio.volume = m ? 0 : get(vol); });

  return _audio;
}

// ─── Playback API ─────────────────────────────────────────────────────────────
export function playSong(song) {
  if (!song?.url) return;
  const a = getAudio();
  buffering.set(true);
  a.src = song.url;
  a.currentTime = 0;
  pos.set(0); dur.set(0);
  a.play().catch(e => {
    console.warn('[Syncy/play]', e.message);
    playing.set(false); buffering.set(false);
  });
}

export function togglePlay() {
  const a = getAudio();
  const s = get(currentSong);
  if (!s) return;
  if (!a.src || a.networkState === 0) { playSong(s); return; }
  if (get(playing)) a.pause();
  else a.play().catch(() => {});
}

export function seekTo(t) {
  const a = getAudio();
  if (a) { a.currentTime = t; pos.set(t); }
}

export function skipNext() {
  const q = get(queue);
  if (!q.length) return;
  const i = get(shuffle)
    ? Math.floor(Math.random() * q.length)
    : Math.min(get(qIdx) + 1, q.length - 1);
  qIdx.set(i);
}

export function skipPrev() {
  const a = getAudio();
  if (a && a.currentTime > 3) { a.currentTime = 0; return; }
  qIdx.update(i => Math.max(0, i - 1));
}

export function playNow(song) {
  const q = get(queue);
  const idx = q.findIndex(s => s.id === song.id);
  if (idx >= 0) { qIdx.set(idx); playSong(song); return; }
  queue.update(q2 => { const nq = [...q2, song]; qIdx.set(nq.length - 1); return nq; });
  playSong(song);
}

export function addToQueue(song) {
  queue.update(q => q.find(s => s.id === song.id) ? q : [...q, song]);
}

export function removeFromQueue(i) {
  const cur = get(qIdx);
  queue.update(q => q.filter((_,j) => j !== i));
  if (i < cur) qIdx.update(j => j - 1);
  else if (i === cur) qIdx.update(j => Math.min(j, Math.max(0, get(queue).length - 1)));
}

export function clearQueue() {
  const a = getAudio();
  if (a) { a.pause(); a.src = ''; }
  queue.set([]); qIdx.set(0); playing.set(false); pos.set(0); dur.set(0);
}
