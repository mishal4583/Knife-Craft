/**
 * PINEAPPLE_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.pineapple()` (source line 8193, the spiky-crowned hexagonal
 * shell) AND `PAINT.pineapple()` ("PINEAPPLE, PEELED", source line 6703,
 * the pale butter-yellow flesh with spiral shaving furrows), against the
 * real `shape:'capsule'` geometry. Pineapple is one of the source's
 * exactly-three real peelable foods (`peelable = SKIN && !SKIN_KEEP` —
 * see knifecraft.html's own peel-mechanics doc), and production's
 * pre-existing generic rub-to-peel system (`this.peeled`, same one
 * Onion/Potato/Garlic already use) now drives it directly: unpeeled
 * paints ONLY the real shell (no flesh anywhere, matching the source's
 * own full-opacity SKIN sprite), peeled paints ONLY the real flesh (no
 * shell anywhere) — a discrete swap on `completePeel()`, not the
 * source's continuous alpha fade, which production's single-canvas-
 * per-piece architecture has no equivalent for.
 */
import { traceCapsulePath } from "../ingredientShapes";

export function pineappleTextureSize(
  rx: number,
  capR: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (capR + margin) * 2 };
}

export function paintPineappleTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  capR: number,
  margin: number,
  peeled = false,
): void {
  const cx = rx + margin;
  const cy = capR + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = () => {
    ctx.beginPath();
    traceCapsulePath(ctx, cx, cy, rx, capR, 0);
  };

  if (peeled) {
    // --- "PINEAPPLE, PEELED": the real flesh with spiral shaving furrows ---
    const flg = ctx.createLinearGradient(cx, cy - capR, cx, cy + capR);
    flg.addColorStop(0, "#FBF1C4");
    flg.addColorStop(0.46, "#F2DE97");
    flg.addColorStop(1, "#DBBF66");
    ctx.fillStyle = flg;
    sil();
    ctx.fill();

    ctx.save();
    sil();
    ctx.clip();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.56); // the spiral furrows of a shaved pineapple
    const R = rx + capR;
    const S = 30;
    for (let y = -R; y <= R; y += S) {
      const bandG = ctx.createLinearGradient(0, y, 0, y + S);
      bandG.addColorStop(0, "rgba(255,250,214,0.50)");
      bandG.addColorStop(0.4, "rgba(255,252,230,0.16)");
      bandG.addColorStop(0.86, "rgba(178,148,66,0.28)");
      bandG.addColorStop(1, "rgba(118,94,34,0.40)");
      ctx.fillStyle = bandG;
      ctx.fillRect(-R, y, R * 2, S);
      ctx.strokeStyle = "rgba(116,92,32,0.48)"; // the groove between two passes
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-R, y + S);
      ctx.lineTo(R, y + S);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(124,98,38,0.34)"; // eye remnants, left down in the furrows
    for (let i = 0; i < 52; i++) {
      const a = i * 2.399963;
      const r = Math.sqrt(((i * 6151) % 83) / 83);
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * rx * 0.92 * r,
        cy + Math.sin(a) * capR * 0.9 * r,
        2.6,
        1.5,
        a,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const rim = new Path2D(); // amber margin: where the blade ran near the rind
    const outer = new Path2D();
    traceCapsulePath(outer, cx, cy, rx, capR, 0);
    const inner = new Path2D();
    traceCapsulePath(inner, cx, cy, rx - 16, capR - 16, 0);
    rim.addPath(outer);
    rim.addPath(inner);
    ctx.save();
    ctx.clip(rim, "evenodd");
    ctx.fillStyle = "rgba(188,140,44,0.42)";
    sil();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = "rgba(150,112,34,0.42)";
    ctx.lineWidth = 2;
    sil();
    ctx.stroke();
    return;
  }

  // --- SKIN.pineapple: the spiky-crowned hexagonal shell (unpeeled) ---
  // Crown first: the body's own edge covers the joint.
  const bx = cx + rx * 0.9;
  const by = cy;
  for (const back of [1, 0]) {
    const n = back ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = -1.02 + (i / (n - 1)) * 2.04 + (back ? 0.09 : -0.07);
      const L = (back ? 128 : 106) * (0.7 + 0.4 * Math.cos(a * 0.88));
      const w = back ? 18 : 15;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a);
      const bl = new Path2D();
      bl.moveTo(0, -w * 0.5);
      bl.quadraticCurveTo(L * 0.58, -w * 0.6, L, 0);
      bl.quadraticCurveTo(L * 0.58, w * 0.6, 0, w * 0.5);
      bl.closePath();
      const gr = ctx.createLinearGradient(0, -w, L, w);
      if (back) {
        gr.addColorStop(0, "#2B5520");
        gr.addColorStop(0.55, "#3B7429");
        gr.addColorStop(1, "#23491A");
      } else {
        gr.addColorStop(0, "#63A342");
        gr.addColorStop(0.5, "#4C8931");
        gr.addColorStop(1, "#356322");
      }
      ctx.fillStyle = gr;
      ctx.fill(bl);
      ctx.strokeStyle = "rgba(18,42,12,0.34)";
      ctx.lineWidth = 1;
      ctx.stroke(bl);
      ctx.strokeStyle = "rgba(216,242,172,0.28)"; // the blade's lit spine
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(L * 0.08, 0);
      ctx.lineTo(L * 0.9, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  const rind = ctx.createLinearGradient(cx, cy - capR, cx, cy + capR);
  rind.addColorStop(0, "#EDB349");
  rind.addColorStop(0.44, "#D08B27");
  rind.addColorStop(1, "#8E5A16");
  ctx.fillStyle = rind;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();

  const COLS = 11;
  const ROWS = 6;
  const hw = ((rx * 2) / COLS) * 0.62;
  const hh = ((capR * 2) / ROWS) * 0.64;
  for (let r = -1; r <= ROWS; r++) {
    // One row of bleed each way: no bald margin.
    const y = cy - capR + ((r + 0.5) / ROWS) * capR * 2;
    for (let cIdx = -1; cIdx <= COLS; cIdx++) {
      const x = cx - rx + ((cIdx + 0.5 + (r % 2 ? 0.5 : 0)) / COLS) * rx * 2;
      const seed = ((r + 2) * 131 + (cIdx + 2) * 7919) % 97;
      const j = 0.94 + 0.14 * ((seed % 9) / 9);
      const cell = new Path2D(); // a scale PLATE: hexagon, not a wire diamond
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 3;
        const px = x + Math.cos(a) * hw * j;
        const py = y + Math.sin(a) * hh * j;
        if (k) cell.lineTo(px, py);
        else cell.moveTo(px, py);
      }
      cell.closePath();
      const cg2 = ctx.createRadialGradient(x - hw * 0.26, y - hh * 0.3, 1, x, y, hw * 1.2);
      cg2.addColorStop(0, seed % 3 ? "rgba(252,206,116,0.50)" : "rgba(246,188,94,0.46)");
      cg2.addColorStop(0.58, "rgba(206,134,40,0.26)");
      cg2.addColorStop(1, "rgba(112,66,12,0.44)");
      ctx.fillStyle = cg2;
      ctx.fill(cell);
      ctx.strokeStyle = "rgba(96,58,10,0.60)";
      ctx.lineWidth = 1.7;
      ctx.stroke(cell);
      ctx.strokeStyle = "rgba(90,54,10,0.42)"; // the bract: a small chevron
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.3, y + hh * 0.16);
      ctx.lineTo(x, y - hh * 0.2);
      ctx.lineTo(x + hw * 0.3, y + hh * 0.16);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,232,168,0.34)";
      ctx.beginPath();
      ctx.arc(x, y - hh * 0.06, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const shade = ctx.createRadialGradient(
    cx - rx * 0.28,
    cy - capR * 0.34,
    capR * 0.2,
    cx,
    cy,
    rx * 1.06,
  );
  shade.addColorStop(0, "rgba(255,226,150,0.20)");
  shade.addColorStop(0.62, "rgba(255,220,140,0)");
  shade.addColorStop(1, "rgba(92,54,10,0.30)"); // the body reads round, not a flat tiled panel
  ctx.fillStyle = shade;
  sil();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(112,70,14,0.46)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
