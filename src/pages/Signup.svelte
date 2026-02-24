<script>
  import { createEventDispatcher } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import WaveCanvas from '../components/WaveCanvas.svelte';
  import { user } from '$lib/stores/app.js';
  import { signUp } from '$lib/services/supabase.js';

  const D = createEventDispatcher();
  let email='', password='', username='', err='', loading=false, showPw=false;

  async function submit() {
    if (!email||!password||!username) { err='Fill all fields'; return; }
    if (password.length < 6) { err='Password min 6 characters'; return; }
    loading=true; err='';
    try { const u = await signUp(email, password, username); user.set(u); }
    catch(e) { err = e.message||'Sign up failed'; }
    finally { loading=false; }
  }
</script>

<div class="auth-shell" in:fade={{ duration:500 }}>
  <WaveCanvas intensity={1.8} />
  <div class="orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
  </div>

  <div class="auth-center">
    <div class="logo-wrap" in:fly={{ y:-50, duration:700, easing:backOut, delay:100 }}>
      <div class="logo-icon">
        <svg viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="16" fill="#0a0a16"/>
          <circle cx="18" cy="36" r="8" fill="none" stroke="url(#lg2)" stroke-width="2"/>
          <circle cx="40" cy="32" r="8" fill="none" stroke="url(#lg2)" stroke-width="2"/>
          <path d="M26 36V13L48 10V32" fill="none" stroke="url(#lg2)" stroke-width="2" stroke-linecap="round"/>
          <defs>
            <linearGradient id="lg2" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop stop-color="#f59e0b"/><stop offset="1" stop-color="#dc2626"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>

    <div class="brand" in:fly={{ y:24, duration:500, easing:cubicOut, delay:280 }}>
      {#each 'SYNCY'.split('') as ch, i}
        <span class="brand-ch" style="animation-delay:{180+i*65}ms">{ch}</span>
      {/each}
    </div>
    <div class="brand-sub" in:fade={{ duration:400, delay:580 }}>join the universe</div>

    <div class="auth-card" in:scale={{ start:0.88, opacity:0, duration:450, easing:backOut, delay:380 }}>
      <h2 class="auth-card-title">Create account</h2>
      {#if err}<div class="auth-err" style="margin-bottom:16px" in:fly={{ y:-8, duration:200 }}>{err}</div>{/if}

      <div class="field"><label class="auth-label" for="s-un">Username</label>
        <input id="s-un" class="inp" type="text" bind:value={username} placeholder="your name" autocomplete="nickname"/>
      </div>
      <div class="field"><label class="auth-label" for="s-em">Email</label>
        <input id="s-em" class="inp" type="email" bind:value={email} placeholder="you@example.com" autocomplete="email"/>
      </div>
      <div class="field"><label class="auth-label" for="s-pw">Password</label>
        <div style="position:relative">
          <input 
            id="s-pw" 
            class="inp" 
            type={showPw?'text':'password'} 
            value={password}
            on:input={e => password = e.currentTarget.value}
            placeholder="min 6 characters" 
            on:keydown={e=>e.key==='Enter'&&submit()}
          />
          <button class="pw-eye" type="button" on:click={()=>showPw=!showPw}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <button class="auth-submit" style="margin-top:8px" on:click={submit} disabled={loading}>
        {#if loading}<span class="spinner" style="width:16px;height:16px;margin:0 auto"></span>
        {:else}Create account{/if}
      </button>
      <div class="auth-switch">Have an account? <button on:click={()=>D('switch')}>Sign in</button></div>
    </div>
  </div>
</div>

<style>
  .orbs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .orb{position:absolute;border-radius:50%;filter:blur(80px)}
  .orb-1{width:280px;height:280px;top:-60px;left:-40px;background:radial-gradient(circle,rgba(245,158,11,.1),transparent 70%);animation:orbF1 9s ease-in-out infinite}
  .orb-2{width:220px;height:220px;bottom:-30px;right:-30px;background:radial-gradient(circle,rgba(220,38,38,.1),transparent 70%);animation:orbF2 7s ease-in-out infinite}
  @keyframes orbF1{0%,100%{transform:translateY(0)}50%{transform:translateY(25px)}}
  @keyframes orbF2{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
  .logo-wrap{animation:floatY 3s ease-in-out infinite}
  .logo-icon{width:68px;height:68px}.logo-icon svg{width:100%;height:100%}
  .brand{font-family:var(--fn);font-size:34px;font-weight:800;letter-spacing:.36em;display:flex;gap:2px;background:linear-gradient(135deg,var(--t1) 40%,var(--a6));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .brand-ch{display:inline-block;animation:letterIn .55s cubic-bezier(.16,1,.3,1) both}
  .brand-sub{font-size:12px;color:var(--t3);letter-spacing:.06em;font-style:italic}
  .auth-card-title{font-family:var(--fn);font-size:21px;font-weight:700;margin-bottom:22px}
  .field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
  .pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--t3);display:flex;transition:color .12s}
  .pw-eye:hover{color:var(--t1)}
  .auth-switch{text-align:center;margin-top:18px;font-size:13px;color:var(--t3)}
  .auth-switch button{background:none;border:none;cursor:pointer;color:var(--a5);font-weight:600;margin-left:4px}
  .auth-switch button:hover{color:var(--a6)}
</style>