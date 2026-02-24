<script>
  import { page } from '$lib/stores/app.js';
  import { queue } from '$lib/stores/player.js';

  export let isAdmin = false;

  $: TABS = [
    { id:'home',    label:'Home'    },
    { id:'search',  label:'Search'  },
    { id:'player',  label:'Now'     },
    { id:'library', label:'Library' },
    { id:'rooms',   label:'Rooms'   },
    ...(isAdmin ? [{ id:'admin', label:'Admin' }] : []),
  ];
  $: N = TABS.length;

  $: activeIdx = TABS.findIndex(t => t.id === $page);
  $: indLeft   = activeIdx >= 0 ? `${activeIdx * (100/N)}%` : '0%';
  $: indWidth  = `${100/N}%`;

  // ── Swipe between tabs ──────────────────────────────────────────────────
  let touchX = 0, touchY = 0;
  function onTouchStart(e) {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchY);
    if (Math.abs(dx) < 55 || dy > Math.abs(dx) * 0.6) return;
    const cur = TABS.findIndex(t => t.id === $page);
    if (cur < 0) return;
    const nxt = dx < 0 ? Math.min(cur+1, N-1) : Math.max(cur-1, 0);
    page.set(TABS[nxt].id);
  }
</script>

<svelte:window on:touchstart={onTouchStart} on:touchend={onTouchEnd} />

<nav class="bnav">
  <div class="bnav-indicator" style="left:{indLeft};width:{indWidth}"></div>

  {#each TABS as tab}
    <button class="bnav-btn" class:on={$page===tab.id} on:click={() => page.set(tab.id)}>
      {#if tab.id === 'home'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      {:else if tab.id === 'search'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      {:else if tab.id === 'player'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
        </svg>
      {:else if tab.id === 'library'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      {:else if tab.id === 'rooms'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      {:else if tab.id === 'admin'}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      {/if}
      {tab.label}

      {#if tab.id === 'player' && $queue.length > 0}
        <span class="bnav-badge">{$queue.length}</span>
      {/if}
    </button>
  {/each}
</nav>