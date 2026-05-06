<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import WaveCanvas from '../components/WaveCanvas.svelte';
  import { user, page, playlists, liked, showToast, navigateTo } from '$lib/stores/app.js';
  import { queue, playing, currentSong, playNow, addToQueue } from '$lib/stores/player.js';
  import { signOut } from '$lib/services/supabase.js';
  import { fetchHomeModules } from '$lib/services/musicApi.js';

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  $: rawName = $user?.user_metadata?.username || $user?.email?.split('@')[0] || 'there';
  $: name    = rawName.length > 14 ? rawName.slice(0,13)+'…' : rawName;
  $: initial = rawName.charAt(0).toUpperCase();

  let mounted = false, filter = 'all', homeLoading = true;
  let charts = [], featuredPlaylists = [], newReleases = [], trending = [], trendingAlbums = [], trendingStations = [];

  $: quickItems = $liked.slice(0, 4);
  $: featCard   = featuredPlaylists[0] ?? null;
  $: horizItems = featuredPlaylists.slice(1);

  onMount(async () => {
    setTimeout(() => mounted = true, 80);
    // Safety timeout — homeLoading never stays true beyond 6 s
    const safetyTimer = setTimeout(() => { homeLoading = false; }, 6000);
    try {
      const d = await fetchHomeModules();
      charts            = d.charts ?? [];
      featuredPlaylists = d.featuredPlaylists;
      newReleases       = d.newReleases ?? [];
      trending          = d.trending ?? [];
      trendingAlbums    = d.trendingAlbums ?? [];
      trendingStations  = d.trendingStations;
    } catch {}
    finally { homeLoading = false; clearTimeout(safetyTimer); }
  });

  async function doSignOut() { await signOut(); user.set(null); }

  function setFilter(f) {
    filter = f;
    if (f === 'podcasts') showToast('Podcasts coming soon');
  }

  function playItem(item) {
    if (item.url) { playNow(item); page.set('player'); }
    else { showToast(`Loading "${item.title}"…`); page.set('search'); }
  }

  function queueItem(item) {
    if (item.url) { addToQueue(item); showToast(`"${item.title}" added to queue`); }
    else showToast('No direct stream — searching…');
  }
</script>

<div class="home">
  <WaveCanvas intensity={1.2} />
  <div class="top-fade" aria-hidden="true"></div>

  <header class="h-hdr">
    <div class="h-logo">
      <div class="h-logo-mark">S</div>
      <span class="wordmark">YNCY</span>
    </div>
    <div class="hdr-sep"></div>
    {#if $playing}
      <div class="live-chip" in:fly={{ x:10, duration:200 }}>
        <div class="live-dot"></div>LIVE
      </div>
    {/if}
    <button class="avatar-btn" title="Sign out" on:click={doSignOut}>
      <div class="avatar">{initial}</div>
      <div class="avatar-tooltip">Sign out</div>
    </button>
  </header>

  <div class="h-scroll">

    {#if mounted}
      <div class="hero" in:fly={{ y:20, duration:460, easing:cubicOut, delay:60 }}>
        <div class="hero-greet">{greet}</div>
        <h1 class="hero-name">{name}</h1>
      </div>
    {/if}

    <!-- Filter pills -->
    {#if mounted}
      <div class="filter-pills" in:fly={{ y:10, duration:340, easing:cubicOut, delay:100 }}>
        {#each [['all','All'],['music','Music'],['podcasts','Podcasts']] as [val,lbl]}
          <button class="fpill" class:on={filter===val} on:click={() => setFilter(val)}>{lbl}</button>
        {/each}
      </div>
    {/if}

    <!-- Quick resume 2-col grid -->
    {#if quickItems.length > 0 && mounted}
      <div class="qr-grid" in:fly={{ y:12, duration:360, easing:cubicOut, delay:140 }}>
        {#each quickItems as song}
          <button class="qr-card" on:click={() => playItem(song)}>
            {#if song.coverUrl}
              <img src={song.coverUrl} alt="" class="qr-art" />
            {:else}
              <div class="qr-art qr-art-fb"></div>
            {/if}
            <div class="qr-text">
              <div class="qr-title">{song.title}</div>
              <div class="qr-artist">{song.artist}</div>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Charts row -->
    {#if homeLoading}
      <div class="skel" style="height:140px;border-radius:18px;margin-bottom:22px"></div>
    {:else if charts.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:170 }}>
        <div class="sec-hdr">
          <span class="sec-label">CHARTS</span>
        </div>
        <div class="h-row">
          {#each charts as chart}
            <button class="h-card" on:click={() => navigateTo('collection', chart.id, 'playlists')}>
              <div class="h-art">{#if chart.coverUrl}<img src={chart.coverUrl} alt="" />{/if}</div>
              <div class="h-card-title">{chart.title}</div>
              <div class="h-card-sub">{chart.subtitle || 'JioSaavn'}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- "Picked for you" feature card -->
    {#if !homeLoading && featCard}
      <div class="feat-card" in:fly={{ y:12, duration:360, easing:cubicOut, delay:200 }}>
        {#if featCard.coverUrl}
          <div class="feat-img-bg" style="background-image:url({featCard.coverUrl})"></div>
        {/if}
        <div class="feat-overlay"></div>
        <div class="feat-body">
          <div class="feat-eye">PICKED FOR YOU</div>
          <div class="feat-title">{featCard.title}</div>
          <div class="feat-sub">{featCard.subtitle || (featCard.songCount>0 ? `${featCard.songCount} songs` : '')}</div>
          <div class="feat-actions">
            <button class="btn-primary" style="padding:9px 20px;font-size:12.5px;gap:6px" on:click={() => navigateTo('collection', featCard.id, 'playlists')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Open
            </button>
            <button class="btn-ghost" style="padding:9px 16px;font-size:12.5px" on:click={() => queueItem(featCard)}>+ Queue</button>
          </div>
        </div>
        {#if featCard.coverUrl}
          <img src={featCard.coverUrl} alt="" class="feat-art" />
        {/if}
      </div>
    {/if}

    <!-- New Releases (Album cards) -->
    {#if homeLoading}
      <div class="sec-hdr"><div class="skel" style="width:100px;height:12px;border-radius:4px"></div></div>
      <div class="h-row" style="margin-bottom:22px">
        {#each [1,2,3,4] as _}<div class="skel" style="flex-shrink:0;width:130px;height:158px;border-radius:12px;scroll-snap-align:start"></div>{/each}
      </div>
    {:else if newReleases.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:230 }}>
        <div class="sec-hdr">
          <span class="sec-label">NEW RELEASES</span>
          <button class="sec-link" on:click={() => page.set('search')}>See all →</button>
        </div>
        <div class="h-row">
          {#each newReleases as album}
            <button class="h-card" on:click={() => navigateTo('collection', album.id, 'albums')}>
              <div class="h-art">{#if album.coverUrl}<img src={album.coverUrl} alt="" />{/if}</div>
              <div class="h-card-title">{album.title}</div>
              <div class="h-card-sub">{album.artist}{#if album.year} · {album.year}{/if}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Trending Albums (real album collections) -->
    {#if !homeLoading && trendingAlbums.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:250 }}>
        <div class="sec-hdr">
          <span class="sec-label">TRENDING ALBUMS</span>
        </div>
        <div class="h-row">
          {#each trendingAlbums as album}
            <button class="h-card" on:click={() => navigateTo('collection', album.id, 'albums')}>
              <div class="h-art">{#if album.coverUrl}<img src={album.coverUrl} alt="" />{/if}</div>
              <div class="h-card-title">{album.title}</div>
              <div class="h-card-sub">{album.artist || album.year}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Trending playlist row -->
    {#if !homeLoading && horizItems.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:260 }}>
        <div class="sec-hdr">
          <span class="sec-label">TRENDING PLAYLISTS</span>
          <button class="sec-link" on:click={() => page.set('search')}>See all →</button>
        </div>
        <div class="h-row">
          {#each horizItems as item}
            <button class="h-card" on:click={() => navigateTo('collection', item.id, 'playlists')}>
              <div class="h-art">{#if item.coverUrl}<img src={item.coverUrl} alt="" />{/if}</div>
              <div class="h-card-title">{item.title}</div>
              <div class="h-card-sub">{item.subtitle}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Radio stations (circular) -->
    {#if !homeLoading && trendingStations.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:260 }}>
        <div class="sec-hdr"><span class="sec-label">RADIO STATIONS</span></div>
        <div class="h-row">
          {#each trendingStations as st}
            <button class="st-card" on:click={() => showToast(`${st.title} — coming soon`)}>
              <div class="st-art">{#if st.coverUrl}<img src={st.coverUrl} alt="" />{/if}</div>
              <div class="st-title">{st.title}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- My playlists -->
    {#if mounted && $playlists.length > 0}
      <div class="section" in:fly={{ y:12, duration:360, easing:cubicOut, delay:290 }}>
        <div class="sec-hdr">
          <span class="sec-label">MY PLAYLISTS</span>
          <button class="sec-link" on:click={() => page.set('library')}>See all →</button>
        </div>
        <div class="h-row">
          {#each $playlists.slice(0,6) as pl}
            <button class="h-card" on:click={() => page.set('library')}>
              <div class="h-art">{#if pl.songs[0]?.coverUrl}<img src={pl.songs[0].coverUrl} alt="" />{/if}</div>
              <div class="h-card-title">{pl.name}</div>
              <div class="h-card-sub">{pl.songs.length} songs</div>
            </button>
          {/each}
        </div>
      </div>
    {:else if mounted && $playlists.length === 0 && $liked.length === 0 && !homeLoading}
      <div class="start-hint" in:fade={{ duration:300, delay:350 }}>
        <div class="hint-text">Start by searching for songs you love</div>
        <button class="btn-primary" style="margin-top:12px" on:click={() => page.set('search')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          Search songs
        </button>
      </div>
    {/if}

    <!-- Stats bar -->
    {#if mounted}
      <div class="stats-bar" in:fly={{ y:10, duration:360, easing:cubicOut, delay:320 }}>
        <div class="stat-item"><div class="stat-val">{$queue.length}</div><div class="stat-key">IN QUEUE</div></div>
        <div class="stat-div"></div>
        <div class="stat-item"><div class="stat-val">{$playlists.length}</div><div class="stat-key">PLAYLISTS</div></div>
        <div class="stat-div"></div>
        <div class="stat-item"><div class="stat-val">{$liked.length}</div><div class="stat-key">LIKED</div></div>
        <div class="stat-div"></div>
        <div class="stat-item">
          <div class="stat-val" style="color:{$playing?'var(--g)':'var(--t3)'}">
            {#if $playing}
              <div class="eq" style="display:inline-flex">
                <div class="eq-bar" style="--d:.38s;--delay:0s"></div>
                <div class="eq-bar" style="--d:.44s;--delay:.06s"></div>
                <div class="eq-bar" style="--d:.36s;--delay:.12s"></div>
              </div>
            {:else}—{/if}
          </div>
          <div class="stat-key">{$playing ? 'PLAYING' : 'IDLE'}</div>
        </div>
      </div>
    {/if}

    <div style="height:20px"></div>
  </div>
</div>

<style>
  .home { height:100%;display:flex;flex-direction:column;overflow:hidden;position:relative;background:var(--bg0); }
  .top-fade { position:absolute;top:0;left:0;right:0;height:120px;background:linear-gradient(to bottom,var(--bg0) 0%,transparent 100%);pointer-events:none;z-index:2; }

  .h-hdr { position:relative;z-index:10;flex-shrink:0;display:flex;align-items:center;gap:10px;padding:calc(var(--st) + 10px) 16px 10px; }
  .h-logo { display:flex;align-items:center; }
  .h-logo-mark { width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--a4),var(--r3));display:flex;align-items:center;justify-content:center;font-family:var(--fn);font-size:15px;font-weight:800;color:#fff;box-shadow:0 2px 12px rgba(245,158,11,.35);flex-shrink:0; }
  .wordmark { font-family:var(--fn);font-size:18px;font-weight:800;letter-spacing:.18em;color:var(--t1);padding-left:2px; }
  .hdr-sep { flex:1; }
  .avatar-btn { position:relative;background:none;border:none;cursor:pointer;padding:0;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center; }
  .avatar { width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--a3),var(--r3));display:flex;align-items:center;justify-content:center;font-family:var(--fn);font-size:13px;font-weight:800;color:#fff;border:1.5px solid rgba(245,158,11,.2);transition:box-shadow .15s; }
  .avatar-btn:hover .avatar { box-shadow:0 0 0 2px var(--a4); }
  .avatar-tooltip { position:absolute;top:calc(100% + 6px);right:0;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;padding:4px 9px;font-size:11px;color:var(--t2);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s; }
  .avatar-btn:hover .avatar-tooltip { opacity:1; }

  .h-scroll { flex:1;overflow-y:auto;position:relative;z-index:1;padding:0 14px; }

  .hero { padding:14px 2px 14px; }
  .hero-greet { font-size:13px;color:var(--t3);margin-bottom:3px; }
  .hero-name { font-family:var(--fn);font-size:34px;font-weight:800;line-height:1;letter-spacing:-.01em;background:linear-gradient(135deg,var(--t1) 50%,var(--a5) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }

  .filter-pills { display:flex;gap:8px;margin-bottom:18px;overflow-x:auto; }
  .filter-pills::-webkit-scrollbar { display:none; }
  .fpill { padding:7px 18px;border-radius:100px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:var(--su2);color:var(--t2);transition:all .15s;white-space:nowrap;min-height:36px;flex-shrink:0; }
  .fpill.on { background:var(--t1);color:var(--bg0); }
  .fpill:active { transform:scale(.94); }

  .qr-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px; }
  .qr-card { display:flex;align-items:center;background:rgba(20,20,40,.9);border-radius:8px;overflow:hidden;cursor:pointer;border:none;text-align:left;min-height:56px;transition:background .1s; }
  .qr-card:hover { background:var(--su2); }
  .qr-card:active { transform:scale(.97); }
  .qr-art { width:56px;height:56px;object-fit:cover;flex-shrink:0; }
  .qr-art-fb { width:56px;height:56px;background:var(--su2);flex-shrink:0; }
  .qr-text { padding:6px 8px;min-width:0;flex:1; }
  .qr-title { font-size:12px;font-weight:600;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .qr-artist { font-size:10.5px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px; }

  .feat-card { position:relative;border-radius:18px;overflow:hidden;margin-bottom:22px;min-height:140px;display:flex;align-items:flex-end; }
  .feat-img-bg { position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(20px) brightness(.45);transform:scale(1.1); }
  .feat-overlay { position:absolute;inset:0;background:linear-gradient(120deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.15) 100%); }
  .feat-body { position:relative;z-index:2;padding:16px 18px;flex:1; }
  .feat-eye { font-family:var(--fm);font-size:9px;color:var(--a5);letter-spacing:.16em;margin-bottom:6px; }
  .feat-title { font-family:var(--fn);font-size:20px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:4px; }
  .feat-sub { font-size:12px;color:rgba(255,255,255,.5);margin-bottom:14px; }
  .feat-actions { display:flex;gap:8px;align-items:center; }
  .feat-art { position:absolute;right:-10px;bottom:-10px;width:110px;height:110px;object-fit:cover;border-radius:14px;box-shadow:-8px 8px 24px rgba(0,0,0,.5);transform:rotate(-4deg);z-index:1;opacity:.75; }

  .section { margin-bottom:22px; }
  .sec-hdr { display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
  .sec-label { font-family:var(--fm);font-size:10px;color:var(--t3);letter-spacing:.14em; }
  .sec-link { background:none;border:none;cursor:pointer;color:var(--a5);font-size:12px;font-weight:600;min-height:44px;display:flex;align-items:center; }

  .h-row { display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:8px;scrollbar-width:none; }
  .h-row::-webkit-scrollbar { display:none; }
  .h-card { flex-shrink:0;width:130px;background:none;border:none;cursor:pointer;text-align:left;scroll-snap-align:start;padding:0; }
  .h-card:active { transform:scale(.96); }
  .h-art { width:130px;height:130px;border-radius:12px;background:var(--su2);overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:8px; }
  .h-art img { width:100%;height:100%;object-fit:cover; }
  .h-card-title { font-size:12.5px;font-weight:600;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .h-card-sub { font-size:11px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px; }

  .st-card { flex-shrink:0;width:90px;background:none;border:none;cursor:pointer;text-align:center;scroll-snap-align:start;padding:0; }
  .st-card:active { transform:scale(.92); }
  .st-art { width:90px;height:90px;border-radius:50%;background:var(--su2);overflow:hidden;margin:0 auto 8px;border:2px solid var(--br2); }
  .st-art img { width:100%;height:100%;object-fit:cover; }
  .st-title { font-size:11px;font-weight:500;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }

  .stats-bar { display:flex;align-items:center;background:rgba(12,12,24,.9);border:1px solid var(--brd);border-radius:var(--r-m);padding:14px 6px;margin-bottom:20px;backdrop-filter:blur(20px); }
  .stat-item { flex:1;text-align:center; }
  .stat-val { font-family:var(--fn);font-size:22px;font-weight:800;color:var(--a5);line-height:1;min-height:26px;display:flex;align-items:center;justify-content:center; }
  .stat-key { font-family:var(--fm);font-size:8.5px;color:var(--t4);letter-spacing:.12em;margin-top:4px; }
  .stat-div { width:1px;height:36px;background:var(--brd);flex-shrink:0; }

  .start-hint { background:rgba(12,12,24,.9);border:1px dashed var(--br2);border-radius:var(--r-l);padding:28px 20px;text-align:center;margin-bottom:20px; }
  .hint-text { font-size:13px;color:var(--t3);line-height:1.6; }
</style>