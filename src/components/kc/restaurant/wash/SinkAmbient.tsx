import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BASIN, TAP, HOSE } from "@/game/restaurant/sinkQueue";
import { useWashArt, washUrl } from "./washArt";

/**
 * The sink's living water (developer 2026-11-09: "increase the effect of washing the dishes"): the water sheet and its drifting ripples, the suds
 * piled at the basin's edges and the suds that GROW as a piece is scrubbed (and drain as it is rinsed), the running tap, the pre-rinse hose in the
 * rinse phase, soft steam, bubbles and a mist at the screen's edges. Every layer uses the painted art when its file exists (public/dishwashing/,
 * scripts/make-wash-assets.py) and a CSS stand-in otherwise, so the sink looks right with any part of the art. Presentation only: it reads the phase
 * and the progress the game already has. Reduced Motion: no drifting, no steam, no bubbles, a still tap and spray.
 * Everything is `pointer-events-none`; at most 3 steam wisps and 5 bubbles exist at once.
 */

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const poly = BASIN.polygon
  .map(
    ([x, y]) =>
      `${(((x - BASIN.box.x) / BASIN.box.w) * 100).toFixed(2)}% ${(((y - BASIN.box.y) / BASIN.box.h) * 100).toFixed(2)}%`,
  )
  .join(", ");

/** Five ambient bubbles at fixed places (no randomness): x, y as shares of the basin box, size in px, delay in s. */
const BUBBLES = [
  { x: 0.12, y: 0.62, s: 26, d: 0 },
  { x: 0.31, y: 0.3, s: 18, d: 1.7 },
  { x: 0.68, y: 0.5, s: 30, d: 3.1 },
  { x: 0.85, y: 0.72, s: 20, d: 0.9 },
  { x: 0.52, y: 0.8, s: 16, d: 2.4 },
] as const;
const STEAM = [
  { x: 0.18, d: 0 },
  { x: 0.5, d: 2.7 },
  { x: 0.78, d: 5.2 },
] as const;

export function SinkAmbient({
  phase,
  progress,
  reduced,
  active,
}: {
  phase: "scrub" | "rinse" | "shine" | "leaving";
  /** The current piece's progress, 0-100 (scrubbing: it grows the suds; rinsing: it drains them). */
  progress: number;
  reduced: boolean;
  /** A piece is in the sink (the suds and the tap only matter then; the empty sink is calm). */
  active: boolean;
}) {
  const water = useWashArt("water");
  const ripples = useWashArt("ripples");
  const rim = useWashArt("foam-rim");
  const foam1 = useWashArt("foam-1");
  const foam2 = useWashArt("foam-2");
  const foam3 = useWashArt("foam-3");
  const tap = useWashArt("tap-stream");
  const spray = useWashArt("rinse-spray");
  const steam = useWashArt("steam");
  const bubbles = useWashArt("bubbles");
  const mist = useWashArt("mist");

  // The suds level: grows while scrubbing, drains while rinsing, full at the shine.
  const suds =
    phase === "rinse"
      ? Math.max(0, 1 - progress / 100)
      : phase === "scrub"
        ? Math.min(1, progress / 100)
        : phase === "shine"
          ? 0
          : 0;
  const levelOpacity = (lo: number, hi: number) =>
    Math.min(1, Math.max(0, (suds - lo) / (hi - lo)));
  const rinsing = phase === "rinse" && active;

  // The rinse spray cycles its six frames (3 x 2 sheet) while the water runs.
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!rinsing || reduced) return;
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 6), 85);
    return () => window.clearInterval(t);
  }, [rinsing, reduced]);

  const basinBox: CSSProperties = {
    left: pct(BASIN.box.x / 540),
    top: pct(BASIN.box.y / 960),
    width: pct(BASIN.box.w / 540),
    height: pct(BASIN.box.h / 960),
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5]"
      aria-hidden
      data-testid="wash-up-ambient"
    >
      {/* the basin: water, ripples, suds, steam and bubbles, cut to the basin's own outline */}
      <div className="absolute" style={{ ...basinBox, clipPath: `polygon(${poly})` }}>
        {water ? (
          <img
            src={washUrl("water")}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-fill opacity-70"
            style={{ transform: "scale(1.22)" }}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(130,200,220,0.16),rgba(80,150,175,0.30))]" />
        )}
        <div
          className={cn("absolute inset-0 opacity-30", !reduced && "wash-drift")}
          style={
            ripples
              ? {
                  backgroundImage: `url(${washUrl("ripples")})`,
                  backgroundSize: "256px 256px",
                  mixBlendMode: "screen",
                }
              : {
                  backgroundImage:
                    "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.0) 0 14px, rgba(255,255,255,0.18) 15px 17px), repeating-radial-gradient(circle at 70% 65%, rgba(255,255,255,0) 0 18px, rgba(255,255,255,0.14) 19px 21px)",
                }
          }
        />
        {/* suds piled along the edges (always a little), and growing over the water as the piece is scrubbed */}
        {rim ? (
          <img
            src={washUrl("foam-rim")}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-fill"
            style={{ opacity: 0.35 + 0.65 * Math.max(suds, active ? 0.2 : 0) }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.4 + 0.6 * suds,
              backgroundImage:
                "radial-gradient(ellipse 22% 36% at 4% 50%, #fffaf0 0 50%, transparent 72%), radial-gradient(ellipse 22% 36% at 96% 50%, #fffaf0 0 50%, transparent 72%), radial-gradient(ellipse 46% 26% at 50% 4%, #fffaf0 0 46%, transparent 70%), radial-gradient(ellipse 40% 22% at 50% 98%, #fffaf0 0 40%, transparent 68%)",
            }}
          />
        )}
        {(
          [
            [
              foam1,
              "foam-1",
              0,
              0.34,
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,.7) 0 6px, transparent 7px), radial-gradient(circle at 60% 70%, rgba(255,255,255,.6) 0 8px, transparent 9px)",
            ],
            [
              foam2,
              "foam-2",
              0.3,
              0.7,
              "radial-gradient(circle at 35% 45%, rgba(255,255,255,.8) 0 10px, transparent 11px), radial-gradient(circle at 75% 25%, rgba(255,255,255,.7) 0 12px, transparent 13px), radial-gradient(circle at 15% 80%, rgba(255,255,255,.7) 0 9px, transparent 10px)",
            ],
            [
              foam3,
              "foam-3",
              0.65,
              1,
              "radial-gradient(circle at 25% 35%, rgba(255,255,255,.9) 0 16px, transparent 17px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.9) 0 18px, transparent 19px), radial-gradient(circle at 45% 85%, rgba(255,255,255,.85) 0 14px, transparent 15px)",
            ],
          ] as const
        ).map(([art, name, lo, hi, css]) => (
          <div
            key={name}
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: active ? levelOpacity(lo, hi) * 0.85 : 0,
              backgroundImage: art ? `url(${washUrl(name)})` : css,
              backgroundSize: art ? "256px 256px" : "120px 90px",
            }}
          />
        ))}
        {/* steam: three soft wisps rising, staggered */}
        {!reduced
          ? STEAM.map((w) => (
              <span
                key={w.x}
                className="wash-steam absolute bottom-[10%]"
                style={{
                  left: pct(w.x),
                  width: steam ? 60 : 46,
                  height: steam ? 90 : 70,
                  animationDelay: `${w.d}s`,
                  ...(steam
                    ? {
                        backgroundImage: `url(${washUrl("steam")})`,
                        backgroundSize: "300% 100%",
                        backgroundPosition: `${(STEAM.indexOf(w) / 2) * 100}% 0`,
                      }
                    : {
                        background:
                          "radial-gradient(ellipse at 50% 70%, rgba(255,255,255,0.45), transparent 70%)",
                        filter: "blur(5px)",
                      }),
                }}
              />
            ))
          : null}
        {/* a few bubbles that drift up and wobble */}
        {!reduced
          ? BUBBLES.map((b, i) => (
              <span
                key={i}
                className="wash-bubble absolute"
                style={{
                  left: pct(b.x),
                  top: pct(b.y),
                  width: b.s,
                  height: b.s,
                  animationDelay: `${b.d}s`,
                  ...(bubbles
                    ? {
                        backgroundImage: `url(${washUrl("bubbles")})`,
                        backgroundSize: "400% 300%",
                        backgroundPosition: `${((i % 4) / 3) * 100}% 0`,
                      }
                    : {
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.95) 0 10%, rgba(255,255,255,0.18) 28%, rgba(180,225,240,0.22) 62%, rgba(255,255,255,0.5) 66%, transparent 70%)",
                      }),
                }}
              />
            ))
          : null}
      </div>

      {/* the running tap: a thin stream from the spout, stronger in the rinse */}
      {active ? (
        <span
          className={cn("absolute", !reduced && tap && "wash-tap")}
          style={{
            left: pct((TAP.x - TAP.w / 2) / 540),
            top: pct(TAP.y / 960),
            width: pct(TAP.w / 540),
            height: pct(TAP.h / 960),
            opacity: rinsing ? 0.95 : 0.55,
            ...(tap
              ? {
                  backgroundImage: `url(${washUrl("tap-stream")})`,
                  backgroundSize: "600% 100%",
                  backgroundRepeat: "no-repeat",
                }
              : {
                  width: pct(8 / 540),
                  left: pct((TAP.x - 4) / 540),
                  background:
                    "linear-gradient(90deg, transparent, rgba(200,235,250,0.8), transparent)",
                  borderRadius: 6,
                }),
          }}
        />
      ) : null}

      {/* the pre-rinse hose: a fan of water over the dish while it is rinsed */}
      {rinsing ? (
        <span
          className="absolute"
          style={{
            left: pct((HOSE.x - HOSE.w / 2) / 540),
            top: pct(HOSE.y / 960),
            width: pct(HOSE.w / 540),
            height: pct(HOSE.h / 960),
            ...(spray
              ? {
                  backgroundImage: `url(${washUrl("rinse-spray")})`,
                  backgroundSize: "300% 200%",
                  backgroundPosition: `${((frame % 3) / 2) * 100}% ${Math.floor(frame / 3) * 100}%`,
                  backgroundRepeat: "no-repeat",
                }
              : {
                  background:
                    "repeating-linear-gradient(105deg, rgba(190,230,250,0.0) 0 10px, rgba(190,230,250,0.45) 11px 13px)",
                  maskImage: "linear-gradient(180deg, #000, transparent)",
                  WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
                }),
          }}
        />
      ) : null}

      {/* a soft steam mist at the edges of the screen */}
      {mist ? (
        <img
          src={washUrl("mist")}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-fill opacity-50"
        />
      ) : null}

      <style>{`
        @keyframes wash-drift { from { background-position: 0 0; } to { background-position: 256px 128px; } }
        @keyframes wash-steam-up { 0% { transform: translateY(0) scale(.8); opacity: 0; } 20% { opacity: .75; } 100% { transform: translateY(-130px) scale(1.25); opacity: 0; } }
        @keyframes wash-bubble-bob { 0%,100% { transform: translate(0,0); } 50% { transform: translate(5px,-9px); } }
        @keyframes wash-tap-frames { from { background-position: 0 0; } to { background-position: 100% 0; } }
        .wash-drift { animation: wash-drift 14s linear infinite; }
        .wash-steam { animation: wash-steam-up 8s ease-out infinite; }
        .wash-bubble { animation: wash-bubble-bob 4.5s ease-in-out infinite; }
        .wash-tap { animation: wash-tap-frames .5s steps(6) infinite; }
      `}</style>
    </div>
  );
}
