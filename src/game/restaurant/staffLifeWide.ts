import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import type { Stop } from "./floorLife";
import type { StageSpots } from "./staffLife";

/**
 * Where the first floor's staff stand on the WIDE restaurant map (developer 2026-11-20, `TL-restaurant-0N-<stage>.png`, 1920 x 1080): the same roles and loops as
 * `STAGE_SPOTS` (staffLife.ts) on the tall plan, measured again on each wide picture (map percent of 1920 x 1080, feet position): in front of the range, the two
 * aisles of the kitchen, the dining floor in front of the service counter, two spots beside dining tables, the office chair, and the tiled restroom floor.
 * Each was drawn on its picture and checked by eye (nobody on a shelf, a counter or a table).
 */
export const STAGE_SPOTS_WIDE: Readonly<Record<KitchenMapArtStage, StageSpots>> = {
  humble: {
    range: { y: 44, xs: [19, 26, 33.5] },
    prepAisle: { x: 15, ys: [46, 54] },
    chefAisle: { x: 35.5, ys: [46, 54] },
    counter: { computerX: 62, frontY: 61.5 },
    tables: [
      { x: 41.5, y: 72 },
      { x: 56.5, y: 72 },
    ],
    managerSeat: { x: 13.3, y: 78.5 },
  },
  growing: {
    range: { y: 43.3, xs: [22, 28.5, 34.5] },
    prepAisle: { x: 14, ys: [46, 54] },
    chefAisle: { x: 28.5, ys: [47, 54] },
    counter: { computerX: 60, frontY: 60.5 },
    tables: [
      { x: 47.5, y: 66 },
      { x: 63.5, y: 66 },
    ],
    managerSeat: { x: 9.3, y: 79.5 },
  },
  established: {
    range: { y: 43.3, xs: [22, 28, 34] },
    prepAisle: { x: 14.5, ys: [46, 54] },
    chefAisle: { x: 38.5, ys: [46, 54] },
    counter: { computerX: 62, frontY: 61.5 },
    tables: [
      { x: 42.5, y: 70 },
      { x: 73, y: 69 },
    ],
    managerSeat: { x: 10, y: 80 },
  },
  "neighborhood-cafe": {
    range: { y: 43.2, xs: [23, 30, 37] },
    prepAisle: { x: 15.5, ys: [46, 53] },
    chefAisle: { x: 41.5, ys: [46, 53] },
    counter: { computerX: 62, frontY: 59.5 },
    tables: [
      { x: 50, y: 66 },
      { x: 73, y: 66 },
    ],
    managerSeat: { x: 11.8, y: 72 },
  },
  "flourishing-cafe": {
    range: { y: 42.5, xs: [33, 35.5, 38.5] },
    prepAisle: { x: 14, ys: [47, 54] },
    chefAisle: { x: 38.5, ys: [46, 52] },
    counter: { computerX: 60, frontY: 61.5 },
    tables: [
      { x: 60.5, y: 67.5 },
      { x: 71.5, y: 69 },
    ],
    managerSeat: { x: 10.5, y: 77 },
  },
  grand: {
    range: { y: 40, xs: [21, 28, 35] },
    prepAisle: { x: 14, ys: [42, 50] },
    chefAisle: { x: 39, ys: [42, 50] },
    counter: { computerX: 62, frontY: 61 },
    tables: [
      { x: 51, y: 69 },
      { x: 71.2, y: 70 },
    ],
    managerSeat: { x: 12.5, y: 79 },
  },
};

/** The Cleaner's three places on each stage's tiled restroom floor (in front of the stalls). */
export const RESTROOM_STOPS_WIDE: Readonly<
  Record<KitchenMapArtStage, readonly [Stop, Stop, Stop]>
> = {
  humble: [
    { x: 82, y: 45 },
    { x: 86, y: 43 },
    { x: 90, y: 45 },
  ],
  growing: [
    { x: 82, y: 50 },
    { x: 86, y: 48 },
    { x: 90, y: 52 },
  ],
  established: [
    { x: 77.5, y: 45 },
    { x: 83, y: 44.5 },
    { x: 88, y: 45.5 },
  ],
  "neighborhood-cafe": [
    { x: 79, y: 45 },
    { x: 85, y: 44 },
    { x: 90, y: 45.5 },
  ],
  "flourishing-cafe": [
    { x: 78, y: 44 },
    { x: 85, y: 42.5 },
    { x: 91, y: 44 },
  ],
  grand: [
    { x: 80, y: 43 },
    { x: 86, y: 41.5 },
    { x: 91, y: 43 },
  ],
};
