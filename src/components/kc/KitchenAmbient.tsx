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
/** A painted effect sprite (public/fx, cut from the Codex FX sheets by scripts/make-fx-assets.py). */
const fx = (name: string) => `${import.meta.env.BASE_URL}fx/${name}.webp`;
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

      {/* lamps: the painted amber glow, breathing */}
      {s.lamps.map((l, i) => (
        <span
          key={`lamp-${i}`}
          className="ka-lamp"
          data-testid="ka-lamp"
          style={
            {
              left: pct(l.x),
              top: pct(l.y),
              width: pct(l.r * 0.95),
              "--ld": `${(2.6 + spread(i, 7) * 2).toFixed(1)}s`,
              "--d": `${(spread(i, 8) * 2.5).toFixed(1)}s`,
            } as CSSProperties
          }
        >
          <img src={fx("glow-1")} alt="" draggable={false} decoding="async" />
        </span>
      ))}

      {/* petals and leaves drifting past the window (the garden outside) */}
      {Array.from({ length: wide ? 6 : 5 }, (_, i) => (
        <img
          key={`petal-${i}`}
          className="ka-petal"
          data-testid="ka-petal"
          src={fx(i % 3 === 2 ? `leaf-${(i % 2) + 1}` : `petal-${(i % 6) + 1}`)}
          alt=""
          draggable={false}
          decoding="async"
          style={
            {
              left: pct(w.x + w.w * (0.1 + spread(i, 10) * 0.7)),
              top: pct(w.y + w.h * (0.02 + spread(i, 11) * 0.3)),
              width: pct(wide ? 1.5 : 3.6),
              "--d": `${(spread(i, 12) * 9).toFixed(1)}s`,
              "--pd": `${(9 + spread(i, 13) * 6).toFixed(1)}s`,
              "--px": `${Math.round(120 + spread(i, 14) * 260)}%`,
              "--py": `${Math.round(380 + spread(i, 15) * 420)}%`,
              "--pr": `${Math.round(180 + spread(i, 16) * 360)}deg`,
            } as CSSProperties
          }
        />
      ))}

      {/* the burner's painted flame (four frames of a loop, shown one after another by opacity) peeking out around the base of each pot */}
      {s.pots.map((p, pi) => (
        <span
          key={`flame-${pi}`}
          className="ka-flame"
          data-testid="ka-flame"
          style={
            {
              left: pct(p.x),
              top: pct(p.y + (wide ? 4.6 : 6.2)),
              width: pct(steamW * 1.45),
            } as CSSProperties
          }
        >
          {[1, 2, 4, 5].map((f, fi) => (
            <img
              key={f}
              src={fx(`flame-burner-${f}`)}
              alt=""
              draggable={false}
              decoding="async"
              style={{ "--fi": fi } as CSSProperties}
            />
          ))}
        </span>
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

      {/* the copper catches the light: a painted star glint */}
      {s.glints.map((g, i) => (
        <span
          key={`glint-${i}`}
          className="ka-glint"
          data-testid="ka-glint"
          style={
            {
              left: pct(g.x),
              top: pct(g.y),
              width: pct(glintW * 1.7),
              "--d": `${(i * 1.7 + spread(i, 9) * 1.2).toFixed(2)}s`,
            } as CSSProperties
          }
        >
          <img src={fx(i % 2 ? "glint-2" : "glint-1")} alt="" draggable={false} decoding="async" />
        </span>
      ))}
    </div>
  );
}
