import { CRATE_ZONES } from "@/game/business/crateDispatch";

/**
 * Unload the Van's (Kitchen Dispatch's) painted art (Crate Dispatch folder, built by scripts/make-crate-dispatch-assets.py). Every piece is
 * optional: until a picture has loaded the screen draws a plain shape. The crates, the gates and the dark blocks are drawn in
 * code (they are bricks of any size, in the colour of their ingredient); the pictures are the room, the wooden
 * frame, the dust puff and the ingredient on every crate.
 */
export type KdArtName = "backdrop" | "counter" | "frame" | "puff" | `item-${string}`;
/** The eight foods painted for this game; every other food reuses the Sauce Station's product picture. */
const OWN_ITEMS = new Set([
  "tomato",
  "carrot",
  "lettuce",
  "onion",
  "cheddar",
  "salmon",
  "mushroom",
  "broccoli",
]);
const ITEMS = [...new Set(Object.values(CRATE_ZONES).flatMap((z) => z.items))];
const NAMES: KdArtName[] = [
  "backdrop",
  "counter",
  "frame",
  "puff",
  ...ITEMS.map((n): KdArtName => `item-${n}`),
];
/** Where a food's picture is (the crates' own 8, or the Sauce Station's products). */
export const itemUrl = (item: string) =>
  OWN_ITEMS.has(item)
    ? `${import.meta.env.BASE_URL}business/cratedispatch/ingredient-${item}.webp`
    : `${import.meta.env.BASE_URL}business/sauce/products/${item}.webp`;

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
    img.src = name.startsWith("item-") ? itemUrl(name.slice(5)) : kdUrl(name);
  }
  return art;
}
