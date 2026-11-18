"use client";
import { useEffect } from "react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(",")})`;

/** Warna biji kopi dari hijau (mentah) sampai cokelat tua (matang) */
const ROAST = [
  [143, 168, 112],
  [201, 165, 90],
  [154, 98, 52],
  [84, 48, 27],
];
const roastColor = (t: number, dark = 1) => {
  const x = clamp(t) * 3;
  const i = Math.min(2, Math.floor(x));
  return mix(
    ROAST[i].map((v) => v * dark),
    ROAST[i + 1].map((v) => v * dark),
    x - i
  );
};
const STAGES = ["Green bean", "Sedang di-roasting", "Siap diseduh"];

type Bean = { x: number; y: number; r: number; a: number; va: number; vy: number; sway: number; o: number };

/**
 * Mesin animasi landing page: elemen muncul saat terlihat, parallax berlapis, biji kopi
 * yang di-roasting, kartu yang bergeser ke samping, HP peraga alur pesan, biji kopi berjatuhan.
 * Tidak merender apa pun; ia hanya menggerakkan elemen di dalam `.lp`.
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
      if (!Number.isFinite(to)) return;
      const dec = Number(el.dataset.dec || 0);
      const stepSize = Number(el.dataset.step || 0);
      const prefix = el.dataset.prefix ?? "";
      const fmt = new Intl.NumberFormat("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec });
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
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    $$(".lp-rv,.lp-io").forEach((el) => io.observe(el));
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
    const header = $(".lp-hdr");
    const hero = $(".lp-hero");
    const heroEls = $$("[data-hero]");
    const heroGhost = $("[data-heroghost]");
    const inner = $$("[data-inner]");
    const bands = $$(".lp-band").map((b) => ({
      b,
      bg: b.querySelector<HTMLElement>("[data-band]"),
      ghost: b.querySelector<HTMLElement>("[data-bandx]"),
      text: b.querySelector<HTMLElement>("[data-bandin]"),
    }));
    const layers = $$("[data-plx]").map((el) => ({ el, s: Number(el.dataset.plx), top: 0, h: 0 }));
    const ribbon = $(".lp-rtrack");
    const roast = $(".lp-roast");
    const caps = $$(".lp-roast .lp-cap");
    const dots = $$(".lp-roast .lp-dots i");
    const origins = $$(".lp-origins span");
    const arc = $<SVGCircleElement>("[data-roast=arc]");
    const orbit = $<SVGGElement>("[data-roast=orbit]");
    const bean = $<SVGGElement>("[data-roast=bean]");
    const beanFill = $<SVGEllipseElement>("[data-roast=fill]");
    const crease = $<SVGPathElement>("[data-roast=crease]");
    const smoke = $<SVGGElement>("[data-roast=smoke]");
    const stage = $<SVGTextElement>("[data-roast=stage]");
    const day = $(".lp-day");
    const track = $(".lp-day .lp-track");
    const view = $(".lp-day .lp-view");
    const hbar = $(".lp-hbar i");
    const panels = $$(".lp-panel:not(.lp-end)").map((p) => ({
      p,
      img: p.querySelector<HTMLElement>("img"),
      num: p.querySelector<HTMLElement>(".lp-num"),
    }));
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
    let hh = 60;
    let nopin = false;
    let maxX = 0;
    let lastY = window.scrollY;
    let vel = 0;
    let autoStep = 0;
    let ticking = false;

    /** Seberapa jauh sebuah bagian yang "menahan" layar sudah dilewati (0..1) */
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

      /* skala gerak mengikuti ukuran layar: HP bergerak lebih sedikit dari desktop */
      const rs = clamp(vw / 1200, 0.42, 1);
      const unit = clamp(vh * 0.16, 60, 150) * rs;

      /* hero: lapisan foto + tulisan besar di belakang */
      const hy = Math.min(y, hero?.offsetHeight ?? vh);
      for (const el of heroEls) el.style.transform = on ? `translate3d(0,${(hy * Number(el.dataset.hero) * rs).toFixed(1)}px,0)` : "";
      if (heroGhost) heroGhost.style.transform = on ? `translate3d(${(-hy * 0.35).toFixed(1)}px,0,0)` : "";

      /* foto bertumpuk: posisi rancangan tepat saat berada di tengah layar */
      for (const o of layers) {
        const c = o.top + o.h / 2 - y - vh / 2;
        if (Math.abs(c) > vh) continue;
        o.el.style.transform = on ? `translate3d(0,${((c / vh) * o.s * unit).toFixed(1)}px,0)` : "";
      }
      /* foto bergeser di dalam bingkainya */
      for (const el of inner) {
        const r = (el.parentElement ?? el).getBoundingClientRect();
        if (r.bottom < -60 || r.top > vh + 60) continue;
        const t = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
        el.style.transform = on ? `translate3d(0,${(-t * r.height * 0.1).toFixed(1)}px,0)` : "";
      }
      /* jendela parallax: foto lebih lambat dari tulisan */
      for (const { b, bg, ghost, text } of bands) {
        const r = b.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        const t = on ? clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1) : 0;
        if (bg) bg.style.transform = `translate3d(0,${(-t * r.height * 0.17).toFixed(1)}px,0)`;
        if (text) text.style.transform = `translate3d(0,${(t * r.height * 0.1).toFixed(1)}px,0)`;
        if (ghost) ghost.style.transform = `translate3d(calc(-50% + ${(t * Number(ghost.dataset.bandx) * vw * 0.22).toFixed(1)}px),0,0)`;
      }
      if (ribbon) {
        const loop = ribbon.scrollWidth / 4 || 1;
        ribbon.style.transform = `translate3d(${(-((y * 0.45) % loop)).toFixed(1)}px,0,0)`;
      }

      /* roasting: biji kopi berubah warna */
      if (roast && beanFill) {
        const p = nopin ? 1 : pinProgress(roast);
        const rt = clamp((p - 0.05) / 0.8);
        beanFill.setAttribute("fill", roastColor(rt));
        crease?.setAttribute("stroke", roastColor(rt, 0.62));
        arc?.setAttribute("stroke-dashoffset", (917.4 * (1 - rt)).toFixed(1));
        orbit?.setAttribute("transform", `rotate(${(p * 200).toFixed(1)} 160 160)`);
        bean?.setAttribute(
          "transform",
          `rotate(${(-24 + (on ? p * 30 : 0)).toFixed(1)} 160 160) translate(160 160) scale(${(1 + rt * 0.1).toFixed(3)}) translate(-160 -160)`
        );
        smoke?.setAttribute("opacity", String(clamp((rt - 0.3) / 0.15) * (1 - clamp((p - 0.92) / 0.06) * 0.6)));
        const ci = p < 0.34 ? 0 : p < 0.7 ? 1 : 2;
        if (stage) stage.textContent = STAGES[ci];
        if (!nopin) caps.forEach((c, i) => c.classList.toggle("lp-on", i === ci));
        dots.forEach((d, i) => d.style.setProperty("--lp-f", String(clamp(i === 0 ? p / 0.34 : i === 1 ? (p - 0.34) / 0.36 : (p - 0.7) / 0.3))));
        origins.forEach((o, i) => o.classList.toggle("lp-on", p > 0.03 + i * 0.05));
      }

      /* sehari di Amalgam: scroll ke bawah, kartu bergeser ke samping */
      if (day && track) {
        if (nopin) track.style.transform = "";
        else {
          const dp = clamp((pinProgress(day) - 0.04) / 0.84);
          track.style.transform = `translate3d(${(-dp * maxX).toFixed(1)}px,0,0)`;
          hbar?.style.setProperty("--lp-f", String(dp));
        }
        for (const { p, img, num } of panels) {
          const r = p.getBoundingClientRect();
          if (r.right < -80 || r.left > vw + 80) continue;
          const t = on ? clamp((r.left + r.width / 2 - vw / 2) / (vw / 2 + r.width / 2), -1, 1) : 0;
          if (img) img.style.transform = `translate3d(${(-t * r.width * 0.1).toFixed(1)}px,0,0)`;
          if (num) num.style.transform = `translate3d(${(t * r.width * 0.16).toFixed(1)}px,0,0)`;
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
        if (phone)
          phone.style.transform =
            !on || nopin ? "" : `rotate(${lerp(-3, 3, q).toFixed(2)}deg) translateY(${(Math.sin(q * Math.PI * 4) * 6).toFixed(1)}px)`;
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

    /** Ukur ulang tiap ukuran layar berubah (putar HP, ubah jendela, font selesai dimuat) */
    const measure = () => {
      if (!alive) return;
      vw = document.documentElement.clientWidth;
      vh = window.innerHeight;
      hh = header?.offsetHeight ?? 60;
      // layar sangat pendek (HP mendatar) atau gerak dikurangi: tanpa bagian yang "menahan" layar
      nopin = reduceMq.matches || vh < 440;
      root.classList.toggle("lp-nopin", nopin);
      for (const o of layers) o.el.style.transform = "";
      for (const o of layers) {
        const r = o.el.getBoundingClientRect();
        o.top = r.top + window.scrollY;
        o.h = r.height;
      }
      maxX = track && view ? Math.max(0, track.scrollWidth - view.clientWidth) : 0;
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
    window.addEventListener("load", measure);
    reduceMq.addEventListener("change", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    // foto yang baru selesai dimuat bisa menggeser tata letak
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    // tanpa "menahan" layar tidak ada scroll yang menggerakkan HP, jadi layarnya berganti sendiri
    const auto = window.setInterval(() => {
      if (!nopin) return;
      autoStep += 1;
      request();
    }, 3200);
    measure();
    cleanups.push(() => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", measure);
      reduceMq.removeEventListener("change", measure);
      ro.disconnect();
      window.clearInterval(auto);
      window.clearTimeout(resizeTimer);
      root.classList.remove("lp-nopin");
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
        o: 0.07 + Math.random() * 0.12,
      });
      const size = () => {
        const r = cv.getBoundingClientRect();
        const d = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width;
        H = r.height;
        cv.width = Math.round(W * d);
        cv.height = Math.round(H * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const n = Math.round((few ? 7 : 16) * Math.min(1, W / 900 + 0.35));
        while (beans.length < n) beans.push(make(false));
        beans = beans.slice(0, n);
      };
      const sizeObserver = new ResizeObserver(size);
      sizeObserver.observe(cv);
      const vis = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
      vis.observe(cv);
      cleanups.push(() => {
        sizeObserver.disconnect();
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
            ctx.fillStyle = `rgba(244,241,227,${b.o})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, b.r * 0.68, b.r, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(6,58,36,.6)";
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
