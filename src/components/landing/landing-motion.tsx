"use client";
import { useEffect } from "react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(",")})`;

type Bean = { x: number; y: number; r: number; a: number; va: number; vy: number; sway: number; o: number };

/**
 * Mesin animasi landing page: elemen muncul saat terlihat, parallax, cangkir terisi,
 * HP peraga alur pesan, biji kopi berjatuhan. Tidak merender apa pun; ia hanya
 * menggerakkan elemen di dalam `.lp` lewat atribut `data-*`.
 * Tanpa library: IntersectionObserver + satu requestAnimationFrame per scroll.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
    const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));
    const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
    const flatMq = matchMedia("(max-height: 520px)"); // layar pendek: tanpa bagian yang "menahan"
    const cleanups: (() => void)[] = [];
    let alive = true;

    root.classList.add("lp-js");
    cleanups.push(() => root.classList.remove("lp-js"));

    /* --- angka menghitung naik --- */
    const tween = (ms: number, fn: (e: number) => void) => {
      if (reduceMq.matches) return fn(1);
      const t0 = performance.now();
      const step = (t: number) => {
        if (!alive) return;
        const p = clamp((t - t0) / ms);
        fn(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const countUp = (el: HTMLElement) => {
      const final = el.textContent ?? "";
      const to = Number(el.dataset.count);
      const dec = Number(el.dataset.dec || 0);
      const prefix = el.dataset.prefix ?? "";
      if (!Number.isFinite(to)) return;
      const fmt = new Intl.NumberFormat("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const stepSize = Number(el.dataset.step || 0);
      tween(Number(el.dataset.ms || 1500), (e) => {
        if (e >= 1) return void (el.textContent = final);
        const v = to * e;
        el.textContent = prefix + fmt.format(stepSize ? Math.round(v / stepSize) * stepSize : v);
      });
    };

    /* --- muncul saat terlihat --- */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add("lp-in");
          io.unobserve(el);
          if (el.dataset.count) countUp(el);
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    $$("[data-io]").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* --- foto miring mengikuti kursor (hanya perangkat dengan mouse) --- */
    if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMq.matches) {
      for (const el of $$(".lp-tilt")) {
        const move = (ev: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = (ev.clientX - r.left) / r.width - 0.5;
          const y = (ev.clientY - r.top) / r.height - 0.5;
          el.style.transform = `rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg) translateY(-4px)`;
        };
        const leave = () => (el.style.transform = "");
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        });
      }
    }

    /* --- elemen yang digerakkan scroll --- */
    const bar = $(".lp-progress");
    const header = $(".lp-header");
    const plx = $$("[data-plx]");
    const inner = $$("[data-plx-inner]");
    const bands = $$("[data-band],[data-band-x]");
    const ribbon = $(".lp-ribbon-track");
    const brew = $(".lp-brew");
    const caps = $$(".lp-cap");
    const dots = $$(".lp-dots i");
    const liquid = $<SVGGElement>("[data-cup=liquid]");
    const wave = $<SVGPathElement>("[data-cup=wave]");
    const foam = $<SVGElement>("[data-cup=foam]");
    const art = $<SVGElement>("[data-cup=art]");
    const stream = $<SVGRectElement>("[data-cup=stream]");
    const steam = $<SVGGElement>("[data-cup=steam]");
    const flow = $(".lp-flow");
    const steps = $$(".lp-steps li:not(.lp-rail)");
    const rail = $(".lp-rail i");
    const screens = $$(".lp-scr");
    const bubbles = $$(".lp-bub");
    const phone = $(".lp-phone");
    const navLinks = $$<HTMLAnchorElement>(".lp-nav a");
    const navTargets = navLinks.map((a) => document.getElementById(a.getAttribute("href")?.slice(1) ?? ""));

    let vh = window.innerHeight;
    let vw = window.innerWidth;
    let lastY = window.scrollY;
    let vel = 0;
    let autoStep = 0;
    let ticking = false;
    const pinProgress = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - vh));
    };

    const frame = () => {
      ticking = false;
      if (!alive) return;
      const y = window.scrollY;
      const reduce = reduceMq.matches;
      const flat = flatMq.matches;
      vel = lerp(vel, y - lastY, 0.2);
      lastY = y;
      if (bar) bar.style.transform = `scaleX(${clamp(y / Math.max(1, document.documentElement.scrollHeight - vh))})`;
      header?.classList.toggle("lp-scrolled", y > 8);

      /* parallax: kekuatan mengecil di layar sempit agar tidak bertabrakan */
      const k = reduce ? 0 : clamp(vw / 1280, 0.45, 1);
      for (const el of plx) {
        const r = (el.parentElement ?? el).getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const t = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = k ? `translate3d(0,${(t * Number(el.dataset.plx) * k).toFixed(1)}px,0)` : "";
      }
      for (const el of inner) {
        const r = (el.parentElement ?? el).getBoundingClientRect();
        if (r.bottom < -60 || r.top > vh + 60) continue;
        const t = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = k ? `translate3d(0,${(-t * Number(el.dataset.plxInner) * k).toFixed(1)}px,0)` : "";
      }
      for (const el of bands) {
        const r = (el.parentElement ?? el).getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        const t = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        const kb = reduce ? 0 : clamp(vw / 1100, 0.55, 1);
        el.style.transform = el.dataset.bandX
          ? `translate3d(${(t * kb * Number(el.dataset.bandX)).toFixed(1)}px,0,0)`
          : `translate3d(0,${(-t * kb * Number(el.dataset.band)).toFixed(1)}px,0)`;
      }
      if (ribbon) {
        const loop = ribbon.scrollWidth / 4 || 1;
        ribbon.style.transform = `translate3d(${-((y * 0.45) % loop).toFixed(1)}px,0,0)`;
      }

      /* cangkir terisi */
      if (brew && liquid && wave && stream) {
        const p = flat ? 1 : pinProgress(brew);
        const fill = clamp((p - 0.04) / 0.8);
        const level = lerp(262, 104, fill);
        liquid.setAttribute("transform", `translate(0,${level.toFixed(1)})`);
        wave.setAttribute("fill", mix([59, 36, 22], [176, 124, 78], clamp((fill - 0.4) / 0.45)));
        stream.setAttribute("opacity", fill > 0.01 && fill < 0.97 ? "1" : "0");
        stream.setAttribute("fill", fill < 0.4 ? "#3b2416" : "#f3e7c9");
        stream.setAttribute("height", String(level + 46));
        const done = String(clamp((p - 0.86) / 0.08));
        foam?.setAttribute("opacity", done);
        art?.setAttribute("opacity", done);
        steam?.setAttribute("opacity", done);
        const ci = p < 0.36 ? 0 : p < 0.8 ? 1 : 2;
        caps.forEach((c, i) => c.classList.toggle("lp-on", i === ci));
        dots.forEach((d, i) =>
          d.style.setProperty("--f", String(clamp(i === 0 ? p / 0.36 : i === 1 ? (p - 0.36) / 0.44 : (p - 0.8) / 0.2)))
        );
      }

      /* HP memperagakan alur pesan */
      if (flow && screens.length) {
        const q = flat ? (autoStep + 0.5) / screens.length : pinProgress(flow);
        const si = Math.min(screens.length - 1, Math.floor(q * screens.length));
        steps.forEach((s, i) => s.classList.toggle("lp-on", i === si));
        rail?.style.setProperty("--f", String(clamp((q * screens.length) / (screens.length - 1))));
        screens.forEach((s, i) => {
          s.classList.toggle("lp-on", i === si);
          s.classList.toggle("lp-past", i < si);
        });
        bubbles.forEach((b) => b.classList.toggle("lp-on", Number(b.dataset.at) === si));
        if (phone)
          phone.style.transform =
            reduce || flat ? "" : `rotate(${lerp(-3, 3, q).toFixed(2)}deg) translateY(${(Math.sin(q * Math.PI * 4) * 6).toFixed(1)}px)`;
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
    const onResize = () => {
      vh = window.innerHeight;
      vw = window.innerWidth;
      request();
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", onResize);
    flatMq.addEventListener("change", request);
    // di layar pendek tidak ada scroll yang menggerakkan HP, jadi layarnya berganti sendiri
    const auto = window.setInterval(() => {
      if (!flatMq.matches) return;
      autoStep = (autoStep + 1) % 4;
      request();
    }, 3200);
    frame();
    cleanups.push(() => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", onResize);
      flatMq.removeEventListener("change", request);
      window.clearInterval(auto);
    });

    /* --- biji kopi berjatuhan (canvas), hanya digambar saat terlihat --- */
    const fields = $$<HTMLCanvasElement>("canvas.lp-beans").flatMap((cv) => {
      const ctx = cv.getContext("2d");
      if (!ctx) return [];
      const few = cv.dataset.few === "1";
      let W = 0;
      let H = 0;
      let visible = false;
      let beans: Bean[] = [];
      const make = (top: boolean): Bean => ({
        x: Math.random() * W,
        y: top ? -30 : Math.random() * H,
        r: 7 + Math.random() * 10,
        a: Math.random() * 6.28,
        va: (Math.random() - 0.5) * 0.012,
        vy: 0.18 + Math.random() * 0.4,
        sway: Math.random() * 6.28,
        o: 0.08 + Math.random() * 0.14,
      });
      const size = () => {
        const r = cv.getBoundingClientRect();
        const d = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        cv.width = Math.round(W * d);
        cv.height = Math.round(H * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const n = Math.round((few ? 7 : 16) * Math.min(1, W / 900 + 0.3));
        while (beans.length < n) beans.push(make(false));
        beans = beans.slice(0, n);
      };
      const ro = new ResizeObserver(size);
      ro.observe(cv);
      const vis = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
      vis.observe(cv);
      cleanups.push(() => {
        ro.disconnect();
        vis.disconnect();
      });
      size();
      return [
        () => {
          if (!visible || reduceMq.matches) return;
          ctx.clearRect(0, 0, W, H);
          for (const b of beans) {
            b.y += (b.vy + Math.abs(vel) * 0.05) * 1.2;
            b.a += b.va + vel * 0.0006;
            b.sway += 0.008;
            b.x += Math.sin(b.sway) * 0.25;
            if (b.y > H + 30) Object.assign(b, make(true));
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.a);
            ctx.fillStyle = `rgba(243,231,201,${b.o})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, b.r * 0.68, b.r, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(74,77,56,.55)";
            ctx.lineWidth = Math.max(1, b.r * 0.12);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(0, -b.r * 0.82);
            ctx.bezierCurveTo(b.r * 0.42, -b.r * 0.3, -b.r * 0.42, b.r * 0.3, 0, b.r * 0.82);
            ctx.stroke();
            ctx.restore();
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
