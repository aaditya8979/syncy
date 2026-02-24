<script>
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import {
    playlists, liked, downloads, toggleLike, createPlaylist,
    deletePlaylist, addSongToPlaylist, removeSongFromPlaylist,
    addDownload, removeDownload, playDownload, showToast
  } from '$lib/stores/app.js';
  import { playNow, addToQueue } from '$lib/stores/player.js';
  import SongRow from '../components/SongRow.svelte';

  let tab = 'playlists';
  let newName = '', showCreate = false;
  let openPLId = null;
  $: openPL = $playlists.find(p => p.id === openPLId);

  function doCreate() {
    if (!newName.trim()) return;
    createPlaylist(newName);
    showToast('Playlist created');
    newName = ''; showCreate = false;
  }

  function playAll(pl) {
    if (!pl.songs.length) return;
    pl.songs.forEach(s => addToQueue(s));
    playNow(pl.songs[0]);
    showToast(`Playing "${pl.name}"`);
  }

  $: dlList = Object.values($downloads).sort((a,b) => b.cachedAt - a.cachedAt);
</script>

<!-- Playlist detail -->
{#if openPL}
  <div style="height:100%;display:flex;flex-direction:column;overflow:hidden" in:fly={{ x:28, duration:280 }}>
    <header class="hdr">
      <button class="ctrl-btn" on:click={() => openPLId=null}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fn);font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{openPL.name}</div>
        <div style="font-size:11px;color:var(--t3)">{openPL.songs.length} songs</div>
      </div>
      {#if openPL.songs.length > 0}
        <button class="btn-primary" style="padding:8px 16px;font-size:12px" on:click={() => playAll(openPL)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play all
        </button>
      {/if}
    </header>
    <div style="flex:1;overflow-y:auto;padding:6px 8px">
      {#if openPL.songs.length === 0}
        <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">Add songs using the + button on any song.</div>
      {:else}
        {#each openPL.songs as song, i}
          <SongRow {song} index={i+1} context="queue"
            on:play={e => playNow(e.detail)}
            on:like={e => toggleLike(e.detail)}
            on:remove={e => removeSongFromPlaylist(openPLId, e.detail.id)}
            on:download={e => { addDownload(e.detail); showToast('Downloading'); }}
            on:addtopl={() => {}}
          />
        {/each}
      {/if}
    </div>
  </div>

{:else}
  <div style="height:100%;display:flex;flex-direction:column;overflow:hidden">
    <header class="hdr">
      <div class="wordmark" style="font-size:15px">Library</div>
      <div class="hdr-sep"></div>
    </header>

    <div style="padding:10px 14px;flex-shrink:0">
      <div class="pills">
        <button class="pill" class:on={tab==='playlists'} on:click={() => tab='playlists'}>Playlists</button>
        <button class="pill" class:on={tab==='liked'} on:click={() => tab='liked'}>Liked {$liked.length?`(${$liked.length})`:''}</button>
        <button class="pill" class:on={tab==='offline'} on:click={() => tab='offline'}>Offline {dlList.length?`(${dlList.length})`:''}</button>
      </div>
    </div>

    <div style="flex:1;overflow-y:auto;padding:0 8px">

      {#if tab === 'playlists'}
        <div style="padding:4px 4px 10px">
          {#if showCreate}
            <div class="create-bar" in:scale={{ duration:200, easing:backOut }}>
              <input class="inp" bind:value={newName} placeholder="Playlist name…"
                on:keydown={e => e.key==='Enter'&&doCreate()} style="flex:1;border-radius:var(--r-s)" />
              <button class="btn-primary" style="padding:10px 16px;font-size:13px;flex-shrink:0" on:click={doCreate}>Create</button>
              <button class="ibtn" on:click={() => showCreate=false}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
              </button>
            </div>
          {:else}
            <button class="new-pl-btn" on:click={() => showCreate=true}>
              <span style="font-size:18px;color:var(--a5);line-height:1">+</span>
              New playlist
            </button>
          {/if}
        </div>

        {#if $playlists.length === 0}
          <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">No playlists yet.</div>
        {:else}
          {#each $playlists as pl, i}
            <div class="pl-row" in:fly={{ y:8, duration:200, delay:i*30 }}>
              <button class="pl-main" on:click={() => openPLId=pl.id}>
                <div class="pl-cover">
                  {#if pl.songs[0]?.coverUrl}
                    <img src={pl.songs[0].coverUrl} alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px"/>
                  {:else}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
                      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                  {/if}
                </div>
                <div style="flex:1;min-width:0;text-align:left">
                  <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{pl.name}</div>
                  <div style="font-size:11.5px;color:var(--t3);margin-top:2px">{pl.songs.length} songs</div>
                </div>
              </button>
              <div style="display:flex;gap:2px;flex-shrink:0">
                <button class="ibtn" title="Play all" on:click={() => playAll(pl)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <button class="ibtn" title="Delete" on:click={() => { deletePlaylist(pl.id); showToast('Deleted'); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        {/if}

      {:else if tab === 'liked'}
        {#if $liked.length === 0}
          <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">No liked songs yet.</div>
        {:else}
          {#each $liked as song, i}
            <SongRow {song} index={i+1}
              on:play={e => playNow(e.detail)}
              on:like={e => toggleLike(e.detail)}
              on:download={e => { addDownload(e.detail); showToast('Downloading'); }}
              on:addtopl={e => { addSongToPlaylist(e.detail.pid, e.detail.song); showToast('Added'); }}
            />
          {/each}
        {/if}

      {:else if tab === 'offline'}
        {#if dlList.length === 0}
          <div style="padding:48px;text-align:center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="color:var(--t4);margin:0 auto 14px;display:block">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div style="font-size:13px;color:var(--t3)">No downloaded songs. Tap the download icon on any song.</div>
          </div>
        {:else}
          {#each dlList as song, i}
            <div class="dl-row" in:fly={{ y:8, duration:200, delay:i*30 }}>
              {#if song.coverUrl}
                <img src={song.coverUrl} alt="" class="s-thumb" />
              {:else}
                <div class="s-thumb">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="color:var(--t4)">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              {/if}
              <div style="flex:1;min-width:0">
                <!-- 2-line clamp on title -->
                <div style="font-size:13.5px;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.38;color:var(--t1)">{song.title}</div>
                <div style="font-size:11.5px;color:var(--t2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{song.artist}</div>
                <div style="display:flex;align-items:center;gap:3px;margin-top:4px">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="color:var(--g)">
                    <polyline points="2 6 5 9 10 3"/>
                  </svg>
                  <span style="font-size:9.5px;color:var(--g);font-family:var(--fm)">Saved offline</span>
                </div>
              </div>
              <!-- FIXED: playDownload resolves cached blob URL -->
              <button class="ctrl-play sm" on:click={() => playDownload(song)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="ibtn" on:click={() => { removeDownload(song.id); showToast('Removed'); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
                </svg>
              </button>
            </div>
          {/each}
        {/if}
      {/if}

    </div>
  </div>
{/if}

<style>
  .create-bar { display:flex;gap:8px;align-items:center;background:var(--sur);border:1px solid var(--br2);border-radius:var(--r-s);padding:8px; }
  .new-pl-btn { width:100%;padding:11px 14px;border:1px dashed var(--br2);border-radius:var(--r-s);cursor:pointer;color:var(--t2);font-size:13px;display:flex;align-items:center;gap:8px;background:transparent;transition:all .15s; }
  .new-pl-btn:hover { border-color:var(--a4);color:var(--t1);background:var(--gas); }
  .pl-row { display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:var(--r-s);transition:background .1s; }
  .pl-row:hover { background:var(--sur); }
  .pl-main { flex:1;display:flex;align-items:center;gap:11px;background:none;border:none;cursor:pointer;color:var(--t1);min-width:0; }
  .pl-cover { width:48px;height:48px;border-radius:10px;background:var(--su2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden; }
  .dl-row { display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:var(--r-s);transition:background .1s; }
  .dl-row:hover { background:var(--sur); }
</style>