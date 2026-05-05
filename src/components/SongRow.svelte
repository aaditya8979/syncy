<script>
  import { createEventDispatcher } from 'svelte';
  import { playing, currentSong, addToQueue, playNow } from '$lib/stores/player.js';
  import { liked, playlists, showToast, addSongToPlaylist, toggleLike, page, downloadTrack, downloads } from '$lib/stores/app.js';

  export let song;
  export let index    = null;
  export let context  = 'default'; // 'queue' shows remove button
  export let compact  = false;

  const D = createEventDispatcher();
  let showPL = false;
  let pressTimer = null;
  let didLongPress = false;
  let pressing = false;

  $: active      = $currentSong?.id != null && String($currentSong.id) === String(song.id);
  $: isPlay      = active && $playing;
  $: isLiked     = $liked.some(s => String(s.id) === String(song.id));
  $: isDownloaded = String(song.id) in $downloads || song.id in $downloads;
  const fmt      = s => s > 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '';

  // ── Advanced Gesture: Tap = Queue, Long Press = Play ───────────────────────
  function handlePointerDown(e) {
    didLongPress = false;
    pressing = true;
    pressTimer = setTimeout(() => {
      didLongPress = true;
      pressing = false;
      // Long-press: play instantly with haptic feedback
      playNow(song);
      page.set('player');
      showToast(`Playing "${song.title}"`);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }

  function handlePointerUp(e) {
    clearTimeout(pressTimer);
    pressing = false;
    if (didLongPress) { didLongPress = false; return; }
    // Normal tap: add to queue (or play in queue context)
    if (context === 'queue') {
      D('play', song);
    } else {
      addToQueue(song);
      showToast(`"${song.title}" added to queue`);
    }
  }

  function handlePointerLeave() {
    clearTimeout(pressTimer);
    pressing = false;
  }

  async function handleAddToPL(pid) {
    if (showPL === 'loading') return;
    const originalShowPL = showPL;
    showPL = 'loading'; // prevent double-tap
    
    showToast('Resolving track details...');
    const success = await addSongToPlaylist(pid, song);
    
    showPL = false;
    if (success) {
      showToast('Added to playlist');
    } else {
      showToast('Failed to add (might be already in playlist)');
    }
  }
</script>

<div class="song-row" class:active class:pressing class:pl-open={showPL} role="button" tabindex="0"
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointerleave={handlePointerLeave}
  on:contextmenu|preventDefault
  on:keydown={e => e.key==='Enter' && D('play', song)}
>
  <!-- Left: index or EQ or note icon -->
  <div class="sr-idx">
    {#if isPlay}
      <div class="eq">
        <div class="eq-bar" style="--d:.42s;--delay:0s"></div>
        <div class="eq-bar" style="--d:.38s;--delay:.07s"></div>
        <div class="eq-bar" style="--d:.48s;--delay:.14s"></div>
      </div>
    {:else if index !== null}
      <span class="sr-num">{index}</span>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" style="color:var(--t4)">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    {/if}
  </div>

  <!-- Thumbnail -->
  {#if song.coverUrl}
    <img src={song.coverUrl} alt="" class="s-thumb" loading="lazy" />
  {:else}
    <div class="s-thumb">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    </div>
  {/if}

  <!-- Title + artist -->
  <div class="s-meta">
    <div class="s-title" class:on={active}>{song.title}</div>
    <div class="s-artist">
      {song.artist}
      {#if song.source}
        <span class="src-pill {song.source}">{song.source}</span>
      {/if}
    </div>
  </div>

  {#if !compact && song.duration > 0}
    <span class="s-dur">{fmt(song.duration)}</span>
  {/if}

  <!-- Actions -->
  {#if !compact}
    <div class="sr-acts" on:click|stopPropagation on:pointerdown|stopPropagation on:pointerup|stopPropagation role="none">
      <button class="ibtn" class:liked={isLiked} title={isLiked?'Unlike':'Like'}
        on:click={() => { toggleLike(song); showToast(isLiked ? 'Removed from liked' : 'Added to liked'); }}>
        <svg width="14" height="14" viewBox="0 0 24 24"
          fill={isLiked?'currentColor':'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      <!-- Add to playlist -->
      <div style="position:relative">
        <button class="ibtn" title="Add to playlist" on:click={() => showPL = !showPL}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        {#if showPL}
          <div class="pl-dropdown">
            {#if showPL === 'loading'}
              <div class="pl-empty" style="display:flex;align-items:center;gap:8px">
                <div class="spinner" style="width:12px;height:12px;border-width:1.5px"></div>
                Resolving...
              </div>
            {:else if $playlists.length === 0}
              <div class="pl-empty">No playlists</div>
            {:else}
              {#each $playlists as pl (pl.id)}
                <button class="pl-opt" on:click={() => handleAddToPL(pl.id)}>
                  <span class="pl-opt-name">{pl.name}</span>
                  <span style="font-family:var(--fm);font-size:10px;color:var(--t3)">{pl.songs.length}</span>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Download Track -->
      <button class="ibtn" class:downloaded={isDownloaded} title={isDownloaded ? 'Saved offline' : 'Download Offline'} on:click={() => downloadTrack(song)}>
        {#if isDownloaded}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g)">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        {/if}
      </button>

      {#if context === 'queue'}
        <button class="ibtn" title="Remove from queue" on:click={() => D('remove', song)}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</div>

{#if showPL}
  <div style="position:fixed;inset:0;z-index:48"
    on:click={() => showPL=false} role="button" tabindex="-1" on:keydown={() => {}}></div>
{/if}

<style>
  .song-row {
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    transition: transform .12s ease, background .12s;
  }
  .song-row:active, .song-row.pressing {
    transform: scale(0.97);
    background: rgba(255,255,255,.03);
  }
  .song-row.pl-open { z-index: 60; background: rgba(255,255,255,.02); }
  .sr-idx  { width:22px;flex-shrink:0;display:flex;align-items:center;justify-content:center; }
  .sr-num  { font-family:var(--fm);font-size:11px;color:var(--t3); }
  .sr-acts { display:flex;align-items:center;flex-shrink:0; }
  .pl-dropdown {
    position:absolute;right:0;top:calc(100% + 4px);background:var(--bg3);
    border:1px solid var(--br2);border-radius:var(--r-m);padding:4px;
    z-index:50;min-width:160px;max-height:220px;overflow-y:auto;
    box-shadow:0 10px 32px rgba(0,0,0,.6);
  }
  .pl-empty { padding:10px 14px;font-size:12px;color:var(--t3); }
  .pl-opt {
    display:flex;align-items:center;justify-content:space-between;
    width:100%;padding:8px 12px;background:none;border:none;
    cursor:pointer;color:var(--t1);font-size:13px;border-radius:8px;
    transition:background .1s;gap:8px;
  }
  .pl-opt:hover { background:var(--sur); }
  .pl-opt-name { flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .ibtn.downloaded { color: var(--g); }
  .ibtn.downloaded:hover { background: rgba(34,197,94,.12); }
</style>
