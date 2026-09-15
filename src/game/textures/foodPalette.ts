/**
 * FOOD_PALETTE — ported verbatim (same hex values) from the reference
 * ("Lovable") art batch's palette.ts, shared by every "polygon"-shape
 * ingredient's texture file so the batch reads as one artist, exactly as
 * intended there. `polygonCanvas.ts`'s `hex()` converts these to CSS.
 */
export const LIGHT = { x: -0.45, y: -0.6 } as const; // normalised key-light direction (upper-left)

export const PAL = {
  shadow: 0x3e2819,
  crumbShadow: 0x8a6238,

  mushroomCapDark: 0x8a6440,
  mushroomCap: 0xb08355,
  mushroomCapLight: 0xd0a878,
  mushroomGill: 0xc9a882,
  mushroomGillDark: 0x9a7550,
  mushroomStem: 0xefdfc2,
  mushroomStemShade: 0xd6c09b,
  mushroomFlesh: 0xf6ecd8,

  // Red bell pepper (not the reference's green) — per explicit user
  // request. pepperStem stays green: a red bell pepper's stem/calyx is
  // still green in real life, only the body changes color.
  pepperDark: 0x8a2418,
  pepper: 0xd0402a,
  pepperLight: 0xf07a4e,
  pepperStem: 0x4b7a35,
  pepperFlesh: 0xf7d9c4,
  pepperCavity: 0xf0b89a,
  pepperSeed: 0xf2e6a8,

  strawberryDark: 0x9c1f2a,
  strawberry: 0xd23440,
  strawberryLight: 0xef6a63,
  strawberrySeed: 0xf3dd9a,
  strawberryFlesh: 0xf3b3ac,
  strawberryCore: 0xfae4dc,
  leaf: 0x5f8f4a,
  leafDark: 0x44693a,

  appleDark: 0xa02a2b,
  apple: 0xd14a38,
  appleLight: 0xe8834c,
  appleBlush: 0xf0b45c,
  appleFlesh: 0xf7edcf,
  appleCore: 0xe4d3ab,
  appleSeed: 0x5b3a22,
  stemWood: 0x6b4226,

  crustDark: 0x9a5f2c,
  crust: 0xc07b3a,
  crustLight: 0xdca25a,
  crumb: 0xf3e0b6,
  crumbLight: 0xfaeed0,
  crumbHole: 0xe2c894,
} as const;
