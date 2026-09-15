/**
 * STEAK_TEXTURE — ported verbatim from knifecraft.html's actual
 * `PAINT.steak(c2,g)` (source `:8179`) against the real
 * `shape:'fillet'` geometry, ZERO new geometry of its own — a ribeye is
 * a teardrop (one broad round shoulder running out to a blunt point),
 * so `STEAK_GEOMETRY`'s rail overrides retune the same `fillet` family
 * chicken uses rather than replacing it. No SKIN entry, no `hasCut`
 * split — see chickenTexture.ts's own doc for why.
 *
 * What makes it beef rather than recoloured chicken is two things paint
 * owns: MARBLING (a pale branching web through the muscle) and the FAT
 * CAP along the lower rail. Both are built as rail-space REGIONS/
 * THREADS, so a piece clip inherits its own share of them for free —
 * the same structural argument the cucumber skin/flesh inset makes.
 * Rebuilt (per the source's own history) after a first pass read as a
 * flat single-tone muscle with a few pale squiggles: a ribeye is MUSCLE
 * GROUPS separated by fat, painted in that order — ground, the two
 * groups toned off the fat seam, grain per group along its own
 * direction, the marbling web (threads + branches + flecks, densest in
 * the eye), then the seam and outer cap as irregular fat with soft
 * boundaries. All variation hashed off the loop index, never
 * `Math.random`.
 */
import { makeFilletRailAt, traceFilletPath, type FilletOpts } from "../ingredientShapes";
import { filletHash, filletRegion, filletTaperStroke, filletThread } from "./proteinPaintHelpers";

export function steakTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintSteakTexture(
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
  // The fat seam's path down the body, as a v-function of s: low at the
  // shoulder, rising across to the tip.
  const seam = (s: number) =>
    clamp01(
      0.8 - 0.3 * Math.pow(clamp01((s - 0.02) / 0.94), 0.7) + 0.035 * Math.sin(5.3 * s + 0.7),
    );

  const base = ctx.createLinearGradient(cx - rx * 0.5, cy - ry, cx + rx * 0.7, cy + ry);
  base.addColorStop(0, "#D24E55");
  base.addColorStop(0.34, "#C03C46");
  base.addColorStop(0.7, "#AC313B");
  base.addColorStop(1, "#962731");
  ctx.fillStyle = base;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);
  // THE TWO GROUPS. The eye is fractionally brighter and pinker than
  // the side muscle, which is the difference a photograph shows;
  // painted as regions off the seam so the boundary is the fat, not a
  // gradient.
  const eye = filletRegion(
    at,
    0.02,
    0.99,
    () => 0.02,
    (s) => seam(s) - 0.02,
  );
  const side = filletRegion(
    at,
    0.02,
    0.99,
    (s) => seam(s) + 0.02,
    () => 0.98,
  );
  ctx.fillStyle = "rgba(214,92,92,0.12)";
  ctx.fill(eye);
  ctx.fillStyle = "rgba(130,32,38,0.14)";
  ctx.fill(side);
  // FORM — shoulder proud, trailing edge falling away, both soft enough
  // to stay diffuse.
  const sh = at(0.3, 0.34);
  const lo = at(0.7, 0.9);
  const dome = ctx.createRadialGradient(sh[0], sh[1], ry * 0.1, sh[0], sh[1], ry * 1.7);
  dome.addColorStop(0, "rgba(255,198,188,0.26)");
  dome.addColorStop(0.55, "rgba(255,188,178,0.10)");
  dome.addColorStop(1, "rgba(255,188,178,0)");
  ctx.fillStyle = dome;
  ctx.fill(sil);
  const fall = ctx.createRadialGradient(lo[0], lo[1], ry * 0.12, lo[0], lo[1], ry * 1.6);
  fall.addColorStop(0, "rgba(90,18,24,0.24)");
  fall.addColorStop(0.6, "rgba(90,18,24,0.10)");
  fall.addColorStop(1, "rgba(90,18,24,0)");
  ctx.fillStyle = fall;
  ctx.fill(sil);
  // GRAIN — dense and short, and each group's fibres run along ITS own
  // direction: the eye's bundles curve around the shoulder, the side
  // muscle's run along the seam. 80 strokes at very low alpha merge
  // into tone at gameplay size.
  ctx.lineCap = "round";
  for (let k = 0; k < 80; k++) {
    const inEye = k % 3 !== 2;
    const s0 = 0.05 + 0.88 * h(k + 3, 37);
    const v0 = inEye
      ? 0.06 + (seam(s0) - 0.1) * h(k + 5, 23)
      : seam(s0) + 0.06 + (0.9 - seam(s0)) * h(k + 7, 19);
    const len = 0.045 + 0.055 * h(k + 11, 13);
    const curl = inEye ? -0.22 + 0.34 * h(k + 13, 11) : -0.1 + 0.1 * h(k + 17, 7);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(at(s0 + len * t, clamp01(v0 + curl * len * 4 * t)));
    }
    filletTaperStroke(
      ctx,
      pts,
      "122,28,34",
      0.075 + 0.035 * h(k + 19, 5),
      2.4 + 1.6 * h(k + 23, 7),
    );
  }
  // MARBLING — a WEB: 54 branching threads plus 140 fine flecks, cream
  // not white, densest in the eye and thinning toward the perimeter,
  // plus 9 heavier streaks for hierarchy.
  for (let k = 0; k < 54; k++) {
    const inEye = k % 4 !== 3;
    const s0 = 0.06 + 0.84 * h(k + 29, 41);
    const v0 = inEye
      ? 0.08 + (seam(s0) - 0.14) * h(k + 31, 29)
      : seam(s0) + 0.08 + (0.86 - seam(s0)) * h(k + 37, 23);
    const gd = inEye ? -0.3 : 0.16;
    const hl = h(k + 43, 17);
    const dir = gd + (-0.34 + 0.68 * h(k + 41, 19));
    const len = 0.03 + 0.115 * hl * hl;
    const pts = filletThread(at, s0, v0, dir, len, 0.18, 7);
    filletTaperStroke(
      ctx,
      pts,
      "253,238,228",
      0.42 + 0.26 * h(k + 47, 11),
      1.1 + 2.0 * h(k + 53, 9),
    );
    if (k % 3 === 0) {
      // a fork off the middle, which is what makes it a web
      const br = filletThread(
        at,
        s0 + len * 0.5,
        v0 + 0.02,
        dir + (h(k + 59, 7) > 0.5 ? 0.6 : -0.6),
        len * 0.5,
        0.2,
        4,
      );
      filletTaperStroke(
        ctx,
        br,
        "253,238,228",
        0.3 + 0.18 * h(k + 61, 9),
        0.9 + 1.2 * h(k + 67, 7),
      );
    }
  }
  for (let k = 0; k < 140; k++) {
    // flecks: the fine grain of marbling, too small to be a line
    const s0 = 0.05 + 0.88 * h(k + 71, 83);
    const v0 = 0.06 + 0.88 * h(k + 73, 89);
    const near = Math.abs(v0 - seam(s0)) < 0.1; // fat crowds around the seam
    const a = (near ? 0.34 : 0.22) + 0.18 * h(k + 79, 11);
    ctx.fillStyle = `rgba(252,234,222,${a.toFixed(3)})`;
    const q = at(s0, v0);
    const rr = 0.7 + 1.5 * h(k + 83, 13);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.5 + h(k + 89, 17));
    ctx.beginPath();
    ctx.ellipse(0, 0, rr * (1.6 + 1.8 * h(k + 97, 7)), rr * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let k = 0; k < 9; k++) {
    // HEAVY STREAKS — the few large fat runs inside the eye, longer and
    // wider than a thread but nothing like the seam.
    const s0 = 0.1 + 0.7 * h(k + 107, 11);
    const v0 = 0.1 + (seam(s0) - 0.18) * h(k + 109, 7);
    const dir = -0.3 + (-0.26 + 0.52 * h(k + 113, 9));
    const pts = filletThread(at, s0, v0, dir, 0.1 + 0.07 * h(k + 127, 7), 0.14, 9);
    filletTaperStroke(
      ctx,
      pts,
      "252,234,222",
      0.46 + 0.16 * h(k + 131, 7),
      2.6 + 2.0 * h(k + 137, 9),
    );
  }
  // THE SEAM — the broad fat boundary between the groups, built as a
  // REGION with two independently wobbling edges (a stroke has a
  // constant width, which read as a painted swoosh). Faded at both ends
  // along the length: a full-length band read as a painted smile.
  const seamBand = filletRegion(
    at,
    0.06,
    0.94,
    (s) => seam(s) - (0.024 + 0.014 * Math.sin(11.0 * s + 1.1) + 0.008 * Math.sin(23.0 * s)),
    (s) => seam(s) + (0.022 + 0.013 * Math.sin(9.3 * s + 2.4) + 0.008 * Math.sin(19.0 * s)),
    72,
  );
  ctx.save();
  ctx.clip(seamBand);
  const sg = ctx.createLinearGradient(at(0.06, 0.5)[0], 0, at(0.94, 0.5)[0], 0);
  sg.addColorStop(0, "rgba(252,234,218,0)");
  sg.addColorStop(0.22, "rgba(252,236,220,0.82)");
  sg.addColorStop(0.62, "rgba(250,232,214,0.74)");
  sg.addColorStop(1, "rgba(246,226,208,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(cx - rx - 8, cy - ry - 8, rx * 2 + 16, ry * 2 + 16);
  ctx.restore();
  // THE OUTER CAP — fat along the lower rail, with an IRREGULAR inner
  // boundary (a smooth boundary reads as a sock pulled over the steak).
  const cap = filletRegion(
    at,
    0.1,
    0.86,
    (s) => 0.96 - (0.038 + 0.022 * Math.sin(7.7 * s + 0.4) + 0.012 * Math.sin(17.0 * s + 1.9)),
    () => 1.0,
    72,
  );
  ctx.save();
  ctx.clip(cap);
  const capG = ctx.createLinearGradient(at(0.1, 0.5)[0], 0, at(0.86, 0.5)[0], 0);
  capG.addColorStop(0, "rgba(242,214,200,0)");
  capG.addColorStop(0.2, "rgba(248,226,210,0.86)");
  capG.addColorStop(0.7, "rgba(240,214,198,0.80)");
  capG.addColorStop(1, "rgba(236,208,192,0)");
  ctx.fillStyle = capG;
  ctx.fillRect(cx - rx - 8, cy - ry - 8, rx * 2 + 16, ry * 2 + 16);
  ctx.restore();
  for (let k = 0; k < 14; k++) {
    // ticks crossing the cap boundary, so it is not a hard line
    const s0 = 0.08 + 0.84 * h(k + 101, 17);
    const pts: [number, number][] = [at(s0, 0.99), at(s0 + 0.01, 0.9 - 0.04 * h(k + 103, 7))];
    filletTaperStroke(ctx, pts, "206,160,136", 0.22, 1.6, () => 1);
  }
  // SHEEN — raw beef is wet, not lacquered: broad, low, along the grain.
  {
    const q = at(0.34, 0.32);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.14);
    const hg = ctx.createRadialGradient(0, 0, 1, 0, 0, rx * 0.3);
    hg.addColorStop(0, "rgba(255,226,218,0.20)");
    hg.addColorStop(0.55, "rgba(255,220,210,0.08)");
    hg.addColorStop(1, "rgba(255,220,210,0)");
    ctx.fillStyle = hg;
    ctx.scale(1, (ry * 0.12) / (rx * 0.3));
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // PERIMETER — darker inside the edge so the steak reads thick, fading
  // inward under the clip.
  ctx.strokeStyle = "rgba(104,24,30,0.22)";
  ctx.lineWidth = ry * 0.2;
  ctx.stroke(sil);
  ctx.strokeStyle = "rgba(92,20,26,0.18)";
  ctx.lineWidth = ry * 0.09;
  ctx.stroke(sil);
  ctx.restore();
  ctx.strokeStyle = "rgba(118,30,36,0.42)";
  ctx.lineWidth = 1.4;
  ctx.stroke(sil);
}
