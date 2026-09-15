/**
 * SWEET_POTATO_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.sweetpotato()` (source line 7896, opaque purple-magenta skin)
 * AND `PAINT.sweetpotato()` (source line 6909, the bright yellow flesh).
 * The source composites these as two full-body sprites with a
 * time-based alpha fade production has no equivalent for; baked into
 * one canvas instead — skin drawn full, then — ONLY once `hasCut` is
 * true — the real yellow flesh painted on top clipped to an inset taper,
 * so the purple skin survives at the edge while a cut opens onto the
 * actual ported yellow flesh. See kiwiTexture.ts's own doc for why
 * `hasCut` defaulting to false (an uncut whole stays 100% skin) matters
 * and where the flag comes from.
 */
import { traceTaperPath, type TaperPaintOpts } from "./carrotTexture";

const SKIN_INSET = 16;

export function sweetPotatoTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintSweetPotatoTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
  hasCut = false,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  skin.addColorStop(0, "#C4548C");
  skin.addColorStop(0.34, "#A83368");
  skin.addColorStop(0.72, "#84204B");
  skin.addColorStop(1, "#5E1234");
  ctx.fillStyle = skin;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  const blush = ctx.createLinearGradient(cx - rx * 0.5, cy - rBig, cx + rx * 0.2, cy);
  blush.addColorStop(0, "rgba(240,150,190,0.34)");
  blush.addColorStop(1, "rgba(240,150,190,0)");
  ctx.fillStyle = blush;
  sil(0);
  ctx.fill(); // the lit magenta bloom along the shoulder

  ctx.fillStyle = "rgba(70,12,38,0.20)"; // rough skin: coarse, dense freckle mat
  for (let i = 0; i < 130; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 97) / 97);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.9 * r,
      cy + Math.sin(a) * rBig * 0.85 * r,
      2.2 + 2.4 * (((i * 104729) % 29) / 29),
      1.4 + 1.4 * (((i * 6151) % 19) / 19),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "rgba(226,180,120,0.30)"; // tan lenticels, sparse
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 53) / 53);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.86 * r,
      cy + Math.sin(a) * rBig * 0.8 * r,
      2.0,
      1.2,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    // the dimpled eyes: discrete pits
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 104729) % 41) / 41);
    const x = cx + Math.cos(a) * rx * 0.74 * r;
    const y = cy + Math.sin(a) * rBig * 0.66 * r;
    ctx.fillStyle = "rgba(64,10,34,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y, 3.2, 2.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(248,190,214,0.28)";
    ctx.beginPath();
    ctx.ellipse(x - 0.6, y - 1.6, 2.6, 1.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(74,14,40,0.44)";
  ctx.lineWidth = 1.8;
  sil(0);
  ctx.stroke();

  if (!hasCut) return; // uncut: 100% purple-magenta skin — no yellow flesh showing yet

  // --- PAINT.sweetpotato: the real bright yellow flesh, windowed to an
  // inset taper so the purple skin survives around the edge ---
  ctx.save();
  ctx.beginPath();
  traceTaperPath(
    ctx,
    cx,
    cy,
    rx - SKIN_INSET,
    rBig - SKIN_INSET,
    Math.max(3, rSmall - SKIN_INSET * 0.6),
    buttRound,
    tipRound,
    0,
    opts,
  );
  ctx.clip();

  const fg = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  fg.addColorStop(0, "#FDE870");
  fg.addColorStop(0.5, "#F7D544");
  fg.addColorStop(1, "#E4B826");
  ctx.fillStyle = fg;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  for (let i = -1; i <= 1; i++) {
    // sparse lengthwise fibre, subordinate
    const t = i / 1.4;
    ctx.strokeStyle = i === 0 ? "rgba(198,150,20,0.20)" : "rgba(255,246,190,0.20)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.85, cy + t * rBig * 0.5);
    ctx.quadraticCurveTo(cx, cy + t * rBig * 0.56, cx + rx * 0.85, cy + t * rSmall * 0.46);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(212,168,30,0.10)";
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 79) / 79);
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 0.82 * r,
      cy + Math.sin(a) * rBig * 0.78 * r,
      2.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
