/**
 * app.js — Auth state, navigation, library (playlists / liked / downloads), toast
 * All library data is per-user, stored in localStorage with user-scoped keys
 */
import { writable, get } from 'svelte/store';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const user        = writable(null);
export const authLoading = writable(true);

// ─── Navigation ───────────────────────────────────────────────────────────────
// 'home' | 'search' | 'player' | 'library' | 'rooms'
export const page = writable('home');

// ─── Toast ────────────────────────────────────────────────────────────────────
export const toast = writable('');
let _toastTimer;
export function showToast(msg) {
  toast.set(msg);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.set(''), 2600);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const key = (uid, k) => `syncy:${uid}:${k}`;
const lget = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb; } catch { return fb; } };
const lset = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Library stores ───────────────────────────────────────────────────────────
export const liked     = writable([]);
export const playlists = writable([]);
export const downloads = writable({}); // { [songId]: Song & { cachedAt: number } }

export function initLibrary(uid) {
  liked.set    (lget(key(uid,'liked'),     []));
  playlists.set(lget(key(uid,'playlists'), []));
  downloads.set(lget(key(uid,'downloads'), {}));
}

// ─── Liked songs ──────────────────────────────────────────────────────────────
export function toggleLike(song) {
  const uid = get(user)?.id; if (!uid) return;
  liked.update(l => {
    const next = l.find(s => s.id === song.id) ? l.filter(s => s.id !== song.id) : [song, ...l];
    lset(key(uid,'liked'), next);
    return next;
  });
}
export const isLiked = songId => get(liked).some(s => s.id === songId);

// ─── Playlists ────────────────────────────────────────────────────────────────
export function createPlaylist(name) {
  const uid = get(user)?.id; if (!uid || !name.trim()) return null;
  const pl = { id: crypto.randomUUID(), name: name.trim(), songs: [], createdAt: Date.now() };
  playlists.update(ps => { const n=[pl,...ps]; lset(key(uid,'playlists'),n); return n; });
  return pl.id;
}

export function deletePlaylist(id) {
  const uid = get(user)?.id; if (!uid) return;
  playlists.update(ps => { const n=ps.filter(p=>p.id!==id); lset(key(uid,'playlists'),n); return n; });
}

export function renamePlaylist(id, name) {
  const uid = get(user)?.id; if (!uid) return;
  playlists.update(ps => { const n=ps.map(p=>p.id===id?{...p,name}:p); lset(key(uid,'playlists'),n); return n; });
}

export function addSongToPlaylist(pid, song) {
  const uid = get(user)?.id; if (!uid) return;
  playlists.update(ps => {
    const n = ps.map(p => {
      if (p.id !== pid) return p;
      if (p.songs.find(s => s.id === song.id)) return p;
      return { ...p, songs: [...p.songs, song] };
    });
    lset(key(uid,'playlists'), n); return n;
  });
}

export function removeSongFromPlaylist(pid, songId) {
  const uid = get(user)?.id; if (!uid) return;
  playlists.update(ps => {
    const n = ps.map(p => p.id!==pid ? p : {...p,songs:p.songs.filter(s=>s.id!==songId)});
    lset(key(uid,'playlists'),n); return n;
  });
}

// ─── Downloads / offline ──────────────────────────────────────────────────────
export function addDownload(song) {
  const uid = get(user)?.id; if (!uid) return;
  downloads.update(d => {
    const n = { ...d, [song.id]: { ...song, cachedAt: Date.now() } };
    lset(key(uid,'downloads'), n); return n;
  });
  // Tell SW to cache the audio
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CACHE', url: song.url, id: song.id });
  }
}

export function removeDownload(songId) {
  const uid = get(user)?.id; if (!uid) return;
  downloads.update(d => {
    if (d[songId]) {
      navigator.serviceWorker?.controller?.postMessage({ type: 'UNCACHE', url: d[songId].url });
    }
    const n = { ...d }; delete n[songId]; lset(key(uid,'downloads'),n); return n;
  });
}

/**
 * Play a downloaded song — resolves cached blob URL, falls back to direct URL.
 * This FIXES the offline play/pause not working issue.
 */
export async function playDownload(song) {
  const { playNow } = await import('./player.js');
  if (!('caches' in window)) { playNow(song); return; }
  try {
    const cache = await caches.open('syncy-audio-v1');
    const resp  = await cache.match(song.url);
    if (resp) {
      const blob   = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      playNow({ ...song, url: blobUrl });
    } else {
      playNow(song);
    }
  } catch {
    playNow(song);
  }
}
