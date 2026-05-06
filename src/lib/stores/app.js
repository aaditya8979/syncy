/**
 * app.js — Auth state, navigation, library (playlists / liked / downloads), toast
 * All library data is per-user, stored in localStorage with user-scoped keys
 */
import { writable, derived, get } from 'svelte/store';
import { set, get as idbGet, del } from 'idb-keyval';
import { playNow } from '$lib/stores/player.js';
import { getSongDetails } from '$lib/services/musicApi.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const user        = writable(null);
export const authLoading = writable(true);

// ─── Navigation / Routing (with history) ──────────────────────────────────────
export const currentView = writable({ page: 'home', id: null, type: null });
export const viewHistory = writable([]);

export const page = {
  subscribe: derived(currentView, $v => $v.page).subscribe,
  set: (p) => {
    const cur = get(currentView);
    if (cur.page !== p) {
      viewHistory.update(h => [...h, cur]);
      currentView.set({ page: p, id: null, type: null });
    }
  },
  update: (fn) => {
    const cur = get(currentView);
    const nxtPage = fn(cur.page);
    if (cur.page !== nxtPage) {
      viewHistory.update(h => [...h, cur]);
      currentView.update(v => ({ ...v, page: nxtPage }));
    }
  },
};

export function navigateTo(pg, id = null, type = null) {
  const cur = get(currentView);
  if (cur.page !== pg || cur.id !== id) {
    viewHistory.update(h => [...h, cur]);
    currentView.set({ page: pg, id, type });
  }
}

export function navigateBack() {
  const h = get(viewHistory);
  if (h.length === 0) {
    currentView.set({ page: 'home', id: null, type: null });
  } else {
    const prev = h[h.length - 1];
    viewHistory.set(h.slice(0, -1));
    currentView.set(prev);
  }
}

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
const lset = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch (e) {
    // Surface quota or serialization errors instead of silently dropping data
    console.error('[Syncy/lset] localStorage write failed:', e.message);
    try { showToast('Storage full — some data may not persist'); } catch {}
  }
};

// Strip JioSaavn API bloat, keep only what the app needs
function sanitizeSong(song) {
  return {
    id:       String(song.id ?? ''),
    title:    song.title    ?? 'Unknown',
    artist:   song.artist   ?? 'Unknown Artist',
    album:    song.album    ?? '',
    coverUrl: song.coverUrl ?? '',
    duration: song.duration ?? 0,
    url:      song.url      ?? '',
    source:   song.source   ?? 'jiosaavn',
  };
}

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
  const clean = sanitizeSong(song);
  liked.update(l => {
    const next = l.find(s => String(s.id) === String(clean.id))
      ? l.filter(s => String(s.id) !== String(clean.id))
      : [clean, ...l];
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

export async function addSongToPlaylist(pid, song) {
  const uid = get(user)?.id; if (!uid) return false;
  
  // Resolve full details if URL is missing (e.g. from search all)
  let targetSong = song;
  if (!song.url && String(song.id).startsWith('jio-')) {
    const full = await getSongDetails(song.id);
    if (full) targetSong = full;
  }
  
  const clean = sanitizeSong(targetSong);
  let wasAdded = false;

  playlists.update(ps => {
    const n = ps.map(p => {
      if (p.id !== pid) return p;
      if (p.songs.find(s => String(s.id) === String(clean.id))) return p;
      wasAdded = true;
      return { ...p, songs: [...p.songs, clean] };
    });
    if (wasAdded) lset(key(uid,'playlists'), n);
    return n;
  });
  return wasAdded;
}

export function removeSongFromPlaylist(pid, songId) {
  const uid = get(user)?.id; if (!uid) return;
  playlists.update(ps => {
    const n = ps.map(p => p.id!==pid ? p : {...p,songs:p.songs.filter(s=>s.id!==songId)});
    lset(key(uid,'playlists'),n); return n;
  });
}

// ─── Downloads / offline ──────────────────────────────────────────────────────
export async function downloadTrack(song) {
  const uid = get(user)?.id; if (!uid) return;
  showToast(`Downloading "${song.title}"...`);
  try {
    const res = await fetch(song.url);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    await set(`audio_blob_${song.id}`, blob);
    
    downloads.update(d => {
      const n = { ...d, [song.id]: { ...song, cachedAt: Date.now() } };
      lset(key(uid,'downloads'), n); return n;
    });
    showToast(`Downloaded "${song.title}"`);
  } catch (e) {
    showToast(`Failed to download: ${e.message}`);
  }
}

export async function removeDownload(songId) {
  const uid = get(user)?.id; if (!uid) return;
  try {
    await del(`audio_blob_${songId}`);
    downloads.update(d => {
      const n = { ...d }; delete n[songId]; lset(key(uid,'downloads'),n); return n;
    });
    showToast('Removed from offline cache');
  } catch (e) {
    console.warn('Failed to delete blob', e);
  }
}

/**
 * Play a downloaded song from idb-keyval.
 */
export async function playDownload(song) {
  try {
    const blob = await idbGet(`audio_blob_${song.id}`);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      playNow({ ...song, url: blobUrl });
    } else {
      playNow(song); // fallback to network
    }
  } catch {
    playNow(song);
  }
}

// ─── Share ────────────────────────────────────────────────────────────────────
// Uses native navigator.share on mobile; falls back to clipboard on desktop.
export function shareItem(id, type = 'track') {
  const url = `https://syncy.vercel.app/${type}/${id}`;
  if (navigator.share) {
    navigator.share({ title: 'Syncy', url }).catch(() => {});
    showToast('Shared!');
  } else {
    navigator.clipboard?.writeText(url)
      .then(() => showToast('Link copied!'))
      .catch(() => showToast('Could not copy link'));
  }
}

