/**
 * BASIL_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.basil()` (source line 5495): stems first (they pass BEHIND the
 * blades), then each non-stem leaf gets its own ovate bezier blade —
 * full through the base, drawn out to a tip — with a midrib, four pairs
 * of side veins, a soft highlight, and a dark outline stroke. BASIL_LEAVES
 * (definitions.ts) is the source's own `geom.leaves` list, scaled by the
 * same real-cm k-factor every other geometry constant uses; the painting
 * and the collision geometry are the exact same bunch, so a cut that
 * misses a leaf misses its paint too.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { BASIL_LEAVES } from "../definitions";

// [light, mid, dark] per blade, cycling — ported verbatim from PAINT.basil's TONES.
const TONES: readonly [string, string, string][] = [
  ["#7FAE55", "#5C8B3C", "#3E6427"],
  ["#8CB95E", "#679641", "#456C2B"],
  ["#749F4C", "#547F36", "#385C24"],
  ["#96C267", "#6E9E46", "#4A7130"],
];

export function basilTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

/** The world-space leaf list for the CURRENT canvas width — `scale` is `canvasWidth / 540`, matching every other geometry constant's own `*_FRAC * w` convention. PreparationScene.layout() calls fitClusterBounds on this same list to get ingRx/ingRy. */
export function basilLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(BASIL_LEAVES, scale);
}

export function paintBasilTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  // Stems first: they pass BEHIND the blades.
  for (const L of leaves) {
    if (!L.stem) continue;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);
    const sg = ctx.createLinearGradient(0, -L.ry, 0, L.ry);
    sg.addColorStop(0, "#8AA85E");
    sg.addColorStop(0.5, "#6E8C48");
    sg.addColorStop(1, "#546E36");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let i = 0;
  for (const L of leaves) {
    if (L.stem) continue;
    const t = TONES[i++ % TONES.length]!;
    const lrx = L.rx;
    const lry = L.ry;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    // Ovate: full through the base, drawn out to a tip.
    const blade = new Path2D();
    blade.moveTo(-lrx, 0);
    blade.bezierCurveTo(-lrx * 0.64, -lry * 0.99, lrx * 0.26, -lry * 0.86, lrx, 0);
    blade.bezierCurveTo(lrx * 0.26, lry * 0.86, -lrx * 0.64, lry * 0.99, -lrx, 0);
    blade.closePath();

    const bg = ctx.createLinearGradient(-lrx * 0.3, -lry, lrx * 0.4, lry);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.52, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(blade);

    ctx.save();
    ctx.clip(blade);
    ctx.strokeStyle = "rgba(230,242,208,0.40)";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-lrx * 0.84, 0);
    ctx.quadraticCurveTo(0, -lry * 0.07, lrx * 0.93, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226,240,205,0.20)"; // side veins: a suggestion, not a diagram
    ctx.lineWidth = 1.1;
    for (let v = 0; v < 4; v++) {
      const bx = lrx * (-0.52 + v * 0.33);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.quadraticCurveTo(bx + lrx * 0.15, s * lry * 0.4, bx + lrx * 0.33, s * lry * 0.7);
        ctx.stroke();
      }
    }
    const hl = ctx.createRadialGradient(
      -lrx * 0.22,
      -lry * 0.34,
      2,
      -lrx * 0.22,
      -lry * 0.34,
      lrx * 0.62,
    );
    hl.addColorStop(0, "rgba(255,255,240,0.20)");
    hl.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = hl;
    ctx.fill(blade);
    ctx.restore();

    ctx.strokeStyle = "rgba(34,58,22,0.30)";
    ctx.lineWidth = 1.3;
    ctx.stroke(blade);
    ctx.restore();
  }
}
