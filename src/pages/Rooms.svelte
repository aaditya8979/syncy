<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { user, showToast } from '$lib/stores/app.js';
  import { listRooms, createRoom } from '$lib/services/supabase.js';

  const D = createEventDispatcher();
  let rooms = [], loading = true, showCreate = false;
  let newName = '', newPass = '', creating = false;
  let joinId = '';

  onMount(load);

  async function load() {
    loading = true;
    rooms = await listRooms();
    loading = false;
  }

  async function doCreate() {
    if (!newName.trim()) { showToast('Enter a room name'); return; }
    creating = true;
    try {
      const r = await createRoom(newName.trim(), $user.id, newPass.trim() || undefined);
      showToast(`Room "${r.name}" created!`);
      showCreate = false;
      newName = ''; newPass = '';
      D('enter', r.id);
    } catch(e) {
      showToast(`Error: ${e.message}`);
    } finally {
      creating = false;
    }
  }

  function doJoin() {
    const raw = joinId.trim();
    // Accept full URL or bare UUID
    const id = raw.replace(/^.*[?&]room=/, '').split('&')[0];
    if (!id) { showToast('Paste a valid room ID'); return; }
    D('enter', id);
  }
</script>

<div style="height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0)">
  <header class="hdr">
    <div style="display:flex;flex-direction:column;flex:1">
      <div class="wordmark" style="font-size:15px">Rooms</div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">Listen together · WiFi sync</div>
    </div>
    <button class="hdr-btn" on:click={() => showCreate = !showCreate}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Create
    </button>
    <button class="ibtn" on:click={load} title="Refresh" style="width:32px;height:32px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-8.5"/>
      </svg>
    </button>
  </header>

  <div style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px">

    <!-- Create form -->
    {#if showCreate}
      <div class="create-panel" in:scale={{ duration:220, easing:backOut }}>
        <div class="cp-hdr">
          <span style="font-family:var(--fn);font-size:14px;font-weight:700">New room</span>
          <button class="ibtn" on:click={() => showCreate=false}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
        </div>
        <div class="cp-body">
          <div>
            <label class="auth-label" for="rn-name">Room name *</label>
            <input id="rn-name" class="inp" bind:value={newName}
              placeholder="Friday vibes, Chill zone…"
              on:keydown={e => e.key==='Enter' && doCreate()} />
          </div>
          <div>
            <label class="auth-label" for="rn-pass">Passcode (optional)</label>
            <input id="rn-pass" class="inp" bind:value={newPass} placeholder="Leave empty = public" />
          </div>
          <button class="btn-primary" style="width:100%;padding:12px" on:click={doCreate} disabled={creating||!newName.trim()}>
            {#if creating}
              <span class="spinner" style="width:15px;height:15px;margin:0 auto"></span>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create room
            {/if}
          </button>
        </div>
      </div>
    {/if}

    <!-- Join by ID / link -->
    <div class="join-bar">
      <input class="inp" style="flex:1;border-radius:100px;font-size:13px"
        bind:value={joinId} placeholder="Paste room ID or invite link…"
        on:keydown={e => e.key==='Enter' && doJoin()} />
      <button class="btn-primary" style="flex-shrink:0;padding:10px 18px;border-radius:100px"
        on:click={doJoin} disabled={!joinId.trim()}>
        Join
      </button>
    </div>

    <!-- Room list label -->
    <div style="font-family:var(--fm);font-size:9.5px;color:var(--t3);letter-spacing:.12em;text-transform:uppercase;padding:2px 2px 0">
      Active rooms ({rooms.length})
    </div>

    {#if loading}
      {#each [1,2,3] as _}
        <div class="room-tile">
          <div class="skel" style="width:48px;height:48px;border-radius:14px;flex-shrink:0"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:7px">
            <div class="skel" style="width:55%;height:13px"></div>
            <div class="skel" style="width:35%;height:10px"></div>
          </div>
        </div>
      {/each}
    {:else if rooms.length === 0}
      <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px;line-height:1.7">
        No rooms yet.<br/>Create the first one and invite friends!
      </div>
    {:else}
      {#each rooms as r, i}
        <button class="room-tile" in:fly={{ y:8, duration:200, delay:i*35 }}
          on:click={() => D('enter', r.id)}>
          <div class="rt-icon" class:playing={r.status==='playing'}>
            {#if r.status === 'playing'}
              <div class="eq" style="transform:scale(1.1)">
                <div class="eq-bar" style="--d:.38s;--delay:0s"></div>
                <div class="eq-bar" style="--d:.44s;--delay:.06s"></div>
                <div class="eq-bar" style="--d:.36s;--delay:.12s"></div>
              </div>
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            {/if}
          </div>
          <div style="flex:1;text-align:left;min-width:0">
            <div style="font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{r.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              <span style="font-size:11.5px;color:var(--t3)">{r.status==='playing'?'▶ Playing':'Idle'}</span>
              <span style="font-size:9px;color:var(--t4)">·</span>
              <span style="font-size:11px;color:var(--t3)">{r.passcode?'🔒 Private':'Public'}</span>
              {#if r.host_id === $user?.id}
                <span style="font-family:var(--fm);font-size:9px;color:var(--a5);letter-spacing:.06em">YOUR ROOM</span>
              {/if}
            </div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--t4);flex-shrink:0">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .join-bar { display:flex;gap:8px;align-items:center; }

  .create-panel {
    background:var(--bg2);border:1px solid var(--br2);border-radius:var(--r-l);
    overflow:hidden;position:relative;
  }
  .create-panel::before {
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--a4),var(--r4),transparent);
  }
  .cp-hdr { display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px; }
  .cp-body { padding:0 16px 16px;display:flex;flex-direction:column;gap:12px; }

  .room-tile {
    display:flex;align-items:center;gap:13px;padding:13px 14px;
    background:var(--sur);border:1px solid var(--brd);border-radius:var(--r-m);
    cursor:pointer;width:100%;transition:all .18s;
  }
  .room-tile:hover { border-color:var(--br2);background:var(--su2);transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.35); }
  .room-tile:active { transform:scale(.98); }
  .rt-icon {
    width:48px;height:48px;border-radius:14px;flex-shrink:0;
    background:linear-gradient(135deg,var(--r2),var(--a3));
    display:flex;align-items:center;justify-content:center;color:#fff;
    transition:box-shadow .2s;
  }
  .rt-icon.playing { box-shadow:0 0 0 2px rgba(245,158,11,.5),0 4px 18px rgba(245,158,11,.3); }
</style>