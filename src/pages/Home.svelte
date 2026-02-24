<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import WaveCanvas from '../components/WaveCanvas.svelte';
  import { user, page, playlists, liked, showToast } from '$lib/stores/app.js';
  import { queue, playing, currentSong, playNow, addToQueue } from '$lib/stores/player.js';
  import { signOut } from '$lib/services/supabase.js';

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Trim username — never overflow
  $: rawName = $user?.user_metadata?.username || $user?.email?.split('@')[0] || 'there';
  $: name = rawName.length > 14 ? rawName.slice(0, 13) + '…' : rawName;
  $: initial = rawName.charAt(0).toUpperCase();

  let mounted = false;
  onMount(() => { setTimeout(() => mounted = true, 80); });

  async function doSignOut() { await signOut(); user.set(null); }
</script>

<div class="home">
  <!-- Full-height ambient wave canvas -->
  <WaveCanvas intensity={1.2} />

  <!-- Top gradient fade so header reads well over waves -->
  <div class="top-fade" aria-hidden="true"></div>

  <!-- ── HEADER ──────────────────────────────────────────────────────────── -->
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

  <!-- ── SCROLLABLE BODY ─────────────────────────────────────────────────── -->
  <div class="h-scroll">

    <!-- Hero -->
    {#if mounted}
      <div class="hero" in:fly={{ y:22, duration:560, easing:cubicOut, delay:60 }}>
        <div class="hero-greet">{greet}</div>
        <h1 class="hero-name">{name}</h1>
        <p class="hero-tag">Your personal music universe</p>
      </div>
    {/if}

    <!-- ── Primary action cards ──────────────────────────────────────────── -->
    {#if mounted}
      <div class="action-grid" in:fly={{ y:20, duration:480, easing:cubicOut, delay:140 }}>

        <!-- LISTEN card — large, primary CTA -->
        <button class="action-card card-listen" on:click={() => page.set('search')}>
          <div class="card-bg-glow"></div>
          <div class="card-inner">
            <div class="card-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <div class="card-text">
              <div class="card-title">Listen</div>
              <div class="card-sub">Millions of songs</div>
            </div>
          </div>
          <div class="card-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </button>

        <!-- Two smaller cards -->
        <div class="card-row">
          <button class="action-card card-library" on:click={() => page.set('library')}>
            <div class="card-icon sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div class="card-title sm">Library</div>
            <div class="card-sub sm">{$playlists.length} playlists · {$liked.length} liked</div>
          </button>

          <button class="action-card card-rooms" on:click={() => page.set('rooms')}>
            <div class="card-icon sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div class="card-title sm">Rooms</div>
            <div class="card-sub sm">Listen together</div>
          </button>
        </div>
      </div>
    {/if}

    <!-- ── Now playing strip ──────────────────────────────────────────────── -->
    {#if $currentSong}
      <div class="now-strip" in:fly={{ y:10, duration:300 }}>
        <div class="ns-art">
          {#if $currentSong.coverUrl}
            <img src={$currentSong.coverUrl} alt="" />
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          {/if}
          {#if $playing}<div class="ns-pulse"></div>{/if}
        </div>
        <div class="ns-info">
          <div class="ns-label">NOW PLAYING</div>
          <div class="ns-title">{$currentSong.title}</div>
        </div>
        <button class="ns-btn" on:click={() => page.set('player')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    {/if}

    <!-- ── Stats bar ──────────────────────────────────────────────────────── -->
    {#if mounted}
      <div class="stats-bar" in:fly={{ y:16, duration:420, easing:cubicOut, delay:220 }}>
        <div class="stat-item">
          <div class="stat-val">{$queue.length}</div>
          <div class="stat-key">IN QUEUE</div>
        </div>
        <div class="stat-div"></div>
        <div class="stat-item">
          <div class="stat-val">{$playlists.length}</div>
          <div class="stat-key">PLAYLISTS</div>
        </div>
        <div class="stat-div"></div>
        <div class="stat-item">
          <div class="stat-val">{$liked.length}</div>
          <div class="stat-key">LIKED</div>
        </div>
        <div class="stat-div"></div>
        <div class="stat-item">
          <div class="stat-val" style="color:{$playing?'var(--g)':'var(--t3)'}">
            {#if $playing}
              <div class="eq" style="display:inline-flex">
                <div class="eq-bar" style="--d:.38s;--delay:0s"></div>
                <div class="eq-bar" style="--d:.44s;--delay:.06s"></div>
                <div class="eq-bar" style="--d:.36s;--delay:.12s"></div>
              </div>
            {:else}
              —
            {/if}
          </div>
          <div class="stat-key">{$playing ? 'PLAYING' : 'IDLE'}</div>
        </div>
      </div>
    {/if}

    <!-- ── Playlists section ───────────────────────────────────────────────── -->
    {#if mounted && $playlists.length > 0}
      <div class="section" in:fly={{ y:16, duration:400, easing:cubicOut, delay:300 }}>
        <div class="sec-row">
          <span class="sec-label">PLAYLISTS</span>
          <button class="sec-link" on:click={() => page.set('library')}>See all →</button>
        </div>
        <div class="pl-scroll">
          {#each $playlists.slice(0,6) as pl}
            <button class="pl-chip" on:click={() => page.set('library')}>
              <div class="pl-chip-art">
                {#if pl.songs[0]?.coverUrl}
                  <img src={pl.songs[0].coverUrl} alt="" />
                {:else}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                {/if}
              </div>
              <div class="pl-chip-name">{pl.name}</div>
              <div class="pl-chip-count">{pl.songs.length}</div>
            </button>
          {/each}
        </div>
      </div>
    {:else if mounted}
      <div class="start-hint" in:fade={{ duration:300, delay:380 }}>
        <div class="hint-text">Start by searching for songs you love</div>
        <button class="btn-primary" style="margin-top:12px" on:click={() => page.set('search')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          Search songs
        </button>
      </div>
    {/if}

    <!-- Bottom padding for nav -->
    <div style="height:16px"></div>
  </div>
</div>

<style>
  .home {
    height:100%; display:flex; flex-direction:column; overflow:hidden;
    position:relative; background:var(--bg0);
  }
  .top-fade {
    position:absolute; top:0; left:0; right:0; height:120px;
    background:linear-gradient(to bottom, var(--bg0) 0%, transparent 100%);
    pointer-events:none; z-index:2;
  }

  /* Header */
  .h-hdr {
    position:relative; z-index:10; flex-shrink:0;
    display:flex; align-items:center; gap:10px;
    padding:calc(var(--st) + 10px) 16px 10px;
    background:transparent;
  }
  .h-logo { display:flex; align-items:center; gap:0; }
  .h-logo-mark {
    width:30px; height:30px; border-radius:8px; flex-shrink:0;
    background:linear-gradient(135deg, var(--a4), var(--r3));
    display:flex; align-items:center; justify-content:center;
    font-family:var(--fn); font-size:15px; font-weight:800; color:#fff;
    box-shadow:0 2px 12px rgba(245,158,11,.35);
  }
  .wordmark {
    font-family:var(--fn); font-size:18px; font-weight:800; letter-spacing:.18em;
    color:var(--t1); padding-left:2px;
  }
  .hdr-sep { flex:1; }
  .avatar-btn { position:relative; background:none; border:none; cursor:pointer; padding:0; }
  .avatar {
    width:32px; height:32px; border-radius:50%; flex-shrink:0;
    background:linear-gradient(135deg, var(--a3), var(--r3));
    display:flex; align-items:center; justify-content:center;
    font-family:var(--fn); font-size:13px; font-weight:800; color:#fff;
    border:1.5px solid rgba(245,158,11,.2);
    transition:box-shadow .15s;
  }
  .avatar-btn:hover .avatar { box-shadow:0 0 0 2px var(--a4); }
  .avatar-tooltip {
    position:absolute; top:calc(100% + 6px); right:0;
    background:var(--bg3); border:1px solid var(--brd); border-radius:6px;
    padding:4px 9px; font-size:11px; color:var(--t2);
    white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .15s;
  }
  .avatar-btn:hover .avatar-tooltip { opacity:1; }

  /* Scroll area */
  .h-scroll {
    flex:1; overflow-y:auto; position:relative; z-index:1;
    padding:0 14px;
  }

  /* Hero */
  .hero { padding:16px 2px 20px; }
  .hero-greet { font-size:13px; color:var(--t3); letter-spacing:.04em; margin-bottom:4px; }
  .hero-name {
    font-family:var(--fn); font-size:38px; font-weight:800; line-height:1;
    letter-spacing:-.01em; margin-bottom:10px;
    background:linear-gradient(135deg, var(--t1) 50%, var(--a5) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .hero-tag { font-size:13px; color:var(--t3); font-style:italic; }

  /* Action grid */
  .action-grid { display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
  .card-row    { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

  .action-card {
    border:none; cursor:pointer; border-radius:18px;
    position:relative; overflow:hidden;
    transition:transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s;
    display:flex;
  }
  .action-card:hover  { transform:translateY(-3px); }
  .action-card:active { transform:scale(.97); }

  /* Large LISTEN card */
  .card-listen {
    padding:20px 20px;
    background:linear-gradient(140deg, #92400e 0%, #b45309 35%, #7c2d12 80%, #450a0a 100%);
    box-shadow:0 8px 36px rgba(180,83,9,.4);
    align-items:center; gap:14px;
    flex-direction:row;
  }
  .card-listen .card-bg-glow {
    position:absolute; top:-30%; right:-10%;
    width:180px; height:180px; border-radius:50%;
    background:radial-gradient(circle, rgba(251,191,36,.18) 0%, transparent 70%);
    pointer-events:none;
  }
  .card-inner { display:flex; align-items:center; gap:14px; flex:1; position:relative; z-index:1; }
  .card-icon {
    width:52px; height:52px; border-radius:15px;
    background:rgba(255,255,255,.12); backdrop-filter:blur(10px);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; color:#fff;
  }
  .card-text { text-align:left; }
  .card-title { font-family:var(--fn); font-size:20px; font-weight:800; color:#fff; line-height:1; }
  .card-sub   { font-size:12px; color:rgba(255,255,255,.6); margin-top:3px; }
  .card-arrow { color:rgba(255,255,255,.5); position:relative; z-index:1; flex-shrink:0; }

  /* Small cards */
  .card-library, .card-rooms {
    padding:16px 14px; flex-direction:column; align-items:flex-start; gap:8px;
  }
  .card-library {
    background:linear-gradient(140deg, #1a1a32 0%, #14142a 100%);
    border:1px solid var(--br2);
    box-shadow:0 4px 20px rgba(0,0,0,.4);
  }
  .card-rooms {
    background:linear-gradient(140deg, #1f0a0a 0%, #2d0f0f 100%);
    border:1px solid rgba(185,28,28,.25);
    box-shadow:0 4px 20px rgba(185,28,28,.15);
  }
  .card-icon.sm {
    width:40px; height:40px; border-radius:12px;
    background:rgba(255,255,255,.06);
    display:flex; align-items:center; justify-content:center;
    color:var(--t2);
  }
  .card-library .card-icon.sm { color:var(--v5); }
  .card-rooms   .card-icon.sm { color:var(--r5); }
  .card-title.sm { font-family:var(--fn); font-size:14px; font-weight:700; color:var(--t1); }
  .card-sub.sm   { font-size:10.5px; color:var(--t3); }

  /* Now playing strip */
  .now-strip {
    display:flex; align-items:center; gap:10px;
    background:rgba(16,16,28,.95); border:1px solid var(--br2);
    border-radius:14px; padding:10px 12px; margin-bottom:16px;
    backdrop-filter:blur(20px);
    box-shadow:0 4px 20px rgba(0,0,0,.4);
  }
  .ns-art {
    width:40px; height:40px; border-radius:10px;
    background:var(--su2); flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden; position:relative;
  }
  .ns-art img { width:100%; height:100%; object-fit:cover; }
  .ns-pulse {
    position:absolute; inset:0; border-radius:10px;
    background:transparent; border:2px solid rgba(245,158,11,.5);
    animation:nsPulse 1.5s ease-in-out infinite;
  }
  @keyframes nsPulse {
    0%,100% { opacity:0.4; transform:scale(1); }
    50%      { opacity:1;   transform:scale(1.06); }
  }
  .ns-info { flex:1; min-width:0; }
  .ns-label { font-family:var(--fm); font-size:8.5px; color:var(--a5); letter-spacing:.14em; margin-bottom:2px; }
  .ns-title { font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ns-btn {
    width:32px; height:32px; border-radius:50%;
    background:var(--su2); border:1px solid var(--brd);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; color:var(--t2); cursor:pointer;
    transition:all .15s;
  }
  .ns-btn:hover { color:var(--t1); border-color:var(--a4); }

  /* Stats bar */
  .stats-bar {
    display:flex; align-items:center;
    background:rgba(12,12,24,.9); border:1px solid var(--brd);
    border-radius:var(--r-m); padding:14px 6px; margin-bottom:20px;
    backdrop-filter:blur(20px);
  }
  .stat-item { flex:1; text-align:center; }
  .stat-val  {
    font-family:var(--fn); font-size:22px; font-weight:800;
    color:var(--a5); line-height:1; min-height:26px;
    display:flex; align-items:center; justify-content:center;
  }
  .stat-key  { font-family:var(--fm); font-size:8.5px; color:var(--t4); letter-spacing:.12em; margin-top:4px; }
  .stat-div  { width:1px; height:36px; background:var(--brd); flex-shrink:0; }

  /* Playlists horizontal scroll */
  .section { margin-bottom:20px; }
  .sec-row  { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .sec-label { font-family:var(--fm); font-size:10px; color:var(--t3); letter-spacing:.14em; }
  .sec-link  { background:none; border:none; cursor:pointer; color:var(--a5); font-size:12px; font-weight:600; }
  .pl-scroll { display:flex; gap:10px; overflow-x:auto; padding-bottom:6px; }
  .pl-scroll::-webkit-scrollbar { display:none; }
  .pl-chip {
    display:flex; flex-direction:column; align-items:center; gap:7px;
    background:var(--sur); border:1px solid var(--brd); border-radius:var(--r-m);
    padding:12px 10px; min-width:90px; max-width:90px; cursor:pointer;
    transition:all .15s; flex-shrink:0;
  }
  .pl-chip:hover { border-color:var(--br2); background:var(--su2); transform:translateY(-2px); }
  .pl-chip-art {
    width:56px; height:56px; border-radius:12px;
    background:var(--su2); display:flex; align-items:center; justify-content:center;
    overflow:hidden;
  }
  .pl-chip-art img { width:100%; height:100%; object-fit:cover; }
  .pl-chip-name {
    font-size:11.5px; font-weight:600; width:100%; text-align:center;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  .pl-chip-count { font-family:var(--fm); font-size:9.5px; color:var(--t3); }

  /* Start hint */
  .start-hint {
    background:rgba(12,12,24,.9); border:1px dashed var(--br2);
    border-radius:var(--r-l); padding:28px 20px;
    text-align:center; margin-bottom:20px;
  }
  .hint-text { font-size:13px; color:var(--t3); line-height:1.6; }
</style>