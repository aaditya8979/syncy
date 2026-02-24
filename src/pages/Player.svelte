<script>
  import { fly } from 'svelte/transition';
  import { queue, qIdx, playing, pos, dur, pct, vol, muted, shuffle, repeat,
    currentSong, buffering, togglePlay, skipNext, skipPrev, seekTo, addToQueue,
    removeFromQueue, clearQueue, playSong, getAudio } from '$lib/stores/player.js';
  import { liked, toggleLike, page, showToast } from '$lib/stores/app.js';
  import SongRow from '../components/SongRow.svelte';

  $: isLiked = $currentSong ? $liked.some(s => s.id === $currentSong.id) : false;
  const fmt = s => s > 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';

  let showQueue = false;
  $: sliderVal = $pct;
  let volVal = 85;
  $: vol.set(volVal / 100);

  function onSeek(e) { seekTo((parseFloat(e.target.value)/100) * $dur); }
  function cycleRepeat() { repeat.update(r => r==='off'?'all':r==='all'?'one':'off'); }

  // ── Animation Logic Updates ──────────────────────────────────────────────
  let discPhase = 'stopped';
  let spinAngle = 0;
  let spinRaf;
  let lastTs;
  let spinSpeed = 0;

  const NORMAL_SPEED   = 360 / 18000;
  // Removed MAX_SPIN_SPEED as we don't want it to spin crazy fast anymore
  const SPINUP_RATE    = 0.0004;
  const SPINDOWN_RATE  = 0.0012; // Increased braking power for "sudden" stop

  function animateDisc(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(ts - lastTs, 64);
    lastTs = ts;

    if (discPhase === 'spinup') {
      spinSpeed = Math.min(spinSpeed + SPINUP_RATE * dt, NORMAL_SPEED);
      spinAngle += spinSpeed * dt;
      if (spinSpeed >= NORMAL_SPEED - 0.00001) discPhase = 'playing';
      spinRaf = requestAnimationFrame(animateDisc);

    } else if (discPhase === 'playing') {
      spinAngle += NORMAL_SPEED * dt;
      spinRaf = requestAnimationFrame(animateDisc);

    } else if (discPhase === 'spindown') {
      // FIX 1: Removed the "ramp up to max speed" logic.
      // Now it strictly decelerates (brakes) from current speed.
      spinSpeed = Math.max(spinSpeed - SPINDOWN_RATE * dt, 0);
      spinAngle += spinSpeed * dt;

      if (spinSpeed <= 0) {
        discPhase = 'stopped';
        spinSpeed = 0;
        spinAngle = 0; // FIX 2: Reset to "mean position" (upright)
      } else {
        spinRaf = requestAnimationFrame(animateDisc);
      }
    }
  }

  // React to $playing changes
  let prevPlaying = false;
  $: {
    if ($playing && !prevPlaying) {
      cancelAnimationFrame(spinRaf);
      lastTs = null;
      if (discPhase === 'stopped') spinSpeed = 0;
      discPhase = 'spinup';
      spinRaf = requestAnimationFrame(animateDisc);
    } else if (!$playing && prevPlaying) {
      if (discPhase === 'playing' || discPhase === 'spinup') {
        cancelAnimationFrame(spinRaf);
        lastTs = null;
        discPhase = 'spindown';
        spinRaf = requestAnimationFrame(animateDisc);
      }
    }
    prevPlaying = $playing;
  }

  $: discTransform = `rotate(${spinAngle % 360}deg)`;
  $: discGlow = discPhase !== 'stopped'
    ? '0 0 60px rgba(245,158,11,.5), 0 0 120px rgba(220,38,38,.2), 0 0 200px rgba(245,158,11,.08)'
    : '0 16px 48px rgba(0,0,0,.7)';

  // FIX 3: Safe Play Handler
  // Prevents toggling if no song is loaded or if player state is desynced
  const handlePlayPause = () => {
    if (!$currentSong) return;
    togglePlay();
  };
</script>

<div class="ps" in:fly={{ y:20, duration:300 }}>
  <header class="hdr">
    <button class="ctrl-btn" on:click={() => page.set('home')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
    </button>
    <div style="flex:1;text-align:center">
      <span style="font-family:var(--fm);font-size:9px;color:var(--t3);letter-spacing:.15em;text-transform:uppercase">
        {showQueue ? 'Queue' : 'Now Playing'}
      </span>
    </div>
    <button class="ctrl-btn" class:on={showQueue} on:click={() => showQueue=!showQueue}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    </button>
  </header>

  {#if !showQueue}
    <div class="player-body">

      <div class="art-outer" style="box-shadow:{discGlow}">
        <div class="vinyl-ring">
          <div class="vinyl-disc" style="transform:{discTransform}">
            {#if $currentSong?.coverUrl}
              <img src={$currentSong.coverUrl} alt="" class="art-img"/>
            {:else}
              <div class="art-fallback">
                <div class="art-grooves"></div>
                <div class="disc-hub"><div class="disc-dot"></div></div>
              </div>
            {/if}
            <div class="vinyl-shine"></div>
          </div>
          <div class="vinyl-center-hole"></div>
        </div>

        <div class="speed-ring" class:fast={discPhase==='spindown' && spinSpeed > NORMAL_SPEED}></div>

        {#if $buffering}
          <div class="art-loading"><span class="spinner"></span></div>
        {:else if discPhase !== 'stopped'}
          <div class="art-eq-badge">
            <div class="eq">
              {#each ['.42s','.36s','.48s','.4s'] as d,i}
                <div class="eq-bar" style="--d:{d};--delay:{i*.09}s"></div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="song-info">
        <div class="si-title">{$currentSong?.title ?? 'Nothing playing'}</div>
        <div class="si-artist">{$currentSong?.artist ?? 'Search & add songs to play'}</div>
        {#if $currentSong?.source}
          <span class="src-pill {$currentSong.source}" style="margin-top:8px;display:inline-flex">{$currentSong.source}</span>
        {/if}
      </div>

      <div class="like-row">
        <button class="ibtn" class:liked={isLiked} style="width:38px;height:38px"
          on:click={() => $currentSong && toggleLike($currentSong)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isLiked?'currentColor':'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      <div class="seek-area">
        <input type="range" min="0" max="100" step="0.1" value={sliderVal}
          style="--pct:{sliderVal}%" on:input={onSeek} disabled={!$currentSong} />
        <div class="time-row">
          <span style="font-family:var(--fm);font-size:10.5px;color:var(--t3)">{fmt($pos)}</span>
          <span style="font-family:var(--fm);font-size:10.5px;color:var(--t3)">{fmt($dur)}</span>
        </div>
      </div>

      <div class="controls">
        <button class="ctrl-btn" class:on={$shuffle} on:click={() => shuffle.update(s=>!s)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
        </button>
        <button class="ctrl-btn" style="padding:9px" on:click={skipPrev} disabled={!$currentSong}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/>
          </svg>
        </button>
        
        <button class="ctrl-play" on:click={handlePlayPause} disabled={!$currentSong}>
          {#if $playing}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          {/if}
        </button>
        
        <button class="ctrl-btn" style="padding:9px" on:click={skipNext} disabled={!$currentSong}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
        <button class="ctrl-btn" class:on={$repeat!=='off'} style="position:relative" on:click={cycleRepeat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          {#if $repeat==='one'}
            <span style="position:absolute;top:-2px;right:-2px;background:var(--a4);border-radius:50%;width:12px;height:12px;font-size:7px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:800;font-family:var(--fm)">1</span>
          {/if}
        </button>
      </div>

      <div class="vol-row">
        <button class="ctrl-btn" style="padding:5px" on:click={() => muted.update(m=>!m)}>
          {#if $muted}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          {/if}
        </button>
        <input type="range" min="0" max="100" bind:value={volVal} style="--pct:{volVal}%" />
        <span style="font-family:var(--fm);font-size:10px;color:var(--t3);width:28px;text-align:right">{volVal}</span>
      </div>

    </div>

  {:else}
    <div class="queue-panel">
      <div class="qhdr">
        <span style="font-family:var(--fn);font-size:14px;font-weight:700">Queue</span>
        <span style="color:var(--t3);font-size:12px">({$queue.length})</span>
        <div style="flex:1"></div>
        {#if $queue.length > 0}
          <button style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:12px"
            on:click={clearQueue}>Clear</button>
        {/if}
      </div>
      <div class="qlist">
        {#if $queue.length === 0}
          <div style="padding:48px;text-align:center;color:var(--t3);font-size:13px">Queue is empty</div>
        {:else}
          {#each $queue as song, i}
            <SongRow {song} index={i+1} context="queue"
              on:play={() => { qIdx.set(i); playSong(song); }}
              on:remove={() => removeFromQueue(i)}
              on:like={() => toggleLike(song)}
              on:download={() => {}} on:addtopl={() => {}}
            />
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .ps { height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0); }
  .player-body { flex:1;overflow-y:auto;padding:8px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:14px; }

  /* ── VINYL DISC ─────────────────────────────────── */
  .art-outer {
    width:min(240px,66vw); aspect-ratio:1;
    border-radius:50%; flex-shrink:0;
    position:relative; margin-top:6px;
    transition:box-shadow 1.2s ease;
  }
  .vinyl-ring {
    width:100%; height:100%; border-radius:50%;
    background:conic-gradient(
      from 0deg,
      #161024 0deg 20deg, #0c0818 20deg 40deg,
      #161024 40deg 60deg, #0c0818 60deg 80deg,
      #161024 80deg 100deg, #0c0818 100deg 120deg,
      #161024 120deg 140deg, #0c0818 140deg 160deg,
      #161024 160deg 180deg, #0c0818 180deg 200deg,
      #161024 200deg 220deg, #0c0818 220deg 240deg,
      #161024 240deg 260deg, #0c0818 260deg 280deg,
      #161024 280deg 300deg, #0c0818 300deg 320deg,
      #161024 320deg 340deg, #0c0818 340deg 360deg
    );
    position:relative; overflow:hidden;
    border:2px solid rgba(245,158,11,.08);
    box-shadow:inset 0 0 30px rgba(0,0,0,.8);
  }
  .vinyl-disc {
    width:100%; height:100%; border-radius:50%;
    position:relative; overflow:hidden;
    will-change:transform;
  }
  .art-img   { width:100%;height:100%;object-fit:cover;border-radius:50%; }
  .art-fallback {
    width:100%;height:100%;border-radius:50%;
    background:radial-gradient(circle at 40% 35%, #2a1a4a 0%, #0f0a1a 60%, #07050f 100%);
    display:flex;align-items:center;justify-content:center;position:relative;
  }
  .art-grooves {
    position:absolute;inset:0;border-radius:50%;
    background:repeating-radial-gradient(circle,transparent 0px,transparent 8px,rgba(255,255,255,.015) 8px,rgba(255,255,255,.015) 9px);
  }
  .disc-hub {
    width:28%;height:28%;border-radius:50%;
    background:radial-gradient(circle,#1a1028,#08050f);
    border:1.5px solid rgba(245,158,11,.15);
    display:flex;align-items:center;justify-content:center;
    position:relative;z-index:2;
  }
  .disc-dot { width:8px;height:8px;border-radius:50%;background:var(--a5);box-shadow:0 0 14px var(--ga); }
  .vinyl-shine {
    position:absolute;inset:0;border-radius:50%;
    background:conic-gradient(from 120deg, rgba(255,255,255,.07) 0deg 40deg, transparent 40deg 360deg);
    pointer-events:none;
  }
  .vinyl-center-hole {
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:6%;height:6%;border-radius:50%;background:#000;
    border:1px solid rgba(255,255,255,.1);z-index:10;
  }
  .speed-ring {
    position:absolute;inset:-3px;border-radius:50%;
    border:2px solid transparent;
    transition:border-color .3s, box-shadow .3s;pointer-events:none;
  }
  .speed-ring.fast {
    border-color:rgba(245,158,11,.6);
    box-shadow:0 0 30px rgba(245,158,11,.4), inset 0 0 20px rgba(245,158,11,.1);
    animation:fastRing .15s linear infinite;
  }
  @keyframes fastRing {
    0%   { border-color: rgba(245,158,11,.6); }
    33%  { border-color: rgba(220,38,38,.7); }
    66%  { border-color: rgba(245,158,11,.5); }
    100% { border-color: rgba(220,38,38,.6); }
  }
  .art-eq-badge { position:absolute;bottom:14px;right:14px; }
  .art-loading  { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);border-radius:50%; }

  .song-info   { width:100%;text-align:center; }
  .si-title    { font-family:var(--fn);font-size:20px;font-weight:700;line-height:1.3; }
  .si-artist   { font-size:13px;color:var(--t2);margin-top:5px; }
  .like-row    { width:100%;display:flex;justify-content:flex-end; }
  .seek-area   { width:100%; }
  .time-row    { display:flex;justify-content:space-between;margin-top:5px; }
  .controls    { display:flex;align-items:center;gap:8px;width:100%;justify-content:center; }
  .vol-row     { display:flex;align-items:center;gap:8px;width:100%; }

  .queue-panel { flex:1;display:flex;flex-direction:column;overflow:hidden; }
  .qhdr        { display:flex;align-items:center;gap:6px;padding:12px 16px;border-bottom:1px solid var(--brd); }
  .qlist       { flex:1;overflow-y:auto;padding:6px 8px; }
</style>