import { CRATE_W, type CrateItem } from "@/game/business/deliveryInspection";

/**
 * PIXEL-ACCURATE TAPS for Delivery Inspection (developer 2026-11-21: "I clicked on the sweet potato behind and it picked the wrong item. Optimize the touch and its accuracy").
 * Every ingredient is a round box, and a box drawn later takes the tap even where its picture is empty (the corners of a circle round a zucchini), so a tap on the sweet potato
 * half hidden behind it went to the zucchini. Now the tap is judged on the PICTURES: the topmost ingredient whose own pixel under the finger is solid gets it. A finger is wider
 * than a pixel, so when no solid pixel is under it, the nearest solid one within `SLACK_PX` (the finger's pad, widening ring by ring) is used instead, again the topmost.
 */
type Mask = { w: number; h: number; a: Uint8ClampedArray };
const masks = new Map<string, Mask | "none">();
const loading = new Set<string>();
const urlOf = (id: string) => `${import.meta.env?.BASE_URL ?? "/"}business/ingredients/${id}.webp`;

/** Reads a picture's alpha once (a small canvas, 160 px). A picture that cannot be read counts as a round shape (see `alphaAt`). */
export function loadMask(id: string): void {
  if (masks.has(id) || loading.has(id) || typeof document === "undefined") return;
  loading.add(id);
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 160;
      c.height = img.naturalHeight || 160;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) throw new Error("no canvas");
      g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const a = new Uint8ClampedArray(c.width * c.height);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]!;
      masks.set(id, { w: c.width, h: c.height, a });
    } catch {
      masks.set(id, "none");
    }
    loading.delete(id);
  };
  img.onerror = () => {
    masks.set(id, "none");
    loading.delete(id);
  };
  img.src = urlOf(id);
}

/** For the QA only: gives an ingredient a mask made by `solid(nx, ny)` (a browser reads the real picture instead). */
export function setMaskForTest(
  id: string,
  solid: (nx: number, ny: number) => boolean,
  n = 80,
): void {
  const a = new Uint8ClampedArray(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) a[y * n + x] = solid((x + 0.5) / n, (y + 0.5) / n) ? 255 : 0;
  masks.set(id, { w: n, h: n, a });
}

/** The picture's opacity (0 to 255) at `nx`, `ny` of its box (0 to 1); a round shape when the picture is not known. */
export function alphaAt(id: string, nx: number, ny: number): number {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;
  const m = masks.get(id);
  if (!m || m === "none") return Math.hypot(nx - 0.5, ny - 0.5) <= 0.42 ? 255 : 0;
  const x = Math.min(m.w - 1, Math.floor(nx * m.w));
  const y = Math.min(m.h - 1, Math.floor(ny * m.h));
  return m.a[y * m.w + x]!;
}

const SOLID = 40;
/** How far from the finger a solid pixel still counts, in screen px (a finger's pad is about 18 px across). */
export const SLACK_PX = 14;

/** One item as the hit test needs it. `z` is its paint order. */
export type Pickable = { item: CrateItem; z: number };

/** True when the point (area px) is on the item's own solid pixel. */
function solidAt(it: CrateItem, u: number, px: number, py: number): boolean {
  const cx = it.x * u;
  const cy = it.y * u;
  const size = it.size * u;
  const r = (-it.tilt * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(r) - dy * Math.sin(r);
  const ly = dx * Math.sin(r) + dy * Math.cos(r);
  return alphaAt(it.ingredient, lx / size + 0.5, ly / size + 0.5) >= SOLID;
}

/**
 * The item under a point of the crate area (`px`, `py` in screen px from its top-left, `width` its width), or null. Exact first; then rings of 3, 6, 10 and `SLACK_PX`
 * px round the point, the first ring with a solid pixel deciding, the topmost item of it winning.
 */
export function pickItem(
  list: readonly Pickable[],
  width: number,
  px: number,
  py: number,
): CrateItem | null {
  const u = width / CRATE_W;
  const ordered = [...list].sort((a, b) => b.z - a.z || b.item.id - a.item.id);
  const at = (x: number, y: number) => ordered.find((p) => solidAt(p.item, u, x, y))?.item ?? null;
  const exact = at(px, py);
  if (exact) return exact;
  for (const r of [3, 6, 10, SLACK_PX]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const hit = at(px + Math.cos(a) * r, py + Math.sin(a) * r);
      if (hit) return hit;
    }
  }
  return null;
}
