// Test page for tools/e2e/shiftcard.mjs (served by a throwaway `vite` dev server, never part of the build): the REAL MilestoneBanner with the REAL
// shift-card helpers (restaurant/shiftRecognition.ts), fed with saves whose fridge is built the way the game builds it. ?v= picks the case.
import { createRoot } from "react-dom/client";
import "../../../src/styles.css";
import { MilestoneBanner } from "../../../src/components/kc/story/MilestoneBanner";
import {
  shiftNotes,
  shiftStats,
  shiftTier,
  shiftWaste,
  type ShiftCard,
} from "../../../src/game/restaurant/shiftRecognition";
import { DEFAULT_SAVE, type SaveData } from "../../../src/game/SaveManager";
import { addStock, type BusinessInventory } from "../../../src/game/business/businessInventory";

const today = DEFAULT_SAVE.business.calendar.businessDay;
const withStock = (inventory: BusinessInventory, discarded = 0): SaveData => ({
  ...DEFAULT_SAVE,
  business: {
    ...DEFAULT_SAVE.business,
    inventory,
    finance: {
      ...DEFAULT_SAVE.business.finance,
      dailyAccumulator: {
        ...DEFAULT_SAVE.business.finance.dailyAccumulator,
        discardedQuantity: discarded,
      },
    },
  },
});
const LIVE = 36;
const NOT_YET = 8;
const base = {
  orders: 4,
  accuracy: 91,
  perfects: 7,
  cook: false,
  news: [] as string[],
  dare: null,
};
const cards: Record<string, ShiftCard> = {
  zero: {
    ...base,
    news: ["Accuracy up from 81% to 91%", "Most perfect cuts in a service: 7"],
    tier: shiftTier({ orders: 4, accuracy: 91 }),
    waste: shiftWaste(withStock({}), LIVE),
  },
  spoiled: {
    ...base,
    accuracy: 78,
    perfects: 2,
    tier: shiftTier({ orders: 4, accuracy: 78 }),
    waste: shiftWaste(
      withStock({
        ...addStock({}, "basil", 2, 180, today - 3),
        ...addStock({}, "tomato", 3, 90, today - 8),
      }),
      LIVE,
    ),
  },
  low: {
    ...base,
    accuracy: 44,
    perfects: 0,
    tier: shiftTier({ orders: 4, accuracy: 44 }),
    waste: shiftWaste(withStock({}), LIVE),
  },
  untracked: {
    ...base,
    accuracy: 96,
    perfects: 12,
    tier: shiftTier({ orders: 4, accuracy: 96 }),
    // spoiled stock is in the fridge, but the freshness stage is not live yet: the card must say nothing about waste
    waste: shiftWaste(withStock(addStock({}, "basil", 2, 180, today - 3)), NOT_YET),
  },
  dare: {
    ...base,
    news: ["Dare won: Perfect Chef", "Title earned: Precision Chef 2"],
    tier: shiftTier({ orders: 4, accuracy: 91 }),
    waste: shiftWaste(withStock(addStock({}, "basil", 2, 180, today - 3)), LIVE),
    dare: { title: "No Mercy Prep", progress: "3 of 5 plates" },
  },
};
const card = cards[new URLSearchParams(location.search).get("v") ?? "zero"] ?? cards.zero!;
createRoot(document.getElementById("root")!).render(
  <div className="relative h-full w-full overflow-hidden bg-cream">
    <MilestoneBanner
      kicker="Level Complete"
      line="+$158.00 Completion Reward"
      ms={600000}
      rows={[
        { label: "Order payout", value: "+$12.00" },
        { label: "Completion reward", value: "+$158.00" },
        { label: "Earned this level", value: "+$170.00", strong: true },
      ]}
      stats={shiftStats(card)}
      {...(card.tier ? { tier: card.tier } : {})}
      notes={[...shiftNotes(card), "🍽️ Dine-in opens", "☀️ Day 2 begins"]}
      onDismiss={() => {}}
    />
  </div>,
);
