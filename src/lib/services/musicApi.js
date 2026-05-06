/**
 * musicApi.js — JioSaavn primary (Bollywood/Hindi), Jamendo fallback
 * Handles ALL three JioSaavn response shapes observed in the wild
 */

const JIOSAAVN = 'https://saavn.sumit.co/api';
const JAMENDO  = 'b6747d04';

function clean(s) {
  return String(s||'')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
    .replace(/<[^>]*>/g,'').trim();
}

function bestUrl(urls) {
  if (!urls?.length) return '';
  for (const q of ['320kbps','160kbps','96kbps','48kbps']) {
    const m = urls.find(u => u.quality === q);
    if (m?.link) return m.link;
    if (m?.url)  return m.url;
  }
  const last = urls[urls.length-1];
  return last?.link ?? last?.url ?? '';
}

function bestImg(imgs) {
  if (!imgs?.length) return '';
  const hq = imgs.find(i => i.quality === '500x500' || i.quality === 'high');
  return hq?.link ?? hq?.url ?? imgs[imgs.length-1]?.link ?? imgs[imgs.length-1]?.url ?? '';
}

export async function searchJioSaavn(query) {
  try {
    const res = await fetch(
      `${JIOSAAVN}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=30`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // All three response shapes:
    const songs = data?.data?.results ?? data?.results ?? data?.songs?.results ?? [];

    return songs.map(s => ({
      id:       `jio-${s.id}`,
      title:    clean(s.name ?? s.title ?? ''),
      artist:   clean(
        s.primaryArtists ?? s.primary_artists ??
        s.artists?.primary?.map(a=>a.name).join(', ') ?? 'Unknown'
      ),
      url:      bestUrl(s.downloadUrl ?? s.download_url),
      coverUrl: bestImg(s.image),
      duration: parseInt(String(s.duration ?? '0'), 10) || 0,
      source:   'jiosaavn',
    })).filter(s => s.url && s.title);
  } catch(e) {
    console.warn('[JioSaavn]', e.message);
    return [];
  }
}

export async function searchJamendo(query) {
  try {
    const p = new URLSearchParams({
      client_id: JAMENDO, format:'json', limit:'15', audioformat:'mp31', namesearch: query
    });
    const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${p}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    let results = data.results || [];
    if (!results.length) {
      const tp = new URLSearchParams({ client_id: JAMENDO, format:'json', limit:'15', audioformat:'mp31', tags: query.toLowerCase() });
      const tr = await fetch(`https://api.jamendo.com/v3.0/tracks/?${tp}`, { signal: AbortSignal.timeout(8000) });
      results = (await tr.json()).results || [];
    }
    return results.map(t => ({
      id:       `jmdo-${t.id}`,
      title:    t.name,
      artist:   t.artist_name,
      url:      t.audio || t.audiodownload,
      coverUrl: t.album_image || t.image || '',
      duration: Number(t.duration) || 0,
      source:   'jamendo',
    }));
  } catch(e) {
    console.warn('[Jamendo]', e.message);
    return [];
  }
}

export async function searchMusic(query) {
  if (!query.trim()) return [];
  const jio = await searchJioSaavn(query);
  return jio.length > 0 ? jio : searchJamendo(query);
}

// ── Home page modules (trending playlists, new releases, radio, charts) ──────
export async function fetchHomeModules() {
  const mapPl = p => ({
    id:       String(p.id ?? p.listid ?? ''),
    title:    clean(p.title ?? p.name ?? p.listname ?? ''),
    subtitle: clean(p.subtitle ?? p.more_info?.firstname ?? ''),
    coverUrl: bestImg(p.image),
    songCount: parseInt(String(p.count ?? p.songCount ?? p.more_info?.song_count ?? '0'), 10) || 0,
    type: 'playlist',
  });
  const mapAlbum = a => ({
    id:      String(a.id ?? ''),
    title:   clean(a.title ?? a.name ?? ''),
    artist:  clean(a.subtitle ?? a.artists?.map?.(x=>x.name)?.join(', ') ?? a.primaryArtists?.map?.(x=>x.name)?.join(', ') ?? ''),
    coverUrl: bestImg(a.image),
    year:    String(a.releaseDate ?? a.more_info?.release_date ?? a.year ?? '').slice(0, 4),
    songCount: parseInt(String(a.songCount ?? '0'), 10) || 0,
    type: 'album',
  });
  const mapSt = r => ({
    id:      String(r.id ?? r.stationid ?? ''),
    title:   clean(r.title ?? r.name ?? ''),
    coverUrl: bestImg(r.image),
    type: 'station',
  });

  // Convert a modules "album" entry (which is actually a song preview) into a playable song
  async function resolveModuleSong(item) {
    const base = {
      id:       `jio-${item.id}`,
      title:    clean(item.name ?? item.title ?? ''),
      artist:   clean(item.primaryArtists?.map?.(a=>a.name)?.join(', ') ?? item.subtitle ?? ''),
      coverUrl: bestImg(item.image),
      duration: parseInt(String(item.duration ?? '0'), 10) || 0,
      source:   'jiosaavn',
      type:     'song',
    };
    // Try to get the download URL from the item itself
    let url = bestUrl(item.downloadUrl ?? item.download_url);
    if (url) return { ...base, url };
    // Fetch full song data by ID
    try {
      const res = await fetch(`${JIOSAAVN}/songs/${item.id}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        const s = d?.data?.[0] ?? d?.data ?? {};
        url = bestUrl(s.downloadUrl ?? s.download_url);
        if (url) return { ...base, url, title: clean(s.name ?? base.title), artist: clean(s.primaryArtists ?? base.artist) };
      }
    } catch {}
    return { ...base, url: '' };
  }

  // /modules endpoint not available — build home from parallel song, album, and playlist searches
  try {
    const songQueries = [
      'trending bollywood hits 2026',
      'arijit singh latest',
      'punjabi hits trending',
      'hip hop rap trending',
    ];
    const albumQueries = [
      'latest bollywood',
      'latest punjabi',
      'top english',
    ];
    const playlistQueries = [
      'top bollywood',
      'romantic hits',
      'workout mix',
    ];
    const chartQueries = [
      'top charts',
      'global top 50',
    ];

    const [songResults, albumResults, playlistResults, chartResults] = await Promise.all([
      Promise.allSettled(songQueries.map(q => searchJioSaavn(q))),
      Promise.allSettled(albumQueries.map(q => searchAlbums(q))),
      Promise.allSettled(playlistQueries.map(q => searchPlaylists(q))),
      Promise.allSettled(chartQueries.map(q => searchPlaylists(q))),
    ]);

    // Collect all songs, deduplicate
    const seenSong = new Set();
    const allSongs = [];
    for (const r of songResults) {
      if (r.status !== 'fulfilled') continue;
      for (const s of r.value) {
        if (!seenSong.has(s.id)) { seenSong.add(s.id); allSongs.push(s); }
      }
    }

    // Collect all albums, deduplicate
    const seenAlbum = new Set();
    const allAlbums = [];
    for (const r of albumResults) {
      if (r.status !== 'fulfilled') continue;
      for (const a of r.value) {
        if (!seenAlbum.has(a.id)) { seenAlbum.add(a.id); allAlbums.push(a); }
      }
    }

    // Collect all playlists, deduplicate
    const seenPlaylist = new Set();
    const allPlaylists = [];
    for (const r of playlistResults) {
      if (r.status !== 'fulfilled') continue;
      for (const p of r.value) {
        if (!seenPlaylist.has(p.id)) { seenPlaylist.add(p.id); allPlaylists.push(p); }
      }
    }

    // Collect all charts, deduplicate
    const allCharts = [];
    for (const r of chartResults) {
      if (r.status !== 'fulfilled') continue;
      for (const p of r.value) {
        if (!seenPlaylist.has(p.id)) { seenPlaylist.add(p.id); allCharts.push(p); }
      }
    }

    const trend = allSongs.slice(0, 40).map(s => ({ ...s, type: 'song' }));

    return {
      charts: allCharts.slice(0, 10),
      featuredPlaylists: allPlaylists.slice(0, 16),
      newReleases: allAlbums.slice(0, 20),   // Real album cards
      trendingAlbums: allAlbums.slice(20, 40),
      trending: trend,
      trendingStations: [],
    };
  } catch (e) {
    console.warn('[JioSaavn/modules]', e.message);
    const songs = await searchJioSaavn('trending bollywood hits 2026');
    return {
      charts: [],
      featuredPlaylists: songs.slice(0, 8).map(s => ({ ...s, type: 'playlist', songCount: 0, subtitle: s.artist })),
      newReleases: [],
      trendingAlbums: [],
      trending: songs.slice(8).map(s => ({ ...s, type: 'song' })),
      trendingStations: [],
    };
  }
}

// ── Omnisearch (songs + artists + albums + playlists) ─────────────────────────
export async function searchAll(query) {
  if (!query?.trim()) return { songs: [], artists: [], albums: [], playlists: [], topQuery: null };
  try {
    const res = await fetch(
      `${JIOSAAVN}/search?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const d = raw?.data ?? {};

    const songs = (d.songs?.results ?? []).map(s => ({
      id: `jio-${s.id}`, title: clean(s.title ?? s.name ?? ''),
      artist: clean(s.description ?? ''), coverUrl: bestImg(s.image), type: 'song',
    }));
    const artists = (d.artists?.results ?? []).map(a => ({
      id: String(a.id ?? ''), name: clean(a.title ?? a.name ?? ''),
      coverUrl: bestImg(a.image), type: 'artist',
      description: clean(a.description ?? ''),
    }));
    const albums = (d.albums?.results ?? []).map(a => ({
      id: String(a.id ?? ''), title: clean(a.title ?? a.name ?? ''),
      artist: clean(a.description ?? ''), coverUrl: bestImg(a.image), type: 'album',
    }));
    const playlists = (d.playlists?.results ?? []).map(p => ({
      id: String(p.id ?? ''), title: clean(p.title ?? p.name ?? ''),
      subtitle: clean(p.description ?? ''), coverUrl: bestImg(p.image), type: 'playlist',
    }));
    const topQuery = d.topQuery?.results?.[0] ?? null;

    return { songs, artists, albums, playlists, topQuery };
  } catch (e) {
    console.warn('[JioSaavn/searchAll]', e.message);
    // Fallback to song-only search
    const fallback = await searchJioSaavn(query);
    return { songs: fallback, artists: [], albums: [], playlists: [], topQuery: null };
  }
}

// ── Artist detail page ───────────────────────────────────────────────────────
export async function getArtistDetails(artistId) {
  if (!artistId) return null;
  try {
    const res = await fetch(`${JIOSAAVN}/artists?id=${artistId}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const info = raw?.data ?? {};

    // topSongs & topAlbums come directly on the artist object
    const songs = (info.topSongs ?? []).map(s => ({
      id:       `jio-${s.id}`,
      title:    clean(s.name ?? s.title ?? ''),
      artist:   clean(s.artists?.primary?.map(a => a.name).join(', ') ?? ''),
      url:      bestUrl(s.downloadUrl ?? s.download_url),
      coverUrl: bestImg(s.image),
      duration: parseInt(String(s.duration ?? '0'), 10) || 0,
      source:   'jiosaavn',
    })).filter(s => s.url && s.title);

    const albums = (info.topAlbums ?? []).map(a => ({
      id:       String(a.id ?? ''),
      title:    clean(a.name ?? a.title ?? ''),
      artist:   clean(a.artists?.primary?.map(x => x.name).join(', ') ?? ''),
      coverUrl: bestImg(a.image),
      year:     String(a.year ?? ''),
      type:     'album',
    })).filter(a => a.id && a.title);

    return {
      id:            String(info.id ?? artistId),
      name:          clean(info.name ?? ''),
      coverUrl:      bestImg(info.image),
      bio:           info.bio ?? [],
      followerCount: info.followerCount ?? info.fanCount ?? '0',
      fanCount:      info.fanCount ?? '0',
      isVerified:    !!info.isVerified,
      dominantType:  info.dominantType ?? '',
      wiki:          info.wiki ?? '',
      songs,
      albums,
    };
  } catch (e) {
    console.warn('[JioSaavn/artist]', e.message);
    return null;
  }
}

// ── Search albums ────────────────────────────────────────────────────────────
export async function searchAlbums(query) {
  if (!query?.trim()) return [];
  try {
    const res = await fetch(
      `${JIOSAAVN}/search/albums?query=${encodeURIComponent(query)}&limit=15`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return (raw?.data?.results ?? []).map(a => ({
      id:       String(a.id ?? ''),
      title:    clean(a.name ?? a.title ?? ''),
      artist:   clean(a.artists?.primary?.map(x => x.name).join(', ') ?? a.description ?? ''),
      coverUrl: bestImg(a.image),
      year:     String(a.year ?? ''),
      type:     'album',
    })).filter(a => a.id && a.title);
  } catch (e) {
    console.warn('[JioSaavn/searchAlbums]', e.message);
    return [];
  }
}

// ── Search playlists ─────────────────────────────────────────────────────────
export async function searchPlaylists(query) {
  if (!query?.trim()) return [];
  try {
    const res = await fetch(
      `${JIOSAAVN}/search/playlists?query=${encodeURIComponent(query)}&limit=15`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return (raw?.data?.results ?? []).map(p => ({
      id:       String(p.id ?? ''),
      title:    clean(p.name ?? p.title ?? ''),
      subtitle: clean(p.description ?? p.language ?? ''),
      coverUrl: bestImg(p.image),
      songCount: parseInt(String(p.songCount ?? '0'), 10) || 0,
      type:     'playlist',
    })).filter(p => p.id && p.title);
  } catch (e) {
    console.warn('[JioSaavn/searchPlaylists]', e.message);
    return [];
  }
}

// ── Collection (Album or Playlist) detail ────────────────────────────────────
export async function getCollection(type, id) {
  if (!type || !id) return null;
  // type = 'albums' or 'playlists'
  try {
    const res = await fetch(`${JIOSAAVN}/${type}?id=${id}&limit=100`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const d = raw?.data ?? {};

    const songs = (d.songs ?? []).map(s => ({
      id:       `jio-${s.id}`,
      title:    clean(s.name ?? s.title ?? ''),
      artist:   clean(
        s.artists?.primary?.map(a => a.name).join(', ') ??
        s.primaryArtists ?? ''
      ),
      url:      bestUrl(s.downloadUrl ?? s.download_url),
      coverUrl: bestImg(s.image),
      duration: parseInt(String(s.duration ?? '0'), 10) || 0,
      source:   'jiosaavn',
    })).filter(s => s.url && s.title);

    return {
      id:        String(d.id ?? id),
      title:     clean(d.name ?? d.title ?? ''),
      coverUrl:  bestImg(d.image),
      songCount: d.songCount ?? songs.length,
      songs,
      year:      String(d.year ?? d.releaseDate ?? '').slice(0,4),
      artist:    clean(
        d.artists?.primary?.map(a => a.name).join(', ') ??
        d.primaryArtists ?? d.firstname ?? ''
      ),
      followerCount: d.followerCount ?? d.fanCount ?? '0',
      type,
    };
  } catch (e) {
    console.warn(`[JioSaavn/${type}]`, e.message);
    return null;
  }
}

// ── Lyrics ───────────────────────────────────────────────────────────────────
function parseLyrics(raw) {
  if (!raw) return { lines: [], synced: false };
  const cleanRaw = raw.replace(/<br\s*\/?>/gi, '\n').replace(/ {2,}/g, '\n');
  const lrcRe = /^\[(\d{2}):(\d{2})[.:](\d{2,3})\]\s*(.*)$/;
  const lrcLines = cleanRaw.split('\n').filter(l => lrcRe.test(l.trim()));
  if (lrcLines.length > 3) {
    return {
      synced: true,
      lines: lrcLines.map(l => {
        const m = l.trim().match(lrcRe);
        return { time: +m[1]*60 + parseFloat(`${m[2]}.${m[3]}`), text: m[4] };
      }).filter(l => l.text.trim()),
    };
  }
  return {
    synced: false,
    lines: cleanRaw.split(/\n+/)
      .map((text, i) => ({ time: i * 4, text: text.trim() }))
      .filter(l => l.text && !l.text.startsWith('[')),
  };
}

export async function getLyrics(songId, title = '', artist = '') {
  const id = String(songId).startsWith('jio-') ? String(songId).slice(4) : String(songId);
  let raw = '';
  console.log('[Lyrics] Fetching for:', { id, title, artist });

  // 1. Try JioSaavn API
  try {
    const res = await fetch(`${JIOSAAVN}/lyrics?id=${id}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      console.log('[Lyrics] JioSaavn response status:', data?.status);
      if (data?.status !== 'FAILED') {
        if (typeof data?.data?.lyrics === 'string') raw = data.data.lyrics;
        else if (typeof data?.lyrics === 'string') raw = data.lyrics;
        else if (typeof data?.data === 'string') raw = data.data;
      }
    }
  } catch (e) {
    console.warn('[Lyrics] JioSaavn error:', e.message);
  }

  if (raw.trim()) {
    console.log('[Lyrics] JioSaavn success, length:', raw.length);
    return parseLyrics(raw);
  }

  // 2. Fallback to LRCLIB (Global Synced Lyrics Database)
  if (title) {
    try {
      const cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
      const firstArtist = (artist || '').split(',')[0].trim();
      const q = encodeURIComponent(`${cleanTitle} ${firstArtist}`.trim());
      const url = `https://lrclib.net/api/search?q=${q}`;
      console.log('[Lyrics] LRCLIB query:', url);
      
      const lrclibRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
      console.log('[Lyrics] LRCLIB status:', lrclibRes.status);
      if (lrclibRes.ok) {
        const lrcData = await lrclibRes.json();
        console.log('[Lyrics] LRCLIB results:', lrcData.length);
        if (Array.isArray(lrcData) && lrcData.length > 0) {
          const best = lrcData.find(d => d.syncedLyrics) || lrcData[0];
          raw = best.syncedLyrics || best.plainLyrics || '';
          if (raw.trim()) {
            console.log('[Lyrics] LRCLIB success, synced:', !!best.syncedLyrics, 'length:', raw.length);
            return parseLyrics(raw);
          }
        }
      }
    } catch (e) {
      console.warn('[Lyrics] LRCLIB error:', e.message);
    }
  }

  // 3. No lyrics found
  console.log('[Lyrics] No lyrics found for:', title);
  return { lines: [], synced: false };
}

// ── Get single song details (to resolve stream URLs) ─────────────────────────
export async function getSongDetails(songId) {
  if (!songId) return null;
  const id = String(songId).startsWith('jio-') ? songId.slice(4) : songId;
  try {
    const res = await fetch(`${JIOSAAVN}/songs/${id}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      const s = d?.data?.[0] ?? d?.data ?? {};
      if (!s.id) return null;
      return {
        id:       `jio-${s.id}`,
        title:    clean(s.name ?? s.title ?? ''),
        artist:   clean(s.primaryArtists ?? s.artists?.primary?.map(a=>a.name).join(', ') ?? ''),
        url:      bestUrl(s.downloadUrl ?? s.download_url),
        coverUrl: bestImg(s.image),
        duration: parseInt(String(s.duration ?? '0'), 10) || 0,
        source:   'jiosaavn',
      };
    }
  } catch(e) {
    console.warn('[JioSaavn/song]', e.message);
  }
  return null;
}
