import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { pendingInspections, pinsOf } from "@/game/business/deliveryInspection";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

/**
 * "🔎 Inspect delivery · 2" (developer 2026-11-08): the entry to Delivery Inspection (business/deliveryInspection.ts), beside "Fridge Sort" in
 * the Market's Ingredients tab and above the Inventory fridge while a delivery waits (not inspected yet, within today's five) and no Prep Cook
 * does it. The number is the inspections waiting. A small chip, never a popup; nothing waits on it.
 */
export function DeliveryInspectionChip({
  save,
  go,
  className,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  className?: string;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  // The check is mandatory (developer 2026-11-11): the chip shows every basket still to check, past today's rewarded rounds too.
  const left = pendingInspections(save, level);
  if (left <= 0) return null;
  const pins = pinsOf(save);
  return (
    <button
      type="button"
      data-testid="delivery-inspection-chip"
      onClick={() => go("delivery-inspection")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#c0713a] bg-[linear-gradient(170deg,#fbe4cf,#efc29b)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <span aria-hidden>🔎</span> Check the delivery · {left}
      {pins > 0 ? <span className="text-[12px] font-bold text-walnut/70">· 🎖️ {pins}</span> : null}
    </button>
  );
}
