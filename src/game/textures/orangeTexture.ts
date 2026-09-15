/**
 * ORANGE_TEXTURE — paints an orange into a raw 2D canvas, same technique
 * as onionTexture.ts (a near-circular ellipse). Orange is Radial-only —
 * the citrus segment/membrane pattern baked in here is purely cosmetic
 * (the same restrained overlay trick onion's rings/mushroom's gills
 * already use over a plain ellipse silhouette), it has no bearing on the
 * real radial wedge geometry (that comes from actual cuts through
 * center, see PreparationScene/TECHNIQUES.radial) — it just makes the
 * rind/pith/segment read believable wherever a real cut exposes it.
 */

export function orangeTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintOrangeTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = rx / 120;

  ctx.clearRect(0, 0, w, h);

  const silPath = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
  };

  const rg = ctx.createRadialGradient(cx - rx * 0.26, cy - ry * 0.3, rx * 0.16, cx, cy, rx * 1.14);
  rg.addColorStop(0, "#FFA23C");
  rg.addColorStop(0.55, "#F5821E");
  rg.addColorStop(0.86, "#DA6811");
  rg.addColorStop(1, "#B8540C");
  ctx.fillStyle = rg;
  silPath();
  ctx.fill();

  ctx.save();
  silPath();
  ctx.clip();

  // Dimpled rind texture — a scatter of tiny pores, an orange's own skin.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#8F4A0C";
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + i * 0.7;
    const r = 0.25 + ((i * 31) % 10) / 13;
    const px = cx + Math.cos(a) * rx * r;
    const py = cy + Math.sin(a) * ry * r;
    ctx.beginPath();
    ctx.ellipse(px, py, 1.6 * s, 1.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A pale pith ring just inside the rind, then citrus segments radiating
  // from center — membrane lines only, the actual wedges come from real
  // radial cuts.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#FFF3D6";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const pulp = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx * 0.86);
  pulp.addColorStop(0, "#FFB25A");
  pulp.addColorStop(0.7, "#FB9A3A");
  pulp.addColorStop(1, "#F5842A");
  ctx.fillStyle = pulp;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "#FFF3D6";
  ctx.lineWidth = 1.4 * s;
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.86);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // A small pale center disc — the pith core.
  ctx.fillStyle = "rgba(255,246,222,0.7)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.08, ry * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft glossy highlight, upper-left.
  ctx.globalAlpha = 0.3;
  const hg = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.38,
    2,
    cx - rx * 0.3,
    cy - ry * 0.38,
    rx * 0.4,
  );
  hg.addColorStop(0, "#FFF6E4");
  hg.addColorStop(1, "rgba(255,246,228,0)");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.3, cy - ry * 0.38, rx * 0.36, ry * 0.26, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  ctx.strokeStyle = "rgba(120,60,10,0.3)";
  ctx.lineWidth = Math.max(1.4, ry * 0.06);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - ctx.lineWidth * 0.5, ry - ctx.lineWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}
