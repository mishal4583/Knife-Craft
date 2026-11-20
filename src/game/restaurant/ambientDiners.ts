import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";

/**
 * The other diners of the wide dining room (developer 2026-11-20: "the customers are not integrated properly"): each dining picture (`landscape-art/true/dining-0N.webp`) has
 * a dozen tables and, until now, only the party being served was drawn, so the room looked empty. Most of the other tables each get one guest, seen from behind in the chair at
 * the table's front (the way the served party's own guest is drawn). Fixed by the stage (the same room always looks the same); presentation only, nothing to do with the orders,
 * the save or the money.
 *
 * The tables are measured on a 5 % grid over each dining picture (percent of the whole picture, the cloth's centre); the two front tables of each stage are NOT listed (the served
 * parties use them), nor the second row right behind them (a guest there would read as sitting at the party's table), nor the booths (their seats are drawn in the picture). A guest sits `SEAT_DY` below the cloth, as the served party does (`wseat` in serviceFloor.ts).
 */
export type Diner = { id: string; at: { x: number; y: number } };

const SEAT_DY = 8;

const TABLES: Readonly<Record<KitchenMapArtStage, readonly (readonly [number, number])[]>> = {
  humble: [[48.5, 41.5]],
  growing: [
    [30.1, 27.8],
    [50, 32.6],
    [69.5, 27.8],
  ],
  established: [
    [39.5, 25.7],
    [60.8, 25.7],
    [15.6, 41.9],
    [81.3, 41.7],
  ],
  "neighborhood-cafe": [
    [29.9, 27.8],
    [44.5, 27.8],
    [57.4, 27.1],
    [72, 27.8],
    [44.5, 42.5],
    [57.2, 42.5],
  ],
  "flourishing-cafe": [
    [32, 23],
    [49.2, 23.6],
    [68.2, 23.6],
    [49.2, 41.7],
    [80.9, 38.2],
  ],
  grand: [
    [40.1, 22.9],
    [60.3, 22.9],
    [76.6, 32.2],
    [78.5, 45.8],
    [24.2, 31.9],
    [23, 41.7],
  ],
};

/** The diners of a stage, from the back of the room to the front, so a nearer guest is drawn over a farther one. Three tables in four have one. */
export function ambientDiners(stage: KitchenMapArtStage): Diner[] {
  const out: Diner[] = [];
  TABLES[stage].forEach(([x, y], i) => {
    if (i % 4 === 3) return;
    out.push({ id: `diner-${stage}-${i}`, at: { x, y: y + SEAT_DY } });
  });
  return out.sort((a, b) => a.at.y - b.at.y);
}
