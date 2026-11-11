import { openingClip, surfaceOf } from "./sauceSurface";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WHISK_ZONE, type Tool } from "@/game/business/sauceStation";
import { boxStyle, cellAspect, cellStyle, rectStyle, sauceUrl, useSauceArt } from "./sauceArt";
import { SHEETS } from "./sauceSheets";

/**
 * The small painted pieces of the Sauce Station screens: a cropped sprite, the sauce bottle icon, the two vessels with their liquid, the layered
 * bottle, and the gauges (whisk dial, emulsion tube, thickness tube). Every piece is a painted picture when the art is built (`public/business/sauce/`)
 * and a plain CSS stand-in when it is not, so the game always plays. Presentation only: the numbers come from `business/sauceStation.ts`.
 */

/** One picture of a sheet, cropped to its painted pixels; the emoji shows until (or unless) the art exists. */
export function Sprite({
  sheet,
  index,
  emoji,
  className,
  style,
}: {
  sheet: string;
  index: number;
  emoji?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ok = useSauceArt(sheet);
  const box = ok ? boxStyle(sheet, index) : null;
  if (!box)
    return (
      <span
        aria-hidden
        className={cn("grid place-items-center leading-none", className)}
        style={{ aspectRatio: "1", ...style }}
      >
        {emoji}
      </span>
    );
  return (
    <span
      aria-hidden
      className={cn("block", className)}
      style={{ aspectRatio: String(box.aspect), ...box.style, ...style }}
    />
  );
}

/** The icon of one of the 24 sauce bottles (C02, the whole 6 x 4 cell), or its emoji. */
export function SauceIcon({
  index,
  emoji,
  className,
  grey,
}: {
  index: number;
  emoji: string;
  className?: string;
  grey?: boolean;
}) {
  const ok = useSauceArt("sauce-icons");
  const style: CSSProperties = ok
    ? {
        ...cellStyle("sauce-icons", index % 6, Math.floor(index / 6)),
        aspectRatio: String(cellAspect("sauce-icons")),
        ...(grey ? { filter: "grayscale(1) brightness(.55)", opacity: 0.7 } : null),
      }
    : { aspectRatio: "1" };
  return (
    <span
      aria-hidden
      className={cn("block shrink-0", !ok && "grid place-items-center text-[26px]", className)}
      style={style}
    >
      {ok ? null : emoji}
    </span>
  );
}

// ── The two vessels ──────────────────────────────────────────────────────────

/**
 * The mixing bowl or the pan with the liquid in it: the painted vessel, the liquid as a real surface (an ellipse seen through the opening, with a
 * lighter meniscus, a darker edge where it meets the wall, a gloss, a ripple), a swirl when it is being stirred, floating chunks, and (when a dressing
 * split) an oil slick. `level` is how full it is (0..1). Without the art, an ellipse stands in.
 */
export function Vessel({
  kind,
  level,
  color,
  swirl,
  split,
  chunks,
  className,
}: {
  kind: "bowl" | "pan";
  level: number;
  color: string;
  swirl: boolean;
  split: boolean;
  /** Chunk sprite indexes (M18) to float in it. */
  chunks?: readonly number[] | undefined;
  className?: string;
}) {
  const back = useSauceArt(`${kind}-back`);
  const surf = surfaceOf(kind, level);
  const art = back;
  const empty = level < 0.01;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return (
    <div
      className={cn("relative", className)}
      style={{ aspectRatio: "540 / 312" }}
      data-testid="sauce-vessel"
    >
      {art ? (
        <img
          src={sauceUrl(`${kind}-back`)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
      ) : (
        <div
          className="absolute inset-x-[2%] top-[4%] bottom-[8%] rounded-[50%/42%] border-[5px] border-[#b9824a] bg-[#e9d3a8] shadow-lift"
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: art ? openingClip(kind) : "ellipse(44% 36% at 50% 28%)" }}
      >
        {art ? (
          empty ? null : (
            <div
              className="absolute transition-[top,left,width,background-color] duration-300"
              data-testid="sauce-liquid"
              style={{
                left: pct(surf.left),
                top: pct(surf.top),
                width: pct(surf.width),
                height: pct(surf.height),
                borderRadius: "50%",
                backgroundColor: color,
                // a light pool toward the back-left (where the window is), a darker edge where the sauce meets the wall, a bright thin meniscus ring
                backgroundImage:
                  "radial-gradient(70% 60% at 38% 30%, rgba(255,255,255,.32), rgba(255,255,255,0) 70%), radial-gradient(closest-side, rgba(0,0,0,0) 70%, rgba(0,0,0,.30) 100%)",
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,.20), inset 0 4px 7px rgba(255,255,255,.30), inset 0 -7px 12px rgba(0,0,0,.20)",
              }}
            >
              <span
                aria-hidden
                className="absolute left-[18%] top-[14%] h-[16%] w-[34%] rotate-[-8deg] rounded-[50%] bg-white/30 blur-[2px]"
              />
              {swirl ? (
                <span
                  aria-hidden
                  className="sauce-swirl absolute left-1/2 top-1/2 h-[150%] w-[100%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35"
                  style={{
                    backgroundImage:
                      "conic-gradient(from 0deg, rgba(255,255,255,.55), rgba(255,255,255,0) 18%, rgba(0,0,0,.18) 40%, rgba(255,255,255,0) 58%, rgba(255,255,255,.4) 80%, rgba(255,255,255,.55))",
                  }}
                />
              ) : null}
              {split ? (
                <span
                  aria-hidden
                  data-testid="sauce-split"
                  className="absolute left-[18%] top-[22%] h-[40%] w-[64%] rounded-[50%] border-[3px] border-[rgba(255,240,170,.85)] bg-[rgba(255,230,120,.28)]"
                />
              ) : null}
            </div>
          )
        ) : (
          <div
            className="absolute inset-x-0 bottom-0 transition-[top,background-color] duration-300"
            data-testid="sauce-liquid"
            style={{
              top: `${(0.03 + (1 - level) * 0.25) * 100}%`,
              backgroundColor: color,
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,0) 26%, rgba(0,0,0,.14))",
            }}
          >
            {split ? (
              <span
                aria-hidden
                data-testid="sauce-split"
                className="absolute left-[18%] top-[16%] h-[34%] w-[64%] rounded-[50%] border-[3px] border-[rgba(255,240,170,.85)] bg-[rgba(255,230,120,.28)]"
              />
            ) : null}
          </div>
        )}
        {level > 0.2 && chunks
          ? chunks.map((c, i) => (
              <Sprite
                key={i}
                sheet="chunks"
                index={c}
                emoji="•"
                className="sauce-chunk absolute w-[9%]"
                style={{
                  left: `${24 + ((i * 23) % 52)}%`,
                  top: pct(surf.visTop + (surf.visBottom - surf.visTop) * (0.3 + 0.18 * (i % 3))),
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))
          : null}
      </div>
    </div>
  );
}

// ── Bottles ──────────────────────────────────────────────────────────────────

/** Where each of the six bottle shapes' liquid starts and ends (a share of the 256 px cell; measured on the built mask row). */
const BOTTLE_INSIDE: readonly (readonly [number, number])[] = [
  [0.3, 0.915],
  [0.34, 0.915],
  [0.4, 0.915],
  [0.42, 0.915],
  [0.46, 0.915],
  [0.43, 0.915],
];
/** Where the liquid's surface is in a bottle of `shape` at `fill` (0 = empty, 1 = brim of the body), as a share of the bottle's height from the top. */
export function bottleSurface(shape: number, fill: number): number {
  const [top, bottom] = BOTTLE_INSIDE[shape] ?? BOTTLE_INSIDE[0]!;
  return bottom - Math.min(1.15, Math.max(0, fill)) * (bottom - top);
}

/**
 * A glass bottle made of the three painted rows of the bottle sheet: the back, the liquid clipped by the mask row, then the front glass; optionally a
 * cap and a label. `fill` is the share of the inside that is full (0..1.2: over 1 it brims over). Without the art, a simple glass shape stands in.
 */
export function BottleView({
  shape,
  fill,
  color,
  capped,
  label,
  emoji,
  mark,
  className,
  children,
}: {
  shape: number;
  fill: number;
  color: string;
  capped?: boolean;
  label?: number | undefined;
  emoji?: string | undefined;
  /** Draw the fill line across the bottle. */
  mark?: number | undefined;
  className?: string;
  /** Drawn over the bottle in ITS coordinates (the pitcher and the stream: see BottleStage). */
  children?: ReactNode;
}) {
  const ok = useSauceArt("bottles");
  const [top, bottom] = BOTTLE_INSIDE[shape] ?? BOTTLE_INSIDE[0]!;
  const f = Math.min(1.15, Math.max(0, fill));
  const liquidTop = bottleSurface(shape, f);
  const row = (r: number): CSSProperties => ({
    ...cellStyle("bottles", shape, r),
    aspectRatio: String(cellAspect("bottles")),
  });
  const maskUrl = `url(${sauceUrl("bottles")})`;
  return (
    <div
      className={cn("relative", className)}
      style={{ aspectRatio: ok ? String(cellAspect("bottles")) : "1 / 2" }}
      data-testid="sauce-bottle"
      data-fill={fill.toFixed(2)}
    >
      {ok ? (
        <>
          <span aria-hidden className="absolute inset-0" style={row(0)} />
          {/* the liquid, clipped to the glass by drawing it through the silhouette row (a canvas: the same on every browser, an iPhone's included) */}
          <BottleLiquid shape={shape} top={liquidTop} bottom={bottom} color={color} />
          <span aria-hidden className="absolute inset-0" style={row(1)} />
        </>
      ) : (
        <span
          aria-hidden
          className="absolute inset-x-[18%] bottom-0 top-[8%] overflow-hidden rounded-t-[35%] rounded-b-xl border-[3px] border-[#9fc9c4] bg-[#e9f6f3]/60"
        >
          <span
            className="absolute inset-x-0 bottom-0"
            style={{ top: `${(1 - f) * 100}%`, backgroundColor: color }}
          />
        </span>
      )}
      {mark !== undefined ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[8%] right-[8%] border-t-2 border-dashed border-white/90"
          style={{ top: `${bottleSurface(shape, mark) * 100}%` }}
        />
      ) : null}
      {label !== undefined ? (
        <Sprite
          sheet="labels"
          index={label}
          emoji={null}
          className="absolute left-1/2 w-[58%] -translate-x-1/2"
          style={{ top: "56%" }}
        />
      ) : null}
      {label !== undefined && emoji ? (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 text-[min(5vw,20px)] leading-none"
          style={{ top: "62%" }}
        >
          {emoji}
        </span>
      ) : null}
      {capped ? <Cap shape={shape} /> : null}
      {children}
    </div>
  );
}

// ── The liquid in a bottle, drawn on a canvas ───────────────────────────────

const pictures = new Map<string, Promise<HTMLImageElement>>();
/** Loads a picture once (remembered), for drawing it on a canvas. */
function loadPicture(url: string): Promise<HTMLImageElement> {
  let p = pictures.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("picture"));
      img.src = url;
    });
    pictures.set(url, p);
  }
  return p;
}

/**
 * The sauce inside a bottle (developer 2026-11-11: "the sauce inside the bottle is not accurate"; on the developer's iPhone the liquid slid out
 * under the glass). It used to be a CSS mask over a sprite sheet, which different browsers place differently. Now the glass silhouette (the sheet's
 * third row) is drawn on a canvas and the liquid is painted through it (`source-in`), so the sauce is exactly where the glass is on every browser
 * and never outside it. `top` / `bottom` are shares of the bottle's height; the colour is the sauce's own, shaded like the glass.
 */
function BottleLiquid({
  shape,
  top,
  bottom,
  color,
}: {
  shape: number;
  top: number;
  bottom: number;
  color: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const cv = ref.current;
    const sheet = SHEETS["bottles"];
    if (!cv || !sheet) return;
    void loadPicture(sauceUrl("bottles")).then((img) => {
      if (!alive) return;
      const cw = sheet.w / sheet.cols;
      const ch = sheet.h / sheet.rows;
      const W = Math.round(cw * 2);
      const H = Math.round(ch * 2);
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(img, shape * cw, 2 * ch, cw, ch, 0, 0, W, H);
      const y0 = Math.max(0, Math.min(1, top)) * H;
      const y1 = Math.max(y0, Math.min(1, bottom) * H);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
      ctx.globalCompositeOperation = "source-atop";
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(255,255,255,.3)");
      g.addColorStop(0.3, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(0,0,0,.16)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
      // the surface: a thin light line where the liquid meets the air
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(0, y0, W, 2);
    });
    return () => {
      alive = false;
    };
  }, [shape, top, bottom, color]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      data-testid="sauce-bottle-liquid"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ filter: "saturate(1.25)" }}
    />
  );
}

/** Where a bottle's mouth is: the neck's centre (share of the bottle's width) and its rim (share of the bottle's height). */
export const bottleMouth = (shape: number): { x: number; y: number; neck: number } => {
  const [rim, centre, width] = NECK[shape] ?? NECK[0]!;
  return { x: centre, y: rim / 256, neck: width };
};

/**
 * The pitcher over a bottle and the stream into it, in the bottle's coordinates (shares of its width and height). The spout tip sits just above the
 * mouth; the pitcher turns about that tip (so it tips over the mouth instead of swinging away), and the stream is a thin ribbon of the sauce's own
 * colour from the tip down to the surface, with a ripple where it lands. Idle, the pitcher rests tilted a little and raised.
 */
export function PourScene({
  shape,
  fill,
  color,
  pouring,
  reducedMotion,
}: {
  shape: number;
  fill: number;
  color: string;
  pouring: boolean;
  reducedMotion: boolean;
}) {
  const mouth = bottleMouth(shape);
  const jug = boxStyle("pour-tools", 0);
  const aspect = jug?.aspect ?? 1.26;
  // bottle width : height is 1 : 2 (a cell of the sheet is 128 x 256), so a jug 1.4 bottle-widths wide is 1.4 / aspect bottle-widths tall.
  const jugW = 1.4;
  const jugH = (jugW / aspect) * 0.5;
  const tipY = mouth.y - 0.035;
  const surface = bottleSurface(shape, fill);
  const streamTop = tipY + 0.005;
  const hasStream = pouring && surface > streamTop;
  const move = reducedMotion ? undefined : "transform .22s ease-out";
  return (
    <>
      {hasStream ? (
        <>
          <span
            aria-hidden
            data-testid="sauce-stream"
            className="pointer-events-none absolute z-[5] rounded-full"
            style={{
              left: `${mouth.x * 100}%`,
              top: `${streamTop * 100}%`,
              height: `${(surface - streamTop) * 100}%`,
              width: `${Math.max(3, mouth.neck * 100 * 0.3)}%`,
              transform: "translateX(-50%)",
              backgroundColor: color,
              backgroundImage:
                "linear-gradient(90deg, rgba(255,255,255,.35), rgba(255,255,255,0) 40%, rgba(0,0,0,.14))",
              filter: "saturate(1.25)",
            }}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-[5] h-[3%] w-[26%] rounded-[50%] border-2 border-white/70",
              !reducedMotion && "sauce-ripple",
            )}
            style={{
              left: `${mouth.x * 100}%`,
              top: `${surface * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        </>
      ) : null}
      <span
        aria-hidden
        data-testid="sauce-jug"
        data-pouring={pouring ? "1" : "0"}
        className="pointer-events-none absolute z-[6]"
        style={{
          left: `${mouth.x * 100}%`,
          top: `${(tipY - JUG_TIP.y * jugH) * 100}%`,
          width: `${jugW * 100}%`,
          transformOrigin: `${JUG_TIP.x * 100}% ${JUG_TIP.y * 100}%`,
          transform: pouring ? "rotate(-34deg) translateY(0)" : "rotate(-8deg) translateY(-6%)",
          transition: move,
        }}
      >
        <Sprite sheet="pour-tools" index={0} emoji="🫗" className="h-auto w-full" />
      </span>
    </>
  );
}

/** The pitcher's spout tip inside its own picture (shares of the tight box), measured on the sheet: the tip is on the left edge, a little below the top. */
export const JUG_TIP = { x: 0, y: 0.13 } as const;

/**
 * The painted closure for a bottle shape. Each picture of the caps sheet also carries a neck full of sauce, so only the hand-picked box of the cap itself
 * (pixels of the built sheet) is shown, as wide as the bottle's neck and standing on its rim.
 */
const CAP_BOX: readonly (readonly [number, number, number, number])[] = [
  [42, 30, 58, 37],
  [167, 2, 56, 66],
  [280, 31, 64, 35],
  [35, 139, 65, 53],
  [167, 129, 48, 54],
  [286, 146, 59, 46],
];
/** For each bottle shape: the rim row of its front glass (of 256), the neck's centre and width (shares of the bottle's width). */
const NECK: readonly (readonly [number, number, number])[] = [
  [6, 0.547, 0.234],
  [60, 0.531, 0.328],
  [78, 0.566, 0.758],
  [47, 0.59, 0.305],
  [37, 0.555, 0.297],
  [82, 0.496, 0.273],
];
function Cap({ shape }: { shape: number }) {
  const ok = useSauceArt("caps");
  const box = ok ? rectStyle("caps", CAP_BOX[shape] ?? CAP_BOX[0]!) : null;
  const [rim, cx, w] = NECK[shape] ?? NECK[0]!;
  if (!box)
    return (
      <span
        aria-hidden
        className="absolute h-[5%] -translate-x-1/2 rounded-sm bg-[#c23a22]"
        style={{
          left: `${cx * 100}%`,
          width: `${w * 130}%`,
          bottom: `${(1 - (rim + 4) / 256) * 100}%`,
        }}
      />
    );
  return (
    <span
      aria-hidden
      className="absolute -translate-x-1/2"
      data-testid="sauce-cap"
      style={{
        left: `${cx * 100}%`,
        width: `${Math.min(100, w * (shape === 2 ? 105 : 130))}%`,
        bottom: `${(1 - (rim + 5) / 256) * 100}%`,
        aspectRatio: String(box.aspect),
        ...box.style,
      }}
    />
  );
}

// ── Gauges ───────────────────────────────────────────────────────────────────

/** The whisk-speed dial: the painted face and needle (turns per second on a 240-degree sweep) with the green zone drawn over it. */
export const DIAL_MAX = 3.6;
const dialDeg = (turns: number) => -120 + Math.min(1, Math.max(0, turns / DIAL_MAX)) * 240;
export function DialGauge({
  omega,
  tool,
  className,
}: {
  omega: number;
  tool: Tool;
  className?: string;
}) {
  const ok = useSauceArt("dial");
  const [lo, hi] = WHISK_ZONE[tool];
  const arc = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(50 + 38 * Math.cos(t)).toFixed(2)} ${(50 + 38 * Math.sin(t)).toFixed(2)}`;
  };
  const a0 = dialDeg(lo);
  const a1 = dialDeg(hi);
  return (
    <div
      className={cn("relative aspect-square", className)}
      data-testid="sauce-dial"
      data-omega={omega.toFixed(2)}
    >
      {ok ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ ...cellStyle("dial", 0, 0), aspectRatio: "1" }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-4 border-[#c9a45a] bg-[#fbf3dc]"
        />
      )}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d={`M ${arc(a0)} A 38 38 0 0 1 ${arc(a1)}`}
          fill="none"
          stroke="#3fa34d"
          strokeWidth="8"
          strokeLinecap="round"
          opacity=".92"
        />
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 transition-transform duration-100"
        style={{
          transform: `rotate(${dialDeg(omega).toFixed(1)}deg)`,
          ...(ok
            ? { ...cellStyle("dial", 1, 0), aspectRatio: "1" }
            : {
                background:
                  "linear-gradient(#d23b2a,#d23b2a) 50% 14% / 4px 36% no-repeat, radial-gradient(circle,#8a6a2a 0 6%,transparent 7%)",
              }),
        }}
      />
    </div>
  );
}

/** The emulsion tube: the painted empty tube, with the full one revealed from the left as the sauce blends (0..1). */
export function EmulsionMeter({ blend, className }: { blend: number; className?: string }) {
  const ok = useSauceArt("emulsion-meter");
  return (
    <div
      className={cn("relative", className)}
      style={{ aspectRatio: "384 / 96" }}
      data-testid="sauce-emulsion"
      data-blend={blend.toFixed(2)}
    >
      {ok ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ ...cellStyle("emulsion-meter", 0, 0), aspectRatio: "384/96" }}
          />
          <span
            aria-hidden
            className="absolute inset-0 transition-[clip-path] duration-100"
            style={{
              ...cellStyle("emulsion-meter", 0, 1),
              aspectRatio: "384/96",
              clipPath: `inset(0 ${(100 - Math.min(1, Math.max(0, blend)) * 100).toFixed(1)}% 0 0)`,
            }}
          />
        </>
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-full border-4 border-[#c9a45a] bg-[#fbf3dc]"
        >
          <span
            className="absolute inset-y-0 left-0 bg-[#f2d98a]"
            style={{ width: `${blend * 100}%` }}
          />
        </span>
      )}
    </div>
  );
}

/** The thickness tube: the painted tube, a green target band and a marker at the sauce's current thickness (0..1, thin at the bottom). */
export function ThicknessGauge({
  thick,
  band,
  className,
}: {
  thick: number;
  band: readonly [number, number];
  className?: string;
}) {
  const ok = useSauceArt("thickness-gauge");
  const y = (v: number) => 12 + (1 - Math.min(1, Math.max(0, v))) * 76;
  return (
    <div
      className={cn("relative", className)}
      style={{ aspectRatio: "128 / 320" }}
      data-testid="sauce-thickness"
      data-thick={thick.toFixed(2)}
    >
      {ok ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${sauceUrl("thickness-gauge")})`,
            backgroundSize: "100% 100%",
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-x-[30%] inset-y-[6%] rounded-full border-4 border-[#c9a45a] bg-[#fbf3dc]"
        />
      )}
      <span
        aria-hidden
        className="absolute left-[18%] w-[10%] rounded-full bg-[#3fa34d]"
        style={{ top: `${y(band[1])}%`, height: `${y(band[0]) - y(band[1])}%` }}
      />
      <span
        aria-hidden
        className="absolute left-[34%] h-[5%] w-[34%] rounded-full border-2 border-[#5b3a22] bg-[#ffd25a] shadow transition-[top] duration-200"
        style={{ top: `${y(thick) - 2.5}%` }}
      />
    </div>
  );
}

/** A round colour sample in the painted paint-chip holder (the ring drawn over the colour). */
export function Swatch({
  color,
  className,
  testId,
}: {
  color: string;
  className?: string;
  testId?: string;
}) {
  const ok = useSauceArt("swatch-holder");
  return (
    <div
      className={cn("relative aspect-square", className)}
      data-testid={testId}
      data-color={color}
    >
      <span
        aria-hidden
        className="absolute inset-[12%] rounded-full transition-colors duration-300"
        style={{
          backgroundColor: color,
          boxShadow: "inset 0 -6px 10px rgba(0,0,0,.18), inset 0 4px 8px rgba(255,255,255,.3)",
        }}
      />
      {ok ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${sauceUrl("swatch-holder")})`,
            backgroundSize: "100% 100%",
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-[6%] rounded-full border-[5px] border-[#c9a45a]"
        />
      )}
    </div>
  );
}

/** The shared keyframes of the screens (swirl, chunk drift, pour wobble); one tag, unique class names. */
/**
 * Where the whisk / spoon is and how it leans (developer 2026-11-11: "the whisk is upside down and whisking is not realistic"). The art is drawn
 * head up, handle down; in use it is turned over: the HANDLE is up in the hand, the wire head (or the spoon's bowl) dips into the sauce. The head
 * tip sits on the fingertip, held inside the bowl's rim (a finger outside the bowl cannot drag the whisk out of it), and the handle leans toward
 * the middle of the bowl like a hand stirring from above: the further the head is from the middle, the more it leans. Pure.
 */
export const TOOL_BOWL = { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.15, hand: 0.95 } as const;
export function toolPose(at: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  tilt: number;
} {
  const { cx, cy, rx, ry, hand } = TOOL_BOWL;
  let ex = (at.x / at.w - cx) / rx;
  let ey = (at.y / at.h - cy) / ry;
  const d = Math.hypot(ex, ey);
  if (d > 1) {
    ex /= d;
    ey /= d;
  }
  const x = (cx + ex * rx) * at.w;
  const y = (cy + ey * ry) * at.h;
  const tilt = (Math.atan2(x - cx * at.w, hand * at.w) * 180) / Math.PI;
  return { x, y, tilt: Math.max(-24, Math.min(24, tilt)) };
}

/** The whisk or spoon over the bowl: in the hand while dragging, standing in the bowl against its right wall otherwise. */
export function ToolInBowl({
  name,
  at,
  stirring,
  reducedMotion,
  hasLiquid,
}: {
  name: "whisk" | "spoon";
  at: { x: number; y: number; w: number; h: number } | null;
  stirring: boolean;
  reducedMotion: boolean;
  hasLiquid: boolean;
}) {
  const art = useSauceArt(name);
  const pose = at ? toolPose(at) : null;
  // The head tip is the top-centre of the picture; turned over, the picture hangs UP from the tip.
  const origin = "50% 4%";
  const style: CSSProperties = pose
    ? {
        left: pose.x,
        top: pose.y,
        transform: `translate(-50%, -4%) rotate(${(180 - pose.tilt).toFixed(1)}deg)`,
        transformOrigin: origin,
        transition: reducedMotion
          ? "none"
          : "transform 60ms linear, left 45ms linear, top 45ms linear",
      }
    : {
        left: `${(TOOL_BOWL.cx + TOOL_BOWL.rx * 0.78) * 100}%`,
        top: `${(TOOL_BOWL.cy + 0.02) * 100}%`,
        transform: "translate(-50%, -4%) rotate(206deg)",
        transformOrigin: origin,
        opacity: 0.97,
      };
  return (
    <>
      {pose && hasLiquid ? (
        <span
          aria-hidden
          data-testid="sauce-ripple"
          className={cn(
            "pointer-events-none absolute z-[9] h-[7%] w-[16%] rounded-[50%] border-2 border-white/55",
            stirring && !reducedMotion && "sauce-ripple",
          )}
          style={{ left: pose.x, top: pose.y + 2, transform: "translate(-50%, -50%)" }}
        />
      ) : null}
      {art ? (
        <img
          src={sauceUrl(name)}
          alt=""
          draggable={false}
          data-testid="sauce-tool"
          data-held={pose ? "1" : "0"}
          data-tilt={pose ? pose.tilt.toFixed(1) : "0"}
          className="pointer-events-none absolute z-10 w-auto select-none"
          style={{ height: "74%", ...style }}
        />
      ) : (
        <span
          aria-hidden
          data-testid="sauce-tool"
          data-held={pose ? "1" : "0"}
          className="pointer-events-none absolute z-10 grid place-items-center text-[44px]"
          style={{
            left: pose ? pose.x : "70%",
            top: pose ? pose.y : "50%",
            transform: "translate(-50%, -100%)",
          }}
        >
          {name === "whisk" ? "🥄" : "🥄"}
        </span>
      )}
    </>
  );
}

export function SauceStyles() {
  return (
    <style>{`
      @keyframes sauce-swirl{to{transform:translate(-50%,-50%) rotate(360deg)}}
      .sauce-swirl{animation:sauce-swirl 1.4s linear infinite}
      @keyframes sauce-chunk{0%,100%{translate:0 0}50%{translate:4px -3px}}
      .sauce-chunk{animation:sauce-chunk 3s ease-in-out infinite}
      @keyframes sauce-ripple{0%{opacity:.8;scale:.6}100%{opacity:0;scale:1.5}}
      .sauce-ripple{animation:sauce-ripple .7s ease-out infinite}
      @keyframes sauce-pop{0%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:1}}
      .sauce-pop{animation:sauce-pop .22s ease-out}
      @keyframes sauce-belt{to{background-position-x:-512px}}
      @keyframes sauce-pour-idle{0%,100%{box-shadow:0 6px 0 #5a3410,0 10px 18px rgba(20,10,4,.45),0 0 0 0 rgba(255,214,140,.0),inset 0 2px 0 rgba(255,255,255,.45)}50%{box-shadow:0 6px 0 #5a3410,0 10px 18px rgba(20,10,4,.45),0 0 18px 4px rgba(255,214,140,.55),inset 0 2px 0 rgba(255,255,255,.45)}}
      .sauce-pour-idle{animation:sauce-pour-idle 1.8s ease-in-out infinite}
      @keyframes sauce-pour-go{0%,100%{scale:1}50%{scale:1.035}}
      .sauce-pour-go{animation:sauce-pour-go .32s ease-in-out infinite}
      @media (prefers-reduced-motion: reduce){.sauce-swirl,.sauce-chunk,.sauce-ripple,.sauce-pour-idle,.sauce-pour-go{animation:none}}
    `}</style>
  );
}
