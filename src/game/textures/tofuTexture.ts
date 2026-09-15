/**
 * TOFU_TEXTURE — ported directly from knifecraft.html's `PAINT.tofu()`.
 * The hardest paint in the source's own batch because it has no features:
 * no rind, no lattice, no blush — everything is carried by the three
 * planes separating at very low chroma, so their VALUE spread is wider
 * than cheddar's even though the hue barely moves. Pinholes (each a
 * shadow dot + an offset highlight dot) keep the faces from reading as
 * flat vector fills; a damp highlight along the top-front edge keeps the
 * block from reading as foam.
 */
import { blockCorners, traceBlockPath } from "../ingredientShapes";

export function tofuTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

function face(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string | CanvasGradient,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export function paintTofuTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  depthX: number,
  depthY: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  const [FLt, BLt, BRt, BRb, FRb, FLb] = blockCorners(cx, cy, rx, ry, depthX, depthY);
  const FRt: [number, number] = [FRb[0], FLt[1]];

  const sil = () => {
    ctx.beginPath();
    traceBlockPath(ctx, cx, cy, rx, ry, depthX, depthY, 0);
  };

  ctx.save();
  sil();
  ctx.clip();

  const front = ctx.createLinearGradient(FLt[0], FLt[1], FRb[0], FRb[1]);
  front.addColorStop(0, "#F4F1E4");
  front.addColorStop(0.58, "#ECE8D8");
  front.addColorStop(1, "#DFDBC9");
  face(ctx, [FLt, FRt, FRb, FLb], front);

  const top = ctx.createLinearGradient(BLt[0], BLt[1], FRt[0], FRt[1]);
  top.addColorStop(0, "#FDFCF6");
  top.addColorStop(0.54, "#F8F6EC");
  top.addColorStop(1, "#F0EDE0");
  face(ctx, [FLt, BLt, BRt, FRt], top);

  const side = ctx.createLinearGradient(FRt[0], FRt[1], BRb[0], BRb[1]);
  side.addColorStop(0, "#D8D3C0");
  side.addColorStop(1, "#C4BFAC");
  face(ctx, [FRt, BRt, BRb, FRb], side);

  // Pinholes: front face only, where seen.
  ctx.save();
  ctx.beginPath();
  [FLt, FRt, FRb, FLb].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 110; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 89) / 89);
    const x = cx + Math.cos(a) * rx * 0.92 * r;
    const y = cy + Math.sin(a) * ry * 0.92 * r;
    const rad = 0.9 + 1.5 * (((i * 104729) % 29) / 29);
    ctx.fillStyle = "rgba(176,170,148,0.14)";
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,250,0.20)";
    ctx.beginPath();
    ctx.arc(x - rad * 0.32, y - rad * 0.32, rad * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Damp light along the top front edge.
  ctx.strokeStyle = "rgba(255,255,252,0.52)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(FLt[0] + 2, FLt[1] + 1.5);
  ctx.lineTo(FRt[0] - 2, FRt[1] + 1.5);
  ctx.stroke();

  ctx.strokeStyle = "rgba(164,158,136,0.30)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(FLt[0], FLt[1]);
  ctx.lineTo(FRt[0], FRt[1]);
  ctx.lineTo(FRb[0], FRb[1]);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(160,154,132,0.38)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
