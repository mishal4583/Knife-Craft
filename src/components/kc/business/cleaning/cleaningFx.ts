/**
 * CLEANING_FX — the cleaning mini-game's feel: soap suds where a sponge works,
 * dust puffs behind a broom, water drops from a mop, scraped flakes, and a
 * burst of sparkles with a shine ring when a stain is gone. Drawn on its own
 * canvas over the dirt in scene coordinates; one animation loop that runs
 * only while something is alive and stops when the last particle fades.
 * Seeded (no Math.random). Off entirely under Reduced Motion.
 */
import { seeded, type CleaningToolId } from "@/game/restaurant/cleaningDirt";

type Kind = "bubble" | "dust" | "drop" | "flake" | "spark" | "ring";
type P = {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  hue: number;
};

const MAX = 220;

export class CleaningFx {
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private rnd = seeded(20261021);
  /** Particles made so far (tests read it). */
  spawned = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
  ) {
    canvas.width = width;
    canvas.height = height;
  }

  private add(p: Omit<P, "age">) {
    if (this.ps.length >= MAX) this.ps.shift();
    this.ps.push({ ...p, age: 0 });
    this.spawned++;
    this.canvas.dataset["fxSpawned"] = String(this.spawned);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  /** The tool working over dirt at (x, y): suds, dust, drops or flakes. */
  scrub(tool: CleaningToolId, x: number, y: number, count: number) {
    const r = this.rnd;
    for (let i = 0; i < count; i++) {
      const jx = x + (r() - 0.5) * 26;
      const jy = y + (r() - 0.5) * 26;
      if (tool === "broom")
        this.add({
          kind: "dust",
          x: jx,
          y: jy,
          vx: (r() - 0.5) * 40,
          vy: -10 - r() * 20,
          life: 0.7,
          size: 5 + r() * 6,
          rot: 0,
          vr: 0,
          hue: 0,
        });
      else if (tool === "scraper")
        this.add({
          kind: "flake",
          x: jx,
          y: jy,
          vx: (r() - 0.5) * 90,
          vy: -40 - r() * 50,
          life: 0.6,
          size: 1.5 + r() * 2,
          rot: r() * 6,
          vr: (r() - 0.5) * 12,
          hue: 0,
        });
      else if (tool === "mop") {
        this.add({
          kind: "drop",
          x: jx,
          y: jy,
          vx: (r() - 0.5) * 60,
          vy: -30 - r() * 40,
          life: 0.55,
          size: 1.6 + r() * 1.6,
          rot: 0,
          vr: 0,
          hue: 0,
        });
        if (r() < 0.5)
          this.add({
            kind: "bubble",
            x: jx,
            y: jy,
            vx: (r() - 0.5) * 14,
            vy: -8 - r() * 10,
            life: 0.9,
            size: 2 + r() * 4,
            rot: 0,
            vr: 0,
            hue: 0,
          });
      } else
        this.add({
          kind: "bubble",
          x: jx,
          y: jy,
          vx: (r() - 0.5) * 16,
          vy: -10 - r() * 16,
          life: 0.8 + r() * 0.5,
          size: 2.5 + r() * 5,
          rot: 0,
          vr: 0,
          hue: 0,
        });
    }
  }

  /** A stain is gone: sparkles and a shine ring; bigger with the streak. */
  sparkle(x: number, y: number, streak: number) {
    const r = this.rnd;
    const n = Math.min(14, 6 + streak);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.5;
      const v = 50 + r() * 70;
      this.add({
        kind: "spark",
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.55 + r() * 0.3,
        size: 3 + r() * 4,
        rot: r() * 6,
        vr: (r() - 0.5) * 8,
        hue: r() < 0.5 ? 48 : 0,
      });
    }
    this.add({
      kind: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      size: 12 + Math.min(streak, 10) * 2,
      rot: 0,
      vr: 0,
      hue: 0,
    });
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
    for (const p of this.ps) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === "drop" || p.kind === "flake") p.vy += 260 * dt;
      if (p.kind === "spark") {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
      const t = p.age / p.life;
      const fade = 1 - t;
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case "bubble": {
          const s = p.size * (0.7 + t * 0.5);
          ctx.globalAlpha = fade;
          ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.arc(-s * 0.35, -s * 0.35, s * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "dust": {
          const s = p.size * (1 + t * 1.4);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
          g.addColorStop(0, `rgba(196, 170, 128, ${0.45 * fade})`);
          g.addColorStop(1, "rgba(196, 170, 128, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "drop":
          ctx.globalAlpha = fade;
          ctx.fillStyle = "rgba(205, 232, 245, 0.95)";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "flake":
          ctx.globalAlpha = fade;
          ctx.rotate(p.rot);
          ctx.fillStyle = "rgba(92, 56, 22, 0.9)";
          ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
          break;
        case "spark": {
          const s = p.size * Math.sin(Math.PI * Math.min(1, t * 1.4 + 0.15));
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, fade * 1.6);
          ctx.fillStyle = p.hue ? "rgba(255, 222, 120, 1)" : "rgba(255, 255, 250, 1)";
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr = k % 2 ? s * 0.28 : s;
            const a = (k / 8) * Math.PI * 2;
            if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else ctx.moveTo(rr, 0);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "ring":
          ctx.globalAlpha = fade * 0.9;
          ctx.strokeStyle = "rgba(255, 246, 200, 1)";
          ctx.lineWidth = 3 * fade + 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.4 + t * 1.3), 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
      ctx.restore();
    }
    this.raf = this.ps.length ? requestAnimationFrame(this.tick) : 0;
  };

  /** Stop the loop and drop every particle (unmount). */
  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ps = [];
  }
}
