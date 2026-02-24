<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import { user, showToast } from '$lib/stores/app.js';
  import { getRoom, updateRoom, joinRoomDB, leaveRoomDB } from '$lib/services/supabase.js';
  import { searchMusic } from '$lib/services/musicApi.js';

  export let roomId;
  const D = createEventDispatcher();

  let room = null, loading = true, isHost = false;
  let ws = null, wsOk = false;
  let members = [], queue = [], currentSong = null;
  let playing = false, pos = 0, dur = 0, vol = 0.85;
  let syncTimer, tab = 'queue', searchQ = '', results = [], searching = false, sTimer;
  let audio = null, copied = false;
  const fmt = s => s>0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';

  // ── Audio ──────────────────────────────────────────────────────────────────
  function initAudio() {
    audio = new Audio(); audio.volume = vol;
    audio.addEventListener('timeupdate',   () => pos = audio.currentTime);
    audio.addEventListener('durationchange', () => dur = isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener('play',  () => playing = true);
    audio.addEventListener('pause', () => playing = false);
    audio.addEventListener('ended', () => { if (isHost) nextSong(); });
  }

  function loadSong(song, play = false) {
    if (!audio || !song?.url) return;
    audio.src = song.url; audio.currentTime = 0;
    if (play) audio.play().catch(() => {});
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const name  = encodeURIComponent($user.user_metadata?.username || $user.email);
    const url   = `${proto}//${location.host}/ws/room?room=${roomId}&user=${$user.id}&name=${name}&host=${isHost?'1':'0'}`;
    ws = new WebSocket(url);

    ws.onopen = () => { wsOk = true; };
    ws.onclose = () => { wsOk = false; };
    ws.onerror = () => showToast('WS error — check network');

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.t) {
          case 'members': members = msg.members; break;

          case 'sync':
            if (!isHost && audio) {
              // Drift correction: sub-250ms is fine; >250ms → hard seek
              const latency  = (Date.now() - msg._serverTime) / 2000;
              const expected = msg.pos + latency;
              if (Math.abs(audio.currentTime - expected) > 0.25) audio.currentTime = expected;
              if (msg.playing && audio.paused)  audio.play().catch(() => {});
              if (!msg.playing && !audio.paused) audio.pause();
            }
            break;

          case 'song':
            if (!isHost) {
              currentSong = msg.song;
              queue = msg.queue || queue;
              loadSong(msg.song, msg.play);
            }
            break;

          case 'queue':
            queue = msg.queue;
            break;
        }
      } catch {}
    };
  }

  function send(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); }

  // ── Host: broadcast 200ms sync pulses ─────────────────────────────────────
  function startSync() {
    syncTimer = setInterval(() => {
      if (!isHost || !audio) return;
      send({ t:'sync', pos: audio.currentTime, playing, songId: currentSong?.id });
    }, 200);
  }

  function playToggle() {
    if (!isHost || !audio || !currentSong) return;
    if (playing) audio.pause(); else audio.play().catch(() => {});
    send({ t:'sync', pos: audio.currentTime, playing: !playing, songId: currentSong?.id });
  }

  function nextSong() {
    if (!isHost) return;
    const idx = queue.findIndex(s => s.id === currentSong?.id);
    const next = queue[idx+1] || queue[0];
    if (!next) return;
    currentSong = next; loadSong(next, true);
    send({ t:'song', song:next, queue, play:true });
  }

  function addSong(song) {
    queue = [...queue, song];
    send({ t:'queue', queue });
    updateRoom(roomId, { queue });
    if (!currentSong && isHost) {
      currentSong = song; loadSong(song, true);
      send({ t:'song', song, queue, play:true });
    }
    showToast(`Added "${song.title}"`);
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  $: {
    clearTimeout(sTimer);
    if (searchQ.trim()) {
      searching = true;
      sTimer = setTimeout(async () => {
        try { results = await searchMusic(searchQ); }
        catch { results = []; }
        finally { searching = false; }
      }, 380);
    } else { results = []; searching = false; }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  onMount(async () => {
    initAudio();
    room = await getRoom(roomId);
    if (!room) { showToast('Room not found'); D('leave'); return; }
    isHost = room.host_id === $user.id;
    queue = room.queue || [];
    currentSong = room.current_song || queue[0] || null;
    if (currentSong) loadSong(currentSong, false);
    await joinRoomDB(roomId, $user.id, $user.user_metadata?.username || $user.email);
    connect();
    if (isHost) startSync();
    loading = false;
  });

  onDestroy(() => {
    clearInterval(syncTimer);
    ws?.close();
    audio?.pause();
    leaveRoomDB(roomId, $user.id);
  });

  function copyInvite() {
    navigator.clipboard.writeText(`${location.origin}?room=${roomId}`);
    copied = true; setTimeout(() => copied=false, 2000);
  }
  $: pct = dur > 0 ? (pos/dur)*100 : 0;
</script>

{#if loading}
  <div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg0)">
    <span class="spinner"></span>
  </div>
{:else}
<div class="rp" in:fly={{ y:20, duration:280 }}>
  <header class="hdr">
    <button class="ctrl-btn" on:click={() => D('leave')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--fn);font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{room?.name}</div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--t3)">{isHost?'HOST':'LISTENER'} · {members.length} online</div>
    </div>
    {#if playing}<div class="live-chip"><div class="live-dot"></div>LIVE</div>{/if}
    <button class="hdr-btn" on:click={copyInvite}>{copied?'Copied!':'Invite'}</button>
  </header>

  <!-- Compact player -->
  <div class="rp-player">
    <div class="rp-art" style="box-shadow:{playing?'0 0 50px rgba(245,158,11,.35)':'none'}">
      {#if currentSong?.coverUrl}
        <img src={currentSong.coverUrl} alt="" style="width:100%;height:100%;object-fit:cover"/>
      {:else}
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--su2)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="color:var(--t4)">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
      {/if}
    </div>

    <div style="width:100%;text-align:center;padding:0 12px">
      <div style="font-family:var(--fn);font-size:18px;font-weight:700;line-height:1.3">{currentSong?.title ?? 'Nothing playing'}</div>
      <div style="font-size:12.5px;color:var(--t2);margin-top:4px">{currentSong?.artist ?? 'Add songs from search'}</div>
      {#if !isHost}<div style="font-family:var(--fm);font-size:9.5px;color:var(--t3);margin-top:6px;letter-spacing:.08em">HOST CONTROLS PLAYBACK</div>{/if}
    </div>

    <div style="width:100%;padding:0 4px">
      <input type="range" min="0" max="100" step="0.1" value={pct} style="--pct:{pct}%"
        disabled={!isHost||!currentSong}
        on:input={e => { if(audio) audio.currentTime = (parseFloat(e.target.value)/100)*dur; }} />
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-family:var(--fm);font-size:10px;color:var(--t3)">{fmt(pos)}</span>
        <span style="font-family:var(--fm);font-size:10px;color:var(--t3)">{fmt(dur)}</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:14px">
      <button class="ctrl-play" on:click={playToggle} disabled={!isHost||!currentSong}>
        {#if playing}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {/if}
      </button>
      <button class="ctrl-btn" style="padding:9px" on:click={nextSong} disabled={!isHost}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
      <input type="range" min="0" max="1" step="0.01" bind:value={vol} style="--pct:{vol*100}%;flex:1"
        on:input={() => { if(audio) audio.volume=vol; }} />
    </div>
  </div>

  <!-- Bottom tabs -->
  <div style="padding:0 12px 8px;flex-shrink:0">
    <div class="pills">
      <button class="pill" class:on={tab==='queue'} on:click={() => tab='queue'}>Queue ({queue.length})</button>
      <button class="pill" class:on={tab==='search'} on:click={() => tab='search'}>Search</button>
      <button class="pill" class:on={tab==='members'} on:click={() => tab='members'}>({members.length})</button>
    </div>
  </div>

  <div style="flex:1;overflow-y:auto;padding:4px 12px">
    {#if tab === 'queue'}
      {#if queue.length === 0}
        <div style="padding:30px;text-align:center;color:var(--t3);font-size:13px">Queue empty. Search songs to add.</div>
      {:else}
        {#each queue as song, i}
          <div class="song-row" class:active={currentSong?.id===song.id}>
            <span style="width:20px;flex-shrink:0;font-family:var(--fm);font-size:11px;color:var(--t3)">{i+1}</span>
            {#if song.coverUrl}<img src={song.coverUrl} alt="" class="s-thumb"/>{:else}<div class="s-thumb"></div>{/if}
            <div class="s-meta">
              <div class="s-title" class:on={currentSong?.id===song.id}>{song.title}</div>
              <div class="s-artist">{song.artist}</div>
            </div>
          </div>
        {/each}
      {/if}

    {:else if tab === 'search'}
      <div class="srch" style="margin-bottom:10px">
        <span class="srch-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
        <input class="srch-inp" type="search" bind:value={searchQ} placeholder="Search songs…" autocomplete="off"/>
        {#if searching}<span class="srch-clr"><span class="spinner" style="width:13px;height:13px"></span></span>{/if}
      </div>
      {#each results as song}
        <div class="song-row" role="button" tabindex="0" style="cursor:pointer"
          on:click={() => addSong(song)} on:keydown={e=>e.key==='Enter'&&addSong(song)}>
          {#if song.coverUrl}<img src={song.coverUrl} alt="" class="s-thumb"/>{:else}<div class="s-thumb"></div>{/if}
          <div class="s-meta">
            <div class="s-title">{song.title}</div>
            <div class="s-artist">{song.artist}</div>
          </div>
          <button class="ibtn" title="Add"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        </div>
      {/each}

    {:else if tab === 'members'}
      {#each members as m}
        <div style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:var(--r-s)">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--r2),var(--a3));display:flex;align-items:center;justify-content:center;font-family:var(--fn);font-size:12px;font-weight:800;color:#fff;flex-shrink:0">
            {(m.username||'?').charAt(0).toUpperCase()}
          </div>
          <div style="flex:1;font-size:13px;font-weight:500">{m.username||'Guest'}</div>
          {#if m.isHost}<span style="font-family:var(--fm);font-size:9px;color:var(--a5);letter-spacing:.08em">HOST</span>{/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
{/if}

<style>
  .rp { height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0); }
  .rp-player { display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 16px;flex-shrink:0; }
  .rp-art { width:min(150px,40vw);aspect-ratio:1;border-radius:50%;overflow:hidden;flex-shrink:0;transition:box-shadow .6s; }
</style>
