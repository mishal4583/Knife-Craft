import type { CSSProperties } from "react";
import {
  STEAM_PLUME,
  kitchenAmbientFor,
  steamPlume,
  type AmbientLayout,
} from "@/game/kitchen/kitchenAmbient";
import type { KitchenSkinId } from "@/game/kitchen/kitchenUpgradeTypes";
import "./kitchenAmbient.css";

/**
 * THE KITCHEN'S LIFE (developer 2026-11-26, from his Gemini clip): steam off the pots, warm lamps that breathe, a slow beam of sun with a few dust motes through the arched window, a
 * glint on the copper. Laid over the painted kitchen INSIDE its stage (`KitchenBackground`), at the points of `game/kitchen/kitchenAmbient.ts` (percent of the picture, so they stay on
 * the painting in any window). Only CSS `transform` and `opacity` move, and the steam film steps its picture frame by frame (no filter, no blur, no canvas, no video, no network);
 * Settings → Reduced motion (and the system's) hides it.
 */
const pct = (n: number) => `${n}%`;
/** A painted effect sprite (public/fx, cut from the Codex FX sheets by scripts/make-fx-assets.py). */
const fx = (name: string) => `${import.meta.env.BASE_URL}fx/${name}.webp`;
/** A fixed, repeatable spread (index based): the layer never re-rolls between renders. */
const spread = (i: number, k: number) => ((i * 47 + k * 31) % 100) / 100;

export function KitchenAmbient({ skin, layout }: { skin: KitchenSkinId; layout: AmbientLayout }) {
  const s = kitchenAmbientFor(skin, layout);
  const wide = layout === "wide";
  // sizes in percent of the picture's width (the steam and the burner's light are sized by each pot's own lid)
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
              width: pct(l.r),
              "--ld": `${(2.6 + spread(i, 7) * 2).toFixed(1)}s`,
              "--d": `${(spread(i, 8) * 2.5).toFixed(1)}s`,
            } as CSSProperties
          }
        ></span>
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

      {/* the burner's warm light under each pot */}
      {s.pots.map((p, pi) => (
        <span
          key={`burner-${pi}`}
          className="ka-burner"
          data-testid="ka-burner"
          style={
            {
              left: pct(p.x),
              top: pct(p.base),
              width: pct(p.w * 1.2),
              "--d": `${(pi * 0.8).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* the steam pouring off each lid (developer 2026-11-27, "make it exactly like this"): a looping film of soft billowing steam, its lid line laid on the pot's rim. Two layers show
          a frame and the next one and fade from one into the other, so it moves smoothly */}
      {s.pots.map((p, pi) => {
        const plume = steamPlume(p, pi);
        const film = `url(${import.meta.env.BASE_URL}${STEAM_PLUME.file})`;
        return (
          <span
            key={`steam-${pi}`}
            className="ka-plume"
            data-testid="ka-steam"
            data-pot={pi}
            data-ax={plume.x}
            data-ay={plume.y}
            // (the lid itself, for the browser test that no button covers it)
            data-lid={p.w}
            data-top={p.top}
            data-open={p.open ? "" : undefined}
            style={
              {
                left: pct(plume.x),
                top: pct(plume.y),
                width: pct(plume.width),
                opacity: plume.strength,
                "--tx": pct(-STEAM_PLUME.rimX * 100),
                "--ty": pct(-STEAM_PLUME.rimY * 100),
                "--start": `${-plume.offset}s`,
              } as CSSProperties
            }
          >
            <i className="ka-film" style={{ backgroundImage: film }} />
            <i className="ka-film ka-film-next" style={{ backgroundImage: film }} />
          </span>
        );
      })}

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
