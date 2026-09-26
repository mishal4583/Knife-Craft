/**
 * GINGER_TEXTURE — ported from the KNIFECRAFT-NEW-INGREDIENTS package's
 * shared `gingerBody()` helper plus its `PAINT_ADDITIONS.ginger()` (the
 * peeled/shaved base sprite) and `SKIN_ADDITIONS.ginger()` (the corky tan
 * shell). A hand of ginger is the same picture peeled or not — same
 * knobs, same ring ridges, same nodes — so the body is drawn ONCE by the
 * shared private `gingerBody` helper below with the palette passed in,
 * exactly matching the package's own two-palettes-one-routine structure.
 * Ginger is the first CLUSTER-shaped ingredient to be peelable in this
 * roster — its shell sheds on the rub through the exact same
 * `this.peeled`/`paintPeelableLayer` mechanism Onion/Potato/Garlic/
 * Pineapple/Watermelon/Coconut already use (see PreparationScene's own
 * ginger-specific dispatch branch), never a new peel mechanic. It is NOT
 * peel-decoupled (see definitions.ts's own doc on ginger) — the shell
 * comes off only by rubbing, never by cutting, same as those six.
 *
 * `mass`/`tip` (GINGER_LEAVES, definitions.ts/ingredientShapes.ts) mark
 * which lobes are the main rhizome body vs. a finger — read here for the
 * ring-ridge band count and the finger-end node/contact-shadow passes,
 * exactly mirroring the package's own `b.mass`/`b.tip` reads.
 */
import { traceClusterPath, scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { GINGER_LEAVES } from "../definitions";

type GingerPalette = {
  rim: string;
  base: readonly [string, string, string, string];
  dome: readonly [string, string, string, string];
  ridge: string;
  lip: string;
  occl: string; // e.g. "rgba(150,118,40,$A)" — "$A" is substituted with an alpha value
  node: readonly [string, string, string];
  freckle: readonly [string, string] | null;
  grade: readonly [string, string, string, string];
  under: string; // "$A"-templated, see occl
  sheen: string; // "$A"-templated, see occl
};

function alpha(template: string, a: number): string {
  return template.replace("$A", a.toString());
}

function lobePath(cx: number, cy: number, b: ClusterLeaf, sx: number, sy: number): Path2D {
  const p = new Path2D();
  p.ellipse(cx + b.dx, cy + b.dy, b.rx * sx, b.ry * sy, b.rot ?? 0, 0, Math.PI * 2);
  return p;
}

function lobeInPath(cx: number, cy: number, b: ClusterLeaf, d: number): Path2D {
  const p = new Path2D();
  p.ellipse(
    cx + b.dx,
    cy + b.dy,
    Math.max(2, b.rx - d),
    Math.max(2, b.ry - d),
    b.rot ?? 0,
    0,
    Math.PI * 2,
  );
  return p;
}

/**
 * Draws the whole rhizome hand — knobs, ring ridges, contact shadows,
 * finger-end nodes, corky freckles (shell only), and the single upper-
 * left light grade — into an already-cleared canvas. `P` is the only
 * thing that differs between the peeled body and the unpeeled shell.
 */
function gingerBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  leaves: ClusterLeaf[],
  P: GingerPalette,
): void {
  const sil = new Path2D();
  traceClusterPath(sil, cx, cy, leaves, 0);

  const RIM = 3;
  ctx.strokeStyle = P.rim;
  ctx.lineWidth = RIM;
  for (const b of leaves) ctx.stroke(lobePath(cx, cy, b, 1, 1));

  const inner = new Path2D();
  for (const b of leaves) inner.addPath(lobeInPath(cx, cy, b, RIM * 0.5));
  ctx.save();
  ctx.clip(inner);
  const rxMax = Math.max(...leaves.map((l) => Math.abs(l.dx) + l.rx));
  const ryMax = Math.max(...leaves.map((l) => Math.abs(l.dy) + l.ry));
  const bg = ctx.createLinearGradient(cx - rxMax * 0.4, cy - ryMax, cx + rxMax * 0.3, cy + ryMax);
  bg.addColorStop(0, P.base[0]);
  bg.addColorStop(0.34, P.base[1]);
  bg.addColorStop(0.7, P.base[2]);
  bg.addColorStop(1, P.base[3]);
  ctx.fillStyle = bg;
  ctx.fill(sil);

  for (const b of leaves) {
    // each knob swells; its edge stays close to the mid tone, or every
    // lobe wears a dark ring and the hand falls apart
    const ox = cx + b.dx;
    const oy = cy + b.dy;
    ctx.save();
    ctx.clip(lobeInPath(cx, cy, b, RIM * 0.5));
    const dome = ctx.createRadialGradient(
      ox - b.rx * 0.2,
      oy - b.ry * 0.56,
      b.ry * 0.05,
      ox,
      oy + b.ry * 0.3,
      b.rx * 1.05,
    );
    dome.addColorStop(0, P.dome[0]);
    dome.addColorStop(0.42, P.dome[1]);
    dome.addColorStop(0.82, P.dome[2]);
    dome.addColorStop(1, P.dome[3]);
    ctx.fillStyle = dome;
    ctx.fill(lobePath(cx, cy, b, 1, 1));
    ctx.translate(ox, oy);
    ctx.rotate(b.rot ?? 0); // ring ridges: at the joints and the tips, not ruled evenly
    const bands = b.tip ? 4 : 3;
    for (let i = 0; i < bands; i++) {
      const lx = b.rx * (b.tip ? 0.22 + i * 0.18 : -0.52 + i * 0.2);
      const q = 1 - (lx / b.rx) * (lx / b.rx);
      if (q <= 0) continue;
      const hgt = b.ry * Math.sqrt(q) * 0.8;
      ctx.strokeStyle = P.ridge;
      ctx.lineWidth = 2.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lx, -hgt);
      ctx.quadraticCurveTo(lx + b.rx * 0.055, 0, lx, hgt);
      ctx.stroke();
      ctx.strokeStyle = P.lip;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(lx - 2.6, -hgt * 0.94);
      ctx.quadraticCurveTo(lx + b.rx * 0.055 - 2.6, 0, lx - 2.6, hgt * 0.94);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Contact shadows: a finger casts its shadow on the body just outside
  // its own outline, so the dark is a narrow annulus hugging the finger,
  // clipped to the body lobe it grows from.
  for (const f of leaves) {
    if (!f.tip) continue;
    for (const b of leaves) {
      if (!b.mass) continue;
      ctx.save();
      ctx.clip(lobeInPath(cx, cy, b, RIM * 0.5));
      for (const [o, i2, a] of [
        [1.07, 1.0, 0.3],
        [1.15, 1.07, 0.17],
        [1.24, 1.15, 0.08],
      ] as const) {
        const ring = new Path2D();
        ring.addPath(lobePath(cx, cy, f, o, o));
        ring.addPath(lobePath(cx, cy, f, i2, i2));
        ctx.fillStyle = alpha(P.occl, a);
        ctx.fill(ring, "evenodd");
      }
      ctx.restore();
    }
  }

  for (const b of leaves) {
    // a blunt, slightly paler finger end
    if (!b.tip) continue;
    const m = Math.hypot(b.dx, b.dy) || 1;
    const sx = cx + b.dx + (b.dx / m) * b.rx * 0.46;
    const sy = cy + b.dy + (b.dy / m) * b.ry * 0.46;
    const ng = ctx.createRadialGradient(sx - b.ry * 0.1, sy - b.ry * 0.14, 1, sx, sy, b.ry * 0.62);
    ng.addColorStop(0, P.node[0]);
    ng.addColorStop(0.58, P.node[1]);
    ng.addColorStop(1, P.node[2]);
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.ellipse(sx, sy, b.ry * 0.42, b.ry * 0.3, b.rot ?? 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.ridge;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(sx, sy, b.ry * 0.5, b.ry * 0.37, b.rot ?? 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (P.freckle) {
    // corky freckles: the shell has them, the shaved flesh does not
    for (let i = 0; i < 70; i++) {
      const a = i * 2.399;
      const r = Math.sqrt((i + 0.5) / 70);
      const x = cx + Math.cos(a) * rxMax * r * 0.94;
      const y = cy + Math.sin(a) * ryMax * r * 0.94;
      ctx.fillStyle = i % 3 ? P.freckle[0] : P.freckle[1];
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + (i % 4) * 0.55, 1.3 + (i % 3) * 0.45, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // One light over the whole hand: eight per-lobe domes are eight little
  // suns, so a multiply pass grades the finished body across a single
  // upper-left source.
  ctx.globalCompositeOperation = "multiply";
  const glob = ctx.createLinearGradient(cx - rxMax * 0.8, cy - ryMax, cx + rxMax * 0.8, cy + ryMax);
  glob.addColorStop(0, P.grade[0]);
  glob.addColorStop(0.44, P.grade[1]);
  glob.addColorStop(0.8, P.grade[2]);
  glob.addColorStop(1, P.grade[3]);
  ctx.fillStyle = glob;
  ctx.fill(sil);
  ctx.globalCompositeOperation = "source-over";
  const shade = ctx.createLinearGradient(cx, cy + ryMax * 0.04, cx, cy + ryMax);
  shade.addColorStop(0, alpha(P.under, 0));
  shade.addColorStop(1, alpha(P.under, 0.4));
  ctx.fillStyle = shade;
  ctx.fill(sil);
  const lit = ctx.createLinearGradient(
    cx - rxMax * 0.5,
    cy - ryMax,
    cx + rxMax * 0.15,
    cy + ryMax * 0.05,
  );
  lit.addColorStop(0, alpha(P.sheen, 0.3));
  lit.addColorStop(1, alpha(P.sheen, 0));
  ctx.fillStyle = lit;
  ctx.fill(sil);
  ctx.restore();
}

const PEELED_PALETTE: GingerPalette = {
  rim: "#C7A24C",
  base: ["#FDF6D2", "#F8E9A2", "#EBD173", "#C9A544"],
  dome: ["#FFFBDC", "#FAEDA9", "#F0DD88", "#D6BC5F"],
  ridge: "rgba(176,140,52,0.26)",
  lip: "rgba(255,253,226,0.52)",
  occl: "rgba(150,118,40,$A)",
  node: ["#FFFDE6", "#F5E9AE", "rgba(214,186,104,0)"],
  freckle: null,
  grade: ["#FFFFFB", "#FDF6DC", "#E9D496", "#CEB268"],
  under: "rgba(128,100,28,$A)",
  sheen: "rgba(255,255,238,$A)",
};

const SKIN_PALETTE: GingerPalette = {
  rim: "#8A6634",
  base: ["#F4E6C6", "#E4CFA0", "#C2A067", "#8E6B36"],
  dome: ["#F6EAC9", "#EAD6A6", "#D8BE8A", "#C2A470"],
  ridge: "rgba(122,88,38,0.30)",
  lip: "rgba(255,248,222,0.42)",
  occl: "rgba(88,60,24,$A)",
  node: ["#F8EDCD", "#E3CB99", "rgba(176,138,78,0)"],
  freckle: ["rgba(132,96,44,0.13)", "rgba(80,54,20,0.11)"],
  grade: ["#FFFDF6", "#F6EBD6", "#D8BC92", "#BC9A6A"],
  under: "rgba(70,46,16,$A)",
  sheen: "rgba(255,250,230,$A)",
};

export function gingerTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function gingerLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(GINGER_LEAVES, scale);
}

/**
 * `peeled` selects which of the two palettes gingerBody paints — the
 * pale shaved rhizome (true, PAINT.ginger's role) or the corky tan shell
 * (false/undefined, SKIN.ginger's role) — see ClusterRenderer's own
 * doc in PreparationScene.ts for why this is a trailing optional
 * parameter every other cluster ingredient's paint function simply
 * ignores, the same convention EllipseRenderer/TaperRenderer/
 * CapsuleRenderer already use for their own peelable ingredients.
 */
export function paintGingerTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
  peeled = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  gingerBody(ctx, cx, cy, leaves, peeled ? PEELED_PALETTE : SKIN_PALETTE);
}
