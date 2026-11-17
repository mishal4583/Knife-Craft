import { CRATE_INGREDIENTS, type CrateIngredient } from "@/game/business/crateDispatch";

/**
 * Kitchen Dispatch's painted art (Crate Dispatch folder, built by scripts/make-crate-dispatch-assets.py). Every piece is
 * optional: until a picture has loaded the screen draws a plain shape. The crates, the gates and the dark blocks are drawn in
 * code (they are bricks of any size, in the colour of their ingredient); the pictures are the room, the wooden
 * frame, the dust puff and the ingredient on every crate.
 */
export type KdArtName = "backdrop" | "counter" | "frame" | "puff" | `ingredient-${CrateIngredient}`;
const NAMES: KdArtName[] = [
  "backdrop",
  "counter",
  "frame",
  "puff",
  ...CRATE_INGREDIENTS.map((n): KdArtName => `ingredient-${n}`),
];

export const kdUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/cratedispatch/${name}.webp`;

export type KdArt = {
  images: Partial<Record<KdArtName, HTMLImageElement>>;
};

export function loadKdArt(): KdArt {
  const art: KdArt = { images: {} };
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => {
      art.images[name] = img;
    };
    img.src = kdUrl(name);
  }
  return art;
}
