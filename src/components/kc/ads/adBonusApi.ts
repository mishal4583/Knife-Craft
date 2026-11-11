import { createContext, useContext } from "react";

/**
 * What the screens may offer as ad bonuses (ads/adBonuses.ts). App provides
 * it around the screens; without a provider (tests, classic screens) every
 * amount is 0 and nothing is shown. Offering only opens App's sheet — the
 * money moves there, after the ad.
 */
export type AdBonusApi = {
  /** The "short by" top-up for a purchase of `price`, or 0 when none is on offer. */
  shortfallFor: (price: number) => number;
  openShortfall: (price: number, item?: string) => void;
  /** The Second Floor ×2 extra for `waiting`, or 0. */
  floorDoubleFor: (waiting: number) => number;
  openFloorDouble: () => void;
  /** Golden Guest: offers the rewarded extra (cents) after the free burst; no-op when it is not on offer. */
  openGolden: (extra: number) => void;
  /** Skip ahead: the rewarded two hours of earnings, or 0 when none is on offer. */
  skipFor: () => number;
  openSkip: () => void;
  /** Rush Hour: the rewarded ×3-for-ten-minutes extra, or 0 when none is on offer. */
  rushFor: () => number;
  openRush: () => void;
  /** The delivery routine's rewarded skip: how many are left today (0 = none on offer), and the skip itself (resolves "ok" once the step is done). */
  skipStepsLeft: () => number;
  skipStep: (stepId: string) => Promise<"ok" | "no">;
};

const NONE: AdBonusApi = {
  shortfallFor: () => 0,
  openShortfall: () => {},
  floorDoubleFor: () => 0,
  openFloorDouble: () => {},
  openGolden: () => {},
  skipFor: () => 0,
  openSkip: () => {},
  rushFor: () => 0,
  openRush: () => {},
  skipStepsLeft: () => 0,
  skipStep: async () => "no",
};

export const AdBonusContext = createContext<AdBonusApi>(NONE);
export const useAdBonus = () => useContext(AdBonusContext);
