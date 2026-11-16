/**
 * Dessert Run's painted art (Dessert Run Assets, built by scripts/make-dessert-run-assets.py). Every piece is
 * optional: until a file has loaded, or if it is missing, the screen draws the plain shape instead, so the
 * game never waits on art. The waiters come in magenta; each is turned into the colour of its cubes once.
 */

const NAMES = [
  "backdrop",
  "plate",
  "aisle",
  "table",
  "guest-plate",
  "cart",
  "spot",
  "counter",
  "guests",
  "waiter-stand",
  "waiter-run",
  "waiter-b-stand",
  "waiter-b-run",
  "win",
  "jam",
  "sparkle",
] as const;
export type ArtName = (typeof NAMES)[number];

export const artUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/dessertrun/${name}.webp`;

export type RunArt = {
  images: Partial<Record<ArtName, HTMLImageElement>>;
  /** Recoloured waiter sheets, by sheet name and colour. */
  sheets: Map<string, HTMLCanvasElement>;
};

export function loadRunArt(): RunArt {
  const art: RunArt = { images: {}, sheets: new Map() };
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => {
      art.images[name] = img;
    };
    img.src = artUrl(name);
  }
  return art;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Turns the magenta key of a waiter sheet into `hex`. The key is any pixel whose red and blue both stand well
 * above its green; its brightness becomes the new colour's shading, so folds and highlights survive, and a
 * light colour keeps its glow instead of going muddy.
 */
export function recolorKeyed(
  source: CanvasImageSource,
  w: number,
  h: number,
  hex: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const [tr, tg, tb] = hexToRgb(hex);
  const REF = 0.27;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i]! / 255;
    const g = px[i + 1]! / 255;
    const b = px[i + 2]! / 255;
    const m = Math.min(1, Math.max(0, (Math.min(r, b) - g - 0.1) / 0.15));
    if (m <= 0) continue;
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const f = Math.min(1.7, Math.max(0.45, lum / REF));
    const lift = Math.max(0, f - 1) * 0.8;
    const k = Math.min(1, f);
    const nr = Math.min(255, tr * k) * (1 - lift) + 255 * lift;
    const ng = Math.min(255, tg * k) * (1 - lift) + 255 * lift;
    const nb = Math.min(255, tb * k) * (1 - lift) + 255 * lift;
    px[i] = px[i]! * (1 - m) + nr * m;
    px[i + 1] = px[i + 1]! * (1 - m) + ng * m;
    px[i + 2] = px[i + 2]! * (1 - m) + nb * m;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** A waiter sheet (stand or run) in the colour of `hex`, made on first use; null until the file has loaded. */
export function waiterSheet(
  art: RunArt,
  kind: "stand" | "run",
  variant: 0 | 1,
  hex: string,
): HTMLCanvasElement | null {
  const name = (variant ? `waiter-b-${kind}` : `waiter-${kind}`) as ArtName;
  const img = art.images[name];
  if (!img) return null;
  const key = `${name}|${hex}`;
  let sheet = art.sheets.get(key);
  if (!sheet) {
    try {
      sheet = recolorKeyed(img, img.naturalWidth, img.naturalHeight, hex);
    } catch {
      return null; // a browser that will not read the picture back: the plain waiter stays
    }
    art.sheets.set(key, sheet);
  }
  return sheet;
}

/** The side of one waiter frame in the built sheets. */
export const FRAME = 192;
