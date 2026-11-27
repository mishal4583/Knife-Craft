import { CRATE_SKINS, cargoItem, type CrateSkin } from "@/game/business/crateCargo";

/**
 * Unload the Van's (Kitchen Dispatch's) painted art (Crate Dispatch folder, built by scripts/make-crate-dispatch-assets.py; the cargo's crate
 * skins, door tags and delivery slip from Van Cargo Assets, scripts/make-van-cargo-assets.py). Every piece is
 * optional: until a picture has loaded the screen draws a plain shape. The crates, the gates and the dark blocks are drawn in
 * code (they are bricks of any size, in the colour of their cargo), with the cargo's crate skin laid over them; the other pictures are the room,
 * the wooden frame, the dust puff and the cargo on every crate. The 140 cargo pictures are the game's own, each loaded only when a board carries it.
 */
export type KdArtName =
  "backdrop" | "counter" | "frame" | "puff" | `skin-${CrateSkin}` | "tag-delivered" | "tag-needed";
/** A cut crate skin's size and its corner squares (scripts/make-van-cargo-assets.py SKIN_SIZE, SKIN_SLICE): the nine-slice the game draws it with. */
export const SKIN_SIZE = 320;
export const SKIN_SLICE = 80;
/** Where the blank paper is on the delivery slip's clipboard (slip.webp), as fractions of the picture: below the clip, inside the wooden rim. */
export const SLIP_SIZE = { w: 528, h: 749 } as const;
export const SLIP_PAPER = { left: 0.085, top: 0.178, right: 0.909, bottom: 0.934 } as const;
/** The eight foods painted for this game; every other item uses its ingredient, pantry or supply picture. */
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
const NAMES: KdArtName[] = [
  "backdrop",
  "counter",
  "frame",
  "puff",
  ...CRATE_SKINS.map((skin) => `skin-${skin}` as const),
  "tag-delivered",
  "tag-needed",
];
const FOLDER = {
  ingredient: "business/ingredients",
  pantry: "business/sauce/products",
  supply: "business/supplies",
} as const;
/** Where a cargo item's picture is. */
export const itemUrl = (item: string) =>
  OWN_ITEMS.has(item)
    ? `${import.meta.env.BASE_URL}business/cratedispatch/ingredient-${item}.webp`
    : `${import.meta.env.BASE_URL}${FOLDER[cargoItem(item)?.source ?? "ingredient"]}/${item}.webp`;

export const kdUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/cratedispatch/${name}.webp`;

export type KdArt = {
  images: Partial<Record<KdArtName, HTMLImageElement>>;
  /** Cargo pictures asked for so far: null while loading (or if it failed). */
  items: Map<string, HTMLImageElement | null>;
};

export function loadKdArt(): KdArt {
  const art: KdArt = { images: {}, items: new Map() };
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => {
      art.images[name] = img;
    };
    img.src = kdUrl(name);
  }
  return art;
}

/** A cargo item's picture once it has loaded (asking the first time starts the load); null until then. */
export function itemPicture(art: KdArt | null, item: string): HTMLImageElement | null {
  if (!art) return null;
  const hit = art.items.get(item);
  if (hit !== undefined) return hit;
  art.items.set(item, null);
  const img = new Image();
  img.onload = () => {
    art.items.set(item, img);
  };
  img.src = itemUrl(item);
  return null;
}
