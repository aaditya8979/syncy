<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { searchMusic, searchJioSaavn, searchAll } from '$lib/services/musicApi.js';
  import { queue, playing, playNow, addToQueue } from '$lib/stores/player.js';
  import { toggleLike, addSongToPlaylist, downloadTrack, showToast, page, navigateTo } from '$lib/stores/app.js';
  import SongRow from '../components/SongRow.svelte';

  const BROWSE = [
    { label: 'Bollywood', color: '#be185d', q: 'bollywood hits 2024' },
    { label: 'Pop',       color: '#6d28d9', q: 'pop songs hindi'     },
    { label: 'Hip-Hop',   color: '#0369a1', q: 'hindi hip hop'       },
    { label: 'Devotional',color: '#92400e', q: 'bhakti songs'        },
    { label: 'Rock',      color: '#1e3a8a', q: 'indian rock songs'   },
    { label: 'Romance',   color: '#9d174d', q: 'romantic hindi songs'},
    { label: 'Indie',     color: '#065f46', q: 'hindi indie music'   },
    { label: 'Party',     color: '#7c2d12', q: 'party songs 2024'    },
  ];

  let q = '', results = [], loading = false, timer;
  let trending = [], trendingLoading = false;
  let catImages = {};
  let inp;
  let omniArtists = [], omniAlbums = [], omniPlaylists = [];

  $: {
    clearTimeout(timer);
    if (q.trim()) {
      loading = true;
      timer = setTimeout(async () => {
        try {
          const [songResults, allResults] = await Promise.all([
            searchMusic(q),
            searchAll(q),
          ]);
          results = songResults;
          omniArtists = allResults.artists ?? [];
          omniAlbums = allResults.albums ?? [];
          omniPlaylists = allResults.playlists ?? [];
        }
        catch { results = []; omniArtists = []; omniAlbums = []; omniPlaylists = []; }
        finally { loading = false; }
      }, 380);
    } else { results = []; omniArtists = []; omniAlbums = []; omniPlaylists = []; loading = false; }
  }

  onMount(async () => {
    setTimeout(() => inp?.focus(), 200);
    trendingLoading = true;
    try { trending = await searchJioSaavn('trending bollywood hits 2024'); }
    catch { trending = []; }
    finally { trendingLoading = false; }

    // Lazy-load one cover per browse category (fire-and-forget)
    for (const cat of BROWSE) {
      searchJioSaavn(cat.q).then(res => {
        if (res[0]?.coverUrl) catImages = { ...catImages, [cat.label]: res[0].coverUrl };
      }).catch(() => {});
    }
  });

  function onPlay(e) {
    const song = e.detail;
    if (get(queue).length === 0 && !get(playing)) {
      playNow(song); showToast(`Playing "${song.title}"`); page.set('player');
    } else {
      addToQueue(song); showToast(`"${song.title}" added to queue`);
    }
  }
  function onLike(e)  { toggleLike(e.detail); showToast(e.detail.liked ? 'Removed from liked' : 'Added to liked'); }
  function onDL(e)    { downloadTrack(e.detail); }
  function onAddPL(e) { addSongToPlaylist(e.detail.pid, e.detail.song); showToast('Added to playlist'); }

  function browseCategory(cat) {
    q = cat.q;
  }

  function playDiscover(song) {
    if (get(queue).length === 0 && !get(playing)) {
      playNow(song); page.set('player');
    } else {
      addToQueue(song); showToast(`"${song.title}" added to queue`);
    }
  }
</script>

<div class="srch-shell">
  <!-- Sticky white search bar -->
  <div class="srch-sticky">
    <div class="srch-bar">
      <span class="srch-ic">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </span>
      <input class="srch-inp" type="search" placeholder="Artists, songs, podcasts…"
        bind:value={q} bind:this={inp} autocomplete="off" />
      {#if loading}
        <span class="srch-end"><span class="spinner" style="width:15px;height:15px;border-color:rgba(0,0,0,.15);border-top-color:#111"></span></span>
      {:else if q}
        <button class="srch-end srch-clr" on:click={() => q = ''}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round">
            <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Scrollable body -->
  <div class="srch-body">
    {#if !q}
      <!-- Discover: horizontal portrait cards from trending -->
      {#if trendingLoading}
        <div style="padding:40px 24px;text-align:center" in:fade={{ duration:200 }}>
          <span class="spinner" style="width:22px;height:22px;margin:0 auto;display:block"></span>
        </div>
      {:else if trending.length > 0}
        <div in:fade={{ duration:280 }}>
          <div class="browse-heading">Discover something new</div>
          <div class="discover-row">
            {#each trending.slice(0, 12) as song, i}
              <button class="disc-card" on:click={() => playDiscover(song)}
                in:fly={{ y:10, duration:200, delay:Math.min(i*20, 240) }}>
                <div class="disc-art">
                  {#if song.coverUrl}
                    <img src={song.coverUrl} alt="" />
                  {:else}
                    <div class="disc-art-fb"></div>
                  {/if}
                  <div class="disc-play-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
                <div class="disc-title">{song.title}</div>
                <div class="disc-artist">{song.artist}</div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Browse All 2-col grid -->
      <div in:fade={{ duration:300, delay:100 }}>
        <div class="browse-heading">Browse all</div>
        <div class="browse-grid">
          {#each BROWSE as cat}
            <button class="bcat-card" style="background:{cat.color}" on:click={() => browseCategory(cat)}>
              <span class="bcat-label">{cat.label}</span>
              {#if catImages[cat.label]}
                <img src={catImages[cat.label]} alt="" class="bcat-img" />
              {:else}
                <!-- Placeholder angled shape when image not yet loaded -->
                <div class="bcat-shape" style="background:rgba(255,255,255,.12)"></div>
              {/if}
            </button>
          {/each}
        </div>
      </div>

    {:else if !loading && results.length === 0 && omniArtists.length === 0 && omniAlbums.length === 0}
      <div style="padding:48px 24px;text-align:center;color:var(--t3)" in:fade={{ duration:200 }}>
        <div style="font-size:14px">No results for "{q}"</div>
        <div style="font-size:12px;margin-top:6px">Try different keywords</div>
      </div>
    {:else}
      <!-- Artists (circular) -->
      {#if omniArtists.length > 0}
        <div class="browse-heading" style="font-size:16px">Artists</div>
        <div class="omni-row">
          {#each omniArtists as artist (artist.id)}
            <button class="omni-card circ" on:click={() => navigateTo('artist', artist.id)}>
              <div class="omni-art circ">
                {#if artist.coverUrl}<img src={artist.coverUrl} alt="" />{/if}
              </div>
              <div class="omni-title">{artist.name}</div>
              <div class="omni-sub">Artist</div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Albums (square) -->
      {#if omniAlbums.length > 0}
        <div class="browse-heading" style="font-size:16px">Albums</div>
        <div class="omni-row">
          {#each omniAlbums as album (album.id)}
            <button class="omni-card" on:click={() => navigateTo('collection', album.id, 'albums')}>
              <div class="omni-art sq">
                {#if album.coverUrl}<img src={album.coverUrl} alt="" />{/if}
              </div>
              <div class="omni-title">{album.title}</div>
              <div class="omni-sub">{album.artist}</div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Playlists (square) -->
      {#if omniPlaylists.length > 0}
        <div class="browse-heading" style="font-size:16px">Playlists</div>
        <div class="omni-row">
          {#each omniPlaylists as pl (pl.id)}
            <button class="omni-card" on:click={() => navigateTo('collection', pl.id, 'playlists')}>
              <div class="omni-art sq">
                {#if pl.coverUrl}<img src={pl.coverUrl} alt="" />{/if}
              </div>
              <div class="omni-title">{pl.title}</div>
              <div class="omni-sub">{pl.subtitle}</div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Songs -->
      {#if results.length > 0}
        <div class="browse-heading" style="font-size:16px">Songs</div>
        {#each results as song, i (song.id)}
          <div in:fly={{ y:8, duration:200, easing: cubicOut, delay:Math.min(i*20, 200) }}>
            <SongRow {song} index={i+1}
              on:play={onPlay} on:like={onLike} on:download={onDL} on:addtopl={onAddPL}
            />
          </div>
        {/each}
      {/if}
    {/if}

    <div style="height:16px"></div>
  </div>
</div>

<style>
  .srch-shell { height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0); }

  /* Sticky white search bar */
  .srch-sticky {
    flex-shrink:0;padding:12px 14px 10px;
    background:var(--bg0);
    border-bottom:1px solid var(--brd);
    position:sticky;top:0;z-index:20;
  }
  .srch-bar {
    position:relative;display:flex;align-items:center;
    background:#fff;border-radius:14px;
    box-shadow:0 2px 16px rgba(0,0,0,.18);
  }
  .srch-ic {
    position:absolute;left:14px;top:50%;transform:translateY(-50%);
    display:flex;pointer-events:none;
  }
  .srch-inp {
    width:100%;background:transparent;border:none;outline:none;
    padding:13px 44px;color:#111;font-size:15px;font-weight:500;
    font-family:var(--fb);border-radius:14px;
    caret-color:#111;
  }
  .srch-inp::placeholder { color:#888; }
  .srch-end {
    position:absolute;right:12px;top:50%;transform:translateY(-50%);
    display:flex;align-items:center;justify-content:center;
    background:none;border:none;cursor:pointer;width:32px;height:32px;
  }
  .srch-clr:hover { opacity:.7; }

  /* Scrollable body */
  .srch-body { flex:1;overflow-y:auto;padding:0 14px; }

  /* Section headings */
  .browse-heading {
    font-family:var(--fn);font-size:18px;font-weight:800;
    color:var(--t1);padding:18px 0 12px;
  }

  /* Discover portrait cards */
  .discover-row {
    display:flex;gap:12px;overflow-x:auto;
    scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
    padding-bottom:10px;scrollbar-width:none;margin-bottom:6px;
  }
  .discover-row::-webkit-scrollbar { display:none; }
  .disc-card {
    flex-shrink:0;width:110px;background:none;border:none;
    cursor:pointer;text-align:left;scroll-snap-align:start;padding:0;
  }
  .disc-card:active { transform:scale(.95); }
  .disc-art {
    width:110px;height:150px;border-radius:12px;
    background:var(--su2);overflow:hidden;
    margin-bottom:7px;position:relative;
  }
  .disc-art img { width:100%;height:100%;object-fit:cover; }
  .disc-art-fb { width:100%;height:100%;background:var(--su2); }
  .disc-play-badge {
    position:absolute;bottom:8px;right:8px;
    width:30px;height:30px;border-radius:50%;
    background:rgba(0,0,0,.65);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;
    color:#fff;opacity:0;transition:opacity .15s;
  }
  .disc-card:hover .disc-play-badge { opacity:1; }
  .disc-title { font-size:12px;font-weight:600;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .disc-artist { font-size:10.5px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px; }

  /* Browse all 2-col grid */
  .browse-grid {
    display:grid;grid-template-columns:1fr 1fr;gap:12px;
    margin-bottom:20px;
  }
  .bcat-card {
    position:relative;border-radius:12px;overflow:hidden;
    min-height:100px;border:none;cursor:pointer;
    padding:14px 12px;text-align:left;
    transition:transform .15s, box-shadow .15s;
  }
  .bcat-card:hover { transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.4); }
  .bcat-card:active { transform:scale(.96); }
  .bcat-label {
    font-family:var(--fn);font-size:15px;font-weight:800;
    color:#fff;position:relative;z-index:2;
    text-shadow:0 1px 4px rgba(0,0,0,.3);
    line-height:1.2;display:block;max-width:55%;
  }
  .bcat-img {
    position:absolute;bottom:-10px;right:-10px;
    width:80px;height:80px;object-fit:cover;
    border-radius:8px;transform:rotate(15deg);
    box-shadow:-4px 4px 16px rgba(0,0,0,.4);
    opacity:.88;
  }
  .bcat-shape {
    position:absolute;bottom:-14px;right:-14px;
    width:80px;height:80px;border-radius:10px;
    transform:rotate(15deg);
  }

  /* Omnisearch result rows */
  .omni-row {
    display:flex;gap:16px;overflow-x:auto;padding-bottom:12px;margin-bottom:8px;
    scrollbar-width:none;
  }
  .omni-row::-webkit-scrollbar { display:none; }
  .omni-card {
    flex-shrink:0;width:120px;background:none;border:none;cursor:pointer;
    text-align:left;padding:0;
  }
  .omni-card:active { transform:scale(.95); }
  .omni-card.circ { text-align:center; }
  .omni-art {
    width:120px;height:120px;background:var(--su2);overflow:hidden;
    margin-bottom:8px;
  }
  .omni-art.circ { border-radius:50%; }
  .omni-art.sq   { border-radius:8px; }
  .omni-art img  { width:100%;height:100%;object-fit:cover; }
  .omni-title {
    font-size:13px;font-weight:600;color:var(--t1);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  .omni-sub {
    font-size:11px;color:var(--t3);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;
  }
</style>
