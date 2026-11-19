"use client";
import { useEffect } from "react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Mesin animasi landing Aprez Locale. Tidak merender apa pun; ia hanya menggerakkan elemen di dalam `.lp`:
 * elemen muncul saat terlihat, foto bergerak lebih lambat di dalam bingkainya (`data-par`), foto dan daun hero
 * melayang beda kecepatan (`data-hero`) dan mengikuti kursor, dua pita bersilang, foto signature yang berganti
 * dengan sapuan, kartu "sepanjang hari" yang bertumpuk, kolom minuman yang bergeser (`data-drift`),
 * pita foto yang melebar, dan HP peraga alur pesan.
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
    $$(".lp-rv").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* --- elemen yang digerakkan scroll --- */
    const bar = $(".lp-progress");
    const header = $(".lp-hdr");
    const hero = $(".ap-hero");
    const heroEls = $$("[data-hero]");
    const spins = $$("[data-spin]");
    const ghost = $("[data-heroghost]");
    const ticks = $$("[data-tick]");
    const pars = $$("[data-par]").map((el) => ({ el, k: Number(el.dataset.par), box: el.parentElement as HTMLElement }));
    const drifts = $$("[data-drift]").map((el) => ({ el, k: Number(el.dataset.drift), dy: 0 }));

    const sig = $(".ap-sig");
    const sigCards = $$(".ap-sig-card");
    const sigShots = $$(".ap-shot");
    const sigImgs = sigShots.map((sh) => sh.querySelector<HTMLElement>("img"));
    const sigDots = $$(".ap-sig-dots i");
    const sigChips = sigCards.map((c) => Array.from(c.querySelectorAll<HTMLElement>(".ap-chips li")));
    const sigCount = $(".ap-sig-count b");

    const dcards = $$(".ap-dcard");
    const dinner = dcards.map((c) => c.firstElementChild as HTMLElement | null);
    const band = $(".ap-band");
    const bandIn = $(".ap-band-in");

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
      if (bar) bar.style.transform = `scaleX(${clamp(y / Math.max(1, document.documentElement.scrollHeight - vh))})`;
      header?.classList.toggle("lp-scrolled", y > 8);
      const rs = clamp(vw / 1200, 0.45, 1);

      /* hero: foto dan daun melayang beda kecepatan, mangkuk berputar pelan, tulisan LOCALE bergeser */
      const hy = Math.min(y, hero?.offsetHeight ?? vh);
      for (const el of heroEls) el.style.translate = on ? `0 ${(hy * Number(el.dataset.hero) * rs).toFixed(1)}px` : "";
      for (const el of spins) el.style.transform = on ? `rotate(${(y * Number(el.dataset.spin)).toFixed(1)}deg)` : "";
      if (ghost) ghost.style.transform = on ? `translate3d(${(-hy * 0.4).toFixed(1)}px,0,0)` : "";

      /* dua pita bersilang bergerak berlawanan */
      for (const t of ticks) {
        const loop = t.scrollWidth / 4 || 1;
        const dir = Number(t.dataset.tick);
        const x = (y * 0.5) % loop;
        t.style.transform = `translate3d(${(dir > 0 ? -x : x - loop).toFixed(1)}px,0,0)`;
      }

      /* foto bergerak lebih lambat di dalam bingkainya */
      for (const { el, k, box } of pars) {
        const r = box.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) continue;
        const t = on ? clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1) : 0;
        el.style.transform = `translate3d(0,${(-t * k * r.height).toFixed(1)}px,0)`;
      }

      /* elemen yang bergeser relatif terhadap tengah layar */
      for (const d of drifts) {
        const r = d.el.getBoundingClientRect();
        if (r.bottom < -240 || r.top > vh + 240) continue;
        const t = on ? clamp((r.top - d.dy + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1) : 0;
        d.dy = t * d.k * rs;
        d.el.style.translate = `0 ${d.dy.toFixed(1)}px`;
      }

      /* signature: tiga foto bergantian dengan sapuan dari bawah, bahan muncul satu per satu */
      if (sig && sigShots.length) {
        const n = sigShots.length;
        const p = nopin ? autoStep % n : pinProgress(sig) * n;
        const idx = Math.min(n - 1, Math.floor(p));
        const q = nopin ? 1 : clamp((p - idx) * 1.6);
        /* teks berganti sedikit lebih awal, saat foto berikutnya mulai menyapu */
        const lead = nopin ? idx : Math.min(n - 1, Math.floor(p + 0.15));
        sigCards.forEach((c, i) => c.classList.toggle("lp-on", i === lead));
        sigDots.forEach((d, i) => d.classList.toggle("lp-on", i === lead));
        if (sigCount) sigCount.textContent = String(lead + 1).padStart(2, "0");
        sigShots.forEach((sh, i) => {
          const open = i === 0 ? 1 : nopin ? (i <= idx ? 1 : 0) : smooth(clamp((p - (i - 0.3)) / 0.3));
          sh.style.clipPath = `inset(${((1 - open) * 100).toFixed(2)}% 0 0 0)`;
          const img = sigImgs[i];
          if (img) {
            const local = clamp(p - i + 0.3, 0, 1.3) / 1.3;
            img.style.transform = on && !nopin ? `scale(${(1.2 - local * 0.16).toFixed(4)})` : "";
          }
        });
        sigChips.forEach((chips, i) =>
          chips.forEach((li, j) => li.classList.toggle("lp-on", i === lead && (nopin || (i === idx && q >= (j + 0.4) / (chips.length + 1.5)))))
        );
      }

      /* sepanjang hari: kartu yang tertutup kartu berikutnya mengecil dan meredup */
      dcards.forEach((c, i) => {
        const next = dcards[i + 1];
        const el = dinner[i];
        if (!el) return;
        if (!next || !on || nopin) {
          el.style.transform = "";
          el.style.filter = "";
          return;
        }
        const r = c.getBoundingClientRect();
        const cover = clamp(1 - (next.getBoundingClientRect().top - r.top) / Math.max(1, r.height));
        el.style.transform = `scale(${(1 - cover * 0.06).toFixed(4)})`;
        el.style.filter = cover > 0.01 ? `brightness(${(1 - cover * 0.2).toFixed(3)})` : "";
      });

      /* pita foto ruang makan: dari kartu membulat melebar sampai penuh */
      if (band && bandIn) {
        const r = band.getBoundingClientRect();
        if (r.bottom > -80 && r.top < vh + 80) {
          const m = on ? (1 - smooth(clamp((vh - r.top) / (vh * 0.85)))) * 7 : 0;
          bandIn.style.clipPath = `inset(${(m * 0.6).toFixed(2)}% ${m.toFixed(2)}% round ${(m * 6).toFixed(1)}px)`;
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

    /* --- hero mengikuti kursor (hanya perangkat dengan mouse) --- */
    if (hero && matchMedia("(hover:hover) and (pointer:fine)").matches) {
      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;
      let raf = 0;
      const tick = () => {
        cx = lerp(cx, tx, 0.08);
        cy = lerp(cy, ty, 0.08);
        hero.style.setProperty("--mx", cx.toFixed(3));
        hero.style.setProperty("--my", cy.toFixed(3));
        raf = Math.abs(cx - tx) + Math.abs(cy - ty) > 0.002 ? requestAnimationFrame(tick) : 0;
      };
      const onMove = (e: PointerEvent) => {
        if (reduceMq.matches) return;
        const r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(tick);
      };
      hero.addEventListener("pointermove", onMove);
      cleanups.push(() => {
        hero.removeEventListener("pointermove", onMove);
        cancelAnimationFrame(raf);
      });
    }

    return () => {
      alive = false;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
