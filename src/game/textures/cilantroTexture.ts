/**
 * CILANTRO_TEXTURE — ported from the KNIFECRAFT-NEW-INGREDIENTS package's
 * `PAINT_ADDITIONS.cilantro()`. Parsley's painter, unchanged in structure
 * (stems first, then one blade per leaflet with midveins/secondaries/
 * highlight/outline — see parsleyTexture.ts's own `paintParsleyTexture`,
 * which this mirrors closely), except for palette and vein weight — the
 * actual shape difference lives entirely in `parsleyLeafShape`'s new
 * `round` branch (04-shared-patches.md §2, parsleyTexture.ts), so both
 * herbs share one blade generator and Parsley's own rendering is
 * completely unaffected.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { CILANTRO_LEAVES } from "../definitions";
import { parsleyLeafShape } from "./parsleyTexture";

// light interior -> medium body -> darker edge; fresh matte green, four subtle variants
const TONES: readonly [string, string, string][] = [
  ["#9AD56F", "#74B851", "#55913A"],
  ["#92CE66", "#6DAF49", "#4E8834"],
  ["#A5DC7A", "#7FC158", "#5C9A40"],
  ["#8CC95F", "#68A944", "#4A8232"],
];

export function cilantroTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function cilantroLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(CILANTRO_LEAVES, scale);
}

export function paintCilantroTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  // Stems first: they pass behind the blades — same yellower-green tone
  // family as the leaves, a touch lighter (petioles catch more light).
  for (const L of leaves) {
    if (!L.stem) continue;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);
    const sg = ctx.createLinearGradient(0, -L.ry, 0, L.ry);
    sg.addColorStop(0, "#A9C878");
    sg.addColorStop(0.5, "#7BA24B");
    sg.addColorStop(1, "#5E8339");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let seed = 0;
  for (const L of leaves) {
    if (L.stem) continue;
    const mySeed = seed++;
    const sh = parsleyLeafShape(L.rx, L.ry, mySeed, true); // true = cilantro's round fan-blade variant
    const t = TONES[sh.seed % TONES.length]!;
    const rx2 = L.rx;
    const ry2 = L.ry;
    const f = sh.fit;
    const bx = sh.bx;

    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const blade = new Path2D();
    sh.walk.forEach((q, k) => {
      const x = bx + q[0] * f;
      const y = q[1] * f;
      if (k) blade.lineTo(x, y);
      else blade.moveTo(x, y);
    });
    blade.closePath();

    const bg = ctx.createLinearGradient(-rx2 * 0.4, -ry2, rx2 * 0.4, ry2);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.5, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(blade);

    ctx.save();
    ctx.clip(blade);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(38,72,26,0.30)"; // one midvein per lobe, all from the base
    ctx.lineWidth = 1.3;
    for (const a of sh.axes) {
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + Math.cos(a.ang) * a.len * f * 0.88, Math.sin(a.ang) * a.len * f * 0.88);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(44,80,30,0.18)"; // secondaries toward the teeth
    ctx.lineWidth = 0.8;
    for (const a of sh.axes) {
      for (const u of [0.46, 0.72]) {
        const px = bx + Math.cos(a.ang) * a.len * f * u;
        const py = Math.sin(a.ang) * a.len * f * u;
        for (const s2 of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(
            px + Math.cos(a.ang + s2 * 0.9) * a.len * f * 0.16,
            py + Math.sin(a.ang + s2 * 0.9) * a.len * f * 0.16,
          );
          ctx.stroke();
        }
      }
    }
    const hl = ctx.createRadialGradient(
      -rx2 * 0.1,
      -ry2 * 0.42,
      2,
      -rx2 * 0.1,
      -ry2 * 0.42,
      rx2 * 0.7,
    );
    hl.addColorStop(0, "rgba(255,255,238,0.07)");
    hl.addColorStop(1, "rgba(255,255,238,0)");
    ctx.fillStyle = hl;
    ctx.fill(blade);
    ctx.restore();

    ctx.strokeStyle = "rgba(40,74,26,0.32)";
    ctx.lineWidth = 1;
    ctx.stroke(blade);
    ctx.restore();
  }
}
