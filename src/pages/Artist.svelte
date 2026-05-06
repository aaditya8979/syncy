<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { getArtistDetails } from '$lib/services/musicApi.js';
  import { page, showToast, navigateTo, navigateBack } from '$lib/stores/app.js';
  import { queue, qIdx, playing, playNow, addToQueue, playSong } from '$lib/stores/player.js';
  import SongRow from '../components/SongRow.svelte';

  export let artistId;

  let artist = null;
  let loading = true;

  onMount(async () => {
    loading = true;
    artist = await getArtistDetails(artistId);
    loading = false;
  });

  $: if (artistId) { loadArtist(artistId); }
  async function loadArtist(id) {
    loading = true;
    artist = await getArtistDetails(id);
    loading = false;
  }

  function playAll() {
    if (!artist?.songs?.length) return;
    queue.set(artist.songs);
    qIdx.set(0);
    playSong(artist.songs[0]);
    page.set('player');
  }

  function shuffleAll() {
    if (!artist?.songs?.length) return;
    const shuffled = [...artist.songs].sort(() => Math.random() - 0.5);
    queue.set(shuffled);
    qIdx.set(0);
    playSong(shuffled[0]);
    page.set('player');
  }

  const fmtCount = n => {
    const num = parseInt(n, 10);
    if (isNaN(num)) return '0';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
  };
</script>

<div class="artist-page">
  {#if loading}
    <div class="artist-loading">
      <span class="spinner" style="width:28px;height:28px"></span>
    </div>
  {:else if !artist}
    <div class="artist-loading" style="color:var(--t3)">Artist not found</div>
  {:else}
    <!-- Cinematic Header -->
    <div class="artist-hero" in:fade={{ duration: 400 }}>
      {#if artist.coverUrl}
        <img src={artist.coverUrl} alt="" class="hero-bg-img" />
      {/if}
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <button class="back-btn" on:click={navigateBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div class="hero-meta">
          {#if artist.isVerified}
            <div class="verified-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span>Verified Artist</span>
            </div>
          {/if}
          <h1 class="hero-name">{artist.name}</h1>
          <div class="hero-stats">
            <span>{fmtCount(artist.followerCount)} followers</span>
            {#if artist.dominantType}
              <span class="dot">·</span>
              <span style="text-transform:capitalize">{artist.dominantType}</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="artist-actions" in:fly={{ y: 10, duration: 300, delay: 100 }}>
      <button class="play-btn" on:click={playAll}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Play
      </button>
      <button class="shuffle-btn" on:click={shuffleAll}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
        </svg>
        Shuffle
      </button>
    </div>

    <!-- Bio -->
    {#if artist.bio?.length > 0}
      <div class="artist-bio" in:fly={{ y: 10, duration: 300, delay: 150 }}>
        <p>{artist.bio[0]?.text ?? ''}</p>
      </div>
    {/if}

    <!-- Popular Tracks -->
    {#if artist.songs?.length > 0}
      <div class="songs-section" in:fly={{ y: 10, duration: 300, delay: 200 }}>
        <h3 class="section-title">Popular</h3>
        {#each artist.songs.slice(0, 20) as song, i (song.id)}
          <div in:fly={{ y: 8, duration: 200, easing: cubicOut, delay: i < 15 ? i * 20 : 0 }}>
            <SongRow {song} index={i + 1} />
          </div>
        {/each}
      </div>
    {:else}
      <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">
        No songs available for this artist
      </div>
    {/if}

    <!-- Albums -->
    {#if artist.albums?.length > 0}
      <div class="albums-section" in:fly={{ y: 10, duration: 300, delay: 280 }}>
        <h3 class="section-title">Albums</h3>
        <div class="albums-row">
          {#each artist.albums as album (album.id)}
            <button class="album-card" on:click={() => navigateTo('collection', album.id, 'albums')}>
              <div class="album-art">
                {#if album.coverUrl}<img src={album.coverUrl} alt="" />{/if}
              </div>
              <div class="album-title">{album.title}</div>
              <div class="album-year">{album.year || ''}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div style="height:100px"></div>
  {/if}
</div>

<style>
  .artist-page { height:100%;overflow-y:auto;background:var(--bg0); }
  .artist-loading { display:flex;align-items:center;justify-content:center;height:300px; }

  /* Cinematic Hero */
  .artist-hero { position:relative;height:340px;overflow:hidden; }
  .hero-bg-img {
    position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    filter:brightness(.6);
  }
  .hero-gradient {
    position:absolute;inset:0;
    background:linear-gradient(to bottom, rgba(6,6,14,0) 0%, rgba(6,6,14,0.4) 50%, var(--bg0) 100%);
  }
  .hero-content {
    position:relative;z-index:2;height:100%;display:flex;flex-direction:column;
    justify-content:flex-end;padding:24px;
  }
  .back-btn {
    position:absolute;top:20px;left:16px;width:36px;height:36px;border-radius:50%;
    background:rgba(0,0,0,.5);backdrop-filter:blur(10px);border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;color:#fff;
  }
  .hero-meta { }
  .verified-badge {
    display:inline-flex;align-items:center;gap:6px;
    font-size:11px;color:#3b82f6;margin-bottom:8px;
  }
  .hero-name {
    font-family:var(--fn);font-size:42px;font-weight:800;color:#fff;
    line-height:1.05;margin-bottom:8px;
    text-shadow:0 4px 20px rgba(0,0,0,.5);
  }
  .hero-stats { font-size:13px;color:rgba(255,255,255,.7); }
  .hero-stats .dot { margin:0 6px; }

  /* Actions */
  .artist-actions { display:flex;gap:12px;padding:20px 24px; }
  .play-btn {
    display:flex;align-items:center;gap:8px;
    padding:12px 32px;border-radius:100px;border:none;cursor:pointer;
    background:var(--a5);color:#000;font-size:14px;font-weight:700;
    font-family:var(--fn);transition:transform .1s,box-shadow .2s;
  }
  .play-btn:hover { transform:scale(1.04);box-shadow:0 4px 20px var(--ga); }
  .play-btn:active { transform:scale(.96); }
  .shuffle-btn {
    display:flex;align-items:center;gap:8px;
    padding:12px 24px;border-radius:100px;
    border:1px solid var(--br2);background:none;cursor:pointer;
    color:var(--t1);font-size:14px;font-weight:600;font-family:var(--fn);
    transition:background .15s;
  }
  .shuffle-btn:hover { background:var(--su2); }

  /* Bio */
  .artist-bio { padding:0 24px 16px;font-size:13px;color:var(--t2);line-height:1.6; }

  /* Songs */
  .songs-section { padding:0 8px; }
  .section-title {
    font-family:var(--fn);font-size:18px;font-weight:700;color:var(--t1);
    padding:8px 16px 12px;
  }

  /* Albums */
  .albums-section { padding:0 8px 16px; }
  .albums-row {
    display:flex;gap:12px;overflow-x:auto;padding:0 8px 8px;
    scrollbar-width:none;-webkit-overflow-scrolling:touch;
  }
  .albums-row::-webkit-scrollbar { display:none; }
  .album-card {
    flex-shrink:0;width:130px;background:none;border:none;cursor:pointer;
    text-align:left;padding:0;
  }
  .album-card:active { transform:scale(.96); }
  .album-art {
    width:130px;height:130px;border-radius:12px;background:var(--su2);
    overflow:hidden;margin-bottom:8px;
  }
  .album-art img { width:100%;height:100%;object-fit:cover; }
  .album-title {
    font-size:12.5px;font-weight:600;color:var(--t1);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  .album-year {
    font-size:11px;color:var(--t3);margin-top:2px;
  }
</style>
