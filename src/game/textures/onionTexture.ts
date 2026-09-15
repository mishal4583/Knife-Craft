/**
 * ONION_TEXTURE — paints a red onion into a raw 2D canvas, same
 * technique as tomatoTexture.ts (one shared texture, every piece later
 * clips a window into it — see pieceTexture.ts). Onion is an ellipse
 * (same shape factory as tomato, see ingredientShapes.ts's
 * makeEllipseSilhouette), near-circular.
 *
 * Two paint variants share one function, same pattern as garlicTexture.ts:
 * `peeled=false` (deep magenta-red papery outer skin, dry and matte) and
 * `peeled=true` (the skin is gone — a glossier, brighter purple-white
 * body with the layered rings reading clearly through the surface, the
 * way a real peeled red onion looks). The concentric ring bands are
 * baked into BOTH variants so any cut/halve piece shows the real
 * alternating purple/white ring structure a red onion is known for
 * (reference: a halved red onion's cross-section), not just a flat
 * color wash.
 */

export function onionTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintOnionTexture(
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
  const s = rx / 118;

  ctx.clearRect(0, 0, w, h);

  const silPath = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
  };

  // Body — deep magenta-red skin (unpeeled) or a brighter, glossier
  // red-violet (peeled, skin gone but still a real red onion's own color,
  // not white).
  const rg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.32, rx * 0.15, cx, cy, rx * 1.1);
  if (!peeled) {
    rg.addColorStop(0, "#9B4A72");
    rg.addColorStop(0.5, "#7C2F58");
    rg.addColorStop(0.85, "#5C1F42");
    rg.addColorStop(1, "#431631");
  } else {
    rg.addColorStop(0, "#C97FA6");
    rg.addColorStop(0.5, "#B0568C");
    rg.addColorStop(0.85, "#8E3D6E");
    rg.addColorStop(1, "#6E2D55");
  }
  ctx.fillStyle = rg;
  silPath();
  ctx.fill();

  ctx.save();
  silPath();
  ctx.clip();

  // Concentric growth rings, alternating purple and pale cream — a red
  // onion's signature cross-section. Baked in for both states so any
  // clipped piece (halve/slice) reads correctly.
  const rings = 6;
  for (let i = rings; i >= 1; i--) {
    const f = i / (rings + 1);
    const isCream = i % 2 === 0;
    ctx.fillStyle = isCream
      ? peeled
        ? "rgba(247,232,238,0.55)"
        : "rgba(240,215,226,0.28)"
      : peeled
        ? "rgba(150,45,95,0.35)"
        : "rgba(90,25,58,0.3)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * f, ry * f, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A pale core at the very center.
  ctx.fillStyle = peeled ? "rgba(250,240,244,0.7)" : "rgba(245,225,234,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.08, ry * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!peeled) {
    // Papery vertical skin lines, root to crown — only the unpeeled skin has these.
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#3A0F27";
    ctx.lineWidth = 1.2 * s;
    const lines = 10;
    for (let i = 0; i < lines; i++) {
      const fx = -1 + (2 * i) / (lines - 1);
      ctx.beginPath();
      ctx.moveTo(cx + fx * rx * 0.94, cy - ry * 0.9);
      ctx.quadraticCurveTo(cx + fx * rx * 1.02, cy, cx + fx * rx * 0.94, cy + ry * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Soft highlight, upper-left — glossier once peeled.
  ctx.save();
  ctx.globalAlpha = peeled ? 0.4 : 0.22;
  const hg = ctx.createRadialGradient(
    cx - rx * 0.32,
    cy - ry * 0.4,
    2,
    cx - rx * 0.32,
    cy - ry * 0.4,
    rx * 0.38,
  );
  hg.addColorStop(0, "#FFF3F8");
  hg.addColorStop(1, "rgba(255,243,248,0)");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.32, cy - ry * 0.4, rx * 0.36, ry * 0.26, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // A small root tuft at the base and a trimmed neck at the top — the
  // peeled variant's are paler/cleaner (papery bits trimmed away).
  ctx.save();
  ctx.fillStyle = peeled ? "rgba(230,210,220,0.55)" : "rgba(120,70,50,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry - 2 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = peeled ? "rgba(240,225,232,0.6)" : "rgba(150,110,90,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry + 3 * s, 6 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A thin darker rind just inside the true edge — reads as the outer
  // membrane even once peeled.
  ctx.strokeStyle = peeled ? "rgba(110,40,75,0.3)" : "rgba(60,15,38,0.35)";
  ctx.lineWidth = Math.max(1.4, ry * 0.05);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - ctx.lineWidth * 0.5, ry - ctx.lineWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}
