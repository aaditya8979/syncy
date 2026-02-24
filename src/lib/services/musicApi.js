/**
 * musicApi.js — JioSaavn primary (Bollywood/Hindi), Jamendo fallback
 * Handles ALL three JioSaavn response shapes observed in the wild
 */

const JIOSAAVN = 'https://jiosaavn-api-privatecvc2.vercel.app';
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
      `${JIOSAAVN}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=20`,
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
