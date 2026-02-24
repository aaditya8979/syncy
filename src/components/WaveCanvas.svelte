<script>
  import { onMount } from 'svelte';
  import { playing } from '$lib/stores/player.js';

  export let intensity = 1;
  export let opacity   = 1;

  let canvas, ctx, raf, t = 0;
  let targetAmp = 0.6, currentAmp = 0.6;

  $: targetAmp = $playing ? 1.4 * intensity : 0.6 * intensity;

  const LAYERS = [
    { freq:0.009, speed:0.011, amp:0.19, phase:0,    op:0.032 },
    { freq:0.014, speed:0.018, amp:0.13, phase:2.09, op:0.024 },
    { freq:0.006, speed:0.007, amp:0.24, phase:4.36, op:0.018 },
  ];

  const C1 = (a) => `rgba(245,158,11,${a})`; // amber
  const C2 = (a) => `rgba(220,38,38,${a})`;  // crimson

  onMount(() => {
    ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      // Smooth amp transition
      currentAmp += (targetAmp - currentAmp) * 0.035;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      t++;

      for (const l of LAYERS) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const wave1 = Math.sin(x * l.freq + t * l.speed + l.phase);
          const wave2 = Math.sin(x * l.freq * 1.7 + t * l.speed * 0.9 + l.phase + 1.2);
          const y = H * 0.6 + (wave1 * H * l.amp + wave2 * H * l.amp * 0.38) * currentAmp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();

        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0,   C1(l.op * opacity));
        g.addColorStop(0.5, C2(l.op * 1.6 * opacity));
        g.addColorStop(1,   C1(l.op * opacity));
        ctx.fillStyle = g;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  });
</script>

<canvas bind:this={canvas}
  style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0"
></canvas>
