import type { CSSProperties } from "react";
import "./celebrationFx.css";

/**
 * The celebration card's confetti and starburst (developer 2026-11-26, painted FX-5 pieces `public/fx/burst-*` and `confetti-*`): a soft starburst opens behind the emblem and 16 pieces
 * fall once through the card. Decoration only: aria-hidden, no pointer events, transform and opacity only, hidden by Reduced motion.
 */
const base = import.meta.env.BASE_URL;
const PIECES = 16;
/** A fixed, repeatable spread (the card never re-rolls between renders). */
const spread = (i: number, k: number) => ((i * 53 + k * 29) % 100) / 100;

export function CelebrationFx() {
  return (
    <div className="cfx" aria-hidden="true" data-testid="celebration-fx">
      <img className="cfx-burst" src={`${base}fx/burst-4.webp`} alt="" draggable={false} />
      {Array.from({ length: PIECES }, (_, i) => (
        <img
          key={i}
          className="cfx-piece"
          src={`${base}fx/confetti-${(i % 8) + 1}.webp`}
          alt=""
          draggable={false}
          style={
            {
              left: `${Math.round(4 + spread(i, 1) * 88)}%`,
              width: `${Math.round(20 + spread(i, 2) * 14)}px`,
              "--d": `${(spread(i, 3) * 0.9).toFixed(2)}s`,
              "--t": `${(2.4 + spread(i, 4) * 1.4).toFixed(2)}s`,
              "--x": `${Math.round((spread(i, 5) - 0.5) * 70)}px`,
              "--r": `${Math.round((spread(i, 6) - 0.5) * 900)}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
