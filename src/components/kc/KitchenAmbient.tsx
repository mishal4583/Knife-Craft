import type { CSSProperties } from "react";
import {
  KITCHEN_STEAM_SPRITES,
  kitchenAmbientFor,
  type AmbientLayout,
} from "@/game/kitchen/kitchenAmbient";
import type { KitchenSkinId } from "@/game/kitchen/kitchenUpgradeTypes";
import "./kitchenAmbient.css";

/**
 * THE KITCHEN'S LIFE (developer 2026-11-26, from his Gemini clip): steam off the pots, warm lamps that breathe, a slow beam of sun with a few dust motes through the arched window, a
 * glint on the copper. Laid over the painted kitchen INSIDE its stage (`KitchenBackground`), at the points of `game/kitchen/kitchenAmbient.ts` (percent of the picture, so they stay on
 * the painting in any window). Only CSS `transform` and `opacity` move (no filter, no blur, no canvas, no picture, no network); Settings → Reduced motion (and the system's) hides it.
 */
const pct = (n: number) => `${n}%`;
/** A fixed, repeatable spread (index based): the layer never re-rolls between renders. */
const spread = (i: number, k: number) => ((i * 47 + k * 31) % 100) / 100;

export function KitchenAmbient({ skin, layout }: { skin: KitchenSkinId; layout: AmbientLayout }) {
  const s = kitchenAmbientFor(skin, layout);
  const wide = layout === "wide";
  // sizes in percent of the picture's width: the wide painting shows a pot about 5 % wide, the tall one about 11 %
  const steamW = wide ? 6.4 : 14;
  const glintW = wide ? 1.7 : 4.2;
  const moteW = wide ? 0.32 : 0.8;
  const w = s.window;
  return (
    <div
      className="kitchen-ambient"
      aria-hidden="true"
      data-testid="kitchen-ambient"
      data-skin={skin}
      data-layout={layout}
    >
      {/* the sun through the arched window, and the dust it lights */}
      <div
        className="ka-beam"
        data-testid="ka-beam"
        style={{
          left: pct(w.x),
          top: pct(w.y),
          width: pct(w.w * 2.7),
          height: pct(w.h * 1.45),
        }}
      />
      {Array.from({ length: wide ? 7 : 6 }, (_, i) => (
        <span
          key={`mote-${i}`}
          className="ka-mote"
          style={
            {
              left: pct(w.x + w.w * (0.15 + spread(i, 1) * 1.6)),
              top: pct(w.y + w.h * (0.15 + spread(i, 2) * 0.9)),
              width: pct(moteW),
              "--d": `${(spread(i, 3) * 13).toFixed(1)}s`,
              "--md": `${(12 + spread(i, 4) * 8).toFixed(1)}s`,
              "--mx": `${Math.round(500 + spread(i, 5) * 900)}%`,
              "--my": `${Math.round(300 + spread(i, 6) * 700)}%`,
            } as CSSProperties
          }
        />
      ))}

      {/* lamps */}
      {s.lamps.map((l, i) => (
        <span
          key={`lamp-${i}`}
          className="ka-lamp"
          data-testid="ka-lamp"
          style={
            {
              left: pct(l.x),
              top: pct(l.y),
              width: pct(l.r),
              "--ld": `${(3 + spread(i, 7) * 2.4).toFixed(1)}s`,
              "--d": `${(spread(i, 8) * 2.5).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* the burner's warm light under each pot, and a low haze at its rim */}
      {s.pots.map((p, pi) => (
        <span
          key={`burner-${pi}`}
          className="ka-burner"
          data-testid="ka-burner"
          style={
            {
              left: pct(p.x),
              top: pct(p.y + (wide ? 2.4 : 3.4)),
              width: pct(steamW * 1.5),
              "--d": `${(pi * 0.8).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}
      {s.pots.map((p, pi) => (
        <span
          key={`haze-${pi}`}
          className="ka-haze"
          style={
            {
              left: pct(p.x),
              top: pct(p.y),
              width: pct(steamW * 1.7),
              "--d": `${(pi * 1.3).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* steam: four plumes per pot, each rising and drifting while a second layer inside it sways and widens, so it curls like smoke instead of puffing like a ball */}
      {s.pots.flatMap((p, pi) =>
        [0, 1, 2, 3].map((k) => (
          <span
            key={`steam-${pi}-${k}`}
            className="ka-steam"
            data-sprite={KITCHEN_STEAM_SPRITES > 0 ? "1" : undefined}
            data-testid="ka-steam"
            style={
              {
                left: pct(p.x + (k % 2 ? 0.4 : -0.4) * (wide ? 0.6 : 1.4)),
                top: pct(p.y),
                width: pct(steamW * (0.78 + (k % 3) * 0.14)),
                "--d": `${(k * 1.9 + pi * 1.1).toFixed(2)}s`,
                "--dx": ["-9%", "13%", "-14%", "9%"][k],
                "--dx2": ["14%", "-12%", "12%", "-15%"][k],
                "--sw": `${(2.8 + k * 0.7).toFixed(1)}s`,
                "--sd": `${(-k * 0.9).toFixed(1)}s`,
                "--tilt":
                  KITCHEN_STEAM_SPRITES > 0
                    ? k % 2
                      ? "4deg"
                      : "-4deg"
                    : k % 2
                      ? "12deg"
                      : "-12deg",
              } as CSSProperties
            }
          >
            {KITCHEN_STEAM_SPRITES > 0 ? (
              <img
                className="ka-steam-img"
                src={`${import.meta.env.BASE_URL}kitchen-fx/steam-${((k + pi) % KITCHEN_STEAM_SPRITES) + 1}.webp`}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
              />
            ) : (
              <i className="ka-steam-body" />
            )}
          </span>
        )),
      )}

      {/* the copper catches the light */}
      {s.glints.map((g, i) => (
        <span
          key={`glint-${i}`}
          className="ka-glint"
          data-testid="ka-glint"
          style={
            {
              left: pct(g.x),
              top: pct(g.y),
              width: pct(glintW),
              "--d": `${(i * 2.1 + spread(i, 9) * 1.5).toFixed(2)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
