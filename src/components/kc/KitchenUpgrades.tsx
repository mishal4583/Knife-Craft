import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Coin, Divider } from "./common/primitives";
import { KitchenBackground } from "./KitchenBackground";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { KITCHEN_UPGRADE_CATALOG } from "@/game/kitchen/kitchenUpgradeDefinitions";
import type { KitchenUpgradeDefinition } from "@/game/kitchen/kitchenUpgradeTypes";
import {
  getKitchenUpgradeState,
  type KitchenUpgradeState,
} from "@/game/kitchen/KitchenUpgradeManager";
import type { SaveData } from "@/game/SaveManager";

/** A small real preview of the upgrade's own background image — unlike Boards/Knives (which have no real photo, only a CSS-gradient stand-in), a kitchen upgrade's true identity IS one of the six finished images, so the card just shows a cropped, scaled copy of it. */
function KitchenUpgradePreview({
  upgrade,
  size = 96,
}: {
  upgrade: KitchenUpgradeDefinition;
  size?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-white/20 shadow-soft"
      style={{ width: size, height: size * 1.3 }}
    >
      <KitchenBackground skin={upgrade.asset} />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_15%,rgba(255,255,255,0.18),transparent_65%)]" />
    </div>
  );
}

/**
 * KITCHEN_UPGRADES — a real progression-milestone screen, not a shop
 * (Phase 14). Each tier is a permanent upgrade: reaching its level
 * replaces the previous kitchen for good (KitchenUpgradeManager.
 * syncKitchenUpgradeOwnership), so there is nothing to choose here —
 * the screen shows the current kitchen, the stages already grown past,
 * and the stages still ahead.
 */
export function KitchenUpgrades({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const [selectedId, setSelectedId] = useState<string>(save.equippedKitchenUpgradeId);
  const selected =
    KITCHEN_UPGRADE_CATALOG.find((u) => u.id === selectedId) ?? KITCHEN_UPGRADE_CATALOG[0]!;
  const state = getKitchenUpgradeState(selected.id, save);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Kitchen Upgrades"
          subtitle="the whole room, growing with you"
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        <div className="px-4">
          <Panel tone="cream" className="p-4">
            <div className="flex items-center gap-4">
              <KitchenUpgradePreview upgrade={selected} size={100} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
                  {selected.name}
                </p>
                <p className="font-ui text-[11px] font-bold uppercase tracking-wide text-copper">
                  {selected.tagline}
                </p>
                <p className="mt-1 font-hand text-[16px] leading-tight text-walnut/70">
                  {selected.description}
                </p>
              </div>
            </div>
            <Divider />
            {state === "locked" ? (
              <KButton full variant="ghost" disabled>
                Unlocks at Level {selected.unlockLevel}
              </KButton>
            ) : state === "current" ? (
              <KButton full variant="sage" disabled>
                Current Kitchen
              </KButton>
            ) : (
              <KButton full variant="ghost" disabled>
                Already upgraded past this
              </KButton>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {KITCHEN_UPGRADE_CATALOG.map((u) => {
            const uState: KitchenUpgradeState = getKitchenUpgradeState(u.id, save);
            const locked = uState === "locked";
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedId(u.id)}
                className={cn(
                  "lift flex flex-col items-center gap-2 rounded-[20px] border p-3 card-warm",
                  u.id === selected.id
                    ? "border-copper/60 ring-2 ring-gold/35"
                    : "border-walnut/15",
                )}
              >
                <div className={cn(locked && "opacity-55 grayscale-[0.35]")}>
                  <KitchenUpgradePreview upgrade={u} size={88} />
                </div>
                <p className="font-display text-[13px] font-black leading-none text-walnut-dark">
                  {u.name}
                </p>
                {uState === "current" ? (
                  <Badge tone="sage">Current</Badge>
                ) : uState === "past" ? (
                  <Badge tone="cream">Upgraded ✓</Badge>
                ) : (
                  <Badge tone="locked">Lv {u.unlockLevel}</Badge>
                )}
              </button>
            );
          })}
        </div>

        <p className="px-6 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/50">
          I upgraded my kitchen.
        </p>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}
