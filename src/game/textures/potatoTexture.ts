/**
 * POTATO_TEXTURE — paints the potato into a raw 2D canvas, same
 * technique as tomatoTexture.ts. An oblong ellipse (rx > ry). Two paint
 * variants share one function, same pattern as garlicTexture.ts:
 * `peeled=false` (matte earthy-brown skin, eyes, mottling) and
 * `peeled=true` (skin gone — a pale, faintly damp cream flesh, no eyes,
 * a couple of thin brown skin flecks left behind the way a real peeled
 * potato still shows a stray unpeeled patch or two).
 */

export function potatoTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintPotatoTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  peeled: boolean,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = rx / 138;

  ctx.clearRect(0, 0, w, h);

  const silPath = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
  };

  const rg = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.3, rx * 0.2, cx, cy, rx * 1.15);
  if (!peeled) {
    // Matte earthy-brown body — no glossy highlight, potato skin is dry.
    rg.addColorStop(0, "#C9A171");
    rg.addColorStop(0.55, "#AD8153");
    rg.addColorStop(0.88, "#8C6640");
    rg.addColorStop(1, "#725234");
  } else {
    // Pale, faintly damp cream flesh.
    rg.addColorStop(0, "#F5EBD2");
    rg.addColorStop(0.55, "#EADFC0");
    rg.addColorStop(0.88, "#DACBA0");
    rg.addColorStop(1, "#C7B589");
  }
  ctx.fillStyle = rg;
  silPath();
  ctx.fill();

  ctx.save();
  silPath();
  ctx.clip();

  if (!peeled) {
    // Mottled skin texture — irregular soft patches, not a clean gradient.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#5E4529";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i * 0.7;
      const r = 0.3 + (0.55 * ((i * 37) % 10)) / 10;
      const px = cx + Math.cos(a) * rx * r;
      const py = cy + Math.sin(a) * ry * r;
      ctx.beginPath();
      ctx.ellipse(px, py, 5 * s, 3.4 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Eyes — small dark dimples, a couple with a faint pale sprout ring.
    ctx.fillStyle = "rgba(60,42,24,0.55)";
    const eyeSpots: [number, number][] = [
      [-0.35, -0.2],
      [0.28, -0.35],
      [-0.1, 0.25],
      [0.35, 0.15],
      [0.02, -0.05],
    ];
    for (const [fx, fy] of eyeSpots) {
      ctx.beginPath();
      ctx.ellipse(cx + fx * rx, cy + fy * ry, 2.6 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // A couple of thin stray brown skin flecks left behind, and a subtle
    // damp sheen — a peeled potato is never perfectly uniform.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#8C6640";
    for (const [fx, fy, w2, h2] of [
      [-0.5, 0.3, 7, 3],
      [0.42, -0.4, 5, 2.4],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(cx + fx * rx, cy + fy * ry, w2 * s, h2 * s, fx, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    const sheen = ctx.createRadialGradient(
      cx - rx * 0.3,
      cy - ry * 0.35,
      2,
      cx - rx * 0.3,
      cy - ry * 0.35,
      rx * 0.5,
    );
    sheen.addColorStop(0, "#FFFDF3");
    sheen.addColorStop(1, "rgba(255,253,243,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // A faint, pale starchy core band — what shows through once cut, either state.
  const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx * 0.55);
  core.addColorStop(0, peeled ? "rgba(250,242,220,0.55)" : "rgba(240,224,190,0.4)");
  core.addColorStop(1, "rgba(240,224,190,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // A thin darker rind just inside the true edge.
  ctx.strokeStyle = peeled ? "rgba(150,125,80,0.2)" : "rgba(60,42,24,0.22)";
  ctx.lineWidth = Math.max(1.4, ry * 0.06);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - ctx.lineWidth * 0.5, ry - ctx.lineWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}
