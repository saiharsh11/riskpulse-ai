import { useEffect, useRef } from "react";

/**
 * Hero canvas: a live candlestick chart made of particles.
 *  - Intro: particles drift in from a scattered field and settle into candles.
 *  - Live: candles scroll left; the newest one forms at the right edge, ticking up and down.
 *    Every so often a sharp dip comes through, labelled the way the agents would flag it.
 *  - Hover: particles are pushed away from the cursor and spring back. Click: shockwave.
 *  - Reduced motion: a still chart.
 */

const INK = [14, 15, 12];
const UP = [10, 143, 90];
const DOWN = [224, 65, 42];
const CANDLES_PER_SEC = 0.9;

type P = {
  x: number; y: number; vx: number; vy: number;
  fx: number; fy: number; wick: boolean; // position inside the candle (body: fx -0.5..0.5, fy 0..1)
  a: number; s: number;
};
type Candle = { k: number; o: number; c: number; h: number; l: number; shock: boolean; parts: P[] };

function seeded(seed: number) {
  let t = seed;
  return () => {
    t |= 0; t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function ParticleField(_: { onAnomalyPoint?: (p: { x: number; y: number } | null) => void } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = seeded(7);
    let W = 0, H = 0, dpr = 1;
    let left = 0, right = 0, top = 0, bottom = 0, step = 18, gap = 3.3, n = 0, mobile = false;
    let candles: Candle[] = [];
    let scroll = 0;
    let lo = 0, hi = 1; // smoothed price range on screen
    let raf = 0, start = performance.now(), last = start;
    const mouse = { x: -9999, y: -9999, active: false };
    const shocks: { x: number; y: number; t: number }[] = [];
    // the hero text's line boxes (canvas coordinates): candles passing under them are dimmed so the text stays readable
    let boxes: { l: number; t: number; r: number; b: number }[] = [];
    let union = { l: 0, t: 0, r: -1, b: -1 };
    const measureText = () => {
      const el = canvas.parentElement?.querySelector("[data-hero-text]");
      if (!el) return;
      const cr = canvas.getBoundingClientRect(), pad = mobile ? 8 : 18;
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        range.selectNodeContents(n);
        rects.push(...Array.from(range.getClientRects()));
      }
      el.querySelectorAll("a, button").forEach((x) => rects.push(x.getBoundingClientRect()));
      boxes = rects.filter((r) => r.width > 0).map((r) => ({ l: r.left - cr.left - pad, t: r.top - cr.top - pad, r: r.right - cr.left + pad, b: r.bottom - cr.top + pad }));
      union = boxes.reduce((u, x) => ({ l: Math.min(u.l, x.l), t: Math.min(u.t, x.t), r: Math.max(u.r, x.r), b: Math.max(u.b, x.b) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    };
    const textFade = (x: number, y: number) => {
      if (x < union.l - 30 || x > union.r + 30 || y < union.t - 30 || y > union.b + 30) return 1;
      let d = Infinity;
      for (const bx of boxes) d = Math.min(d, Math.max(bx.l - x, 0, x - bx.r, bx.t - y, 0, y - bx.b));
      return d <= 0 ? 0.12 : Math.min(1, 0.12 + d / 30);
    };

    // price generator: gentle drift, a sharp dip now and then, then a recovery
    let price = 100, untilShock = 0, recovering = 0, nextK = 0;
    const nextCandle = (): Candle => {
      let drift = 0.25 + (rand() - 0.5) * 2.2;
      let shock = false;
      if (untilShock === 0) { drift = -11; shock = true; }
      else if (untilShock === -1) drift = -4;
      else if (recovering > 0) { drift = 1.1 + (rand() - 0.4) * 2.4; recovering--; }
      untilShock--;
      if (untilShock === -2) { recovering = 22; untilShock = 55 + Math.floor(rand() * 30); }
      const o = price, c = price + drift;
      price = c;
      return { k: nextK++, o, c, h: Math.max(o, c) + rand() * 1.8, l: Math.min(o, c) - rand() * 1.8, shock, parts: [] };
    };

    const yOf = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
    const xOf = (k: number) => left + (k - scroll) * step + step / 2;

    const addParticles = (cd: Candle, scattered: boolean) => {
      const bodyW = step * 0.56;
      const cols = Math.max(2, Math.round(bodyW / gap));
      const pxPerUnit = (bottom - top) / (hi - lo || 1);
      const rows = Math.max(1, Math.round((Math.abs(cd.c - cd.o) * pxPerUnit) / gap));
      const wickRows = Math.max(2, Math.round(((cd.h - cd.l) * pxPerUnit) / gap));
      const spawn = () => {
        if (reduced) return { x: xOf(cd.k), y: yOf(cd.c) };
        if (scattered) {
          const ang = rand() * Math.PI * 2, r = Math.max(W, H) * (0.4 + rand() * 0.6);
          return { x: W / 2 + Math.cos(ang) * r, y: H / 2 + Math.sin(ang) * r };
        }
        return { x: right + 10 + rand() * 50, y: yOf(cd.o) + (rand() - 0.5) * 60 };
      };
      for (let r = 0; r <= rows; r++)
        for (let q = 0; q < cols; q++) {
          const s = spawn();
          cd.parts.push({ ...s, vx: 0, vy: 0, fx: cols === 1 ? 0 : q / (cols - 1) - 0.5, fy: r / rows, wick: false, a: 1, s: 2.1 });
        }
      for (let r = 0; r <= wickRows; r++) {
        const s = spawn();
        cd.parts.push({ ...s, vx: 0, vy: 0, fx: 0, fy: r / wickRows, wick: true, a: 0.85, s: 1.8 });
      }
    };

    const fitRange = (instant: boolean) => {
      let mn = Infinity, mx = -Infinity;
      for (const cd of candles) { if (cd.l < mn) mn = cd.l; if (cd.h > mx) mx = cd.h; }
      const pad = (mx - mn) * 0.06;
      if (instant) { lo = mn - pad; hi = mx + pad; }
      else { lo += (mn - pad - lo) * 0.03; hi += (mx + pad - hi) * 0.03; }
    };

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mobile = W < 768;
      left = mobile ? 16 : W * 0.06;
      right = W - (mobile ? 16 : W * 0.04);
      top = H * (mobile ? 0.52 : 0.30);
      bottom = H * 0.86;
      step = mobile ? 13 : 18;
      gap = mobile ? 3 : 3.3;
      n = Math.floor((right - left) / step);
      // fresh series: the first dip lands about three quarters across, like a story
      price = 100; nextK = 0; recovering = 0; untilShock = Math.floor(n * 0.72); scroll = 0;
      candles = [];
      for (let i = 0; i <= n; i++) candles.push(nextCandle());
      fitRange(true);
      for (const cd of candles) addParticles(cd, true);
      start = last = performance.now();
      measureText();
    };

    const drawGrid = () => {
      ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.16)`;
      for (let i = 0; i <= 4; i++) {
        const gy = top + ((bottom - top) * i) / 4;
        for (let gx = left; gx <= right; gx += 9) ctx.fillRect(gx, gy, 1.2, 1.2);
      }
    };

    const drawLabel = (x: number, y: number, now: number, fade: number) => {
      const pulse = ((now / 1000) % 1.6) / 1.6;
      ctx.strokeStyle = `rgba(${DOWN[0]},${DOWN[1]},${DOWN[2]},${(1 - pulse) * 0.8 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(${DOWN[0]},${DOWN[1]},${DOWN[2]},${fade})`;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      // label to the lower-left, with a thin rule on its right
      const lx = x - 28, ly = y + 40;
      ctx.fillRect(lx, ly - 10, 1, 34);
      ctx.textAlign = "right";
      ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText("RISK: HIGH", lx - 10, ly + 2);
      ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${0.65 * fade})`;
      ctx.fillText("checked by two agents", lx - 10, ly + 18);
    };

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      const intro = Math.min(t / 2.4, 1);

      // advance the tape once the intro has settled
      if (!reduced && t > 2.2) scroll += dt * CANDLES_PER_SEC;
      while (candles.length && candles[0].k < scroll - 1) candles.shift();
      while (nextK <= Math.floor(scroll) + n) { const cd = nextCandle(); candles.push(cd); addParticles(cd, false); }
      fitRange(false);

      const pull = 0.012 + intro * 0.05;
      const R = mobile ? 70 : 130;
      for (let i = shocks.length - 1; i >= 0; i--) if (now - shocks[i].t > 900) shocks.splice(i, 1);
      drawGrid();

      const liveK = Math.floor(scroll) + n;
      const form = scroll - Math.floor(scroll); // how far the newest candle has formed (0..1)
      const bodyW = step * 0.56;
      let label: { x: number; y: number; fade: number } | null = null;

      for (const cd of candles) {
        const cx = xOf(cd.k);
        // the newest candle grows from its open, with a little live jitter
        let c = cd.c, h = cd.h, l = cd.l;
        if (cd.k === liveK && !reduced) {
          const e = 1 - (1 - form) ** 2;
          c = cd.o + (cd.c - cd.o) * e + Math.sin(now / 180) * 0.35 * (1 - e);
          h = Math.max(cd.o, c) + (cd.h - Math.max(cd.o, cd.c)) * e;
          l = Math.min(cd.o, c) - (Math.min(cd.o, cd.c) - cd.l) * e;
        }
        const color = c >= cd.o ? UP : DOWN;
        const yTop = yOf(Math.max(cd.o, c)), yBot = Math.max(yOf(Math.min(cd.o, c)), yTop + gap);
        const yH = yOf(h), yL = yOf(l);
        // fade in at the right edge, out at the left edge
        const edge = Math.max(0, Math.min(1, (cx - left + step) / (step * 4), (right + step - cx) / (step * 2)));

        for (const p of cd.parts) {
          const hx = p.wick ? cx : cx + p.fx * bodyW;
          const hy = p.wick ? yH + (yL - yH) * p.fy : yTop + (yBot - yTop) * p.fy;
          let ax = (hx - p.x) * pull, ay = (hy - p.y) * pull;
          if (mouse.active) {
            const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) ** 2 * 9; ax += (dx / d) * f; ay += (dy / d) * f; }
          }
          for (const s of shocks) {
            const age = (now - s.t) / 900, ring = age * 420;
            const dx = p.x - s.x, dy = p.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1, band = Math.abs(d - ring);
            if (band < 40) { const f = (1 - band / 40) * 14 * (1 - age); ax += (dx / d) * f; ay += (dy / d) * f; }
          }
          p.vx = (p.vx + ax) * 0.84; p.vy = (p.vy + ay) * 0.84;
          p.x += p.vx; p.y += p.vy;
          const speed = Math.min(Math.abs(p.vx) + Math.abs(p.vy), 12);
          const alpha = Math.min(1, p.a * (0.35 + intro * 0.65) * edge + speed * 0.04 * edge) * textFade(p.x, p.y);
          ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        if (cd.shock && cd.k < liveK && cx > left + step * 14) label = { x: cx, y: yL, fade: Math.min(1, intro, edge, (liveK - cd.k) / 2) };
      }
      if (label) drawLabel(label.x, label.y, now, label.fade);
      raf = requestAnimationFrame(tick);
    };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    };
    const leave = () => { mouse.active = false; };
    const click = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      shocks.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
    };
    let resizeT: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(resizeT); resizeT = setTimeout(build, 150); };

    build();
    raf = requestAnimationFrame(tick);
    const remeasure = setInterval(measureText, 1000); // text animates in and fonts load after start
    const host = canvas.parentElement!;
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("pointerdown", click);
    window.addEventListener("resize", resize);
    // pause when off-screen
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); clearInterval(remeasure);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointerdown", click);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
