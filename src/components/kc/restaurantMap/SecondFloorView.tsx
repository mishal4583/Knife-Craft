/**
 * The Second Floor map (developer 2026-10-16): the automated food hall,
 * drawn and tapped exactly like the first-floor map (same CSS, percentage
 * hot spots on the art). Each station opens a panel to buy / upgrade it; the
 * Pickup Counter collects everything the stations earned; the stairs go back
 * down. The money rules live in game/restaurant/secondFloor.ts — this view
 * only shows them and calls `onAction`.
 */
import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/game/AudioManager";
import { useUnlockText } from "../navLevel";
import { FloorLife } from "./FloorLife";
import { FLOOR_LIFE_ALWAYS_PREVIEW, FLOOR_LIFE_PREVIEW } from "@/game/restaurant/floorLife";
import { KButton } from "@/components/kc/common/primitives";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { TableCash } from "@/components/kc/common/TableCash";
import {
  FLOOR_NEARLY_FULL,
  floorFill,
  fillText,
  stationFill,
  type Fill,
} from "@/game/restaurant/floorFill";
import { useAdBonus } from "@/components/kc/ads/adBonusApi";
import { formatUsdBig as formatUsd } from "@/game/money";
import { shortfall } from "@/game/economy/wallet";
import type { SaveData } from "@/game/SaveManager";
import {
  HYPE_MAX,
  RUSH_SPEED,
  rushActive,
  rushLeftMs,
  FLOOR_STAFF,
  FRANCHISE_MIN_TABLES,
  MAX_POLISH,
  SELF_SERVE_MACHINES,
  TIER3_MIN_LEVEL,
  MAX_BRANCH,
  canOpenBranch,
  cleanersNeeded,
  floorPopularityDelta,
  isStaffed,
  machinePrice,
  maxTablesAt,
  polishPrice,
  serversNeeded,
  staffPrice,
  stationPerHour,
  stationTakings,
  tablePrice,
  tierPrice,
  type FloorStaffRole,
  MAX_STATION_LEVEL,
  STATIONS,
  floorEarnings,
  isStationUnlocked,
  STATIONS_OPEN_AT,
  SECOND_FLOOR_TEST_UNLOCK,
  floorPerHour,
  secondFloorOf,
  stationCap,
  type FloorResult,
  type StationId,
} from "@/game/restaurant/secondFloor";
import { SHORT, nextFloorGoal } from "@/game/restaurant/floorGoal";
import { firstMachineGuide, firstMachineNeeded } from "@/game/restaurant/floorGuide";
import { PointerHand } from "../common/PointerHand";
import { goldenAmounts, goldenAt, goldenAvailable } from "@/game/restaurant/goldenGuest";
import type { NormalizedRect } from "./restaurantMap";
import "./RestaurantMap.css";
import { LandscapeBackdrop } from "@/components/kc/game/LandscapeBackdrop";
import { FloorStaffFace } from "@/components/kc/common/FloorStaffFace";

export type SecondFloorAction =
  | { kind: "buy"; id: StationId }
  | { kind: "upgrade"; id: StationId }
  | { kind: "table"; id: StationId }
  | { kind: "polish"; id: StationId }
  | { kind: "branch" }
  | { kind: "golden"; slot: number }
  | { kind: "rush" }
  | { kind: "collect" }
  | { kind: "hire"; role: FloorStaffRole };

type ZoneId = StationId | "pickup" | "seating" | "stairs";

/**
 * Hot spots on second-floor.webp (941 × 1672 source), in % of the art. The
 * top row's badge sits mid-room (y 11.5) so the map toolbar never hides it.
 */
const ZONES: { id: ZoneId; room: NormalizedRect; banner: NormalizedRect }[] = [
  {
    id: "pizza",
    room: { x: 5.3, y: 2.7, w: 30.3, h: 17 },
    banner: { x: 9.6, y: 11.5, w: 22.3, h: 2.4 },
  },
  {
    id: "coffee",
    room: { x: 36.1, y: 2.7, w: 29.8, h: 17 },
    banner: { x: 39.6, y: 11.5, w: 23.6, h: 2.4 },
  },
  {
    id: "drinks",
    room: { x: 66.4, y: 2.7, w: 29.8, h: 17 },
    banner: { x: 71.2, y: 11.5, w: 20.9, h: 2.4 },
  },
  {
    id: "burger",
    room: { x: 4.3, y: 21.5, w: 44.1, h: 15.6 },
    banner: { x: 12.8, y: 22.9, w: 23.4, h: 2.2 },
  },
  {
    id: "iceCream",
    room: { x: 56.9, y: 21.5, w: 39.3, h: 17.6 },
    banner: { x: 65.9, y: 22.9, w: 22.9, h: 2.2 },
  },
  {
    id: "hotFood",
    room: { x: 3.2, y: 38.3, w: 45.2, h: 14.4 },
    banner: { x: 12.2, y: 39.2, w: 25, h: 2.1 },
  },
  {
    id: "pickup",
    room: { x: 51.5, y: 42.2, w: 27.6, h: 10.5 },
    banner: { x: 56.3, y: 42.8, w: 19.7, h: 2.2 },
  },
  {
    id: "stairs",
    room: { x: 80.2, y: 40.7, w: 15.4, h: 19.1 },
    banner: { x: 82, y: 44, w: 12, h: 2.2 },
  },
  {
    id: "seating",
    room: { x: 4.3, y: 54.1, w: 91.4, h: 29 },
    banner: { x: 40.4, y: 57.3, w: 18.9, h: 2.4 },
  },
];

const NAMES: Record<"pickup" | "seating" | "stairs", { name: string; icon: string }> = {
  pickup: { name: "Pickup Counter", icon: "🛍️" },
  seating: { name: "Seating Area", icon: "🍽️" },
  stairs: { name: "Stairs down", icon: "⬇️" },
};

const isStation = (id: ZoneId): id is StationId => STATIONS.some((s) => s.id === id);

function hoursText(h: number): string {
  return `${h} h`;
}

/** A thin bar for how full a station (or the floor) is, with "Full in 2 h 10 min" under it. */
function FillBar({ fill, testId }: { fill: Fill; testId: string }) {
  const pct = Math.round(fill.fraction * 100);
  const warm = fill.full || fill.fraction >= FLOOR_NEARLY_FULL;
  return (
    <div className="mt-2" data-testid={testId} data-full={fill.full ? "true" : "false"}>
      <div
        className="h-2 overflow-hidden rounded-full bg-walnut/12"
        role="progressbar"
        aria-label="How full"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={`h-full rounded-full ${warm ? "bg-copper" : "bg-sage"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={`mt-1 font-ui text-[12px] ${warm ? "font-extrabold text-copper" : "text-walnut/65"}`}
      >
        {fillText(fill)}
      </p>
    </div>
  );
}

/** Where the cash lies on the Pickup Counter (inside its room on the painting, in percent). */
const PICKUP_CASH_AT = { x: 65.3, y: 49.6 };

export function SecondFloorView({
  save,
  playerLevel,
  onAction,
  onDownstairs,
  onOpenMarket,
  reducedMotion = false,
}: {
  save: SaveData;
  playerLevel: number;
  onAction: (action: SecondFloorAction) => FloorResult;
  onDownstairs: () => void;
  /** Opens the Market on its Second Floor section. */
  onOpenMarket?: () => void;
  reducedMotion?: boolean;
}) {
  const u = useUnlockText();
  // The floor earns by the real clock: re-read it every few seconds while open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);
  // The Golden Guest (a VIP) comes and goes by the clock: look at it every second.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const [open, setOpen] = useState<ZoneId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const adBonus = useAdBonus();

  const floor = secondFloorOf(save);
  const waiting = floorEarnings(save, now);
  const perHour = floorPerHour(save);
  const wholeFill = floorFill(save, now);
  // The full preview cast only while the animation-testing flag is on (off: the save's floor).
  const previewLife = FLOOR_LIFE_ALWAYS_PREVIEW;
  const ownedCount = Object.keys(floor.stations).length;
  // The best purchase to aim at; what waits on the floor counts toward the price.
  const goal = nextFloorGoal(save, playerLevel, save.credits + waiting);
  const goalShort = goal ? Math.max(0, goal.price - (save.credits + waiting)) : 0;
  // The first machine, step by step (game/restaurant/floorGuide.ts): save up, then buy it with money left to carry on.
  const firstGuide = firstMachineGuide(save, playerLevel, save.credits + waiting);

  const hype = floor.hype ?? 0;
  const rushOn = rushActive(floor, tick);
  const rushLeft = rushLeftMs(floor, tick);
  const rushClock = `${Math.floor(rushLeft / 60000)}:${String(Math.floor((rushLeft % 60000) / 1000)).padStart(2, "0")}`;
  const golden = Object.keys(floor.stations).length > 0 ? goldenAt(tick) : null;
  const goldenOn = !!golden && goldenAvailable(save, golden.slot);
  const tapGolden = () => {
    if (!golden) return;
    const amounts = goldenAmounts(save, playerLevel, Date.now());
    const r = onAction({ kind: "golden", slot: golden.slot });
    setNow(Date.now());
    if (r.ok) {
      setNote(`🌟 The VIP tipped ${formatUsd(r.amount)} · on the Pickup Counter`);
      if (amounts.adExtra > 0) adBonus.openGolden(amounts.adExtra);
    }
  };

  // FANFARE: a milestone (a new machine, a tier, 5 or 10 tables, ten Polish steps, a new branch, a Rush) gets a short celebration.
  const [fanfare, setFanfare] = useState<{ title: string; line: string } | null>(null);
  const fanfareTimer = useRef<number | null>(null);
  const celebrate = (title: string, line: string) => {
    setFanfare({ title, line });
    AudioManager.playSfx("levelComplete");
    if (fanfareTimer.current) window.clearTimeout(fanfareTimer.current);
    fanfareTimer.current = window.setTimeout(() => setFanfare(null), 2400);
  };
  useEffect(
    () => () => {
      if (fanfareTimer.current) window.clearTimeout(fanfareTimer.current);
    },
    [],
  );
  const milestoneOf = (action: SecondFloorAction, after: SaveData) => {
    const f = secondFloorOf(after);
    if (action.kind === "buy") {
      const d = STATIONS.find((s) => s.id === action.id)!;
      return {
        title: `${d.icon} ${SHORT[d.id]} is open!`,
        line: "A new machine on the floor",
      };
    }
    if (action.kind === "upgrade") {
      const t = f.stations[action.id]?.level ?? 2;
      return { title: `⬆ Tier ${t}!`, line: "Guests pay more, and faster" };
    }
    if (action.kind === "table") {
      const n = f.stations[action.id]?.tables ?? 1;
      if (n === 5) return { title: "🪑 5 tables!", line: "+25% income on this machine" };
      if (n === 10) return { title: "🪑 10 tables!", line: "+50% income on this machine" };
    }
    if (action.kind === "polish" && f.stations[action.id]?.polish === MAX_POLISH)
      return { title: "✨ Sparkling!", line: "Fully polished: +60%" };
    if (action.kind === "branch")
      return { title: `🏬 Branch ${(f.branch ?? 0) + 1}!`, line: "Everything pays ×10 now" };
    if (action.kind === "rush")
      return { title: "⚡ RUSH HOUR!", line: "Guests pour in, ×3 for 3 minutes" };
    return null;
  };

  const act = (action: SecondFloorAction) => {
    const r = onAction(action);
    setNow(Date.now());
    if (r.ok) {
      const m = milestoneOf(action, r.save);
      if (m) celebrate(m.title, m.line);
      setNote(
        action.kind === "collect"
          ? `Collected ${formatUsd(r.amount)}`
          : action.kind === "buy"
            ? isStaffed(secondFloorOf(r.save), action.id)
              ? "✓ Station bought · working now"
              : "✓ Station bought · hire a Floor Server"
            : action.kind === "hire"
              ? `✓ ${FLOOR_STAFF[action.role].name} hired`
              : action.kind === "table"
                ? "🪑 New table · more guests"
                : action.kind === "polish"
                  ? "✨ Polished · earns more"
                  : action.kind === "branch"
                    ? "🏬 New branch open · everything ×10"
                    : "⬆ Upgraded · earns more",
      );
    } else if (r.reason === "insufficientFunds") {
      setNote("Not enough money yet");
    } else if (r.reason === "noStations") {
      setNote("🏬 Buy a station first");
    } else if (r.reason === "notReady") {
      setNote("Fill the Hype meter to start a Rush");
    } else if (r.reason === "locked") {
      setNote(
        action.kind === "upgrade"
          ? `🔒 Tier 3 opens ${u.when(TIER3_MIN_LEVEL)}`
          : "🔒 Not open yet",
      );
    } else if (r.reason === "maxTables" || r.reason === "maxPolish") {
      setNote("Full for this tier");
    } else if (r.reason === "fullTeam") {
      setNote("The floor team is full");
    } else if (r.reason === "nothing") {
      setNote("Nothing to collect yet — come back later");
    }
  };

  const zoneLabel = (id: ZoneId) => {
    if (isStation(id)) {
      const d = STATIONS.find((s) => s.id === id)!;
      return { name: d.name, icon: d.icon };
    }
    return NAMES[id];
  };

  const panel = (() => {
    if (!open) return null;
    if (open === "stairs") return null;
    if (open === "pickup") {
      return (
        <>
          <p className="font-ui text-[13px] leading-snug text-walnut/75">
            Every order the machines make waits here. Collect it into your wallet.
          </p>
          <div className="mt-3 flex items-baseline justify-between font-ui text-walnut-dark">
            <span className="text-[13px]">Waiting</span>
            <span className="font-display text-2xl font-bold">{formatUsd(waiting)}</span>
          </div>
          <p className="mt-1 font-ui text-[12px] text-walnut/65">
            The floor earns {formatUsd(perHour)} per hour from {ownedCount}{" "}
            {ownedCount === 1 ? "station" : "stations"}.
          </p>
          {wholeFill ? <FillBar fill={wholeFill} testId="floor-fill" /> : null}
          {ownedCount > 0 ? (
            <p
              className="mt-1 flex items-center gap-1 font-ui text-[12px] text-walnut/65"
              data-testid="floor-popularity"
            >
              ⭐ +{floorPopularityDelta(save)} popularity a day
              <InfoTip label="How the machines add popularity">
                Every working machine counts its tier (Tier 1 = 1, Tier 3 = 3). Each 6 points add +1
                popularity a day, up to +3 with a full floor.
              </InfoTip>
            </p>
          ) : null}
          <div className="mt-3">
            <KButton
              full
              variant="sage"
              disabled={waiting <= 0}
              onClick={() => act({ kind: "collect" })}
            >
              {waiting > 0 ? `Collect ${formatUsd(waiting)}` : "Nothing to collect yet"}
            </KButton>
            {ownedCount > 0 ? (
              <div className="mt-3" data-testid="floor-hype">
                <div className="flex items-center justify-between font-ui text-[12.5px] font-extrabold text-walnut-dark">
                  <span className="flex items-center gap-1">
                    🔥 Hype
                    <InfoTip label="How Hype works">
                      A well-cooked first clear fills Hype: 20 points, and 20 more for each star.
                      When it is full, start a free three-minute Rush: every machine works ×3.
                    </InfoTip>
                  </span>
                  <span>{rushOn ? `⚡ Rush ${rushClock}` : `${hype}/${HYPE_MAX}`}</span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-walnut/12"
                  role="progressbar"
                  aria-label="Hype"
                  aria-valuemin={0}
                  aria-valuemax={HYPE_MAX}
                  aria-valuenow={hype}
                >
                  <div className="h-full rounded-full bg-copper" style={{ width: `${hype}%` }} />
                </div>
                {hype >= HYPE_MAX ? (
                  <div className="mt-2">
                    <KButton full onClick={() => act({ kind: "rush" })}>
                      ⚡ Start Rush
                    </KButton>
                  </div>
                ) : null}
              </div>
            ) : null}
            {adBonus.rushFor() > 0 ? (
              <div className="mt-2" data-testid="floor-rush-ad">
                <KButton full variant="cream" onClick={adBonus.openRush}>
                  {`📺 Rush hour · +${formatUsd(adBonus.rushFor())}`}
                </KButton>
              </div>
            ) : null}
            {adBonus.skipFor() > 0 ? (
              <div className="mt-2" data-testid="floor-skip">
                <KButton full variant="cream" onClick={adBonus.openSkip}>
                  {`📺 Skip ahead · +${formatUsd(adBonus.skipFor())}`}
                </KButton>
              </div>
            ) : null}
            {adBonus.floorDoubleFor(waiting) > 0 ? (
              <div className="mt-2" data-testid="floor-double">
                <KButton full onClick={adBonus.openFloorDouble}>
                  {`📺 Collect ×2 · ${formatUsd(waiting + adBonus.floorDoubleFor(waiting))}`}
                </KButton>
              </div>
            ) : null}
          </div>
          {onOpenMarket ? (
            <div className="mt-3">
              <KButton
                full
                className="h-12 px-2 text-[12.5px]"
                variant="cream"
                onClick={onOpenMarket}
              >
                🛒 Machines, upgrades & team in the Market
              </KButton>
            </div>
          ) : null}
          <h4 className="mt-4 font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper">
            Floor team · hired for good, no wages
          </h4>
          {(["server", "cleaner"] as const).map((role) => {
            const def = FLOOR_STAFF[role];
            const have = (role === "server" ? floor.servers : floor.cleaners) ?? 0;
            const need = role === "server" ? serversNeeded(floor) : cleanersNeeded(floor);
            return (
              <div
                key={role}
                className="mt-2 rounded-2xl border border-walnut/10 bg-ivory/70 p-2.5"
              >
                <div className="flex items-center justify-between gap-2 font-ui text-[13px] font-extrabold text-walnut-dark">
                  <span>
                    {/* One face per hired Floor Cleaner (two different people); the Server has one portrait. */}
                    {Array.from(
                      { length: role === "cleaner" ? Math.min(def.max, Math.max(1, have)) : 1 },
                      (_, i) => (
                        <FloorStaffFace
                          key={i}
                          role={role}
                          index={i}
                          fallback={def.icon}
                          className="mr-1 h-9 w-9 rounded-xl align-middle"
                        />
                      ),
                    )}{" "}
                    {def.name}s: {have} / {def.max}
                  </span>
                  <span className={have < need ? "text-copper" : "text-sage"}>
                    {need === 0 ? "" : have < need ? `needs ${need}` : "enough"}
                  </span>
                </div>
                <p className="mt-1 font-ui text-[12px] leading-snug text-walnut/65">{def.blurb}</p>
                <div className="mt-2">
                  <KButton
                    full
                    className="h-12 px-2 text-[12.5px]"
                    variant="cream"
                    disabled={
                      ownedCount === 0 ||
                      have >= def.max ||
                      save.credits + waiting < staffPrice(role, have, floor.branch)
                    }
                    onClick={() => act({ kind: "hire", role })}
                  >
                    {ownedCount === 0
                      ? "Buy a station first"
                      : have >= def.max
                        ? "Team full"
                        : `Hire for ${formatUsd(staffPrice(role, have, floor.branch))}`}
                  </KButton>
                </div>
              </div>
            );
          })}
          {canOpenBranch(save) ? (
            <div className="mt-4" data-testid="open-branch">
              <h4 className="font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper">
                Franchise
              </h4>
              <p className="mt-1 flex items-center gap-1 font-ui text-[12px] leading-snug text-walnut/65">
                Every machine is Tier 3 with {FRANCHISE_MIN_TABLES}+ tables.
                <InfoTip label="What a new branch does">
                  Open a new branch: the floor starts again with prices and guests paying ×10, and
                  each branch you finish adds +50% income for good. Your money stays.
                </InfoTip>
              </p>
              <div className="mt-2">
                <KButton full onClick={() => act({ kind: "branch" })}>
                  🏬 Open branch {(floor.branch ?? 0) + 2}
                </KButton>
              </div>
            </div>
          ) : (floor.branch ?? 0) > 0 ? (
            <p className="mt-2 font-ui text-[12px] text-walnut/65" data-testid="branch-line">
              🏬 Branch {(floor.branch ?? 0) + 1} · +{(floor.branch ?? 0) * 50}% income
              {(floor.branch ?? 0) >= MAX_BRANCH ? " · 🏆 final branch" : ""}
            </p>
          ) : null}
        </>
      );
    }
    if (open === "seating") {
      return (
        <p className="font-ui text-[13px] leading-snug text-walnut/75">
          {ownedCount === 0
            ? playerLevel < STATIONS_OPEN_AT
              ? `🔒 Stations on sale ${u.when(STATIONS_OPEN_AT)} · look around`
              : "🏬 Buy a station to bring guests upstairs"
            : `🍔 Guests eat what the machines make · ${formatUsd(perHour)}/h`}
        </p>
      );
    }
    const d = STATIONS.find((s) => s.id === open)!;
    const owned = floor.stations[d.id];
    if (!owned) {
      const locked = !isStationUnlocked(d, playerLevel);
      const price = machinePrice(d, floor.branch);
      const short = shortfall(price, save.credits);
      // The FIRST machine is bought only with money left to carry on (food, wages): developer 2026-11-08.
      const reserveShort =
        ownedCount === 0 ? shortfall(firstMachineNeeded(price), save.credits) : 0;
      // The first two machines are self-serve; later ones run at half speed until a Floor Server is hired.
      const needsServer =
        SELF_SERVE_MACHINES + (floor.servers ?? 0) * FLOOR_STAFF.server.covers <= ownedCount;
      return (
        <>
          <p className="font-ui text-[13px] leading-snug text-walnut/75">{d.blurb}</p>
          <p className="mt-2 font-ui text-[12.5px] text-walnut-dark">
            Earns {formatUsd(d.perHour[0])} an hour at one table · stores up to{" "}
            {hoursText(d.capHours[0])}
          </p>
          {needsServer ? (
            <p
              className="mt-1 font-ui text-[12px] text-walnut/65"
              data-testid="station-needs-server"
            >
              🧑‍🍳 Half speed until a Floor Server runs it (
              {formatUsd(staffPrice("server", floor.servers ?? 0, floor.branch))} once)
            </p>
          ) : null}
          <div className="mt-3">
            <KButton
              full
              disabled={locked || short > 0 || reserveShort > 0}
              onClick={() => act({ kind: "buy", id: d.id })}
            >
              {locked
                ? `🔒 For sale ${u.when(d.unlockLevel)}`
                : short > 0
                  ? `${formatUsd(price)} · need ${formatUsd(short)} more`
                  : reserveShort > 0
                    ? `Save ${formatUsd(reserveShort)} more to keep cooking`
                    : `Buy for ${formatUsd(price)}`}
            </KButton>
          </div>
        </>
      );
    }
    const i = owned.level - 1;
    const here = stationTakings(floor, d.id, now);
    const staffed = isStaffed(floor, d.id);
    const cap = stationCap(floor, d.id);
    const tables = owned.tables ?? 1;
    const polish = owned.polish ?? 0;
    const roomFull = tables >= maxTablesAt(owned.level);
    const tPrice = tablePrice(d, tables, floor.branch);
    const pPrice = polishPrice(d, polish, floor.branch);
    const to = owned.level + 1;
    const nextPrice =
      owned.level < MAX_STATION_LEVEL ? tierPrice(d, to as 2 | 3, floor.branch) : null;
    const tierLocked = to === 3 && playerLevel < TIER3_MIN_LEVEL;
    // What waits on the whole floor counts toward a price (the purchase banks the pile first), not just this machine.
    const funds = save.credits + waiting;
    return (
      <>
        <p className="font-ui text-[13px] leading-snug text-walnut/75">{d.blurb}</p>
        <p className="mt-2 font-ui text-[12.5px] text-walnut-dark" data-testid="station-stats">
          Tier {owned.level} · {tables} {tables === 1 ? "table" : "tables"} · polish {polish}/
          {MAX_POLISH} · {formatUsd(stationPerHour(floor, d.id))} an hour · holds{" "}
          {hoursText(d.capHours[i]!)}
        </p>
        {staffed ? (
          <>
            <p className="mt-1 font-ui text-[12px] text-walnut/65">
              Made so far: {formatUsd(here)}
              {here >= cap ? " · full, collect at the Pickup Counter" : ""}
            </p>
            {stationFill(floor, d.id, now) ? (
              <FillBar fill={stationFill(floor, d.id, now)!} testId="station-fill" />
            ) : null}
          </>
        ) : (
          <p className="mt-1 font-ui text-[12.5px] font-extrabold text-copper">
            🧑‍🍳 Half speed, holds {formatUsd(cap)} · hire a Floor Server
          </p>
        )}
        <div className="mt-3 grid gap-2">
          <KButton
            full
            disabled={roomFull || funds < tPrice}
            onClick={() => act({ kind: "table", id: d.id })}
          >
            {roomFull
              ? `🪑 Room full (${maxTablesAt(owned.level)} tables) · upgrade the tier`
              : `🪑 Table #${tables + 1} · ${formatUsd(tPrice)}`}
          </KButton>
          <KButton
            full
            variant="cream"
            disabled={polish >= MAX_POLISH || funds < pPrice}
            onClick={() => act({ kind: "polish", id: d.id })}
          >
            {polish >= MAX_POLISH
              ? "✨ Fully polished"
              : `✨ Polish ${polish + 1}/${MAX_POLISH} · ${formatUsd(pPrice)} · +6%`}
          </KButton>
          {nextPrice !== null ? (
            <KButton
              full
              variant="cream"
              disabled={tierLocked || funds < nextPrice}
              onClick={() => act({ kind: "upgrade", id: d.id })}
            >
              {tierLocked
                ? `🔒 Tier 3 opens ${u.when(TIER3_MIN_LEVEL)}`
                : `⬆ Tier ${to} · ${formatUsd(nextPrice)} · faster, pays more`}
            </KButton>
          ) : (
            <p className="text-center font-ui text-[12.5px] font-extrabold text-sage">Top tier</p>
          )}
        </div>
      </>
    );
  })();

  return (
    <div
      className={`restaurant-map-container ${reducedMotion ? "restaurant-map--reduced-motion" : ""}`}
      role="region"
      aria-label="Second floor: the automated food hall"
      data-testid="second-floor"
    >
      <LandscapeBackdrop section="restaurant" wash="dim" />
      <div className="restaurant-map-toolbar" role="toolbar" aria-label="Second floor">
        <div className="map-legend-pills">
          <span className="legend-pill level-pill">
            <span className="pill-dot" /> 2nd floor
          </span>
          <span className="legend-pill hub-pill">
            {rushOn ? `⚡ ${formatUsd(perHour * RUSH_SPEED)}` : formatUsd(perHour)}/h
          </span>
          {SECOND_FLOOR_TEST_UNLOCK ? <span className="legend-pill">Test: floor open</span> : null}
        </div>
        <button
          type="button"
          className="zoom-btn"
          style={{ width: "auto", padding: "0 12px", minHeight: 48 }}
          onClick={onDownstairs}
        >
          ⬇ Downstairs
        </button>
      </div>

      <div className="restaurant-map-viewport">
        <div className="restaurant-map-stage is-second-floor">
          <picture className="restaurant-map-picture">
            <img
              className="restaurant-vector-map"
              src={`${import.meta.env.BASE_URL}restaurant-map/second-floor.webp`}
              alt="Overhead plan of the second floor: automated pizza, coffee, drinks, burger, ice cream and fried-food stations, a pickup counter and a seating area"
              draggable={false}
            />
          </picture>
          <FloorLife
            floor={previewLife ? FLOOR_LIFE_PREVIEW : floor}
            earning={previewLife || perHour > 0}
            preview={previewLife}
          />
          {/* What the machines have made lies on the Pickup Counter, like the cash on the tables. */}
          <TableCash
            at={PICKUP_CASH_AT}
            where="the Pickup Counter"
            testId="floor-cash"
            cents={waiting}
            onCollect={() => act({ kind: "collect" })}
          />
          {goldenOn && golden ? (
            <button
              type="button"
              data-testid="golden-guest"
              aria-label="A VIP guest is here: tap for a tip"
              className="absolute z-30 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#f5c451] bg-ivory/95 text-[28px] shadow-lift animate-bounce"
              style={{ left: `${golden.x}%`, top: `${golden.y}%` }}
              onClick={tapGolden}
            >
              <span aria-hidden="true">🌟</span>
            </button>
          ) : null}
          <div className="restaurant-map-hotspots-layer">
            {ZONES.map((z) => {
              const station = isStation(z.id) ? STATIONS.find((s) => s.id === z.id)! : null;
              const owned = station ? floor.stations[station.id] : undefined;
              // Every station stays locked until it is bought (developer 2026-10-16);
              // before its level the pill shows the level, after it the price.
              const locked = !!station && !owned;
              const tooEarly = !!station && !isStationUnlocked(station, playerLevel);
              const label = zoneLabel(z.id);
              return (
                <div
                  key={z.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${label.name}${
                    !locked
                      ? ""
                      : tooEarly
                        ? ` — opens ${u.when(station!.unlockLevel)}`
                        : ` — locked, buy for ${formatUsd(station!.price)}`
                  }`}
                  className={`map-hotspot-zone ${locked ? "is-locked" : "is-unlocked"} ${open === z.id ? "is-current-screen" : ""}`}
                  style={{
                    left: `${z.room.x}%`,
                    top: `${z.room.y}%`,
                    width: `${z.room.w}%`,
                    height: `${z.room.h}%`,
                  }}
                  onClick={() =>
                    z.id === "stairs" ? onDownstairs() : (setNote(null), setOpen(z.id))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (z.id === "stairs") onDownstairs();
                      else setOpen(z.id);
                    }
                  }}
                >
                  <div
                    className="hotspot-banner-anchor"
                    style={{
                      left: `${((z.banner.x + z.banner.w / 2 - z.room.x) / z.room.w) * 100}%`,
                      top: `${((z.banner.y + z.banner.h / 2 - z.room.y) / z.room.h) * 100}%`,
                    }}
                  >
                    {locked ? (
                      <div className="locked-pill-badge">
                        <span className="lock-icon" aria-hidden="true">
                          🔒
                        </span>
                        <span className="lock-text">
                          {tooEarly ? u.badge(station!.unlockLevel) : formatUsd(station!.price)}
                        </span>
                      </div>
                    ) : owned && !isStaffed(floor, station!.id) ? (
                      <div className="locked-pill-badge">
                        <span className="lock-text">Needs a server</span>
                      </div>
                    ) : owned ? (
                      <div className="active-pill-badge">
                        <span className="pulse-dot" aria-hidden="true" />
                        <span className="badge-text">Lv {owned.level}</span>
                      </div>
                    ) : z.id === "pickup" && waiting > 0 ? (
                      <span
                        className="map-attention-badge"
                        role="img"
                        aria-label={`${formatUsd(waiting)} waiting`}
                      >
                        <span aria-hidden="true">💰</span>
                        <i aria-hidden="true">!</i>
                      </span>
                    ) : null}
                  </div>
                  <span className="hotspot-tap-ripple" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!open && ownedCount > 0 && (rushOn || hype >= HYPE_MAX) ? (
        <div
          className={`absolute bottom-[160px] left-2 right-2 z-20 flex min-h-12 items-center justify-between gap-2 rounded-2xl border px-3 py-1.5 font-ui text-[13px] font-extrabold shadow-lg ${rushOn ? "border-copper/50 bg-copper text-ivory" : "border-[#f5c451] bg-ivory/95 text-walnut-dark"}`}
          data-testid={rushOn ? "rush-on" : "rush-ready"}
        >
          {rushOn ? (
            <span>
              ⚡ RUSH ×{RUSH_SPEED} · {rushClock}
            </span>
          ) : (
            <>
              <span>🔥 Hype is full</span>
              <KButton className="h-12 px-4 text-[13px]" onClick={() => act({ kind: "rush" })}>
                ⚡ Start Rush
              </KButton>
            </>
          )}
        </div>
      ) : null}

      {fanfare ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/3 z-40 grid place-items-center px-4"
          role="status"
          aria-live="polite"
          data-testid="floor-fanfare"
        >
          <div className="rounded-3xl border-2 border-[#f5c451] bg-ivory/95 px-6 py-4 text-center shadow-lift animate-bounce">
            <p className="font-display text-[26px] font-black leading-tight text-walnut-dark">
              {fanfare.title}
            </p>
            <p className="mt-1 font-hand text-[17px] text-walnut/80">{fanfare.line}</p>
            <p className="mt-1 text-[22px]" aria-hidden="true">
              🎉✨🎊
            </p>
          </div>
        </div>
      ) : null}

      {!open && firstGuide ? (
        <div
          className="absolute bottom-[88px] left-2 right-2 z-20 rounded-2xl border-2 border-copper/50 bg-ivory/95 p-3 shadow-lg"
          data-testid="floor-first-machine"
          data-stage={firstGuide.stage}
        >
          <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper">
            Your first machine
          </p>
          {firstGuide.stage === "save" ? (
            <>
              <p className="mt-0.5 font-display text-[16px] font-extrabold leading-snug text-walnut-dark">
                Save {formatUsd(firstGuide.missing)} more
              </p>
              <p className="font-hand text-[16px] leading-snug text-walnut/80">
                The {firstGuide.name} machine is {formatUsd(firstGuide.price)}. Keep{" "}
                {formatUsd(firstGuide.needed - firstGuide.price)} for food and wages.
              </p>
              <div
                className="mt-1.5 h-3 overflow-hidden rounded-full bg-walnut/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(firstGuide.fraction * 100)}
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8aa07a,#d7a85a)]"
                  style={{ width: `${Math.round(firstGuide.fraction * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 font-ui text-[12px] font-bold text-walnut/70">
                {formatUsd(firstGuide.have)} of {formatUsd(firstGuide.needed)} · every service pays
                more
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-extrabold leading-snug text-walnut-dark">
                  Buy the {firstGuide.name} machine
                </p>
                <p className="font-hand text-[16px] leading-snug text-walnut/80">
                  {formatUsd(firstGuide.price)} · you still keep{" "}
                  {formatUsd(firstGuide.have - firstGuide.price)}. It earns while you cook.
                </p>
              </div>
              <div className="relative shrink-0">
                <span
                  className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rotate-180"
                  data-testid="floor-first-machine-hand"
                >
                  <PointerHand size={34} />
                </span>
                <KButton
                  className="h-12 px-4 text-[13px]"
                  onClick={() => act({ kind: "buy", id: firstGuide.id })}
                >
                  Buy
                </KButton>
              </div>
            </div>
          )}
        </div>
      ) : !open && goal ? (
        <div
          className="absolute bottom-[88px] left-2 right-2 z-20 flex items-center gap-2 rounded-2xl border border-walnut/15 bg-ivory/95 p-2 shadow-lg"
          data-testid="floor-goal"
        >
          <div className="min-w-0 flex-1 font-ui text-[12.5px] leading-tight text-walnut-dark">
            <div className="truncate font-extrabold">Next: {goal.label}</div>
            <div className="text-walnut/70">
              {formatUsd(goal.price)}
              {goalShort > 0 ? ` · ${formatUsd(goalShort)} to go` : " · ready"}
            </div>
          </div>
          <KButton
            className="h-12 shrink-0 px-4 text-[13px]"
            disabled={goalShort > 0}
            onClick={() => act(goal.action)}
          >
            Buy
          </KButton>
        </div>
      ) : null}

      {open && open !== "stairs" ? (
        <aside className="map-zone-detail-card" role="dialog" aria-label={zoneLabel(open).name}>
          <div className="card-header">
            <span className="card-icon" aria-hidden="true">
              {zoneLabel(open).icon}
            </span>
            <div className="card-title-wrap">
              <strong className="card-title">{zoneLabel(open).name}</strong>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="zoom-btn"
              style={{ minWidth: 48, minHeight: 48 }}
              onClick={() => setOpen(null)}
            >
              ✕
            </button>
          </div>
          <div className="mt-2">{panel}</div>
          {note ? (
            <p
              role="status"
              className="mt-2 text-center font-ui text-[12.5px] font-extrabold text-copper"
            >
              {note}
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

export default SecondFloorView;
