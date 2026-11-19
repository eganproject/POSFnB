"use client";
import { useEffect } from "react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hhmm = (hour: number) => {
  const m = Math.round((hour * 60) / 10) * 10;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;
};

/** Warna langit per jam (fajar, siang, sore keemasan, senja, malam) */
const SKY: [number, [number, number, number]][] = [
  [6, [246, 201, 160]],
  [9, [246, 226, 196]],
  [12, [243, 233, 214]],
  [15.5, [240, 176, 128]],
  [17.5, [196, 104, 76]],
  [19, [35, 44, 69]],
];
const skyAt = (hour: number) => {
  let i = 1;
  while (i < SKY.length - 1 && hour > SKY[i][0]) i++;
  const [h0, c0] = SKY[i - 1];
  const [h1, c1] = SKY[i];
  const t = clamp((hour - h0) / (h1 - h0));
  return c0.map((v, k) => Math.round(lerp(v, c1[k], t))).join(" ");
};

type Wisp = { x: number; y: number; r: number; vy: number; sway: number; o: number; life: number };

/**
 * Mesin animasi landing Aprez Locale. Tidak merender apa pun; ia hanya menggerakkan elemen di dalam `.lp`:
 * elemen muncul saat terlihat, bahan-bahan hero melayang dengan kecepatan berbeda, dua pita bersilang,
 * piring signature yang tersusun mengikuti scroll, matahari yang berjalan di busur sepanjang hari,
 * jendela kota berlapis, HP peraga alur pesan, dan uap hangat yang naik.
 * Tanpa library: IntersectionObserver + satu requestAnimationFrame per scroll.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
    const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));
    const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
    const cleanups: (() => void)[] = [];
    let alive = true;

    /* --- angka menghitung naik --- */
    const countUp = (el: HTMLElement) => {
      const final = el.textContent ?? "";
      const to = Number(el.dataset.count);
      if (!Number.isFinite(to) || reduceMq.matches) return;
      const ms = Number(el.dataset.ms || 1500);
      const t0 = performance.now();
      const step = (t: number) => {
        if (!alive) return;
        const p = clamp((t - t0) / ms);
        el.textContent = p >= 1 ? final : String(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    /* --- muncul saat terlihat --- */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add("lp-in");
          io.unobserve(el);
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    $$(".lp-rv,.ap-room").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* --- elemen yang digerakkan scroll --- */
    const bar = $(".lp-progress");
    const header = $(".lp-hdr");
    const hero = $(".ap-hero");
    const heroEls = $$("[data-hero]");
    const ghost = $("[data-heroghost]");
    const ticks = $$("[data-tick]");

    const sig = $(".ap-sig");
    const sigCards = $$(".ap-sig-card");
    const sigPlates = $$(".ap-plate-slot");
    const sigDots = $$(".ap-sig-dots i");
    const sigParts = sigPlates.map((p) => Array.from(p.querySelectorAll<SVGGElement>(".ap-part")).map((g) => ({ g, at: Number(g.dataset.at) })));
    const sigItems = sigCards.map((c) => Array.from(c.querySelectorAll<HTMLElement>("li")));
    const chop = $(".ap-chop");

    const day = $(".ap-day");
    const moments = $$(".ap-moment");
    const orb = $(".ap-orb");
    const arcDone = $<SVGPathElement>(".ap-arc-done");
    const timeB = $(".ap-time b");
    const timeS = $(".ap-time span");

    const win = $(".ap-window");
    const winLayers = $$(".ap-window [data-band]");
    const winText = $(".ap-window [data-bandin]");

    const flow = $(".lp-flow");
    const steps = $$(".lp-steps li:not(.lp-rail)");
    const rail = $(".lp-rail i");
    const screens = $$(".lp-scr");
    const bubbles = $$(".lp-bub");
    const phone = $(".lp-phone");
    const navLinks = $$<HTMLAnchorElement>(".lp-nav a");
    const navTargets = navLinks.map((a) => document.getElementById(a.getAttribute("href")?.slice(1) ?? ""));

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let hh = 64;
    let nopin = false;
    let autoStep = 0;
    let ticking = false;
    let lastY = window.scrollY;
    let vel = 0;

    /** Seberapa jauh bagian yang "menahan" layar sudah dilewati (0..1) */
    const pinProgress = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const pin = el.firstElementChild as HTMLElement | null;
      return clamp((hh - r.top) / Math.max(1, r.height - (pin?.offsetHeight ?? vh)));
    };

    const frame = () => {
      ticking = false;
      if (!alive) return;
      const y = window.scrollY;
      const on = !reduceMq.matches;
      vel = lerp(vel, y - lastY, 0.2);
      lastY = y;
      if (bar) bar.style.transform = `scaleX(${clamp(y / Math.max(1, document.documentElement.scrollHeight - vh))})`;
      header?.classList.toggle("lp-scrolled", y > 8);
      const rs = clamp(vw / 1200, 0.45, 1);

      /* hero: bahan melayang beda kecepatan, tulisan LOCALE bergeser */
      const hy = Math.min(y, hero?.offsetHeight ?? vh);
      for (const el of heroEls) el.style.translate = on ? `0 ${(hy * Number(el.dataset.hero) * rs).toFixed(1)}px` : "";
      if (ghost) ghost.style.transform = on ? `translate3d(${(-hy * 0.4).toFixed(1)}px,0,0)` : "";

      /* dua pita bersilang bergerak berlawanan */
      for (const t of ticks) {
        const loop = t.scrollWidth / 4 || 1;
        const dir = Number(t.dataset.tick);
        const x = (y * 0.5) % loop;
        t.style.transform = `translate3d(${(dir > 0 ? -x : x - loop).toFixed(1)}px,0,0)`;
      }

      /* signature: tiga piring bergantian, isi piring muncul satu per satu */
      if (sig && sigPlates.length) {
        const n = sigPlates.length;
        let idx: number;
        let q: number;
        if (nopin) {
          idx = autoStep % n;
          q = 1;
        } else {
          const p = pinProgress(sig) * n;
          idx = Math.min(n - 1, Math.floor(p));
          q = clamp((p - idx) * 1.25);
        }
        sigCards.forEach((c, i) => c.classList.toggle("lp-on", i === idx));
        sigPlates.forEach((pl, i) => {
          pl.classList.toggle("lp-on", i === idx);
          pl.classList.toggle("lp-past", i < idx);
        });
        sigDots.forEach((d, i) => d.classList.toggle("lp-on", i === idx));
        sigParts.forEach((parts, i) =>
          parts.forEach(({ g, at }, j) => {
            const shown = i < idx || (i === idx && q >= at);
            g.classList.toggle("lp-on", shown);
            sigItems[i]?.[j]?.classList.toggle("lp-on", shown);
          })
        );
        if (chop) chop.style.transform = on && !nopin ? `rotate(${lerp(-18, 8, q).toFixed(1)}deg) translateY(${(Math.sin(q * Math.PI) * -14).toFixed(1)}px)` : "";
      }

      /* sepanjang hari: jam mengikuti kartu yang sedang di tengah layar */
      if (day && moments.length) {
        const mid = vh * 0.55;
        const pts = moments.map((m) => {
          const r = m.getBoundingClientRect();
          return { m, c: r.top + r.height / 2, hour: Number(m.dataset.hour), title: m.dataset.title ?? "" };
        });
        let hour = pts[0].hour;
        let active = 0;
        if (mid >= pts[pts.length - 1].c) {
          hour = pts[pts.length - 1].hour + clamp((mid - pts[pts.length - 1].c) / 300) * 2;
          active = pts.length - 1;
        } else if (mid > pts[0].c) {
          for (let i = 1; i < pts.length; i++) {
            if (mid <= pts[i].c) {
              const f = clamp((mid - pts[i - 1].c) / Math.max(1, pts[i].c - pts[i - 1].c));
              hour = lerp(pts[i - 1].hour, pts[i].hour, f);
              active = f > 0.5 ? i : i - 1;
              break;
            }
          }
        }
        moments.forEach((m, i) => m.classList.toggle("lp-on", i === active));
        const t = clamp((hour - 6) / 15);
        day.style.setProperty("--ap-sky", skyAt(hour));
        day.style.setProperty("--ap-night", clamp((hour - 17.5) / 1.5).toFixed(3));
        day.classList.toggle("ap-dark", hour > 17.6);
        orb?.classList.toggle("ap-moon", hour > 18.4);
        if (orb) {
          const th = Math.PI * lerp(0.06, 0.94, t);
          orb.style.left = `${((200 - 180 * Math.cos(th)) / 4).toFixed(2)}%`;
          orb.style.top = `${((210 - 180 * Math.sin(th)) / 2.3).toFixed(2)}%`;
        }
        if (arcDone) arcDone.style.strokeDashoffset = (1 - t).toFixed(3);
        if (timeB) timeB.textContent = hhmm(hour);
        if (timeS) timeS.textContent = pts[active].title;
      }

      /* jendela kota: lapisan jauh bergerak paling lambat */
      if (win) {
        const r = win.getBoundingClientRect();
        if (r.bottom > -80 && r.top < vh + 80) {
          const t = on ? clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1) : 0;
          for (const l of winLayers) l.style.transform = `translate3d(0,${(t * r.height * Number(l.dataset.band)).toFixed(1)}px,0)`;
          if (winText) winText.style.transform = `translate3d(0,${(-t * r.height * 0.08).toFixed(1)}px,0)`;
        }
      }

      /* HP memperagakan alur pesan */
      if (flow && screens.length) {
        const n = screens.length;
        const q = nopin ? 0 : pinProgress(flow);
        const si = nopin ? autoStep % n : Math.min(n - 1, Math.floor(q * n));
        steps.forEach((s, i) => s.classList.toggle("lp-on", i === si));
        rail?.style.setProperty("--lp-f", String(nopin ? si / (n - 1) : clamp((q * n) / (n - 1))));
        screens.forEach((s, i) => {
          s.classList.toggle("lp-on", i === si);
          s.classList.toggle("lp-past", i < si);
        });
        bubbles.forEach((b) => b.classList.toggle("lp-on", Number(b.dataset.at) === si));
        if (phone) phone.style.transform = !on || nopin ? "" : `rotate(${lerp(-3, 3, q).toFixed(2)}deg) translateY(${(Math.sin(q * Math.PI * 4) * 6).toFixed(1)}px)`;
      }

      /* menu navigasi yang sedang aktif */
      let cur = -1;
      navTargets.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top < vh * 0.45) cur = i;
      });
      navLinks.forEach((a, i) => a.classList.toggle("lp-on", i === cur));
    };
    const request = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    };

    const measure = () => {
      if (!alive) return;
      vw = document.documentElement.clientWidth;
      vh = window.innerHeight;
      hh = header?.offsetHeight ?? 64;
      root.style.setProperty("--lp-hh", `${hh}px`);
      nopin = reduceMq.matches || vh < 440;
      root.classList.toggle("lp-nopin", nopin);
      frame();
    };
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 80);
      request();
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", onResize);
    reduceMq.addEventListener("change", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    const auto = window.setInterval(() => {
      if (!nopin) return;
      autoStep += 1;
      request();
    }, 3600);
    measure();
    cleanups.push(() => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", onResize);
      reduceMq.removeEventListener("change", measure);
      window.clearInterval(auto);
      window.clearTimeout(resizeTimer);
      root.classList.remove("lp-nopin");
    });

    /* --- uap hangat yang naik (canvas), hanya digambar saat terlihat --- */
    const fields = $$<HTMLCanvasElement>("canvas.ap-steamfx").flatMap((cv) => {
      const ctx = cv.getContext("2d");
      if (!ctx) return [];
      const few = cv.dataset.few === "1";
      let W = 0;
      let H = 0;
      let visible = false;
      let wisps: Wisp[] = [];
      const make = (fresh: boolean): Wisp => ({
        x: Math.random() * W,
        y: fresh ? H + 40 : Math.random() * H,
        r: 30 + Math.random() * 70,
        vy: 0.25 + Math.random() * 0.45,
        sway: Math.random() * 6.28,
        o: 0.05 + Math.random() * 0.08,
        life: 0,
      });
      const size = () => {
        const r = cv.getBoundingClientRect();
        const d = Math.min(window.devicePixelRatio || 1, 1.5);
        W = r.width;
        H = r.height;
        cv.width = Math.round(W * d);
        cv.height = Math.round(H * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const n = Math.round((few ? 8 : 14) * Math.min(1, W / 900 + 0.4));
        while (wisps.length < n) wisps.push(make(false));
        wisps = wisps.slice(0, n);
      };
      const so = new ResizeObserver(size);
      so.observe(cv);
      const vis = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
      vis.observe(cv);
      cleanups.push(() => {
        so.disconnect();
        vis.disconnect();
      });
      size();
      const tint = getComputedStyle(cv).color || "rgb(255,255,255)";
      const rgb = tint.match(/\d+/g)?.slice(0, 3).join(",") ?? "255,255,255";
      return [
        () => {
          if (!visible || reduceMq.matches) return;
          ctx.clearRect(0, 0, W, H);
          for (const w of wisps) {
            w.y -= w.vy + Math.abs(vel) * 0.03;
            w.sway += 0.01;
            w.x += Math.sin(w.sway) * 0.4;
            w.life = clamp(w.life + 0.01);
            if (w.y < -w.r * 2) Object.assign(w, make(true));
            const fade = w.life * clamp(w.y / (H * 0.6));
            const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
            g.addColorStop(0, `rgba(${rgb},${(w.o * fade).toFixed(3)})`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      ];
    });
    let raf = 0;
    const loop = () => {
      vel *= 0.92;
      if (!document.hidden) fields.forEach((draw) => draw());
      raf = requestAnimationFrame(loop);
    };
    if (fields.length) raf = requestAnimationFrame(loop);
    cleanups.push(() => cancelAnimationFrame(raf));

    return () => {
      alive = false;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
