import { firstMachineNeeded } from "@/game/restaurant/floorGuide";
import { Badge, KButton, Panel } from "./common/primitives";
import { useUnlockText } from "./navLevel";
import { ShopItemArt, StockPill } from "./common/ShopItemArt";
import { BuyButton, PricePill, ShopCard, ShopLine } from "./market/ShopCard";
import { ShortfallOffer } from "./ads/ShortfallOffer";
import { InfoTip, Points, StatChip } from "./common/InfoTip";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { formatUsdBig as formatUsd } from "@/game/money";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import {
  FLOOR_STAFF,
  MAX_STATION_LEVEL,
  SECOND_FLOOR_OPENS_AT,
  STATIONS,
  STATIONS_OPEN_AT,
  TIER3_MIN_LEVEL,
  cleanersNeeded,
  machinePrice,
  staffPrice,
  tierPrice,
  floorPerHour,
  isSecondFloorOpen,
  isStationUnlocked,
  secondFloorOf,
  serversNeeded,
  type FloorResult,
} from "@/game/restaurant/secondFloor";
import type { ScreenId } from "./data";
import type { SecondFloorAction } from "./restaurantMap/SecondFloorView";
import { FloorStaffFace } from "@/components/kc/common/FloorStaffFace";

/**
 * MARKET · SECOND FLOOR (developer 2026-10-16: "in the market add the new
 * machines, their staff and machine upgrades"). The floor's machines, their
 * upgrades and the Floor Team, bought through the SAME action as the floor's
 * own panel (App.secondFloorAction → restaurant/secondFloor.ts: one wallet
 * debit and one ledger entry each). Collect stays on the floor's Pickup
 * Counter. Each card shows what the purchase earns and how many staffed
 * hours it takes to pay itself back (the economy plan).
 */
export function MarketSecondFloor({
  save,
  onAction,
  setNotice,
  go,
}: {
  save: SaveData;
  onAction: (action: SecondFloorAction) => FloorResult;
  setNotice: (text: string) => void;
  go: (s: ScreenId) => void;
}) {
  const u = useUnlockText();
  const level = restaurantLevelOf(save.levelProgress);
  const floor = secondFloorOf(save);
  const owned = Object.keys(floor.stations).length;
  const perHour = floorPerHour(save);
  const hours = (price: number, gain: number) => Math.round(price / gain);

  const run = (action: SecondFloorAction, name: string, price: number) => {
    const r = onAction(action);
    if (r.ok) setNotice(`${name} — done!`);
    else if (r.reason === "insufficientFunds") setNotice(notEnoughMoneyText(price, save.credits));
    else if (r.reason === "locked") setNotice(`${name} goes on sale ${u.when(STATIONS_OPEN_AT)}.`);
    else if (r.reason === "noStations") setNotice("🏬 Buy a machine first");
    else if (r.reason === "fullTeam") setNotice("The floor team is full.");
    else setNotice(`${name} couldn't be bought right now.`);
  };

  if (!isSecondFloorOpen(level)) {
    return (
      <Panel className="p-4" data-testid="market-second-floor">
        <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
          🔒 Opens {u.when(SECOND_FLOOR_OPENS_AT)}
        </p>
        <p className="mt-1 font-ui text-[12.5px] text-walnut/65">
          🛒 Machines on sale {u.when(STATIONS_OPEN_AT)}
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4" data-testid="market-second-floor">
      <Panel className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            🏬 Automated food hall
          </p>
          <InfoTip label="How the food hall works">
            Machines cook while you play. The first 2 are self-serve; a Floor Server runs 2 more and
            a Floor Cleaner adds +10% income. Seat more tables and polish machines upstairs. Collect
            the takings at the Pickup Counter — each machine stores a few hours, so come back twice
            a day.
          </InfoTip>
        </div>
        <Points
          className="mt-1"
          items={[
            ["🤖", "Machines cook while you play"],
            ["🧑‍🍳", "First 2 self-serve · 1 server runs 2 more"],
            ["💰", "Collect at the Pickup Counter, twice a day"],
          ]}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-ui text-[13px] font-extrabold text-walnut-dark">
            Earning now: {formatUsd(perHour)}/h
          </span>
          <KButton
            className="h-12 px-2 text-[12.5px]"
            variant="cream"
            onClick={() => go("second-floor")}
          >
            ⬆ Go upstairs
          </KButton>
        </div>
      </Panel>

      <section aria-label="Machines">
        <h3 className="mb-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          Machines
        </h3>
        <div className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1 land:grid-cols-3">
          {STATIONS.map((d) => {
            const o = floor.stations[d.id];
            const locked = !isStationUnlocked(d, level);
            const lvl = o?.level ?? 0;
            const price = machinePrice(d, floor.branch);
            const needed = owned === 0 ? firstMachineNeeded(price) : price;
            const next =
              o && lvl < MAX_STATION_LEVEL ? tierPrice(d, (lvl + 1) as 2 | 3, floor.branch) : null;
            const tierLocked = lvl + 1 === 3 && level < TIER3_MIN_LEVEL;
            const nextGain =
              o && lvl < MAX_STATION_LEVEL ? d.perHour[lvl]! - d.perHour[lvl - 1]! : 0;
            return (
              <ShopCard
                key={d.id}
                data-floor-machine={d.id}
                ring={o ? "owned" : null}
                title={d.name}
                art={
                  <ShopItemArt icon={d.icon} className={cn(locked && "opacity-60 grayscale-[0.3]")}>
                    <span className="flex items-center gap-1">
                      {o ? <StockPill amount={`Lv ${lvl}`} label="owned" /> : null}
                      <InfoTip label={`About the ${d.name}`}>{d.blurb}</InfoTip>
                    </span>
                  </ShopItemArt>
                }
              >
                {!o ? (
                  <>
                    <PricePill price={formatUsd(price)} />
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      <StatChip
                        icon="⏱"
                        tone="sage"
                        title={`Earns ${formatUsd(d.perHour[0])} an hour`}
                      >
                        {formatUsd(d.perHour[0])}/h
                      </StatChip>
                      <StatChip
                        icon="↩"
                        title={`Pays itself back in about ${hours(price, d.perHour[0])} hours of service`}
                      >
                        ~{hours(price, d.perHour[0])} h
                      </StatChip>
                    </div>
                    <div className="mt-auto pt-2">
                      {/* The FIRST machine needs money left to carry on (developer 2026-11-08): the price + the reserve. */}
                      <BuyButton
                        tone={locked || save.credits < needed ? "short" : "go"}
                        icon={!locked}
                        disabled={locked || save.credits < needed}
                        onClick={() => run({ kind: "buy", id: d.id }, d.name, price)}
                      >
                        {locked
                          ? u.badge(d.unlockLevel)
                          : save.credits >= price && save.credits < needed
                            ? `Keep ${formatUsd(needed - price)} for food`
                            : `Buy ${formatUsd(price)}`}
                      </BuyButton>
                      {locked ? null : <ShortfallOffer price={price} item={d.name} />}
                    </div>
                  </>
                ) : next !== null ? (
                  <>
                    <ShopLine>
                      ⏱ {formatUsd(d.perHour[lvl - 1]!)}/h → {formatUsd(d.perHour[lvl]!)}/h
                    </ShopLine>
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      <StatChip
                        icon="↩"
                        title={`The upgrade pays back in about ${hours(next, nextGain)} hours`}
                      >
                        ~{hours(next, nextGain)} h
                      </StatChip>
                      <StatChip icon="📦" title={`Stores ${d.capHours[lvl]} hours of takings`}>
                        {d.capHours[lvl]} h
                      </StatChip>
                    </div>
                    <div className="mt-auto pt-2">
                      <BuyButton
                        tone={tierLocked || save.credits < next ? "short" : "go"}
                        icon={false}
                        disabled={tierLocked || save.credits < next}
                        onClick={() =>
                          run({ kind: "upgrade", id: d.id }, `${d.name} Tier ${lvl + 1}`, next)
                        }
                      >
                        {tierLocked
                          ? u.badge(TIER3_MIN_LEVEL)
                          : `Tier ${lvl + 1} ${formatUsd(next)}`}
                      </BuyButton>
                      {tierLocked ? null : <ShortfallOffer price={next} item={d.name} />}
                    </div>
                  </>
                ) : (
                  <div className="mt-auto pt-2">
                    <BuyButton tone="done" disabled>
                      ✓ Top level · {formatUsd(d.perHour[lvl - 1]!)}/h
                    </BuyButton>
                  </div>
                )}
              </ShopCard>
            );
          })}
        </div>
      </section>

      <section aria-label="Floor team">
        <h3 className="mb-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          Floor team · 1-time hire, no wages
        </h3>
        <div className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1 land:grid-cols-3">
          {(["server", "cleaner"] as const).map((role) => {
            const def = FLOOR_STAFF[role];
            const have = (role === "server" ? floor.servers : floor.cleaners) ?? 0;
            const need = role === "server" ? serversNeeded(floor) : cleanersNeeded(floor);
            const hirePrice = staffPrice(role, have, floor.branch);
            return (
              <ShopCard
                key={role}
                data-floor-staff={role}
                title={def.name}
                art={
                  <ShopItemArt
                    icon={
                      <FloorStaffFace
                        role={role}
                        // The next person to hire (the second Floor Cleaner is the man); a full team shows the last.
                        index={Math.min(have, def.max - 1)}
                        fallback={def.icon}
                        className="h-[116px] w-[116px] border-2 border-[#2b211b]/60 shadow-lift"
                      />
                    }
                  >
                    <span className="flex items-center gap-1">
                      <Badge tone={have < need ? "copper" : "sage"}>
                        {have} / {def.max}
                      </Badge>
                      <InfoTip label={`About the ${def.name}`}>{def.blurb}</InfoTip>
                    </span>
                  </ShopItemArt>
                }
              >
                <PricePill price={formatUsd(staffPrice(role, have, floor.branch))} />
                <ShopLine hand>
                  {need > have
                    ? role === "server"
                      ? `you need ${need}`
                      : `+10% income each`
                    : need === 0
                      ? role === "server"
                        ? "your first 2 machines are self-serve"
                        : "for your first machine"
                      : "enough"}
                </ShopLine>
                <div className="mt-auto pt-2">
                  <BuyButton
                    tone={
                      owned === 0 || have >= def.max || save.credits < hirePrice ? "short" : "go"
                    }
                    icon={false}
                    disabled={owned === 0 || have >= def.max || save.credits < hirePrice}
                    onClick={() => run({ kind: "hire", role }, def.name, hirePrice)}
                  >
                    {owned === 0
                      ? "Buy a machine first"
                      : have >= def.max
                        ? "Team full"
                        : `Hire ${formatUsd(hirePrice)}`}
                  </BuyButton>
                  {owned > 0 && have < def.max ? (
                    <ShortfallOffer price={hirePrice} item={def.name} />
                  ) : null}
                </div>
              </ShopCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
