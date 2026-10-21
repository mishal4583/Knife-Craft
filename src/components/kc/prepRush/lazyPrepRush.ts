import { lazy } from "react";

/**
 * Prep Rush pulls in Phaser, so — like Preparation (lazyPreparation.ts) —
 * it is its own chunk and never joins the menu bundle. Phaser itself is
 * shared with the Preparation chunk, so a player who has cut anything has
 * it already.
 */
export const PrepRush = lazy(() => import("./PrepRush").then((m) => ({ default: m.PrepRush })));
