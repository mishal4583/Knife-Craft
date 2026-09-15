/**
 * CUCUMBER_TEXTURE — a real `shape:'capsule'` geometry (a true stadium —
 * see ingredientShapes.ts's makeCapsuleSilhouette/traceCapsulePath), with
 * two entirely distinct paints picked by `hasCut` — the same SKIN/PAINT
 * split every other dual-layer ingredient in this file uses (see
 * kiwiTexture.ts's own doc for the canonical writeup), except here the
 * two states share NO paint at all: uncut is 100% mottled green skin
 * (`hasCut` mirrors PreparationScene's existing `this.cuts.length > 0`
 * plumbing already used for Kiwi/Beetroot/etc.), and once cut, per an
 * explicit user request, the skin disappears ENTIRELY — a cut piece is
 * pure pale flesh wall to wall, not a white core with a surviving green
 * rind band around it.
 *
 * A user-supplied reference photo of real whole cucumbers called out an
 * earlier unconditional pale core as a "thick white line" running the
 * length of an uncut cucumber — fixed by gating the flesh behind
 * `hasCut`. A second reference photo then called out the lengthwise
 * stem-to-blossom color fade (deep green -> pale yellow-green) and
 * density-fading mottling real cucumber skin has, which the whole-state
 * paint below now carries. A follow-up request then asked for the cut
 * state's surviving green rind band to go away completely — this file's
 * `hasCut` branch is that: no skin, no speckling, just flesh.
 */
import { traceCapsulePath } from "../ingredientShapes";

export function cucumberTextureSize(
  rx: number,
  capR: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (capR + margin) * 2 };
}

export function paintCucumberTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  capR: number,
  margin: number,
  hasCut = false,
): void {
  const cx = rx + margin;
  const cy = capR + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  const sil = (pad: number) => {
    ctx.beginPath();
    traceCapsulePath(ctx, cx, cy, rx, capR, pad);
  };

  if (hasCut) {
    // Explicit user request: once a cut is made, the green skin
    // disappears ENTIRELY — a cut piece reads as pure pale flesh, wall to
    // wall, not a white core with a surviving rind band around it. So
    // unlike the uncut branch below, nothing green is painted at all here.
    const fl = ctx.createLinearGradient(cx, cy - capR, cx, cy + capR);
    fl.addColorStop(0, "#FFFFFF");
    fl.addColorStop(0.5, "#FBFCF2");
    fl.addColorStop(1, "#F1F5DD");
    ctx.fillStyle = fl;
    sil(0);
    ctx.fill();

    ctx.save();
    sil(0);
    ctx.clip();
    ctx.fillStyle = "rgba(150,178,110,0.5)"; // the seed channel down the middle
    for (let i = 0; i < 14; i++) {
      const x = cx - rx * 0.78 + (2 * rx * 0.78 * i) / 13;
      ctx.beginPath();
      ctx.ellipse(x, cy + Math.sin(i * 1.7) * 4, 3.1, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(200,208,168,0.45)"; // one soft length highlight
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.7, cy - capR * 0.52);
    ctx.lineTo(cx + rx * 0.7, cy - capR * 0.52);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // --- skin: full body, always drawn, never fades — this is what keeps
  // an uncut cucumber 100% skin (no white line) regardless of `hasCut`.
  //
  // The reference photo's dominant cue isn't the cylindrical roundness —
  // it's a stem-to-blossom fade running the LENGTH of the cucumber (deep
  // green at one end, pale yellow-green at the other), with mottling that
  // is dense/high-contrast near the dark end and thins out toward the
  // pale end. The previous version had a top-to-bottom shading gradient
  // and uniform all-over speckling — no lengthwise fade at all — so it
  // read as flat/uniform next to the real thing. Base fill is now along
  // the long axis (cx-rx..cx+rx) to carry that fade.
  const skin = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
  skin.addColorStop(0, "#33581F");
  skin.addColorStop(0.32, "#4C7A2E");
  skin.addColorStop(0.62, "#7FA34C");
  skin.addColorStop(0.82, "#BBCE7E");
  skin.addColorStop(1, "#D8E6A2");
  ctx.fillStyle = skin;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  // subtle cylindrical roundness on top of the lengthwise fade — a soft
  // highlight along the top edge, a soft shadow along the bottom (the
  // same cheap "lift/shade" trick kiwiTexture.ts's own SKIN pass uses).
  const lift = ctx.createLinearGradient(cx, cy - capR, cx, cy);
  lift.addColorStop(0, "rgba(255,255,255,0.16)");
  lift.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = lift;
  sil(0);
  ctx.fill();
  const shade = ctx.createLinearGradient(cx, cy, cx, cy + capR);
  shade.addColorStop(0, "rgba(20,40,12,0)");
  shade.addColorStop(1, "rgba(20,40,12,0.22)");
  ctx.fillStyle = shade;
  sil(0);
  ctx.fill();
  // the mottled light/dark speckling a real cucumber's rind has — a
  // deterministic hashed scatter (same technique kiwiTexture.ts's own
  // blotch/fuzz passes use), not noise-per-frame — faded out toward the
  // pale end exactly like the reference photo.
  for (let i = 0; i < 150; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 97) / 97);
    const x = cx + Math.cos(a) * rx * 0.96 * r;
    const y = cy + Math.sin(a) * capR * 0.92 * r;
    const xFrac = (x - cx) / rx; // -1 (dark end) .. +1 (pale end)
    const fade = Math.max(0, 1 - Math.max(0, (xFrac - 0.1) / 0.9));
    if (fade <= 0.08) continue;
    const light = i % 4 !== 0;
    ctx.fillStyle = light
      ? `rgba(224,238,164,${(0.34 * fade).toFixed(3)})`
      : `rgba(24,42,16,${(0.2 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      1.6 + 1.5 * (((i * 7919) % 11) / 11),
      1.1 + 1 * (((i * 104729) % 7) / 7),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // faint skin ridging along the length — most visible on the pale end,
  // matching the reference photo's fine light striations there.
  ctx.strokeStyle = "rgba(20,50,16,0.18)";
  ctx.lineWidth = 1.4;
  for (const f of [-0.82, -0.62, 0.62, 0.82]) {
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + capR * f);
    ctx.lineTo(cx + rx, cy + capR * f);
    ctx.stroke();
  }
  ctx.restore();
  // hasCut is always false past this point (the true branch returns
  // above), so an uncut cucumber is 100% mottled skin, wall to wall.
}
