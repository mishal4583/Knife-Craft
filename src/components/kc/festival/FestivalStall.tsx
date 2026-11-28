/**
 * THE STALL (developer 2026-11-27, the concept image): the roof beam, posts, garlands and hanging lamps; the festival's lit sign and the day's
 * chalkboard; the continuous wooden workstation (ledges, shelf, the tray of pans, the Sauce Station's rack, power-up rack, plate stand) and the
 * things that only stand on it. The posts and
 * the two boards are drawn in front of the customers, who walk in from the stall's sides behind them (developer 2026-11-28). Decoration: nothing here is
 * tapped, and it is all drawn beneath the stations. `margin` is how far the window reaches past each side of the stage (a wide phone), in stage
 * units; the stall's edges and corner things follow it.
 */
import type { CSSProperties } from "react";
import { BurgerStack } from "./FestivalFood";
import { SIDE_ART, STALL_ART, STATION_ART, festivalUrl } from "./festivalArt";
import type { FestivalLayout, Rect } from "./festivalLayout";

const at = ([x, y, w, h]: Rect): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  width: w,
  height: h,
});

/** A prop standing in its box, on its bottom edge. */
function Prop({
  name,
  box,
  className = "",
}: {
  name: keyof typeof STALL_ART;
  box: Rect;
  className?: string;
}) {
  return (
    <img
      src={festivalUrl(STALL_ART[name])}
      alt=""
      draggable={false}
      className={`fest-prop ${className}`}
      style={at(box)}
    />
  );
}

/** A hanging lamp: a cord from the roof, a dark shade, and its warm light. */
function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <svg
      className="fest-lamp"
      style={at([x - 40, 0, 80, y + 26])}
      viewBox={`0 0 80 ${y + 26}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`fest-glow-${x}`}>
          <stop offset="0" stopColor="#ffdf7a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffdf7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="39" y="0" width="2.4" height={y - 34} fill="#3a2012" />
      <ellipse cx="40" cy={y + 4} rx="40" ry="26" fill={`url(#fest-glow-${x})`} />
      <path d={`M24 ${y} Q26 ${y - 34} 40 ${y - 36} Q54 ${y - 34} 56 ${y} Z`} fill="#2b2320" />
      <path
        d={`M29 ${y - 6} Q31 ${y - 28} 39 ${y - 31}`}
        stroke="#8a7a68"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="40" cy={y} rx="16" ry="4.5" fill="#fff3c0" />
      <ellipse cx="40" cy={y + 3} rx="9" ry="5" fill="#ffdf7a" opacity="0.85" />
    </svg>
  );
}

/** The festival's own sign: a red marquee with lit bulbs and its burger on top. */
function Sign({ box, name }: { box: Rect; name: string }) {
  const [first, ...rest] = name.toUpperCase().split(" ");
  const bulbs: [number, number][] = [
    ...Array.from({ length: 11 }, (_, i): [number, number] => [14 + i * 12.4, 36]),
    ...Array.from({ length: 11 }, (_, i): [number, number] => [14 + i * 12.4, 94]),
    ...[50, 65, 80].flatMap((y): [number, number][] => [
      [9, y],
      [143, y],
    ]),
  ];
  return (
    <div className="fest-sign" style={at(box)} data-testid="fest-sign" aria-hidden="true">
      <svg viewBox="0 0 152 100" preserveAspectRatio="xMidYMax meet">
        <rect x="4" y="30" width="144" height="69" rx="17" fill="#7a150c" />
        <rect
          x="6"
          y="31"
          width="140"
          height="66"
          rx="15"
          fill="#c92c1c"
          stroke="#ffcb5c"
          strokeWidth="3"
        />
        {bulbs.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="2.6"
            fill="#fff6bd"
            stroke="#ffb12e"
            strokeWidth="1"
          />
        ))}
        <text x="76" y="63" textAnchor="middle" className="fest-sign-text">
          {first}
        </text>
        <text x="76" y="86" textAnchor="middle" className="fest-sign-text">
          {rest.join(" ")}
        </text>
      </svg>
      <BurgerStack parts={["bun", "patty", "cheese", "lettuce"]} lid className="fest-sign-burger" />
    </div>
  );
}

/** The chalkboard hanging at the side. */
function Special({ box }: { box: Rect }) {
  return (
    <div className="fest-special" style={at(box)} data-testid="fest-special" aria-hidden="true">
      <span className="fest-chain" />
      <span className="fest-chain right" />
      <span className="fest-slate">
        <span className="fest-chalk-title">Today&apos;s Special</span>
        <span className="fest-chalk-food">
          <BurgerStack
            parts={["bun", "patty", "cheese", "lettuce"]}
            lid
            className="fest-chalk-burger"
          />
          <img src={festivalUrl(SIDE_ART.fries!)} alt="" />
          <img src={festivalUrl(SIDE_ART.cola!)} alt="" />
        </span>
      </span>
    </div>
  );
}

/** A gold wire stand holding a stack of clean plates (the game's own plate, five times over). */
function PlateStand({ box }: { box: Rect }) {
  return (
    <div
      aria-hidden="true"
      className="fest-platestand"
      style={at(box)}
      data-testid="fest-platestand"
    >
      <svg viewBox="0 0 142 106" preserveAspectRatio="none">
        <ellipse cx="71" cy="86" rx="66" ry="15" className="fest-wire" />
        <path d="M12 84 C3 58 9 36 24 40 M130 84 C139 58 133 36 118 40" className="fest-wire" />
      </svg>
      {[0, 1, 2, 3, 4].map((i) => (
        <img
          key={i}
          src={festivalUrl(STATION_ART.plate)}
          alt=""
          draggable={false}
          style={{ bottom: `${12 + i * 8}%` }}
        />
      ))}
      <svg viewBox="0 0 142 106" preserveAspectRatio="none">
        <path d="M5 86 C5 106 137 106 137 86" className="fest-wire" />
        <path d="M22 95 L18 72 M71 101 L71 89 M120 95 L124 72" className="fest-wire" />
        <circle cx="22" cy="100" r="4" className="fest-wire-foot" />
        <circle cx="120" cy="100" r="4" className="fest-wire-foot" />
      </svg>
    </div>
  );
}

/** Behind the customers: the lights, the roof beam, the garlands and the lamps. */
export function StallBack({ layout, margin }: { layout: FestivalLayout; margin: number }) {
  const width = layout.w + 2 * margin;
  return (
    <>
      <img
        src={festivalUrl(STALL_ART.lights)}
        alt=""
        className="fest-prop fest-lights"
        style={at([layout.w / 2 - 250, layout.wide ? 56 : 120, 250, 50])}
      />
      <img
        src={festivalUrl(STALL_ART.lights)}
        alt=""
        className="fest-prop fest-lights"
        style={at([layout.w / 2, layout.wide ? 56 : 120, 250, 50])}
      />
      <div
        aria-hidden="true"
        className="fest-beam"
        style={{ left: -margin - 8, width: width + 16 }}
      />
      <Prop name="garland" box={[-margin - 24, -8, 150, 84]} className="fest-garland" />
      <Prop name="garland" box={[layout.w + margin - 126, -8, 150, 84]} className="fest-garland" />
      {layout.lamps.map(([x, y]) => (
        <Lamp key={x} x={x} y={y} />
      ))}
    </>
  );
}

/** In front of the customers, so they come and go behind them: the stall's two side posts and the two boards. */
export function StallSides({
  layout,
  margin,
  name,
}: {
  layout: FestivalLayout;
  margin: number;
  name: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="fest-post"
        style={{ left: -margin - 6, top: -20, height: layout.counter + 24 }}
      />
      <div
        aria-hidden="true"
        className="fest-post right"
        style={{ left: layout.w + margin - 14, top: -20, height: layout.counter + 24 }}
      />
      {layout.sign ? <Sign box={layout.sign} name={name} /> : null}
      {layout.special ? <Special box={layout.special} /> : null}
    </>
  );
}

/** In front of the customers: the one wooden workstation and what stands on it. */
export function StallCounter({ layout, margin }: { layout: FestivalLayout; margin: number }) {
  const edge = { left: -margin - 40, right: -margin - 40 };
  return (
    <>
      {layout.wide ? (
        // the wide painting has no counter: a wooden one, from its edge past the foot of the stage
        <div
          aria-hidden="true"
          className="fest-wood"
          data-testid="fest-wood"
          style={{
            ...edge,
            top: layout.counter,
            bottom: -300,
            backgroundImage: `url(${festivalUrl(STALL_ART.wood)})`,
          }}
        />
      ) : margin >= 4 ? (
        // an upright tablet: the painted counter is only as wide as the stage, so one sheet of the same planks covers it to the window's edges
        <div
          aria-hidden="true"
          className="fest-wood"
          data-testid="fest-wood"
          style={{
            ...edge,
            top: layout.counter,
            bottom: -300,
            backgroundImage: `url(${festivalUrl(STALL_ART.wood)})`,
            backgroundSize: "100% 100%",
          }}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="fest-countertop"
        style={{ ...edge, top: layout.counter - 2 }}
      />
      {layout.ledges.map(([x, y, w, h]) => (
        <div
          key={y}
          aria-hidden="true"
          className="fest-ledge"
          // upright the ledge runs the whole counter; on its side the two stop where the grill begins
          style={
            layout.wide
              ? { left: edge.left, width: x + w - edge.left, top: y, height: h }
              : { ...edge, top: y, height: h }
          }
        />
      ))}
      {layout.shelf ? (
        <div
          aria-hidden="true"
          className="fest-shelf"
          style={{ ...edge, top: layout.shelf[1], height: layout.shelf[3] }}
        />
      ) : null}
      {layout.pantry ? (
        <div
          aria-hidden="true"
          className="fest-pantry"
          data-testid="fest-pantry"
          style={at(layout.pantry)}
        />
      ) : null}
      {layout.sauces ? (
        <div
          aria-hidden="true"
          className="fest-saucerack"
          data-testid="fest-saucerack"
          style={at(layout.sauces)}
        >
          <span>Sauce Station</span>
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className={`fest-rack ${layout.wide ? "fest-rack-top" : ""}`}
        style={at(layout.rack)}
      />
      {layout.plateStand ? <PlateStand box={layout.plateStand} /> : null}
      {layout.props.map((p) => (
        <Prop key={`${p.art}-${p.box[0]}-${p.box[1]}`} name={p.art} box={p.box} />
      ))}
    </>
  );
}
