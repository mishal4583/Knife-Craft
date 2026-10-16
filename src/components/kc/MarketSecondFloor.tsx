import { Badge, KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd } from "@/game/money";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import {
  FLOOR_STAFF,
  MAX_STATION_LEVEL,
  SECOND_FLOOR_OPENS_AT,
  STATIONS,
  STATIONS_OPEN_AT,
  cleanersNeeded,
  floorPerHour,
  isSecondFloorOpen,
  isStationUnlocked,
  secondFloorOf,
  serversNeeded,
  type FloorResult,
} from "@/game/restaurant/secondFloor";
import type { ScreenId } from "./data";
import type { SecondFloorAction } from "./restaurantMap/SecondFloorView";

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
  const level = restaurantLevelOf(save.levelProgress);
  const floor = secondFloorOf(save);
  const owned = Object.keys(floor.stations).length;
  const perHour = floorPerHour(save);
  const hours = (price: number, gain: number) => Math.round(price / gain);

  const run = (action: SecondFloorAction, name: string, price: number) => {
    const r = onAction(action);
    if (r.ok) setNotice(`${name} — done!`);
    else if (r.reason === "insufficientFunds") setNotice(notEnoughMoneyText(price, save.credits));
    else if (r.reason === "locked") setNotice(`${name} goes on sale at Level ${STATIONS_OPEN_AT}.`);
    else if (r.reason === "noStations")
      setNotice("Buy a machine first — the team runs the machines.");
    else if (r.reason === "fullTeam") setNotice("The floor team is full.");
    else setNotice(`${name} couldn't be bought right now.`);
  };

  if (!isSecondFloorOpen(level)) {
    return (
      <Panel className="p-4" data-testid="market-second-floor">
        <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
          🔒 The Second Floor opens at Level {SECOND_FLOOR_OPENS_AT}.
        </p>
        <p className="mt-1 font-ui text-[12.5px] text-walnut/65">
          Its automated food stations go on sale at Level {STATIONS_OPEN_AT}.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4" data-testid="market-second-floor">
      <Panel className="p-3">
        <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
          🏬 Automated food hall
        </p>
        <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/65">
          Machines cook while you play; a Floor Server runs 2 of them and a Floor Cleaner keeps 3
          clean. Collect the takings at the Pickup Counter — each machine stores a few hours, so
          come back twice a day.
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-ui text-[13px] font-extrabold text-walnut-dark">
            Earning now: {formatUsd(perHour)}/h
          </span>
          <KButton size="sm" variant="cream" onClick={() => go("second-floor")}>
            ⬆ Go upstairs
          </KButton>
        </div>
      </Panel>

      <section aria-label="Machines">
        <h3 className="mb-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          Machines
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {STATIONS.map((d) => {
            const o = floor.stations[d.id];
            const locked = !isStationUnlocked(d, level);
            const lvl = o?.level ?? 0;
            const next = o && lvl < MAX_STATION_LEVEL ? d.upgradePrices[lvl - 1]! : null;
            const nextGain =
              o && lvl < MAX_STATION_LEVEL ? d.perHour[lvl]! - d.perHour[lvl - 1]! : 0;
            return (
              <article
                key={d.id}
                data-floor-machine={d.id}
                className={cn(
                  "product-card flex flex-col rounded-[20px] border p-3 card-warm",
                  o ? "border-sage/40" : "border-walnut/15",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[30px] leading-none" aria-hidden>
                    {d.icon}
                  </span>
                  {o ? <Badge tone="sage">Lv {lvl}</Badge> : null}
                </div>
                <p className="mt-1 font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                  {d.name}
                </p>
                <p className="font-ui text-[12px] leading-snug text-walnut/65">{d.blurb}</p>
                {!o ? (
                  <>
                    <p className="mt-1 font-ui text-[12.5px] font-extrabold text-copper">
                      {formatUsd(d.price)}
                      <span className="font-bold text-walnut/60">
                        {" "}
                        · earns {formatUsd(d.perHour[0])}/h
                      </span>
                    </p>
                    <p className="font-hand text-[14px] leading-tight text-walnut/60">
                      Pays itself back in ~{hours(d.price, d.perHour[0])} h of service
                    </p>
                    <div className="mt-auto pt-2">
                      <KButton
                        full
                        size="sm"
                        disabled={locked || save.credits < d.price}
                        onClick={() => run({ kind: "buy", id: d.id }, d.name, d.price)}
                      >
                        {locked ? `🔒 Level ${d.unlockLevel}` : `Buy ${formatUsd(d.price)}`}
                      </KButton>
                    </div>
                  </>
                ) : next !== null ? (
                  <>
                    <p className="mt-1 font-ui text-[12.5px] font-extrabold text-walnut-dark">
                      {formatUsd(d.perHour[lvl - 1]!)}/h → {formatUsd(d.perHour[lvl]!)}/h
                    </p>
                    <p className="font-hand text-[14px] leading-tight text-walnut/60">
                      Upgrade pays back in ~{hours(next, nextGain)} h · stores {d.capHours[lvl]} h
                    </p>
                    <div className="mt-auto pt-2">
                      <KButton
                        full
                        size="sm"
                        variant="sage"
                        disabled={save.credits < next}
                        onClick={() =>
                          run({ kind: "upgrade", id: d.id }, `${d.name} Lv ${lvl + 1}`, next)
                        }
                      >
                        {`Upgrade ${formatUsd(next)}`}
                      </KButton>
                    </div>
                  </>
                ) : (
                  <p className="mt-auto pt-2 font-ui text-[12.5px] font-extrabold text-sage">
                    ✓ Top level · {formatUsd(d.perHour[lvl - 1]!)}/h
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-label="Floor team">
        <h3 className="mb-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          Floor team · hired for good, no wages
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {(["server", "cleaner"] as const).map((role) => {
            const def = FLOOR_STAFF[role];
            const have = (role === "server" ? floor.servers : floor.cleaners) ?? 0;
            const need = role === "server" ? serversNeeded(floor) : cleanersNeeded(floor);
            return (
              <article
                key={role}
                data-floor-staff={role}
                className="product-card flex flex-col rounded-[20px] border border-walnut/15 p-3 card-warm"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[30px] leading-none" aria-hidden>
                    {def.icon}
                  </span>
                  <Badge tone={have < need ? "copper" : "sage"}>
                    {have} / {def.max}
                  </Badge>
                </div>
                <p className="mt-1 font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                  {def.name}
                </p>
                <p className="font-ui text-[12px] leading-snug text-walnut/65">{def.blurb}</p>
                <p className="mt-1 font-ui text-[12.5px] font-extrabold text-copper">
                  {formatUsd(def.price)}
                  <span className="font-bold text-walnut/60">
                    {" "}
                    ·{" "}
                    {need > have
                      ? `you need ${need}`
                      : need === 0
                        ? "for your first machine"
                        : "enough"}
                  </span>
                </p>
                <div className="mt-auto pt-2">
                  <KButton
                    full
                    size="sm"
                    variant="cream"
                    disabled={owned === 0 || have >= def.max || save.credits < def.price}
                    onClick={() => run({ kind: "hire", role }, def.name, def.price)}
                  >
                    {owned === 0
                      ? "Buy a machine first"
                      : have >= def.max
                        ? "Team full"
                        : `Hire ${formatUsd(def.price)}`}
                  </KButton>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
