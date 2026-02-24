<script>
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { adminGetActivity, adminGetRooms } from '$lib/services/supabase.js';
  import { user, page } from '$lib/stores/app.js';

  let tab = 'activity';
  let activity = [], rooms = [], loading = true;
  let filterAction = 'all';

  onMount(async () => {
    [activity, rooms] = await Promise.all([adminGetActivity(), adminGetRooms()]);
    loading = false;
  });

  $: filteredActivity = filterAction === 'all'
    ? activity
    : activity.filter(a => a.action === filterAction);

  const fmt = d => new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });

  // Stats
  $: totalSignups = activity.filter(a => a.action === 'signup').length;
  $: totalLogins  = activity.filter(a => a.action === 'login').length;
  $: uniqueUsers  = new Set(activity.map(a => a.email).filter(Boolean)).size;
  $: activeRooms  = rooms.filter(r => r.status === 'playing').length;
</script>

<div class="admin" in:fly={{ y:12, duration:280 }}>
  <header class="hdr">
    <button class="ctrl-btn" on:click={() => page.set('home')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div style="display:flex;flex-direction:column;flex:1">
      <div class="wordmark" style="font-size:14px">Admin Panel</div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">{$user?.email}</div>
    </div>
    <div class="live-chip"><div class="live-dot"></div>SECURE</div>
  </header>

  <!-- Stats row -->
  {#if !loading}
    <div class="admin-stats" in:fade={{ duration:300 }}>
      <div class="ast">
        <div class="ast-n">{uniqueUsers}</div>
        <div class="ast-l">Users</div>
      </div>
      <div class="ast-sep"></div>
      <div class="ast">
        <div class="ast-n">{totalSignups}</div>
        <div class="ast-l">Signups</div>
      </div>
      <div class="ast-sep"></div>
      <div class="ast">
        <div class="ast-n">{totalLogins}</div>
        <div class="ast-l">Logins</div>
      </div>
      <div class="ast-sep"></div>
      <div class="ast">
        <div class="ast-n">{rooms.length}</div>
        <div class="ast-l">Rooms</div>
      </div>
    </div>
  {/if}

  <!-- Tabs -->
  <div style="padding:8px 12px;flex-shrink:0">
    <div class="pills">
      <button class="pill" class:on={tab==='activity'} on:click={() => tab='activity'}>
        Activity ({activity.length})
      </button>
      <button class="pill" class:on={tab==='rooms'} on:click={() => tab='rooms'}>
        Rooms ({rooms.length})
      </button>
    </div>
  </div>

  {#if tab === 'activity'}
    <!-- Filter -->
    <div style="padding:0 12px 8px;display:flex;gap:6px;flex-shrink:0">
      {#each ['all','signup','login'] as f}
        <button class="filter-btn" class:on={filterAction===f} on:click={() => filterAction=f}>
          {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Content -->
  <div style="flex:1;overflow-y:auto;padding:4px 10px">
    {#if loading}
      {#each [1,2,3,4,5] as _}
        <div style="display:flex;gap:10px;padding:10px 4px;align-items:center">
          <div class="skel" style="width:36px;height:36px;border-radius:10px;flex-shrink:0"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px">
            <div class="skel" style="width:60%;height:12px"></div>
            <div class="skel" style="width:40%;height:10px"></div>
          </div>
        </div>
      {/each}

    {:else if tab === 'activity'}
      {#if filteredActivity.length === 0}
        <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">No activity yet</div>
      {:else}
        {#each filteredActivity as act, i}
          <div class="act-row" in:fly={{ y:5, duration:150, delay:Math.min(i*15,200) }}>
            <div class="act-badge" class:signup={act.action==='signup'} class:login={act.action==='login'}>
              {act.action === 'signup' ? 'S' : 'L'}
            </div>
            <div style="flex:1;min-width:0">
              <div class="act-email">{act.email || act.user_id?.slice(0,16)+'…'}</div>
              {#if act.username}
                <div style="font-size:10.5px;color:var(--a5);font-family:var(--fm)">@{act.username}</div>
              {/if}
              <div class="act-time">{fmt(act.created_at)}</div>
            </div>
            <div class="act-tag" class:signup={act.action==='signup'} class:login={act.action==='login'}>
              {act.action}
            </div>
          </div>
        {/each}
      {/if}

    {:else if tab === 'rooms'}
      {#if rooms.length === 0}
        <div style="padding:40px;text-align:center;color:var(--t3);font-size:13px">No rooms</div>
      {:else}
        {#each rooms as r, i}
          <div class="room-row" in:fly={{ y:5, duration:150, delay:Math.min(i*20,300) }}>
            <div class="room-icon-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{r.name}</div>
              <div style="font-size:10.5px;color:var(--t3);margin-top:2px;font-family:var(--fm)">{fmt(r.created_at)}</div>
            </div>
            <div class="room-status" class:playing={r.status==='playing'}>{r.status}</div>
            <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">{r.passcode?'🔒':''}</div>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .admin { height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg0); }

  .admin-stats {
    display:flex;align-items:center;
    background:rgba(12,12,24,.96);border:1px solid var(--brd);
    margin:0 12px 8px;border-radius:var(--r-m);padding:14px 0;
    flex-shrink:0;
  }
  .ast { flex:1;text-align:center; }
  .ast-n { font-family:var(--fn);font-size:22px;font-weight:800;color:var(--a5); }
  .ast-l { font-family:var(--fm);font-size:8.5px;color:var(--t3);letter-spacing:.1em;margin-top:3px; }
  .ast-sep { width:1px;height:32px;background:var(--brd); }

  .filter-btn {
    padding:5px 12px;border-radius:100px;font-size:11.5px;font-weight:500;
    border:1px solid var(--brd);background:transparent;color:var(--t3);cursor:pointer;
    transition:all .12s;
  }
  .filter-btn.on { background:var(--sur);border-color:var(--br2);color:var(--t1); }
  .filter-btn:hover { border-color:var(--a4);color:var(--t1); }

  .act-row {
    display:flex;align-items:center;gap:10px;
    padding:9px 6px;border-radius:var(--r-s);
    transition:background .1s;
  }
  .act-row:hover { background:var(--sur); }
  .act-badge {
    width:34px;height:34px;border-radius:10px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    font-family:var(--fn);font-size:13px;font-weight:800;
  }
  .act-badge.signup { background:rgba(245,158,11,.12);color:var(--a5); }
  .act-badge.login  { background:rgba(99,102,241,.12);color:var(--v5); }

  .act-email { font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .act-time  { font-family:var(--fm);font-size:10px;color:var(--t3);margin-top:2px; }
  .act-tag {
    font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:.08em;
    padding:3px 7px;border-radius:100px;text-transform:uppercase;flex-shrink:0;
  }
  .act-tag.signup { background:rgba(245,158,11,.1);color:var(--a5); }
  .act-tag.login  { background:rgba(99,102,241,.1);color:var(--v5); }

  .room-row {
    display:flex;align-items:center;gap:10px;
    padding:10px 6px;border-radius:var(--r-s);transition:background .1s;
  }
  .room-row:hover { background:var(--sur); }
  .room-icon-sm {
    width:32px;height:32px;border-radius:9px;
    background:linear-gradient(135deg,var(--r2),var(--a3));
    display:flex;align-items:center;justify-content:center;
    color:#fff;flex-shrink:0;
  }
  .room-status {
    font-family:var(--fm);font-size:9px;text-transform:uppercase;
    padding:3px 7px;border-radius:100px;letter-spacing:.08em;
    background:var(--sur);color:var(--t3);
  }
  .room-status.playing { background:rgba(16,185,129,.1);color:var(--g); }
</style>