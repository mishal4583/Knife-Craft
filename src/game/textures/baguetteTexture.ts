/**
 * BAGUETTE_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.baguette()` against the real `shape:'capsule'` geometry. One
 * vertical crust ramp (top-lit sheen easing into an oven-bake underside)
 * does the whole read — no separate crumb region painted into the
 * sprite at all, matching the source's own documented approach ("the
 * crust OWNS the silhouette; any inset large enough to see bleached the
 * loaf"). Deterministic flour-dust/bran-fleck scatter, and five diagonal
 * scoring slashes as tilted lens shapes in the upper crust only.
 */
import { traceCapsulePath } from "../ingredientShapes";

export function baguetteTextureSize(
  rx: number,
  capR: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (capR + margin) * 2 };
}

export function paintBaguetteTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  capR: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = capR + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  const sil = () => {
    ctx.beginPath();
    traceCapsulePath(ctx, cx, cy, rx, capR, 0);
  };

  const crust = ctx.createLinearGradient(cx, cy - capR, cx, cy + capR);
  crust.addColorStop(0, "#E4AC66");
  crust.addColorStop(0.22, "#D6944A");
  crust.addColorStop(0.55, "#C07B34");
  crust.addColorStop(0.86, "#9E5F22");
  crust.addColorStop(1, "#8E5219");
  ctx.fillStyle = crust;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();

  const bake = ctx.createLinearGradient(cx, cy + capR * 0.18, cx, cy + capR);
  bake.addColorStop(0, "rgba(109,60,17,0)");
  bake.addColorStop(1, "rgba(109,60,17,0.60)");
  ctx.fillStyle = bake;
  ctx.fillRect(cx - rx - 8, cy + capR * 0.18, (rx + 8) * 2, capR * 1.1);

  const sheen = ctx.createRadialGradient(
    cx - rx * 0.22,
    cy - capR * 0.46,
    capR * 0.1,
    cx - rx * 0.18,
    cy - capR * 0.3,
    rx * 0.72,
  );
  sheen.addColorStop(0, "rgba(255,232,186,0.40)");
  sheen.addColorStop(1, "rgba(255,232,186,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - rx - 8, cy - capR - 8, (rx + 8) * 2, (capR + 8) * 2);

  // Flour dust and bran flecks, deterministic (golden angle, never RNG).
  for (let i = 0; i < 150; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 101) / 101);
    const x = cx + Math.cos(a) * rx * 0.96 * r;
    const y = cy + Math.sin(a) * capR * 0.9 * r;
    const rad = 0.5 + 1.0 * (((i * 104729) % 29) / 29);
    ctx.fillStyle = i % 3 ? "rgba(247,223,174,0.30)" : "rgba(109,60,17,0.22)";
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scoring — five diagonal slashes: a baked trough with a pale lip of
  // split crumb inside it, drawn as tilted lenses in the UPPER crust only
  // (a slash is an opening in the top of the crust, not a pin through it).
  for (let i = 0; i < 5; i++) {
    const x = cx - rx * 0.62 + i * ((rx * 1.24) / 4);
    ctx.save();
    ctx.translate(x, cy - capR * 0.26);
    ctx.rotate(-0.52);
    ctx.fillStyle = "rgba(109,60,17,0.60)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(228,172,102,0.95)";
    ctx.beginPath();
    ctx.ellipse(-1.3, -0.7, 2.4, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246,230,194,0.85)";
    ctx.beginPath();
    ctx.ellipse(-2.0, -1.1, 1.2, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(122,68,18,0.45)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
