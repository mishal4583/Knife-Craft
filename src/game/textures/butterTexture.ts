/**
 * BUTTER_TEXTURE — ported directly from knifecraft.html's `PAINT.butter()`.
 * Same three-plane oblique-box contract as Cheddar, but the actual
 * differentiation the source ships is: a pale creamy palette, softer
 * broader "knife drag" streaks instead of wire-cut striations, and a
 * near-invisible waxy bloom — reflecting butter's own real texture, not a
 * recolour of cheddar's.
 */
import { blockCorners, traceBlockPath } from "../ingredientShapes";

export function butterTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
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

export function paintButterTexture(
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
  front.addColorStop(0, "#F9E7A6");
  front.addColorStop(0.55, "#F3DC90");
  front.addColorStop(1, "#E7CA76");
  face(ctx, [FLt, FRt, FRb, FLb], front);

  const top = ctx.createLinearGradient(BLt[0], BLt[1], FRt[0], FRt[1]);
  top.addColorStop(0, "#FFF7D2");
  top.addColorStop(0.52, "#FCEFBB");
  top.addColorStop(1, "#F6E4A4");
  face(ctx, [FLt, BLt, BRt, FRt], top);

  const side = ctx.createLinearGradient(FRt[0], FRt[1], BRb[0], BRb[1]);
  side.addColorStop(0, "#E4C36C");
  side.addColorStop(1, "#CBA855");
  face(ctx, [FRt, BRt, BRb, FRb], side);

  // Knife drag: broad, soft, diagonal — front face only.
  ctx.save();
  ctx.beginPath();
  [FLt, FRt, FRb, FLb].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const y = FLt[1] + (FLb[1] - FLt[1]) * ((i + 0.6) / 4);
    ctx.strokeStyle = i % 2 ? "rgba(255,250,214,0.24)" : "rgba(196,158,70,0.12)";
    ctx.lineWidth = 7 - i;
    ctx.beginPath();
    ctx.moveTo(FLt[0], y + 5);
    ctx.lineTo(FRt[0], y - 5);
    ctx.stroke();
  }
  ctx.restore();

  // Waxy bloom, barely there.
  ctx.fillStyle = "rgba(198,160,72,0.07)";
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 73) / 73);
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 1.02 * r,
      cy + Math.sin(a) * ry * 0.96 * r,
      1.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(190,150,60,0.26)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(FLt[0], FLt[1]);
  ctx.lineTo(FRt[0], FRt[1]);
  ctx.lineTo(FRb[0], FRb[1]);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(184,144,56,0.36)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
