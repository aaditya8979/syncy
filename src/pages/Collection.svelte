<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { getCollection } from '$lib/services/musicApi.js';
  import { page, showToast, shareItem, downloadTrack } from '$lib/stores/app.js';
  import { queue, qIdx, playSong } from '$lib/stores/player.js';
  import SongRow from '../components/SongRow.svelte';

  export let collectionId;
  export let collectionType = 'playlists'; // 'albums' or 'playlists'

  let collection = null;
  let loading = true;
  let visibleCount = 30; // pagination batch size

  onMount(() => loadCollection(collectionId, collectionType));

  $: if (collectionId && collectionType) loadCollection(collectionId, collectionType);

  async function loadCollection(id, type) {
    loading = true;
    visibleCount = 30;
    collection = await getCollection(type, id);
    loading = false;
  }

  $: visibleSongs = collection?.songs?.slice(0, visibleCount) ?? [];
  $: hasMore = (collection?.songs?.length ?? 0) > visibleCount;
  $: totalDuration = collection?.songs?.reduce((a, s) => a + (s.duration || 0), 0) ?? 0;

  function playAll() {
    if (!collection?.songs?.length) return;
    queue.set(collection.songs);
    qIdx.set(0);
    playSong(collection.songs[0]);
    page.set('player');
  }

  function shuffleAll() {
    if (!collection?.songs?.length) return;
    const shuffled = [...collection.songs].sort(() => Math.random() - 0.5);
    queue.set(shuffled);
    qIdx.set(0);
    playSong(shuffled[0]);
    page.set('player');
  }

  function loadMore() {
    visibleCount += 30;
  }

  function doShare() {
    if (!collection) return;
    const type = collectionType === 'albums' ? 'album' : 'playlist';
    shareItem(collectionId, type);
  }

  function doDownload() {
    if (!collection?.songs?.length) return;
    showToast(`Downloading ${collection.songs.length} tracks...`);
    collection.songs.forEach(song => downloadTrack(song));
  }

  const fmtDur = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
    return `${mins} min`;
  };
</script>

<div class="coll-page">
  {#if loading}
    <div class="coll-loading">
      <span class="spinner" style="width:28px;height:28px"></span>
    </div>
  {:else if !collection}
    <div class="coll-loading" style="color:var(--t3)">Collection not found</div>
  {:else}
    <div class="coll-header" in:fade={{ duration: 300 }}>
      <button class="back-btn" on:click={() => page.set('home')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>

      <div class="coll-hero">
        <div class="coll-art">
          {#if collection.coverUrl}
            <img src={collection.coverUrl} alt="" />
          {:else}
            <div class="art-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
          {/if}
        </div>
        <div class="coll-meta">
          <div class="coll-type">{collectionType === 'albums' ? 'Album' : 'Playlist'}</div>
          <h1 class="coll-title">{collection.title}</h1>
          {#if collection.artist}
            <div class="coll-artist">{collection.artist}</div>
          {/if}
          <div class="coll-stats">
            {collection.songCount || collection.songs.length} songs
            {#if collection.songs.length > 0}
              <span class="dot">·</span> {fmtDur(totalDuration)}
            {/if}
            {#if collection.year}
              <span class="dot">·</span> {collection.year}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="coll-actions" in:fly={{ y: 10, duration: 300, delay: 100 }}>
      <button class="play-all-btn" on:click={playAll}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Play All
      </button>
      <button class="action-icon-btn" on:click={shuffleAll} title="Shuffle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
        </svg>
      </button>
      <button class="action-icon-btn" on:click={doShare} title="Share">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
      <button class="action-icon-btn download-btn" on:click={doDownload} title="Download Offline">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>

    <!-- Song list -->
    <div class="coll-tracks" in:fly={{ y: 10, duration: 300, delay: 150 }}>
      {#if collection.songs.length === 0}
        <div class="coll-empty">No tracks available</div>
      {:else}
        {#each visibleSongs as song, i (song.id)}
          <SongRow {song} index={i + 1} />
        {/each}

        <!-- Load More Button -->
        {#if hasMore}
          <button class="load-more-btn" on:click={loadMore} in:fade={{ duration: 200 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            Show More ({collection.songs.length - visibleCount} remaining)
          </button>
        {/if}
      {/if}
    </div>

    <!-- Playlist Footer -->
    {#if collection.songs.length > 0}
      <div class="coll-footer" in:fade={{ duration: 200, delay: 200 }}>
        <span>{collection.songs.length} {collection.songs.length === 1 ? 'song' : 'songs'}</span>
        <span class="dot">·</span>
        <span>{fmtDur(totalDuration)}</span>
      </div>
    {/if}

    <div style="height:100px"></div>
  {/if}
</div>

<style>
  .coll-page { height:100%;overflow-y:auto;background:var(--bg0); }
  .coll-loading { display:flex;align-items:center;justify-content:center;height:300px; }

  .coll-header {
    position:relative;padding:20px 24px;
    background:linear-gradient(to bottom, var(--bg2) 0%, var(--bg0) 100%);
  }
  .back-btn {
    width:36px;height:36px;border-radius:50%;
    background:rgba(255,255,255,.06);border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;color:var(--t1);
    margin-bottom:20px;transition:background .12s;
  }
  .back-btn:hover { background:rgba(255,255,255,.1); }

  .coll-hero { display:flex;gap:20px;align-items:flex-end; }
  .coll-art {
    width:160px;height:160px;border-radius:8px;overflow:hidden;flex-shrink:0;
    box-shadow:0 8px 32px rgba(0,0,0,.6);
  }
  .coll-art img { width:100%;height:100%;object-fit:cover; }
  .art-placeholder {
    width:100%;height:100%;display:flex;align-items:center;justify-content:center;
    background:var(--su2);
  }
  .coll-meta { min-width:0;flex:1; }
  .coll-type { font-family:var(--fm);font-size:10px;color:var(--t3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px; }
  .coll-title { font-family:var(--fn);font-size:24px;font-weight:800;color:var(--t1);line-height:1.2;margin-bottom:6px;word-break:break-word; }
  .coll-artist { font-size:14px;color:var(--t2);margin-bottom:4px; }
  .coll-stats { font-size:12px;color:var(--t3); }
  .coll-stats .dot { margin:0 5px; }

  /* ── Actions ── */
  .coll-actions { display:flex;align-items:center;gap:12px;padding:16px 24px; }
  .play-all-btn {
    display:flex;align-items:center;gap:8px;
    padding:14px 36px;border-radius:100px;border:none;cursor:pointer;
    background:var(--a5);color:#000;font-size:15px;font-weight:700;
    font-family:var(--fn);transition:transform .1s,box-shadow .2s;
  }
  .play-all-btn:hover { transform:scale(1.04);box-shadow:0 4px 20px var(--ga); }
  .play-all-btn:active { transform:scale(.96); }
  .action-icon-btn {
    width:46px;height:46px;border-radius:50%;
    border:1px solid var(--br2);background:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;color:var(--t1);
    transition:background .15s,border-color .15s;
  }
  .action-icon-btn:hover { background:var(--su2);border-color:var(--t3); }

  /* ── Tracks ── */
  .coll-tracks { padding:0 8px; }
  .coll-empty { padding:40px;text-align:center;color:var(--t3);font-size:13px; }

  /* ── Load More Button ── */
  .load-more-btn {
    display:flex;align-items:center;justify-content:center;gap:8px;
    width:calc(100% - 16px);margin:12px 8px;padding:14px;
    background:rgba(255,255,255,.04);border:1px solid var(--br2);
    border-radius:12px;cursor:pointer;
    color:var(--t2);font-family:var(--fn);font-size:13px;font-weight:600;
    transition:all .15s;
  }
  .load-more-btn:hover { background:rgba(255,255,255,.07);border-color:var(--t3);color:var(--t1); }
  .load-more-btn:active { transform:scale(.98); }

  /* ── Footer ── */
  .coll-footer {
    display:flex;align-items:center;justify-content:center;gap:0;
    padding:16px;margin-top:8px;
    font-family:var(--fm);font-size:11px;color:var(--t3);letter-spacing:.04em;
  }
  .coll-footer .dot { margin:0 6px; }
</style>
