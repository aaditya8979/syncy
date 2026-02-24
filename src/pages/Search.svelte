<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { searchMusic } from '$lib/services/musicApi.js';
  import { playNow, addToQueue } from '$lib/stores/player.js';
  import { toggleLike, addSongToPlaylist, addDownload, showToast, page } from '$lib/stores/app.js';
  import SongRow from '../components/SongRow.svelte';

  let q = '', results = [], loading = false, timer;
  let inp;

  $: {
    clearTimeout(timer);
    if (q.trim()) {
      loading = true;
      timer = setTimeout(async () => {
        try { results = await searchMusic(q); }
        catch { results = []; }
        finally { loading = false; }
      }, 380);
    } else { results = []; loading = false; }
  }

  onMount(() => setTimeout(() => inp?.focus(), 200));

  function onPlay(e) { playNow(e.detail); showToast(`Playing "${e.detail.title}"`); page.set('player'); }
  function onLike(e) { toggleLike(e.detail); showToast(e.detail.liked?'Removed from liked':'Added to liked'); }
  function onDL(e)   { addDownload(e.detail); showToast(`Downloading "${e.detail.title}"`); }
  function onAddPL(e){ addSongToPlaylist(e.detail.pid, e.detail.song); showToast('Added to playlist'); }
  function onQueue(e){ addToQueue(e.detail); showToast(`"${e.detail.title}" added to queue`); }
</script>

<div style="height:100%;display:flex;flex-direction:column;overflow:hidden">
  <header class="hdr">
    <div class="wordmark" style="font-size:15px">Search</div>
    <div class="hdr-sep"></div>
    <span style="font-family:var(--fm);font-size:9.5px;color:var(--t3)">JioSaavn · Jamendo</span>
  </header>

  <div style="padding:12px 14px;flex-shrink:0">
    <div class="srch" in:fly={{ y:-10, duration:280, delay:80 }}>
      <span class="srch-ic">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </span>
      <input class="srch-inp" type="search" placeholder="Dilbar, Kesariya, any song…"
        bind:value={q} bind:this={inp} autocomplete="off" />
      {#if loading}
        <span class="srch-clr"><span class="spinner" style="width:14px;height:14px"></span></span>
      {:else if q}
        <button class="srch-clr" on:click={() => q = ''}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div style="flex:1;overflow-y:auto;padding:0 8px">
    {#if !q}
      <div style="padding:60px 24px;text-align:center" in:fade={{ duration:300 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="color:var(--t4);margin:0 auto 16px;display:block">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <div style="font-family:var(--fn);font-size:16px;font-weight:600;color:var(--t2);margin-bottom:8px">Find your songs</div>
        <div style="font-size:12.5px;color:var(--t3);line-height:1.7">Powered by JioSaavn — millions of Bollywood, Hindi &amp; more. Jamendo as backup.</div>
      </div>
    {:else if !loading && results.length === 0}
      <div style="padding:48px 24px;text-align:center;color:var(--t3)">
        <div style="font-size:14px">No results for "{q}"</div>
        <div style="font-size:12px;margin-top:6px">Try different keywords</div>
      </div>
    {:else}
      {#each results as song, i}
        <div in:fly={{ y:8, duration:200, delay:Math.min(i*25,300) }}>
          <SongRow {song} index={i+1}
            on:play={onPlay} on:like={onLike} on:download={onDL} on:addtopl={onAddPL}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>
