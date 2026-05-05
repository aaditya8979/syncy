<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { user, authLoading, page, currentView, toast, initLibrary } from '$lib/stores/app.js';
  import { queue, qIdx, playing, currentSong, playSong } from '$lib/stores/player.js';
  import { getSession, ADMIN_EMAIL } from '$lib/services/supabase.js';

  import Login       from './pages/Login.svelte';
  import Signup      from './pages/Signup.svelte';
  import Home        from './pages/Home.svelte';
  import Search      from './pages/Search.svelte';
  import Player      from './pages/Player.svelte';
  import Library     from './pages/Library.svelte';
  import Rooms       from './pages/Rooms.svelte';
  import RoomPlayer  from './pages/RoomPlayer.svelte';
  import Admin       from './pages/Admin.svelte';
  import Artist      from './pages/Artist.svelte';
  import Collection  from './pages/Collection.svelte';
  import MiniPlayer  from './components/MiniPlayer.svelte';
  import BottomNav   from './components/BottomNav.svelte';

  let authPage = 'login';
  let roomId   = null;

  // ── Check if admin ────────────────────────────────────────────────────────
  $: isAdmin = $user && ADMIN_EMAIL && $user.email === ADMIN_EMAIL;

  // ── Persist page/queue state to survive reloads ───────────────────────────
  const SS_VIEW  = 'syncy:view';
  const SS_QUEUE = 'syncy:queue';
  const SS_QIDX  = 'syncy:qIdx';

  // Save on every change
  $: if ($currentView) { try { sessionStorage.setItem(SS_VIEW, JSON.stringify($currentView)); } catch {} }
  $: if ($queue) { try { sessionStorage.setItem(SS_QUEUE, JSON.stringify($queue)); } catch {} }
  $: { try { sessionStorage.setItem(SS_QIDX, String($qIdx)); } catch {} }

  onMount(async () => {
    const u = await getSession();
    if (u) {
      user.set(u);
      initLibrary(u.id);

      // Restore session state after auth
      try {
        const savedView = sessionStorage.getItem(SS_VIEW);
        if (savedView) {
          const v = JSON.parse(savedView);
          if (v && v.page) {
            currentView.set(v);
          }
        }
        const savedQueue = sessionStorage.getItem(SS_QUEUE);
        const savedIdx   = sessionStorage.getItem(SS_QIDX);
        if (savedQueue) {
          const q = JSON.parse(savedQueue);
          if (Array.isArray(q) && q.length > 0) {
            queue.set(q);
            const idx = parseInt(savedIdx || '0', 10);
            qIdx.set(Math.min(idx, q.length - 1));
          }
        }
      } catch {}
    }
    authLoading.set(false);
  });
</script>

{#if $authLoading}
  <div class="splash">
    <div class="splash-icon">
      <svg viewBox="0 0 56 56" fill="none">
        <rect width="56" height="56" rx="16" fill="#0a0a16"/>
        <circle cx="18" cy="36" r="8" fill="none" stroke="url(#spa)" stroke-width="2.2"/>
        <circle cx="40" cy="32" r="8" fill="none" stroke="url(#spa)" stroke-width="2.2"/>
        <path d="M26 36V13L48 10V32" fill="none" stroke="url(#spa)" stroke-width="2.2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="spa" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f59e0b"/>
            <stop offset="1" stop-color="#dc2626"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="splash-name">SYNCY</div>
  </div>

{:else if !$user}
  {#if authPage === 'login'}
    <Login on:switch={() => authPage = 'signup'} />
  {:else}
    <Signup on:switch={() => authPage = 'login'} />
  {/if}

{:else}
  <div class="shell">
    <div class="page-area">
      {#key $currentView.page + ($currentView.id || '')}
        <div class="page-wrap"
          in:fly={{ y: 15, duration: 250, easing: quintOut }}
          out:fade={{ duration: 120 }}>
          {#if $currentView.page === 'home'}
            <Home />
          {:else if $currentView.page === 'search'}
            <Search />
          {:else if $currentView.page === 'player'}
            <Player />
          {:else if $currentView.page === 'library'}
            <Library />
          {:else if $currentView.page === 'rooms'}
            <Rooms on:enter={e => { roomId=e.detail; page.set('room'); }} />
          {:else if $currentView.page === 'room'}
            <RoomPlayer {roomId} on:leave={() => { page.set('rooms'); roomId=null; }} />
          {:else if $currentView.page === 'admin' && isAdmin}
            <Admin />
          {:else if $currentView.page === 'artist' && $currentView.id}
            <Artist artistId={$currentView.id} />
          {:else if $currentView.page === 'collection' && $currentView.id}
            <Collection collectionId={$currentView.id} collectionType={$currentView.type || 'playlists'} />
          {/if}
        </div>
      {/key}
    </div>

    {#if $currentView.page !== 'player' && $currentView.page !== 'room' && $currentSong}
      <MiniPlayer />
    {/if}

    {#if $currentView.page !== 'room'}
      <BottomNav {isAdmin} />
    {/if}
  </div>
{/if}

<!-- Toast -->
{#if $toast}
  <div class="toast" in:fly={{ y:20, duration:200 }} out:fly={{ y:20, duration:160 }}>
    {$toast}
  </div>
{/if}

<style>
  .splash {
    position:fixed; inset:0; background:var(--bg0);
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:22px;
  }
  .splash-icon { width:76px; height:76px; animation:floatY 3s ease-in-out infinite; }
  .splash-icon svg { width:100%; height:100%; }
  .splash-name {
    font-family:var(--fn); font-size:24px; font-weight:800; letter-spacing:.36em;
    background:linear-gradient(135deg, var(--t1) 40%, var(--a6));
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both .3s;
  }
  .shell    { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
  .page-area { flex:1; overflow:hidden; min-height:0; position:relative; }
  .page-wrap { position:absolute; inset:0; overflow:hidden; }
</style>