import {
  CRATE_COLORS,
  CRATE_INGREDIENTS,
  type CrateIngredient,
} from "@/game/business/crateDispatch";
import { recolorKeyed } from "./dessertRunArt";

/**
 * Kitchen Dispatch's painted art (Crate Dispatch folder, built by scripts/make-crate-dispatch-assets.py). Every piece is
 * optional: until a picture has loaded the screen draws a plain shape. The crates and the gates are painted in a magenta
 * key and turned into each ingredient's colour here, once.
 */
export type KdArtName =
  | "backdrop"
  | "counter"
  | "frame"
  | "crate-2"
  | "crate-3"
  | "gate"
  | "tile"
  | "puff"
  | `ingredient-${CrateIngredient}`;
const NAMES: KdArtName[] = [
  "backdrop",
  "counter",
  "frame",
  "crate-2",
  "crate-3",
  "gate",
  "tile",
  "puff",
  ...CRATE_INGREDIENTS.map((n): KdArtName => `ingredient-${n}`),
];

export const kdUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/cratedispatch/${name}.webp`;

export type KdArt = {
  images: Partial<Record<KdArtName, HTMLImageElement>>;
  sheets: Map<string, HTMLCanvasElement>;
};

export function loadKdArt(): KdArt {
  const art: KdArt = { images: {}, sheets: new Map() };
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => {
      art.images[name] = img;
    };
    img.src = kdUrl(name);
  }
  return art;
}

/** The crate (2 or 3 cells) or the gate in an ingredient's colour; null until the picture has loaded. */
export function kdSheet(
  art: KdArt,
  kind: "crate-2" | "crate-3" | "gate",
  ingredient: CrateIngredient | string,
): HTMLCanvasElement | null {
  const img = art.images[kind];
  if (!img) return null;
  const key = `${kind}|${ingredient}`;
  let sheet = art.sheets.get(key);
  if (!sheet) {
    const hex = CRATE_COLORS[ingredient as CrateIngredient] ?? "#B98A5A";
    try {
      sheet = recolorKeyed(img, img.naturalWidth, img.naturalHeight, hex);
    } catch {
      return null;
    }
    art.sheets.set(key, sheet);
  }
  return sheet;
}

/**
 * Where the ingredient panels and the arrow plate sit along a painted crate, as fractions of its length
 * (measured on the painted pictures: the cream panels, and the plate at the right end).
 */
export const PANELS: Record<2 | 3, { at: readonly number[]; arrow: number }> = {
  2: { at: [0.266, 0.555], arrow: 0.81 },
  3: { at: [0.194, 0.424, 0.654], arrow: 0.865 },
};
