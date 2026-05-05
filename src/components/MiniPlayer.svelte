<script>
  import { page } from '$lib/stores/app.js';
  import { currentSong, playing, pct, togglePlay, skipNext } from '$lib/stores/player.js';

  $: longTitle = ($currentSong?.title?.length ?? 0) > 22;
</script>

<div class="mp" on:click={() => page.set('player')} role="button" tabindex="0"
  on:keydown={e => e.key === 'Enter' && page.set('player')}>

  <!-- Ambient progress bar — glued to bottom edge -->
  <div class="mp-track"><div class="mp-fill" style="width:{$pct}%"></div></div>

  <!-- Album art with pulse ring when playing -->
  <div class="mp-art">
    {#if $currentSong?.coverUrl}
      <img src={$currentSong.coverUrl} alt="" />
    {:else}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    {/if}
    {#if $playing}<div class="mp-pulse"></div>{/if}
  </div>

  <!-- Info — marquee when title is long -->
  <div class="mp-info">
    <div class="mp-title-clip">
      {#if longTitle}
        <div class="mp-marquee">
          <span>{$currentSong?.title}&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span aria-hidden="true">{$currentSong?.title}&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      {:else}
        <div class="mp-title-static">{$currentSong?.title ?? 'Nothing playing'}</div>
      {/if}
    </div>
    <div class="mp-artist">{$currentSong?.artist ?? ''}</div>
  </div>

  <!-- Controls — stopPropagation so tap doesn't open player -->
  <div class="mp-ctrls" on:click|stopPropagation role="none">
    <button class="mp-btn" on:click={togglePlay} aria-label={$playing ? 'Pause' : 'Play'}>
      {#if $playing}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      {/if}
    </button>
    <button class="mp-btn" on:click={skipNext} aria-label="Skip next">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .mp {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 6px 9px 10px;
    background: rgba(10, 10, 20, 0.97);
    border: 1px solid var(--br2);
    border-radius: 18px;
    margin: 0 10px 6px;
    position: relative; overflow: hidden;
    cursor: pointer;
    box-shadow: 0 -4px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(245,158,11,.07);
    backdrop-filter: blur(30px);
    -webkit-tap-highlight-color: transparent;
    transition: transform .12s;
  }
  .mp:active { transform: scale(0.985); }

  /* Amber progress line fused to bottom */
  .mp-track {
    position: absolute; bottom: 0; left: 0; right: 0; height: 2.5px;
    background: var(--sur);
  }
  .mp-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--a4), var(--r4));
    transition: width .5s linear;
    border-radius: 0 2px 2px 0;
  }

  /* Art */
  .mp-art {
    width: 42px; height: 42px; border-radius: 11px;
    background: var(--su2); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; position: relative;
  }
  .mp-art img { width: 100%; height: 100%; object-fit: cover; }
  .mp-pulse {
    position: absolute; inset: 0; border-radius: 11px;
    border: 2px solid rgba(245,158,11,.5);
    animation: mpPulse 1.8s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes mpPulse {
    0%, 100% { opacity: .3; transform: scale(1); }
    50%       { opacity: 1;  transform: scale(1.06); }
  }

  /* Info */
  .mp-info { flex: 1; min-width: 0; overflow: hidden; }
  .mp-title-clip { overflow: hidden; white-space: nowrap; }
  .mp-title-static {
    font-size: 13px; font-weight: 600; color: var(--t1);
    overflow: hidden; text-overflow: ellipsis;
  }
  .mp-marquee {
    display: inline-flex;
    animation: marquee 9s linear infinite;
    white-space: nowrap;
  }
  .mp-marquee span { font-size: 13px; font-weight: 600; color: var(--t1); }
  @keyframes marquee {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .mp-artist {
    font-size: 11px; color: var(--t3); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Controls — 44×44 touch targets */
  .mp-ctrls { display: flex; align-items: center; flex-shrink: 0; }
  .mp-btn {
    width: 44px; height: 44px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: var(--t2); transition: color .12s, background .12s;
    -webkit-tap-highlight-color: transparent;
  }
  .mp-btn:hover  { color: var(--t1); background: var(--su2); }
  .mp-btn:active { transform: scale(0.88); color: var(--a5); }
</style>
