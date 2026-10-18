import { formatUsd } from "@/game/money";
import { useAdBonus } from "./adBonusApi";

/**
 * "📺 Watch · +$X" beside a "Not enough money" line, when the gap is small
 * (adBonuses.ts shortfallAmount). Renders nothing otherwise.
 */
export function ShortfallOffer({ price, item }: { price: number; item?: string }) {
  const api = useAdBonus();
  const amount = api.shortfallFor(price);
  if (amount <= 0) return null;
  return (
    <button
      type="button"
      data-testid="shortfall-offer"
      onClick={() => api.openShortfall(price, item)}
      className="press mt-2 flex min-h-12 w-full items-center justify-center gap-1 rounded-full border border-gold bg-gold/20 px-3 font-ui text-[13px] font-extrabold text-walnut-dark"
    >
      📺 Watch · +{formatUsd(amount)}
    </button>
  );
}
