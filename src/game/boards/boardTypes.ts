/**
 * BOARD_TYPES — the shape of the single authoritative cutting-board
 * catalog (Phase 9), mirroring src/game/knives/knifeTypes.ts's
 * architecture exactly: one BoardDefinition per board, no RPG stats.
 * Boards are purely a material/visual identity — nothing here is allowed
 * to become a `speed`/`accuracy`/`coinBonus`/`xpBonus` field. The starter
 * board (walnut) must never be secretly worse than any board unlocked
 * later.
 */

export type BoardId =
  "walnut" | "maple" | "herb" | "marble" | "darkoak" | "copper" | "butcherblock" | "seafoodslate";

/** boardTexture.ts's paint treatment for the face — "grain" (wood stripes, the default) or a material-specific alternative. */
export type BoardPattern = "grain" | "marble" | "copper" | "herb";

export type BoardVisual = {
  /** [light, mid, dark] hex — the same 3-stop gradient paintBoardTexture already used, just per-board instead of a single hardcoded walnut tone. */
  tone: readonly [string, string, string];
  pattern: BoardPattern;
  /** Optional accent color (a thin trim/inset) — used by "herb"/"copper" patterns. */
  accent?: string;
};

export type BoardDefinition = {
  id: BoardId;
  name: string;
  tagline: string;
  description: string;
  material: string;
  price: number;
  /** Numeric level requirement — 1 means available from the start. */
  unlockLevel: number;
  visual: BoardVisual;
};
