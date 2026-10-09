import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import { KButton, Panel, Badge } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { formatUsd } from "@/game/money";
import { restaurantDevelopment } from "@/game/restaurant/restaurantBackOffice";

/**
 * Unified Restaurant phase 7 (restaurant build): restaurant development on
 * Restaurant → Equipment, next to the fridge. Read-only
 * (restaurantBackOffice.restaurantDevelopment over KitchenUpgradeManager);
 * tiers are still built on the Kitchen Upgrade screen.
 */
export function RestaurantDevelopmentCard({
  save,
  go,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
}) {
  const dev = restaurantDevelopment(save);
  const next = dev.next;
  return (
    <div data-testid="restaurant-development">
      <Panel tone="cream" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>🏗️ Restaurant development</Eyebrow>
            <p className="font-display text-[18px] font-black leading-tight text-walnut-dark">
              {dev.currentName}
            </p>
          </div>
          <Badge tone={next ? "cream" : "sage"}>
            {dev.built} / {dev.total} built
          </Badge>
        </div>
        <div className="mt-2">
          <Bar fraction={dev.total > 0 ? dev.built / dev.total : 1} tone="sage" />
        </div>
        <p className="mt-2 font-hand text-[15px] leading-snug text-walnut/70">
          {!next
            ? "Fully developed — every tier is built."
            : next.state === "locked"
              ? `Next: ${next.name} · ${formatUsd(next.price)} · opens at Level ${next.unlockLevel}.`
              : `Next: ${next.name} · ${formatUsd(next.price)} · ready to build.`}
        </p>
        <KButton full variant="ghost" className="mt-3" onClick={() => go("kitchen-upgrades")}>
          {next && next.state === "available" ? "Build in Kitchen Upgrade →" : "Kitchen Upgrade →"}
        </KButton>
      </Panel>
    </div>
  );
}
