<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { user, showToast } from '$lib/stores/app.js';
  import { searchMusic } from '$lib/services/musicApi.js';
  import { sb } from '$lib/services/supabase.js';
  import {
    roomState, roomMembers, roomQueue, roomSong, roomPlaying,
    roomPos, roomDur, roomPoll, isRoomHost,
    joinRoom, leaveRoom, roomTogglePlay, roomSeek, roomSetVolume,
    addToRoomQueue, nextTrack, prevTrack, removeFromRoomQueue,
    startPoll, votePoll, endPoll, getInviteLink, playTrack,
  } from '$lib/services/room.js';

  export let roomId;
  const D = createEventDispatcher();

  let loading = true, vol = 0.85, tab = 'queue';
  let searchQ = '', results = [], searching = false, sTimer;
  let copied = false;
  let pollQ = '', pollOpts = ['', ''], showPollCreate = false;

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
    try {
      const username = $user.user_metadata?.username || $user.email?.split('@')[0] || 'Guest';
      const { data: room } = await sb
        .from('rooms').select('host_id').eq('id', roomId).single();
      const host = room?.host_id === $user.id;
      await joinRoom(roomId, $user.id, username, host);
    } catch (e) {
      showToast(`Error: ${e.message}`);
      D('leave');
      return;
    }
    loading = false;
  });

  onDestroy(() => { leaveRoom(); });

  function doAddSong(song) {
    addToRoomQueue(song);
    showToast(`Added "${song.title}"`);
  }

  function copyInvite() {
    navigator.clipboard.writeText(getInviteLink());
    copied = true; setTimeout(() => copied = false, 2000);
  }

  function doCreatePoll() {
    const opts = pollOpts.filter(o => o.trim());
    if (!pollQ.trim() || opts.length < 2) { showToast('Need question + 2 options'); return; }
    startPoll(pollQ.trim(), opts.map(o => o.trim()));
    showPollCreate = false;
    pollQ = ''; pollOpts = ['', ''];
    showToast('Poll started!');
  }

  const fmt = s => s > 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';
  $: pct = $roomDur > 0 ? ($roomPos / $roomDur) * 100 : 0;
  $: myVote = $roomPoll?.options?.findIndex(o => o.voters?.includes($user.id)) ?? -1;
  $: totalVotes = $roomPoll?.options?.reduce((a, o) => a + (o.votes || 0), 0) ?? 0;
</script>

{#if loading}
  <div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg0)">
    <span class="spinner"></span>
  </div>
{:else}
<div class="rp" in:fly={{ y: 20, duration: 280 }}>

  <!-- Header -->
  <header class="rp-hdr">
    <button class="ctrl-btn" on:click={() => { leaveRoom(); D('leave'); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div style="flex:1;min-width:0">
      <div class="rp-room-name">{$roomState?.name || 'Room'}</div>
      <div class="rp-meta">
        {$isRoomHost ? 'HOST' : 'LISTENER'} · {$roomMembers.length} online
      </div>
    </div>
    {#if $roomPlaying}
      <div class="live-chip"><div class="live-dot"></div>LIVE</div>
    {/if}
    <button class="hdr-btn" on:click={copyInvite}>{copied ? 'Copied!' : 'Invite'}</button>
  </header>

  <!-- Player -->
  <div class="rp-player">
    <div class="rp-art" style="box-shadow:{$roomPlaying ? '0 0 50px rgba(245,158,11,.35)' : 'none'}">
      {#if $roomSong?.coverUrl}
        <img src={$roomSong.coverUrl} alt="" />
      {:else}
        <div class="rp-art-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="color:var(--t4)">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
      {/if}
    </div>

    <div class="rp-info">
      <div class="rp-title">{$roomSong?.title ?? 'Nothing playing'}</div>
      <div class="rp-artist">{$roomSong?.artist ?? 'Add songs from search'}</div>
      {#if !$isRoomHost}
        <div class="rp-listener-tag">HOST CONTROLS PLAYBACK</div>
      {/if}
    </div>

    <!-- Seek bar -->
    <div style="width:100%;padding:0 4px">
      <input type="range" min="0" max="100" step="0.1" value={pct}
        style="--pct:{pct}%"
        disabled={!$isRoomHost || !$roomSong}
        on:input={e => roomSeek((parseFloat(e.target.value) / 100) * $roomDur)} />
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span class="rp-time">{fmt($roomPos)}</span>
        <span class="rp-time">{fmt($roomDur)}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="rp-controls">
      <button class="ctrl-btn" on:click={prevTrack} disabled={!$isRoomHost}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/></svg>
      </button>
      <button class="ctrl-play" on:click={roomTogglePlay} disabled={!$isRoomHost || !$roomSong}>
        {#if $roomPlaying}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        {/if}
      </button>
      <button class="ctrl-btn" on:click={nextTrack} disabled={!$isRoomHost}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
      <input type="range" min="0" max="1" step="0.01" bind:value={vol}
        style="--pct:{vol*100}%;flex:1;margin-left:8px"
        on:input={() => roomSetVolume(vol)} />
    </div>
  </div>

  <!-- Tab Pills -->
  <div class="rp-tabs">
    <button class="pill" class:on={tab==='queue'} on:click={() => tab='queue'}>Queue ({$roomQueue.length})</button>
    <button class="pill" class:on={tab==='search'} on:click={() => tab='search'}>Search</button>
    <button class="pill" class:on={tab==='members'} on:click={() => tab='members'}>({$roomMembers.length})</button>
    {#if $isRoomHost}
      <button class="pill" class:on={tab==='polls'} on:click={() => tab='polls'}>Polls</button>
    {/if}
  </div>

  <!-- Tab Content -->
  <div class="rp-content">

    {#if tab === 'queue'}
      {#if $roomQueue.length === 0}
        <div class="rp-empty">Queue empty. Search songs to add.</div>
      {:else}
        {#each $roomQueue as song, i}
          <div class="song-row" class:active={$roomSong?.id === song.id}
            role="button" tabindex="0"
            on:click={() => { if ($isRoomHost) playTrack(song); }}
            on:keydown={e => e.key==='Enter' && $isRoomHost && playTrack(song)}>
            <span class="s-idx">{i + 1}</span>
            {#if song.coverUrl}<img src={song.coverUrl} alt="" class="s-thumb" />{:else}<div class="s-thumb"></div>{/if}
            <div class="s-meta">
              <div class="s-title" class:on={$roomSong?.id === song.id}>{song.title}</div>
              <div class="s-artist">{song.artist}</div>
            </div>
            {#if $isRoomHost}
              <button class="ibtn" on:click|stopPropagation={() => removeFromRoomQueue(i)} title="Remove">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      {/if}

    {:else if tab === 'search'}
      <div class="srch" style="margin-bottom:10px">
        <span class="srch-ic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </span>
        <input class="srch-inp" type="search" bind:value={searchQ} placeholder="Search songs…" autocomplete="off" />
        {#if searching}<span class="srch-clr"><span class="spinner" style="width:13px;height:13px"></span></span>{/if}
      </div>
      {#each results as song}
        <div class="song-row" role="button" tabindex="0" style="cursor:pointer"
          on:click={() => doAddSong(song)} on:keydown={e => e.key==='Enter' && doAddSong(song)}>
          {#if song.coverUrl}<img src={song.coverUrl} alt="" class="s-thumb" />{:else}<div class="s-thumb"></div>{/if}
          <div class="s-meta">
            <div class="s-title">{song.title}</div>
            <div class="s-artist">{song.artist}</div>
          </div>
          <button class="ibtn" title="Add">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      {/each}

    {:else if tab === 'members'}
      {#each $roomMembers as m}
        <div class="member-row">
          <div class="m-avatar">{(m.username || '?').charAt(0).toUpperCase()}</div>
          <div style="flex:1;font-size:13px;font-weight:500">{m.username || 'Guest'}</div>
          {#if m.isHost}<span class="host-tag">HOST</span>{/if}
        </div>
      {/each}

    {:else if tab === 'polls'}
      <!-- Active poll display -->
      {#if $roomPoll?.active}
        <div class="poll-card" in:scale={{ duration: 220, easing: backOut }}>
          <div class="poll-q">{$roomPoll.question}</div>
          {#each $roomPoll.options as opt, i}
            <button class="poll-opt"
              class:voted={myVote === i}
              class:disabled={myVote >= 0}
              on:click={() => votePoll(i)}>
              <span class="poll-opt-text">{opt.text}</span>
              <span class="poll-opt-count">{opt.votes}</span>
              {#if totalVotes > 0}
                <div class="poll-bar" style="width:{(opt.votes / totalVotes) * 100}%"></div>
              {/if}
            </button>
          {/each}
          {#if $isRoomHost}
            <button class="btn-ghost" style="margin-top:8px;width:100%;padding:10px;font-size:12px"
              on:click={endPoll}>End Poll</button>
          {/if}
        </div>
      {/if}

      <!-- Create poll (host only) -->
      {#if $isRoomHost}
        {#if !showPollCreate}
          <button class="btn-primary" style="width:100%;padding:12px;margin-top:8px"
            on:click={() => showPollCreate = true}>
            + Create Poll
          </button>
        {:else}
          <div class="poll-create" in:fly={{ y: 10, duration: 200 }}>
            <input class="inp" bind:value={pollQ} placeholder="Poll question…" />
            {#each pollOpts as _, i}
              <input class="inp" bind:value={pollOpts[i]} placeholder="Option {i + 1}" />
            {/each}
            <button class="btn-ghost" style="font-size:12px;padding:8px"
              on:click={() => pollOpts = [...pollOpts, '']}>+ Add option</button>
            <div style="display:flex;gap:8px">
              <button class="btn-primary" style="flex:1;padding:10px" on:click={doCreatePoll}>Start Poll</button>
              <button class="btn-ghost" style="padding:10px" on:click={() => showPollCreate = false}>Cancel</button>
            </div>
          </div>
        {/if}
      {:else if $roomPoll && !$roomPoll.active}
        <div class="rp-empty">No active polls</div>
      {:else if !$roomPoll}
        <div class="rp-empty">No polls yet. Host can create one.</div>
      {/if}
    {/if}
  </div>
</div>
{/if}

<!-- Poll popup for non-host users -->
{#if $roomPoll?.active && !$isRoomHost && tab !== 'polls' && myVote < 0}
  <div class="poll-popup" in:fly={{ y: 30, duration: 250 }} out:fade={{ duration: 150 }}>
    <div class="poll-popup-q">{$roomPoll.question}</div>
    <div class="poll-popup-opts">
      {#each $roomPoll.options as opt, i}
        <button class="poll-popup-btn" on:click={() => votePoll(i)}>{opt.text}</button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .rp { height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0); }

  .rp-hdr {
    display:flex;align-items:center;gap:10px;padding:14px 14px 10px;
    border-bottom:1px solid var(--brd);flex-shrink:0;
  }
  .rp-room-name { font-family:var(--fn);font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .rp-meta { font-family:var(--fm);font-size:9.5px;color:var(--t3); }

  .rp-player { display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 16px 8px;flex-shrink:0; }
  .rp-art {
    width:min(150px,40vw);aspect-ratio:1;border-radius:50%;overflow:hidden;flex-shrink:0;
    transition:box-shadow .6s;
  }
  .rp-art img { width:100%;height:100%;object-fit:cover; }
  .rp-art-empty { width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--su2); }
  .rp-info { text-align:center;padding:0 12px;width:100%; }
  .rp-title { font-family:var(--fn);font-size:18px;font-weight:700;line-height:1.3; }
  .rp-artist { font-size:12.5px;color:var(--t2);margin-top:4px; }
  .rp-listener-tag { font-family:var(--fm);font-size:9.5px;color:var(--t3);margin-top:6px;letter-spacing:.08em; }
  .rp-time { font-family:var(--fm);font-size:10px;color:var(--t3); }

  .rp-controls { display:flex;align-items:center;gap:14px;width:100%; }
  .ctrl-play {
    width:48px;height:48px;border-radius:50%;background:var(--a5);border:none;
    cursor:pointer;display:flex;align-items:center;justify-content:center;color:#000;
    transition:transform .1s,box-shadow .2s;
  }
  .ctrl-play:hover:not(:disabled) { transform:scale(1.06);box-shadow:0 4px 16px var(--ga); }
  .ctrl-play:active:not(:disabled) { transform:scale(.94); }
  .ctrl-play:disabled { opacity:.4;cursor:default; }
  .ctrl-btn {
    width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.05);
    border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--t1);transition:background .12s;
  }
  .ctrl-btn:hover { background:rgba(255,255,255,.1); }
  .ctrl-btn:disabled { opacity:.3;cursor:default; }

  .rp-tabs { display:flex;gap:6px;padding:8px 12px;flex-shrink:0; }
  .rp-content { flex:1;overflow-y:auto;padding:4px 12px; }
  .rp-empty { padding:30px;text-align:center;color:var(--t3);font-size:13px; }

  .s-idx { width:20px;flex-shrink:0;font-family:var(--fm);font-size:11px;color:var(--t3);text-align:center; }

  /* Members */
  .member-row { display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:var(--r-s); }
  .m-avatar {
    width:32px;height:32px;border-radius:50%;
    background:linear-gradient(135deg,var(--r2),var(--a3));
    display:flex;align-items:center;justify-content:center;
    font-family:var(--fn);font-size:12px;font-weight:800;color:#fff;flex-shrink:0;
  }
  .host-tag { font-family:var(--fm);font-size:9px;color:var(--a5);letter-spacing:.08em; }

  /* Live chip */
  .live-chip {
    display:inline-flex;align-items:center;gap:5px;
    padding:4px 10px;border-radius:100px;
    background:rgba(239,68,68,.12);
    font-family:var(--fm);font-size:9px;color:#ef4444;
    letter-spacing:.1em;flex-shrink:0;
  }
  .live-dot { width:6px;height:6px;border-radius:50%;background:#ef4444;animation:blink 1.2s infinite; }

  /* Polls */
  .poll-card {
    background:var(--bg2);border:1px solid var(--br2);border-radius:var(--r-l);
    padding:16px;margin-bottom:12px;
  }
  .poll-q { font-family:var(--fn);font-size:15px;font-weight:700;margin-bottom:12px; }
  .poll-opt {
    position:relative;display:flex;align-items:center;justify-content:space-between;
    width:100%;padding:12px 14px;margin-bottom:6px;
    background:var(--sur);border:1px solid var(--brd);border-radius:var(--r-m);
    cursor:pointer;color:var(--t1);font-size:13px;font-weight:500;
    transition:border-color .15s;overflow:hidden;
  }
  .poll-opt:hover:not(.disabled) { border-color:var(--a5); }
  .poll-opt.voted { border-color:var(--a5);background:rgba(245,158,11,.06); }
  .poll-opt.disabled { cursor:default; }
  .poll-opt-text { position:relative;z-index:1; }
  .poll-opt-count { position:relative;z-index:1;font-family:var(--fm);font-size:11px;color:var(--t3); }
  .poll-bar {
    position:absolute;left:0;top:0;bottom:0;
    background:rgba(245,158,11,.08);border-radius:var(--r-m);
    transition:width .4s cubic-bezier(.16,1,.3,1);
  }
  .poll-create { display:flex;flex-direction:column;gap:10px;padding:12px 0; }

  /* Poll popup for listeners */
  .poll-popup {
    position:fixed;bottom:80px;left:12px;right:12px;
    background:var(--bg3);border:1px solid var(--a4);border-radius:var(--r-l);
    padding:16px;z-index:60;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
  }
  .poll-popup-q { font-family:var(--fn);font-size:14px;font-weight:700;margin-bottom:10px; }
  .poll-popup-opts { display:flex;flex-direction:column;gap:6px; }
  .poll-popup-btn {
    padding:11px 14px;background:var(--sur);border:1px solid var(--brd);
    border-radius:var(--r-m);cursor:pointer;color:var(--t1);font-size:13px;
    transition:all .15s;
  }
  .poll-popup-btn:hover { border-color:var(--a5);background:rgba(245,158,11,.06); }

  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:.3; } }
</style>
