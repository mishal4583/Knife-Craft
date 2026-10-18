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
};

const NONE: AdBonusApi = {
  shortfallFor: () => 0,
  openShortfall: () => {},
  floorDoubleFor: () => 0,
  openFloorDouble: () => {},
};

export const AdBonusContext = createContext<AdBonusApi>(NONE);
export const useAdBonus = () => useContext(AdBonusContext);
