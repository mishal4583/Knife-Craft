import { useUnlockText } from "./navLevel";
import { InfoTip } from "./common/InfoTip";
import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, ScreenHeader, Coin } from "./common/primitives";
import { KitchenBackground } from "./KitchenBackground";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { KITCHEN_UPGRADE_CATALOG } from "@/game/kitchen/kitchenUpgradeDefinitions";
import type { KitchenUpgradeDefinition } from "@/game/kitchen/kitchenUpgradeTypes";
import {
  getKitchenUpgradeState,
  type KitchenUpgradeState,
  type PurchaseKitchenUpgradeResult,
} from "@/game/kitchen/KitchenUpgradeManager";
import { formatUsd } from "@/game/money";
import { ShortfallOffer } from "./ads/ShortfallOffer";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import {
  isRestaurantSave,
  kitchenTierBenefit,
  RESTAURANT_INVESTMENT_RULES,
  kitchenTierPrice,
} from "@/game/restaurant/restaurantInvestments";
import type { SaveData } from "@/game/SaveManager";
import { Art, PIcon, ValuePill } from "./progress/ProgressKit";

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
      className="relative overflow-hidden rounded-[16px] border-2 border-[#e2b24a] shadow-soft"
      style={{ width: size, height: size * 1.3 }}
    >
      <KitchenBackground skin={upgrade.asset} />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_15%,rgba(255,255,255,0.18),transparent_65%)]" />
    </div>
  );
}

/**
 * KITCHEN_UPGRADES — Restaurant Development (Economy V2.5). Each tier
 * after the first is a permanent investment: reaching its level makes it
 * available, and the player builds the tiers in order when they can afford
 * them (KitchenUpgradeManager.purchaseKitchenUpgrade — all or nothing,
 * never on credit). Building a tier moves the kitchen onto it for good.
 * Nothing in the game requires any tier; they are the restaurant growing.
 *
 * Painted (developer 2026-11-25, Business UI design picture 04): the selected kitchen on a paper card with its tagline and what it gives, the state bar, and a
 * card per kitchen with its name on a wood ribbon, ITS OWN DESCRIPTION under the name (the developer's note in the document) and its state. Behaviour, prices and
 * rules are unchanged.
 */
/** What a tier gives, short ("⭐ +7% earnings · 🪑 +2 guest seats", developer 2026-10-23). */
function shortTierBenefit(id: string): string {
  const q = RESTAURANT_INVESTMENT_RULES.kitchenQuality[id] ?? 0;
  const seats = RESTAURANT_INVESTMENT_RULES.kitchenGuestSeats[id] ?? 0;
  return [
    q > 0 ? `⭐ +${Math.round(q * 1000) / 10}% earnings` : null,
    seats > 0 ? `🪑 +${seats} guest seat${seats === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function KitchenUpgrades({
  go,
  save,
  buildKitchenUpgrade,
  embedded = false,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  buildKitchenUpgrade: (id: string) => PurchaseKitchenUpgradeResult;
  /** Render as a Business sub-section, sharing its header, scroll area and bottom nav. */
  embedded?: boolean;
}) {
  const t = useUnlockText();
  const [selectedId, setSelectedId] = useState<string>(
    () =>
      KITCHEN_UPGRADE_CATALOG.find((u) => getKitchenUpgradeState(u.id, save) === "available")?.id ??
      save.equippedKitchenUpgradeId,
  );
  const selected =
    KITCHEN_UPGRADE_CATALOG.find((u) => u.id === selectedId) ?? KITCHEN_UPGRADE_CATALOG[0]!;
  const state = getKitchenUpgradeState(selected.id, save);
  const selectedIndex = KITCHEN_UPGRADE_CATALOG.findIndex((u) => u.id === selected.id);
  const previous = selectedIndex > 0 ? KITCHEN_UPGRADE_CATALOG[selectedIndex - 1]! : null;
  const shortfall = Math.max(0, kitchenTierPrice(selected, save) - save.credits);
  const showBenefit = (id: string) => isRestaurantSave(save) && !!kitchenTierBenefit(id);

  const content = (
    <>
      <div className={embedded ? "" : "px-4"}>
        <section className="pg-card relative overflow-hidden rounded-[22px] p-4">
          <Art
            name="biz:decor-a/kitchen-ghost"
            className="pointer-events-none absolute right-2 top-2 hidden h-24 w-auto @min-[620px]:block"
          />
          <div className="relative flex items-center gap-4">
            <Art
              name="biz:pieces/laurel-left"
              className="pointer-events-none hidden h-20 w-auto shrink-0 @min-[520px]:block"
            />
            <div className="relative shrink-0">
              <KitchenUpgradePreview upgrade={selected} size={100} />
              {state === "current" ? (
                <PIcon
                  name="icons-a/crown"
                  fallback="👑"
                  size={34}
                  className="absolute -left-2 -top-3 z-10"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {/* Narrow phones (320 px): "Neighborhood" at 24 px was wider than the column, which pushed the ⓘ out of the card (clipped, unreachable): a smaller title there, and the ⓘ may wrap under it. */}
              <p className="flex flex-wrap items-center gap-x-1.5 font-display text-[20px] font-black leading-tight text-walnut-dark min-[380px]:text-[24px]">
                {selected.name}
                <InfoTip label={`About the ${selected.name}`}>
                  {selected.description}
                  {kitchenTierBenefit(selected.id)
                    ? " Restaurant quality raises what every order earns; guest seats bring more menu guests each service."
                    : ""}
                </InfoTip>
              </p>
              <p className="font-ui text-[13px] font-bold uppercase italic tracking-wide text-copper">
                {selected.tagline}
              </p>
              <p className="mt-1 font-ui text-[12.5px] font-bold leading-snug text-walnut/70">
                {selected.description}
              </p>
              {showBenefit(selected.id) ? (
                <p
                  className="mt-1 font-ui text-[13px] font-extrabold text-olive"
                  data-testid="kitchen-benefit"
                >
                  {shortTierBenefit(selected.id)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="relative mt-3">
            {state === "locked" ? (
              <KButton full variant="ghost" disabled>
                Unlocks {t.when(selected.unlockLevel)} ·{" "}
                {formatUsd(kitchenTierPrice(selected, save))}
              </KButton>
            ) : state === "needsPrevious" ? (
              <KButton full variant="ghost" disabled>
                Build the {previous?.name} first
              </KButton>
            ) : state === "available" ? (
              <>
                <KButton
                  full
                  variant="copper"
                  disabled={shortfall > 0}
                  onClick={() => buildKitchenUpgrade(selected.id)}
                >
                  🔨 Build · {formatUsd(kitchenTierPrice(selected, save))}
                </KButton>
                <p className="mt-2 text-center font-hand text-[15px] text-walnut/65">
                  {shortfall > 0
                    ? `${notEnoughMoneyText(kitchenTierPrice(selected, save), save.credits)} Balance ${formatUsd(save.credits)}.`
                    : "A permanent investment in your restaurant."}
                </p>
                {shortfall > 0 ? (
                  <ShortfallOffer price={kitchenTierPrice(selected, save)} item={selected.name} />
                ) : null}
              </>
            ) : state === "current" ? (
              <div className="flex min-h-12 items-center justify-center gap-3 rounded-full border-2 border-[#e2b24a] bg-[linear-gradient(180deg,#8fb35a,#5f8a35_60%,#4a7228)] px-4 font-display text-[17px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <PIcon name="icons-a/sparkles" fallback="✦" size={22} />
                <PIcon name="icons-a/crown" fallback="👑" size={28} />
                Current Kitchen
                <PIcon name="icons-a/sparkles" fallback="✦" size={22} />
              </div>
            ) : (
              <KButton full variant="ghost" disabled>
                Already upgraded past this
              </KButton>
            )}
          </div>
        </section>
      </div>

      <div className={cn("grid grid-cols-2 land:grid-cols-3 gap-3 pt-4", !embedded && "px-4")}>
        {KITCHEN_UPGRADE_CATALOG.map((u) => {
          const uState: KitchenUpgradeState = getKitchenUpgradeState(u.id, save);
          const locked = uState === "locked";
          const isCurrent = uState === "current";
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              data-kitchen={u.id}
              data-state={uState}
              className={cn(
                "press relative flex flex-col items-center gap-1.5 overflow-hidden rounded-[20px] border bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] p-3 text-center",
                isCurrent
                  ? "border-[#e2b24a] shadow-[0_0_0_2px_rgba(248,199,82,0.45)]"
                  : "border-[#ebd2a0]",
                u.id === selected.id && "ring-2 ring-copper/40",
              )}
            >
              {isCurrent ? (
                <Art
                  name="biz:pieces/sunburst"
                  className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-36 w-auto opacity-80"
                />
              ) : null}
              <div className={cn("relative", locked && "opacity-55 grayscale-[0.35]")}>
                <KitchenUpgradePreview upgrade={u} size={88} />
                {isCurrent ? (
                  <PIcon
                    name="icons-a/crown"
                    fallback="👑"
                    size={30}
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  />
                ) : null}
              </div>
              <span className="relative flex w-full items-center justify-center gap-0.5">
                <Art
                  name="biz:pieces/laurel-left"
                  className="pointer-events-none h-9 w-auto shrink-0"
                />
                <span className="bz-ribbon-dark min-w-0 flex-1 rounded-full px-2.5 py-1 font-display text-[13.5px] font-black leading-tight">
                  {u.name}
                </span>
                <Art
                  name="biz:pieces/laurel-right"
                  className="pointer-events-none h-9 w-auto shrink-0"
                />
              </span>
              <span
                className="relative font-ui text-[12.5px] font-bold leading-snug text-walnut/70"
                data-testid="kitchen-description"
              >
                {u.description}
              </span>
              {showBenefit(u.id) ? (
                <span className="relative font-ui text-[12px] font-extrabold leading-snug text-olive">
                  {shortTierBenefit(u.id)}
                </span>
              ) : null}
              <span className="relative mt-auto pt-1">
                {uState === "current" ? (
                  <ValuePill tone="green" className="text-[12.5px] uppercase tracking-wide">
                    Current
                  </ValuePill>
                ) : uState === "past" ? (
                  <ValuePill className="text-[12.5px] uppercase tracking-wide">
                    Upgraded ✓
                  </ValuePill>
                ) : uState === "locked" ? (
                  <ValuePill className="text-[12.5px]">🔒 {t.lv(u.unlockLevel)}</ValuePill>
                ) : (
                  <ValuePill tone="gold" className="text-[12.5px]">
                    {formatUsd(kitchenTierPrice(u, save))}
                  </ValuePill>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className={cn(
          "pb-2 pt-5 text-center font-hand text-[16px] text-walnut/50",
          !embedded && "px-6",
        )}
      >
        🏗️ One room at a time
      </p>
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Kitchen Upgrades"
          subtitle="restaurant development"
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />
        {content}
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}
