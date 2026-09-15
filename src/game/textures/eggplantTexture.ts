/**
 * EGGPLANT_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.eggplant()` (source line 5727) against the real `taper` geometry
 * (taperCurve/spine — see EGGPLANT_GEOMETRY's own doc in definitions.ts).
 * No cream core painted on the whole vegetable (that's the cut face's
 * job, not the skin sprite's) — just a violet-tinted specular bar that
 * follows the bowed spine, and a five-sepal calyx splayed back over the
 * shoulder at the narrow (tip) end.
 */
import { traceTaperPath, taperH, taperY, type TaperPaintOpts } from "./carrotTexture";

export function eggplantTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintEggplantTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const y = (x: number) => taperY(x, cx, cy, spine, spineRx);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createLinearGradient(cx - rx * 0.3, cy - rBig, cx + rx * 0.35, cy + rBig);
  skin.addColorStop(0, "#7A3893");
  skin.addColorStop(0.3, "#5C2375");
  skin.addColorStop(0.68, "#431A5C");
  skin.addColorStop(1, "#2A0F3B");
  ctx.fillStyle = skin;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();

  // Specular LAST, tinted violet (not white — a near-white streak on a
  // dark skin is the first thing that reads as "white paint on an
  // eggplant"), following the bowed spine so it never slides off the form.
  const N = 40;
  const ga = ctx.createLinearGradient(cx - rx * 0.75, 0, cx + rx * 0.55, 0);
  ga.addColorStop(0, "rgba(178,132,214,0)");
  ga.addColorStop(0.24, "rgba(190,144,224,0.34)");
  ga.addColorStop(0.6, "rgba(184,138,220,0.22)");
  ga.addColorStop(1, "rgba(178,132,214,0)");
  ctx.strokeStyle = ga;
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = cx - rx * 0.8 + (rx * 1.5 * i) / N;
    const yy = y(x) - h(x) * 0.52;
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  }
  ctx.stroke();
  ctx.restore();

  // CALYX at the narrow (tip) end: five curved sepals in two greens plus a
  // short stem, splayed BACK over the shoulder rather than pasted on top.
  const tipX = cx + rx;
  const cy0 = y(tipX - 8);
  const sep: [number, number, number][] = [
    [-0.92, 54, 15],
    [-0.48, 64, 17],
    [0, 70, 18],
    [0.48, 64, 17],
    [0.92, 54, 15],
  ];
  sep.forEach(([a, len, wid], k) => {
    ctx.save();
    ctx.translate(tipX - 26, cy0);
    ctx.rotate(a * 0.62);
    const lg = ctx.createLinearGradient(0, -wid, len, wid);
    const dark = k % 2 === 0;
    lg.addColorStop(0, dark ? "#5C8A38" : "#6FA344");
    lg.addColorStop(1, dark ? "#3D6626" : "#4E7A2E");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, -wid * 0.22);
    ctx.quadraticCurveTo(len * 0.52, wid * 0.86, -8, wid * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(28,54,16,0.30)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  });
  const st = ctx.createLinearGradient(tipX - 18, cy0 - 9, tipX + 16, cy0 + 9);
  st.addColorStop(0, "#7FA84C");
  st.addColorStop(1, "#5A7F31");
  ctx.fillStyle = st;
  ctx.beginPath();
  ctx.ellipse(tipX - 2, cy0 - 4, 22, 10, -0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(28,54,16,0.28)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
