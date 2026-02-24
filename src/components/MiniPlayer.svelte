<script>
  import { page } from '$lib/stores/app.js';
  import { currentSong, playing, pct, togglePlay, skipNext } from '$lib/stores/player.js';
</script>

<div class="mini-player" on:click={() => page.set('player')} role="button" tabindex="0"
  on:keydown={e => e.key==='Enter' && page.set('player')}>
  <!-- Progress bar at bottom -->
  <div class="mp-bar"><div class="mp-fill" style="width:{$pct}%"></div></div>

  <!-- Art -->
  {#if $currentSong?.coverUrl}
    <img src={$currentSong.coverUrl} alt=""
      style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0" />
  {:else}
    <div style="width:38px;height:38px;border-radius:8px;background:var(--su2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    </div>
  {/if}

  <!-- Info -->
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t1)">{$currentSong?.title}</div>
    <div style="font-size:11px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">{$currentSong?.artist}</div>
  </div>

  <!-- Controls -->
  <button class="ctrl-play sm" on:click|stopPropagation={togglePlay} style="width:36px;height:36px">
    {#if $playing}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    {:else}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    {/if}
  </button>
  <button class="ctrl-btn" style="padding:6px" on:click|stopPropagation={skipNext}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
  </button>
</div>
