import { MOMENT_KIND_LABEL, type KitchenMoment } from "@/game/kitchenMoments";
import kitchenBg from "@/assets/kitchen-bg.jpg";

/**
 * MOMENT_CARD — Phase 6: draws a Kitchen Moment card on its own canvas, in
 * the game's look (the kitchen painting, cream paper, a gold frame, Fraunces
 * / Nunito / Caveat — the game's own same-origin fonts and image, so the
 * canvas stays exportable). The card is drawn once per opening, never per
 * render, and nothing of the game's canvas or UI is in it. 4:5 portrait
 * (1080 × 1350), the common shareable post size.
 */
export const CARD = { W: 1080, H: 1350 } as const;

const C = {
  walnut: "#3e2819",
  walnutMid: "#6b4a2f",
  cream: "#fbf3e2",
  ivory: "#fffaf0",
  gold: "#d8a84e",
  copper: "#b5652e",
  olive: "#5d6b3a",
};
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

/** A recipe's emoji can be its cuisine's flag, which some systems draw as two letters: use a plate then. */
export function cardEmoji(emoji: string): string {
  return /\p{Regional_Indicator}/u.test(emoji) ? "🍽️" : emoji;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a missing picture: the card is drawn without it
    img.src = src;
  });
}

async function fontsReady(): Promise<void> {
  const f = typeof document !== "undefined" ? document.fonts : undefined;
  if (!f) return;
  try {
    await Promise.all([
      f.load('900 80px "Fraunces"'),
      f.load('800 40px "Nunito"'),
      f.load('700 52px "Caveat"'),
    ]);
  } catch {
    // a font that can't load falls back to the stack's next font
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wraps `text` to `maxW`, at most `maxLines` (the last ends with … if cut). */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx)
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Draws `m` and returns the canvas (1080 × 1350). Never throws for a missing picture or font. */
export async function drawMomentCard(m: KitchenMoment): Promise<HTMLCanvasElement> {
  await fontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = CARD.W;
  canvas.height = CARD.H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const { W, H } = CARD;

  // backdrop: the kitchen painting, warmed and darkened
  ctx.fillStyle = C.walnut;
  ctx.fillRect(0, 0, W, H);
  const bg = await loadImage(kitchenBg);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    ctx.globalAlpha = 1;
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(62,40,25,0.55)");
  shade.addColorStop(1, "rgba(62,40,25,0.85)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // the wordmark
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.gold;
  ctx.font = '900 76px "Fraunces", Georgia, serif';
  spaced(ctx, 10);
  ctx.fillText("KNIFECRAFT", W / 2, 126);
  spaced(ctx, 6);
  ctx.font = '800 26px "Nunito", system-ui, sans-serif';
  ctx.fillStyle = "rgba(255,250,240,0.75)";
  ctx.fillText("A KITCHEN MOMENT", W / 2, 172);
  spaced(ctx, 0);

  // the paper card with its gold frame
  const px = 84;
  const py = 220;
  const pw = W - px * 2;
  const ph = H - py - 150;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, px, py, pw, ph, 48);
  const paper = ctx.createLinearGradient(0, py, 0, py + ph);
  paper.addColorStop(0, C.ivory);
  paper.addColorStop(1, C.cream);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.gold;
  roundRect(ctx, px + 18, py + 18, pw - 36, ph - 36, 36);
  ctx.stroke();

  // the kind
  const label = MOMENT_KIND_LABEL[m.kind];
  ctx.fillStyle = C.copper;
  ctx.font = '800 34px "Nunito", system-ui, sans-serif';
  spaced(ctx, 5);
  ctx.fillText(label.title.toUpperCase(), W / 2, py + 96);
  spaced(ctx, 0);

  // the picture, in a warm disc
  const cy = py + 300;
  const disc = ctx.createRadialGradient(W / 2, cy, 20, W / 2, cy, 190);
  disc.addColorStop(0, "rgba(246,215,122,0.65)");
  disc.addColorStop(1, "rgba(246,215,122,0)");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(W / 2, cy, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `200px ${EMOJI_FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(cardEmoji(m.emoji), W / 2, cy + 6);
  ctx.textBaseline = "alphabetic";

  // the heading
  ctx.fillStyle = C.walnut;
  ctx.font = '900 70px "Fraunces", Georgia, serif';
  const head = wrap(ctx, m.heading, pw - 140, 2);
  let y = py + 580;
  for (const l of head) {
    ctx.fillText(l, W / 2, y);
    y += 80;
  }

  // the badge
  ctx.font = '800 32px "Nunito", system-ui, sans-serif';
  const badge = wrap(ctx, m.badge, pw - 220, 1)[0]!;
  const bw = Math.min(pw - 160, ctx.measureText(badge).width + 64);
  roundRect(ctx, W / 2 - bw / 2, y - 22, bw, 56, 28);
  ctx.fillStyle = "rgba(216,168,78,0.28)";
  ctx.fill();
  ctx.fillStyle = C.walnutMid;
  ctx.fillText(badge, W / 2, y + 17);
  y += 104;

  // the facts
  ctx.fillStyle = C.walnutMid;
  ctx.font = '700 50px "Caveat", cursive';
  const facts = m.lines.flatMap((l) => wrap(ctx, l, pw - 140, 2)).slice(0, 4);
  for (const l of facts) {
    ctx.fillText(l, W / 2, y);
    y += 58;
  }

  // the brand mark
  ctx.fillStyle = "rgba(255,250,240,0.85)";
  ctx.font = '800 30px "Nunito", system-ui, sans-serif';
  spaced(ctx, 3);
  ctx.fillText("🔪  KnifeCraft · cozy café prep", W / 2, H - 64);
  spaced(ctx, 0);
  return canvas;
}

/** The card as a PNG blob (null when the browser can't export). */
export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null); // a tainted canvas or a missing encoder
    }
  });
}

/** A file name for a saved card: knifecraft-<kind>-<dish>.png */
export function cardFileName(m: KitchenMoment): string {
  const slug =
    m.dishName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "dish";
  return `knifecraft-${m.kind}-${slug}.png`;
}
