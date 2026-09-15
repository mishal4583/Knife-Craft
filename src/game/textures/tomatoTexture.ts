/**
 * TOMATO_TEXTURE — paints the tomato into a raw 2D canvas (a Phaser
 * CanvasTexture's context), ported near-verbatim from knifecraft.html's
 * `PAINT.tomato()`: a real radial-gradient sphere, faint lobe lines, a
 * soft highlight, and the five-leaf calyx star — using the actual
 * Canvas 2D gradient/rotate API, not a Graphics approximation.
 *
 * Painting once into a texture (regenerated only on resize) lets every
 * cut piece be a plain `Image.setCrop()` window into this SAME texture —
 * pieces are then real, correctly-shaded slices of the tomato's actual
 * silhouette, not a separately-drawn shape, and their edges land exactly
 * where the crop boundary (== the actual cut Y) says they should.
 */

/** Center-relative half-extents; the texture is sized (rx+margin)*2 x (ry+margin)*2 around this center. */
export function tomatoTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintTomatoTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  // The reference's stem/lobe numbers are absolute px against its 148px design rx — scale them so the
  // calyx and lobe lines stay proportionate at any screen size instead of a fixed pixel count.
  const s = rx / 148;

  ctx.clearRect(0, 0, w, h);

  const silPath = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
  };

  // Body: an off-center radial gradient — bright toward the "window light" upper-left.
  const rg = ctx.createRadialGradient(cx - rx * 0.28, cy - ry * 0.34, rx * 0.18, cx, cy, rx * 1.12);
  rg.addColorStop(0, "#E86A5C");
  rg.addColorStop(0.55, "#D94B45");
  rg.addColorStop(0.88, "#B93832");
  rg.addColorStop(1, "#A02F2C");
  ctx.fillStyle = rg;
  silPath();
  ctx.fill();

  // Faint lobe lines — the tomato's natural segmentation.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#7E211E";
  ctx.lineWidth = 7 * s;
  const lobes = 5;
  for (let i = 1; i < lobes; i++) {
    const fx = -1 + (2 * i) / lobes;
    ctx.beginPath();
    ctx.ellipse(cx + fx * rx * 0.62, cy, rx * 0.3, ry * 0.94, 0, -Math.PI / 2.25, Math.PI / 2.25);
    ctx.stroke();
  }
  ctx.restore();

  // Soft window-light highlight, upper-left.
  ctx.save();
  ctx.globalAlpha = 0.34;
  const hg = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.42,
    2,
    cx - rx * 0.34,
    cy - ry * 0.42,
    rx * 0.42,
  );
  hg.addColorStop(0, "#FFF7EE");
  hg.addColorStop(1, "rgba(255,247,238,0)");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.34, cy - ry * 0.42, rx * 0.4, ry * 0.3, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The calyx: five sage-green leaves radiating from a small center disc, at the top of the sphere.
  ctx.save();
  ctx.translate(cx, cy - ry + 6 * s);
  ctx.fillStyle = "#6E8A54";
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2 + 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -13 * s, 5.5 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#8DAA6D";
  ctx.beginPath();
  ctx.arc(0, -2 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5C744A";
  ctx.fillRect(-2.4 * s, -22 * s, 4.8 * s, 14 * s);
  ctx.restore();
}
