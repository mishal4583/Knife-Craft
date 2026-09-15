/**
 * CHEDDAR_TEXTURE — ported directly from knifecraft.html's `PAINT.cheddar()`
 * (the actual final implementation — verified against the source, not a
 * paraphrase). Three lit planes (front/top/side) off the real 6-corner
 * oblique `SILS.block` geometry, wire-cut striations on the front face
 * only, a deterministic waxy-grain scatter, and the two interior seams
 * where the planes meet. No rind/flesh inset anywhere — cheese is the
 * same material throughout, so a cut face is simply more cheese.
 */
import { blockCorners, traceBlockPath } from "../ingredientShapes";

export function cheddarTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

/** One quadrilateral face, filled with its own gradient — ported verbatim from PAINT.cheddar's own local `face()` helper. */
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

export function paintCheddarTexture(
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
  front.addColorStop(0, "#F7B43C");
  front.addColorStop(0.55, "#EFA52C");
  front.addColorStop(1, "#DD8F1F");
  face(ctx, [FLt, FRt, FRb, FLb], front);

  const top = ctx.createLinearGradient(BLt[0], BLt[1], FRt[0], FRt[1]);
  top.addColorStop(0, "#FFD467");
  top.addColorStop(0.52, "#FDC64D");
  top.addColorStop(1, "#F4B438");
  face(ctx, [FLt, BLt, BRt, FRt], top);

  const side = ctx.createLinearGradient(FRt[0], FRt[1], BRb[0], BRb[1]);
  side.addColorStop(0, "#D98D22");
  side.addColorStop(1, "#BB751A");
  face(ctx, [FRt, BRt, BRb, FRb], side);

  // Wire-cut striations, FRONT face only.
  ctx.save();
  ctx.beginPath();
  [FLt, FRt, FRb, FLb].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const y = FLt[1] + (FLb[1] - FLt[1]) * ((i + 0.5) / 9);
    ctx.strokeStyle = i % 2 ? "rgba(255,228,172,0.15)" : "rgba(158,92,18,0.10)";
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(FLt[0], y + ((i * 37) % 7) - 3);
    ctx.lineTo(FRt[0], y + ((i * 53) % 7) - 3);
    ctx.stroke();
  }
  ctx.restore();

  // Waxy grain, subordinate — deterministic golden-angle scatter.
  ctx.fillStyle = "rgba(150,86,18,0.09)";
  for (let i = 0; i < 120; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 83) / 83);
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 1.05 * r,
      cy + Math.sin(a) * ry * 0.98 * r,
      1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // The two interior seams separate the planes.
  ctx.strokeStyle = "rgba(146,82,14,0.30)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(FLt[0], FLt[1]);
  ctx.lineTo(FRt[0], FRt[1]);
  ctx.lineTo(FRb[0], FRb[1]);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(140,76,14,0.42)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
