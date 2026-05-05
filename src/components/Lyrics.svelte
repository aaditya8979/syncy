<script>
  import { tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { pos, currentSong, getAudio } from '$lib/stores/player.js';
  import { getLyrics } from '$lib/services/musicApi.js';

  export let songId = '';
  export let onClose = () => {};

  let lyrics  = { lines: [], synced: false };
  let loading = true;
  let activeIdx = -1;
  let lineEls   = [];
  let expanded  = false;
  let lastLoadedId = '';
  let scrollContainer = null;
  let userScrolling = false;
  let scrollTimeout = null;

  $: if (songId && $currentSong && songId !== lastLoadedId) {
    lastLoadedId = songId;
    load(songId, $currentSong.title, $currentSong.artist);
  }

  async function load(id, title, artist) {
    loading = true; activeIdx = -1; lyrics = { lines: [], synced: false }; lineEls = [];
    try { lyrics = await getLyrics(id, title, artist); }
    catch {}
    finally { loading = false; }
  }

  // ── Precision time-sync via findLastIndex ──────────────────────────────────
  $: if (lyrics.synced && lyrics.lines.length && !userScrolling) {
    const newIdx = findActiveIndex(lyrics.lines, $pos);
    if (newIdx !== activeIdx && newIdx >= 0) {
      activeIdx = newIdx;
      requestAnimationFrame(() => {
        const el = lineEls[activeIdx];
        if (el && scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetScroll = scrollContainer.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
          scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
      });
    }
  }

  // Binary-search derivative: find last line where time <= currentPos
  function findActiveIndex(lines, currentPos) {
    let lo = 0, hi = lines.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (lines[mid].time <= currentPos) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }

  // ── Click-to-seek on synced lines ───────────────────────────────────────────
  function seekToLine(i) {
    if (!lyrics.synced || !lyrics.lines[i]) return;
    const audio = getAudio();
    if (audio) audio.currentTime = lyrics.lines[i].time;
  }

  // ── Detect user scroll to pause auto-scroll ─────────────────────────────────
  function handleUserScroll() {
    userScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => { userScrolling = false; }, 4000);
  }
</script>

<!-- ═══ Collapsed Preview Card ═══ -->
{#if !expanded}
  <button class="ly-preview" on:click={() => expanded = true} in:fade={{ duration: 200 }}>
    <div class="ly-preview-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="12" y2="16"/>
      </svg>
    </div>
    <div class="ly-preview-text">
      {#if loading}
        <span class="ly-dim">Loading lyrics…</span>
      {:else if lyrics.lines.length === 0}
        <span class="ly-dim">No lyrics available</span>
      {:else if activeIdx >= 0}
        <span class="ly-active-preview">{lyrics.lines[activeIdx]?.text || '♪'}</span>
      {:else}
        <span class="ly-dim" style="color:var(--t2)">Lyrics available — tap to view</span>
      {/if}
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2" stroke-linecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>
{/if}

<!-- ═══ Full-screen Lyrics Panel ═══ -->
{#if expanded}
  <div class="ly-full" in:fly={{ y: 40, duration: 280 }} out:fade={{ duration: 150 }}>
    <!-- Blurred background from album art -->
    {#if $currentSong?.coverUrl}
      <div class="ly-bg" style="background-image:url({$currentSong.coverUrl})"></div>
    {/if}

    <!-- Header -->
    <div class="ly-header">
      <span class="ly-badge">LYRICS</span>
      {#if lyrics.synced}
        <span class="ly-sync-pill synced">SYNCED</span>
      {:else if lyrics.lines.length > 0}
        <span class="ly-sync-pill">UNSYNCED</span>
      {/if}
      <div style="flex:1"></div>
      <button class="ly-close" on:click={() => { expanded = false; onClose(); }} aria-label="Close lyrics">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
    </div>

    <!-- Scrolling Lyrics Body -->
    <div class="ly-body" bind:this={scrollContainer} on:scroll={handleUserScroll}>
      {#if loading}
        <div class="ly-center"><span class="spinner" style="display:block;margin:0 auto"></span></div>
      {:else if lyrics.lines.length === 0}
        <div class="ly-center ly-empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1" stroke-linecap="round" style="margin:0 auto 18px;display:block">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          No lyrics available for this song
        </div>
      {:else}
        <div class="ly-spacer-top"></div>
        {#each lyrics.lines as line, i}
          <button
            bind:this={lineEls[i]}
            class="ly-line"
            class:active={i === activeIdx}
            class:past={lyrics.synced && i < activeIdx}
            class:clickable={lyrics.synced}
            on:click={() => seekToLine(i)}
          >
            {line.text || '\u00A0'}
          </button>
        {/each}
        <div class="ly-spacer-bottom"></div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ═══ Preview Card ═══ */
  .ly-preview {
    width: 100%; display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; margin-top: 6px;
    background: rgba(12, 12, 24, .75);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,.05); border-radius: 14px;
    cursor: pointer; transition: background .15s, transform .1s;
    text-align: left;
  }
  .ly-preview:hover { background: rgba(20, 20, 40, .85); }
  .ly-preview:active { transform: scale(.98); }
  .ly-preview-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(245,158,11,.1); display: flex;
    align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--a5);
  }
  .ly-preview-text { flex: 1; min-width: 0; font-size: 13px; }
  .ly-dim { color: var(--t3); }
  .ly-active-preview {
    color: #fff; font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    display: block; font-family: var(--fn);
  }

  /* ═══ Full Lyrics Panel ═══ */
  .ly-full {
    position: relative; width: 100%; flex: 1; min-height: 320px;
    background: rgba(6, 6, 16, .94);
    backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
    border-radius: 20px 20px 0 0;
    border: 1px solid rgba(255,255,255,.04); border-bottom: none;
    display: flex; flex-direction: column; overflow: hidden;
    margin-top: 6px;
  }

  /* Blurred album art background */
  .ly-bg {
    position: absolute; inset: -40px;
    background-size: cover; background-position: center;
    filter: blur(60px) brightness(0.4); transform: scale(1.2);
    z-index: 0; pointer-events: none;
  }

  .ly-header {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    flex-shrink: 0; position: relative; z-index: 1;
  }
  .ly-badge {
    font-family: var(--fm); font-size: 10px; color: var(--a5);
    letter-spacing: .18em;
  }
  .ly-sync-pill {
    font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.3);
    letter-spacing: .1em; padding: 3px 8px; border-radius: 6px;
    background: rgba(255,255,255,.03);
  }
  .ly-sync-pill.synced {
    color: #10b981;
    background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.15);
  }
  .ly-close {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,.05); border: none; cursor: pointer;
    color: rgba(255,255,255,.5);
    display: flex; align-items: center; justify-content: center;
    transition: color .15s, background .15s;
  }
  .ly-close:hover { color: #fff; background: rgba(255,255,255,.1); }

  .ly-body {
    flex: 1; overflow-y: auto; padding: 0 28px;
    scrollbar-width: none; position: relative; z-index: 1;
  }
  .ly-body::-webkit-scrollbar { display: none; }
  .ly-center { padding: 60px 24px; text-align: center; }
  .ly-empty { color: rgba(255,255,255,.3); font-size: 14px; }
  .ly-spacer-top { height: 140px; }
  .ly-spacer-bottom { height: 220px; }

  /* ═══ Lyric Lines — Spotify-tier styling ═══ */
  .ly-line {
    display: block; width: 100%; text-align: left;
    font-family: var(--fn); font-size: 1.35rem; font-weight: 700;
    color: rgba(255, 255, 255, .25);
    line-height: 1.55; padding: 8px 0;
    transition: color .35s ease, transform .35s ease, opacity .35s ease,
                text-shadow .35s ease, font-size .25s ease;
    cursor: default; transform-origin: left center;
    border: none; background: none;
    -webkit-tap-highlight-color: transparent;
  }
  .ly-line.clickable { cursor: pointer; }
  .ly-line.clickable:hover { color: rgba(255, 255, 255, .45); }

  /* Past lines — dimmed */
  .ly-line.past { color: rgba(255, 255, 255, .22); }

  /* Active line — bright white, glow */
  .ly-line.active {
    color: #ffffff;
    font-size: 1.45rem;
    transform: scale(1.02);
    text-shadow: 0 0 20px rgba(255,255,255,.15), 0 0 40px rgba(245,158,11,.12);
  }
</style>
