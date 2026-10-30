/**
 * The Second Floor map (developer 2026-10-16): the automated food hall,
 * drawn and tapped exactly like the first-floor map (same CSS, percentage
 * hot spots on the art). Each station opens a panel to buy / upgrade it; the
 * Pickup Counter collects everything the stations earned; the stairs go back
 * down. The money rules live in game/restaurant/secondFloor.ts — this view
 * only shows them and calls `onAction`.
 */
import { useEffect, useState } from "react";
import { useUnlockText } from "../navLevel";
import { FloorLife } from "./FloorLife";
import { FLOOR_LIFE_ALWAYS_PREVIEW, FLOOR_LIFE_PREVIEW } from "@/game/restaurant/floorLife";
import { KButton } from "@/components/kc/common/primitives";
import { useAdBonus } from "@/components/kc/ads/adBonusApi";
import { formatUsd } from "@/game/money";
import { shortfall } from "@/game/economy/wallet";
import type { SaveData } from "@/game/SaveManager";
import {
  FLOOR_STAFF,
  cleanFactor,
  cleanersNeeded,
  isStaffed,
  serversNeeded,
  stationTakings,
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
import type { NormalizedRect } from "./restaurantMap";
import "./RestaurantMap.css";
import { LandscapeBackdrop } from "@/components/kc/game/LandscapeBackdrop";

export type SecondFloorAction =
  | { kind: "buy"; id: StationId }
  | { kind: "upgrade"; id: StationId }
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
  const [open, setOpen] = useState<ZoneId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const adBonus = useAdBonus();

  const floor = secondFloorOf(save);
  const waiting = floorEarnings(save, now);
  const perHour = floorPerHour(save);
  // The full preview cast only while the animation-testing flag is on (off: the save's floor).
  const previewLife = FLOOR_LIFE_ALWAYS_PREVIEW;
  const ownedCount = Object.keys(floor.stations).length;

  const act = (action: SecondFloorAction) => {
    const r = onAction(action);
    setNow(Date.now());
    if (r.ok) {
      setNote(
        action.kind === "collect"
          ? `Collected ${formatUsd(r.amount)}`
          : action.kind === "buy"
            ? isStaffed(secondFloorOf(r.save), action.id)
              ? "✓ Station bought · working now"
              : "✓ Station bought · hire a Floor Server"
            : action.kind === "hire"
              ? `✓ ${FLOOR_STAFF[action.role].name} hired`
              : "⬆ Upgraded · earns more",
      );
    } else if (r.reason === "insufficientFunds") {
      setNote("Not enough money yet");
    } else if (r.reason === "noStations") {
      setNote("🏬 Buy a station first");
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
          <div className="mt-3">
            <KButton
              full
              variant="sage"
              disabled={waiting <= 0}
              onClick={() => act({ kind: "collect" })}
            >
              {waiting > 0 ? `Collect ${formatUsd(waiting)}` : "Nothing to collect yet"}
            </KButton>
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
                    {def.icon} {def.name}s: {have} / {def.max}
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
                      ownedCount === 0 || have >= def.max || save.credits + waiting < def.price
                    }
                    onClick={() => act({ kind: "hire", role })}
                  >
                    {ownedCount === 0
                      ? "Buy a station first"
                      : have >= def.max
                        ? "Team full"
                        : `Hire for ${formatUsd(def.price)}`}
                  </KButton>
                </div>
              </div>
            );
          })}
          {ownedCount > 0 && cleanFactor(floor) < 1 ? (
            <p className="mt-2 font-ui text-[12px] text-copper">
              🧹 Messy tables · keeps {Math.round(cleanFactor(floor) * 100)}% of takings · hire a
              cleaner
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
      const short = shortfall(d.price, save.credits);
      // Early game phase 5 (2026-10-26): a machine bought now earns only once a Floor Server
      // runs it — say so before the purchase, with the server's one-time price.
      const needsServer = (floor.servers ?? 0) * FLOOR_STAFF.server.covers <= ownedCount;
      return (
        <>
          <p className="font-ui text-[13px] leading-snug text-walnut/75">{d.blurb}</p>
          <p className="mt-2 font-ui text-[12.5px] text-walnut-dark">
            Earns {formatUsd(d.perHour[0])} an hour · stores up to {hoursText(d.capHours[0])}
          </p>
          {needsServer ? (
            <p
              className="mt-1 font-ui text-[12px] text-walnut/65"
              data-testid="station-needs-server"
            >
              🧑‍🍳 Earns once a Floor Server runs it ({formatUsd(FLOOR_STAFF.server.price)} once)
            </p>
          ) : null}
          <div className="mt-3">
            <KButton
              full
              disabled={locked || short > 0}
              onClick={() => act({ kind: "buy", id: d.id })}
            >
              {locked
                ? `🔒 For sale ${u.when(d.unlockLevel)}`
                : short > 0
                  ? `${formatUsd(d.price)} · need ${formatUsd(short)} more`
                  : `Buy for ${formatUsd(d.price)}`}
            </KButton>
          </div>
        </>
      );
    }
    const i = owned.level - 1;
    const here = stationTakings(floor, d.id, now);
    const staffed = isStaffed(floor, d.id);
    const cap = stationCap(d, owned);
    const nextPrice = owned.level < MAX_STATION_LEVEL ? d.upgradePrices[i]! : null;
    return (
      <>
        <p className="font-ui text-[13px] leading-snug text-walnut/75">{d.blurb}</p>
        <p className="mt-2 font-ui text-[12.5px] text-walnut-dark">
          Lv {owned.level} · {formatUsd(d.perHour[i]!)} an hour · stores up to{" "}
          {hoursText(d.capHours[i]!)}
        </p>
        {staffed ? (
          <p className="mt-1 font-ui text-[12px] text-walnut/65">
            Made so far: {formatUsd(here)}
            {here >= Math.floor(cap * cleanFactor(floor))
              ? " · full, collect at the Pickup Counter"
              : ""}
          </p>
        ) : (
          <p className="mt-1 font-ui text-[12.5px] font-extrabold text-copper">
            🧑‍🍳 Needs a Floor Server · Pickup Counter
          </p>
        )}
        <div className="mt-3">
          {nextPrice !== null ? (
            <KButton
              full
              disabled={save.credits + here < nextPrice}
              onClick={() => act({ kind: "upgrade", id: d.id })}
            >
              {`Upgrade to Lv ${owned.level + 1} · ${formatUsd(nextPrice)} (${formatUsd(d.perHour[i + 1]!)}/h)`}
            </KButton>
          ) : (
            <p className="text-center font-ui text-[12.5px] font-extrabold text-sage">
              Fully upgraded
            </p>
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
          <span className="legend-pill hub-pill">{formatUsd(perHour)}/h</span>
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
