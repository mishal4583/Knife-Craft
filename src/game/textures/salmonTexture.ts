/**
 * SALMON_TEXTURE — ported verbatim from knifecraft.html's actual
 * `PAINT.salmon(c2,g)` (source `:8318`) against the real
 * `shape:'fillet'` geometry, retuned for the aspect the family was
 * named for: one broad shoulder running out to a long point. No new
 * geometry, no SKIN entry (the reference is a skinned fillet) — see
 * chickenTexture.ts's own doc for why there is no `hasCut` split here.
 *
 * Its whole identity is the MYOCOMMATA — the pale connective stripes
 * banding the muscle at a slant, authored as curves in rail space (`s`
 * slides as `v` crosses the body) so they meet both rails at the right
 * angle wherever the body is thick or thin, and a cut across the
 * fillet shows their cross-section on every piece rather than a plain
 * orange face. Rebuilt (per the source's own history) after a first
 * pass read as a striped balloon — twelve equal, equally-spaced,
 * equally-bright bands over one flat wash. Three things fix it, all
 * true of the fish: (1) the stripes are not a comb — they crowd and
 * steepen toward the tail, vary in width/brightness, and many fade out
 * before reaching the belly; (2) the flesh is not one colour — the loin
 * is deeper, the belly paler and creamier, with fine mottle everywhere;
 * (3) the stripes are RIDGES (a shadow one side, a lit crest the
 * other), which is what stops them reading as printed stripes.
 */
import { makeFilletRailAt, traceFilletPath, type FilletOpts } from "../ingredientShapes";
import { filletHash, filletRegion, filletTaperStroke } from "./proteinPaintHelpers";

export function salmonTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintSalmonTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  opts: FilletOpts = {},
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  const sil = new Path2D();
  traceFilletPath(sil, cx, cy, rx, ry, 0, opts);
  const at = makeFilletRailAt(cx, cy, rx, ry, opts);
  const h = filletHash;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const base = ctx.createLinearGradient(cx - rx * 0.55, cy - ry, cx + rx * 0.72, cy + ry);
  base.addColorStop(0, "#FE8F66");
  base.addColorStop(0.3, "#F8784C");
  base.addColorStop(0.66, "#EB653E");
  base.addColorStop(1, "#D5522E");
  ctx.fillStyle = base;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);
  // FLESH ZONES — the loin (upper, deeper) and the belly (lower, paler
  // and creamier). Regions off the rails, so the tonal break follows
  // the body instead of sitting across it as a gradient.
  const loin = filletRegion(
    at,
    0.02,
    0.99,
    () => 0.02,
    (s) => 0.46 + 0.1 * Math.sin(2.2 * s),
  );
  const belly = filletRegion(
    at,
    0.02,
    0.99,
    (s) => 0.62 + 0.08 * Math.sin(1.9 * s + 0.6),
    () => 0.98,
  );
  ctx.fillStyle = "rgba(196,70,42,0.30)";
  ctx.fill(loin);
  ctx.fillStyle = "rgba(252,186,150,0.16)";
  ctx.fill(belly);
  // FORM
  const sh = at(0.26, 0.3);
  const lo = at(0.72, 0.9);
  const dome = ctx.createRadialGradient(sh[0], sh[1], ry * 0.1, sh[0], sh[1], ry * 2.0);
  dome.addColorStop(0, "rgba(255,230,216,0.34)");
  dome.addColorStop(0.52, "rgba(255,224,208,0.13)");
  dome.addColorStop(1, "rgba(255,224,208,0)");
  ctx.fillStyle = dome;
  ctx.fill(sil);
  const fall = ctx.createRadialGradient(lo[0], lo[1], ry * 0.12, lo[0], lo[1], ry * 1.7);
  fall.addColorStop(0, "rgba(170,66,40,0.30)");
  fall.addColorStop(0.6, "rgba(170,66,40,0.12)");
  fall.addColorStop(1, "rgba(170,66,40,0)");
  ctx.fillStyle = fall;
  ctx.fill(sil);
  // MOTTLE — fine tone breakup in both directions, under the bands.
  // Without it the flesh between bands is a flat wash.
  for (let k = 0; k < 110; k++) {
    const s0 = 0.05 + 0.88 * h(k + 3, 67);
    const v0 = 0.06 + 0.88 * h(k + 5, 71);
    const dark = k % 2 === 0;
    const pts: [number, number][] = [
      at(s0, v0),
      at(s0 + 0.02 + 0.02 * h(k + 7, 9), clamp01(v0 + 0.05 + 0.07 * h(k + 11, 7))),
    ];
    filletTaperStroke(
      ctx,
      pts,
      dark ? "188,76,46" : "255,214,190",
      (dark ? 0.07 : 0.1) + 0.05 * h(k + 13, 7),
      2.2 + 2.0 * h(k + 17, 9),
      () => 1,
    );
  }
  // THE BANDS — thirteen, crowding and steepening toward the tail (a
  // power curve, not linear), each built as three tapered strokes: a
  // warm shadow behind, the pale core, a lit crest in front. The core's
  // envelope is what lets a band fade out partway down the belly.
  for (let k = 0; k < 13; k++) {
    const f = k / 12;
    // pow 1.06, not 1.18: heavier crowding bunched the last four bands
    // into a fingerprint swirl at the tip. A real fillet tightens
    // toward the tail, it does not spiral.
    const s0 = 0.05 + 0.78 * Math.pow(f, 1.06) + 0.016 * h(k + 19, 9);
    const slide = 0.15 + 0.075 * f; // steepening with it, gently
    const bow = 0.022 + 0.018 * h(k + 23, 7);
    const vEnd = 0.72 + 0.26 * h(k + 29, 11);
    const pts = (ds: number, dv: number): [number, number][] => {
      const o: [number, number][] = [];
      for (let i = 0; i <= 20; i++) {
        const v = (i / 20) * vEnd;
        const vv = v / Math.max(vEnd, 0.001);
        o.push(
          at(s0 + ds + slide * vv * vEnd + bow * Math.sin(Math.PI * vv), clamp01(0.05 + v + dv)),
        );
      }
      return o;
    };
    // full through the middle, fading at both ends
    const env = (t: number) => Math.min(1, 2.6 * Math.sin(Math.PI * Math.pow(t, 0.78)));
    filletTaperStroke(ctx, pts(0.016, 0.01), "198,88,54", 0.22, ry * 0.075, env);
    // brightness rises toward the tail: over the thick pale shoulder
    // the bands are subtler in the reference
    filletTaperStroke(
      ctx,
      pts(0, 0),
      "255,236,224",
      (0.42 + 0.26 * h(k + 31, 9)) * (0.8 + 0.24 * f),
      ry * (0.028 + 0.016 * h(k + 37, 7)),
      env,
    );
    filletTaperStroke(ctx, pts(-0.009, -0.004), "255,250,245", 0.26, ry * 0.018, env);
  }
  // GLOSS — fresh fish is the wettest thing in the larder, so it gets
  // more sheen than beef, but broken into three soft slicks rather than
  // one big one: an unbroken highlight is what makes CG food look waxy.
  for (const [s, v, lx, ly, a, rot] of [
    [0.24, 0.24, 0.26, 0.13, 0.3, -0.2],
    [0.5, 0.38, 0.18, 0.08, 0.2, -0.16],
    [0.74, 0.52, 0.11, 0.06, 0.14, -0.12],
  ] as const) {
    const q = at(s, v);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(rot);
    const hg = ctx.createRadialGradient(0, 0, 1, 0, 0, rx * lx);
    hg.addColorStop(0, `rgba(255,247,242,${a})`);
    hg.addColorStop(0.55, `rgba(255,243,236,${(a * 0.4).toFixed(3)})`);
    hg.addColorStop(1, "rgba(255,243,236,0)");
    ctx.fillStyle = hg;
    ctx.scale(1, (ry * ly) / (rx * lx));
    ctx.beginPath();
    ctx.arc(0, 0, rx * lx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // PERIMETER — stronger than an earlier pass, where a near-invisible
  // rim let the fillet read as a flat sticker.
  ctx.strokeStyle = "rgba(172,70,44,0.26)";
  ctx.lineWidth = ry * 0.28;
  ctx.stroke(sil);
  ctx.strokeStyle = "rgba(158,62,38,0.22)";
  ctx.lineWidth = ry * 0.12;
  ctx.stroke(sil);
  ctx.restore();
  ctx.strokeStyle = "rgba(182,78,50,0.42)";
  ctx.lineWidth = 1.4;
  ctx.stroke(sil);
}
