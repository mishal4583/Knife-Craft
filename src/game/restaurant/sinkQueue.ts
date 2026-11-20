/**
 * THE SINK'S QUEUE, as the screen shows it (developer 2026-11-09: "the list of utensils covers a large portion of the screen"). Pure and presentation-only:
 * it only reads what the dishwashing game already knows (the kinds in the sink, the queue of single pieces, how many are washed) and never changes a
 * rule (dishDirt.ts, cleaningDirt.ts and the wash action are untouched). The screen shows ONE row, the "Up next" strip (the kind being washed now and the
 * next few, then "+N"); the whole list is one tap away in a sheet.
 */

export type SinkKind = { id: string; n: number; label: string; icon: string };
export type SinkPiece = { id: string };

export type KindView = SinkKind & {
  /** Pieces of this kind already washed. */
  washed: number;
  /** Pieces of this kind still to wash (the one being washed now included). */
  left: number;
  state: "done" | "current" | "waiting";
};

/** Every kind with how many pieces are washed and what is going on with it (the full list of the sheet). */
export function kindViews(
  items: readonly SinkKind[],
  queue: readonly SinkPiece[],
  cleanedCount: number,
  activeId: string | null,
  finished = false,
): KindView[] {
  const washedPieces = queue.slice(0, cleanedCount);
  return items.map((item) => {
    const washed = washedPieces.filter((q) => q.id === item.id).length;
    const done = washed >= item.n;
    return {
      ...item,
      washed,
      left: Math.max(0, item.n - washed),
      state: done ? "done" : !finished && activeId === item.id ? "current" : "waiting",
    };
  });
}

export type StripView = {
  /** The kind being washed now (null when nothing is left). */
  current: KindView | null;
  /** The next kinds in the order they come. */
  next: KindView[];
  /** How many more kinds are not shown. */
  more: number;
  /** Pieces still to wash in all. */
  piecesLeft: number;
};

/** The "Up next" strip: the current kind and up to `maxNext` kinds after it; finished kinds are not in it. */
export function stripView(views: readonly KindView[], piecesLeft: number, maxNext = 4): StripView {
  const open = views.filter((v) => v.state !== "done");
  const current = open.find((v) => v.state === "current") ?? open[0] ?? null;
  const after = open.filter((v) => v !== current);
  return {
    current,
    next: after.slice(0, maxNext),
    more: Math.max(0, after.length - maxNext),
    piecesLeft: Math.max(0, piecesLeft),
  };
}

/**
 * Where the sink sits on the full-screen picture, as shares of the screen (logical 540 x 960): the stage box the water and the dish live in
 * (x 20-520, y 215-605 of the portrait art: it is centred on the basin floor of W01, which is wide and short, so the scene is fitted into it), and the regions around it.
 */
export const SINK_LAYOUT = {
  stage: { left: 20 / 540, top: 215 / 960, width: 500 / 540, height: 390 / 960 },
  hud: { top: 0, height: 90 / 960 },
  strip: { top: 98 / 960, height: 86 / 960 },
  status: { top: 614 / 960, height: 44 / 960 },
  progress: { top: 662 / 960, height: 28 / 960 },
  // The footer holds the 48 px Done button: it was 54 / 960 (39 px on a 390 px phone) and the button hung out of the frame, so the rack is
  // a little shorter and the footer 70 / 960 (50 px) - developer 2026-11-16, "let the Done button be properly placed".
  rack: { left: 30 / 540, width: 480 / 540, top: 692 / 960, height: 195 / 960 },
  footer: { top: 890 / 960, height: 70 / 960 },
} as const;

/** The scale of the scene (drawn in 360 x 280 units) inside a box: it fits without cropping. */
export function sceneScale(boxW: number, boxH: number, sceneW = 360, sceneH = 280): number {
  if (boxW <= 0 || boxH <= 0) return 1;
  return Math.min(boxW / sceneW, boxH / sceneH);
}

/** The six slot centres of the "Up next" tray, as shares of its width (the painted tray has its slots there; the current kind is first, the last is "+N"). */
export const SLOT_X = [0.13, 0.29, 0.43, 0.57, 0.71, 0.85] as const;

/**
 * Where things are on the painted portrait sink (W01, logical 540 x 960): the basin's inner outline (the water and the suds are cut to it), the tap's
 * spout (the stream falls from here) and the pre-rinse hose head (the spray fans from here). Measured on the delivered picture.
 */
export const BASIN = {
  box: { x: 20, y: 285, w: 500, h: 250 },
  polygon: [
    [52, 291],
    [488, 289],
    [514, 530],
    [24, 528],
  ],
} as const;
export const TAP = { x: 262, y: 220, w: 34, h: 128 } as const;
export const HOSE = { x: 360, y: 236, w: 230, h: 230 } as const;

/**
 * THE WIDE SINK (developer 2026-11-20, `TL-game-dishwashing.png`, 1920 x 1080): in a landscape window the sink is the wide picture, covering the window, with its own layout.
 * Every figure is a share of that 16:9 picture (`left`/`width` as well, because the controls form a column under the sink instead of filling the screen). The stage box is
 * the basin and a little counter round it (the dish is bigger than the basin floor), the Up-next strip and the title sit on the wall to the left, and the status, the progress,
 * the drying rack and the Done button are on the counter under the sink. The crop of a window that is not 16:9 comes mostly off the bottom, a little off the top, so the
 * controls stay between 6 % and 90 % of the picture's height.
 */
export const SINK_LAYOUT_WIDE = {
  stage: { left: 0.3, top: 0.25, width: 0.4, height: 0.33 },
  hud: { left: 0.02, width: 0.27, top: 0.065, height: 0.085 },
  strip: { left: 0.02, width: 0.27, top: 0.165, height: 0.12 },
  status: { left: 0.3, width: 0.4, top: 0.585, height: 0.048 },
  progress: { left: 0.3, width: 0.4, top: 0.64, height: 0.034 },
  rack: { left: 0.3, width: 0.4, top: 0.675, height: 0.145 },
  footer: { left: 0.3, width: 0.4, top: 0.825, height: 0.075 },
} as const;

/** The geometry the water, the tap and the hose are drawn with: the picture's own units. */
export type SinkGeo = {
  W: number;
  H: number;
  basin: {
    box: { x: number; y: number; w: number; h: number };
    polygon: readonly (readonly [number, number])[];
  };
  tap: { x: number; y: number; w: number; h: number };
  hose: { x: number; y: number; w: number; h: number };
};
export const SINK_GEO_TALL: SinkGeo = { W: 540, H: 960, basin: BASIN, tap: TAP, hose: HOSE };
/** Measured on the wide picture (1920 x 1080): the basin's inner outline, the mixer tap's spout and the pre-rinse hose's head. */
export const SINK_GEO_WIDE: SinkGeo = {
  W: 1920,
  H: 1080,
  basin: {
    box: { x: 655, y: 305, w: 615, h: 240 },
    polygon: [
      [678, 314],
      [1248, 312],
      [1266, 534],
      [658, 528],
    ],
  },
  tap: { x: 931, y: 236, w: 34, h: 190 },
  hose: { x: 1086, y: 255, w: 300, h: 270 },
};
