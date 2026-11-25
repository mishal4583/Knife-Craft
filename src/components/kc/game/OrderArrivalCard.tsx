import type { CSSProperties, ReactNode } from "react";
import "./orderCard.css";

/**
 * THE STARTING CARD (developer 2026-11-21, from his mock-up): the card a customer's order opens on, over the dining room. A dark wooden banner with a chef's hat and leaves carries
 * "MATEO'S ORDER"; the card is cream with a gold frame and corner flourishes; the dish's name, the customer's line, the dish itself on a checkered cloth, a big orange "Start cooking"
 * between two gold laurels, and (with a hired Prep Cook) the green "Prep Cook cuts it" and the "Auto" switch.
 *
 * The dish picture is the dish's own painting when there is one (`game/dishArt.ts`, Codex), otherwise the dish's painted icon on a plate: the card is complete without any dish art.
 * Everything is sized in `em` from the card's own font size (`--oc`), so the whole card scales as one. `compact` (an upright phone, where the card shares the screen with the dining
 * room) leaves out the plate and the cloth.
 */
export type OrderCardProps = {
  /** "walking": the customer has not sat yet. */
  state: "walking" | "seated";
  /** The customer's name; for a party the banner reads "A party of 3" until they sit. */
  customerName: string;
  partySize: number;
  takeaway: boolean;
  dish: { id?: string | undefined; emoji: string; name: string };
  line: string;
  onStart: () => void;
  prepCook?: { auto: boolean; onCut: () => void; onAuto: () => void } | undefined;
  /** An upright phone: no plate and no cloth. */
  compact?: boolean;
  /** The font size of the card (the screen sets it from its own size). */
  size: string;
  /** A named regular's portrait (`CustomerBust`), shown on the banner's left edge once they are seated; without one nothing is drawn. */
  bust?: ReactNode;
  /** The regular guest (restaurant/regularGuest.ts): a lone guest's banner says so. */
  regular?: boolean;
};

export function Hat() {
  return (
    <svg className="oc-hat" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <path
        d="M22 52c-14-2-20-16-12-26 7-9 19-9 26-3 3-12 15-19 27-17 11 2 19 9 21 19 11-4 23 3 24 14 1 9-6 16-15 17v18H28V52Z"
        fill="#fffdf6"
        stroke="#d9cdb4"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M30 56h62" stroke="#e5dcc6" strokeWidth="2" fill="none" />
      <path
        d="M30 70h62v8c0 2-2 4-4 4H34c-2 0-4-2-4-4v-8Z"
        fill="#f4ecd8"
        stroke="#d9cdb4"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Sprig({
  flip,
  className = "",
  style,
}: {
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`oc-sprig ${className}`}
      viewBox="0 0 90 40"
      aria-hidden="true"
      focusable="false"
      style={{ ...(flip ? { transform: "scaleX(-1)" } : {}), ...style }}
    >
      <path
        d="M2 24C26 24 52 16 86 4"
        stroke="#4d7f2e"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {[
        [14, 24, -30],
        [28, 21, -34],
        [42, 17, -38],
        [58, 13, -42],
        [72, 9, -46],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path
            d="M0 0c4-9 14-10 20-6-3 8-12 12-20 6Z"
            fill="#7fb23f"
            stroke="#4d7f2e"
            strokeWidth="1.2"
          />
          <path
            d="M0 8c4 8 14 9 20 5-3-7-12-11-20-5Z"
            fill="#6aa133"
            stroke="#4d7f2e"
            strokeWidth="1.2"
          />
        </g>
      ))}
    </svg>
  );
}

export function Laurel({ flip }: { flip?: boolean }) {
  return (
    <svg
      className="oc-laurel"
      viewBox="0 0 60 80"
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M44 74C26 62 16 42 20 8"
        stroke="#c9942c"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {[
        [38, 66, 70],
        [27, 54, 55],
        [21, 41, 42],
        [20, 28, 30],
        [23, 15, 16],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <path
            d={`M${x} ${y} c-9-2-16 4-17 12 8 1 15-3 17-12Z`}
            fill="#f2c85a"
            stroke="#c9942c"
            strokeWidth="1.2"
            transform={`rotate(${(r as number) - 60} ${x} ${y})`}
          />
          <path
            d={`M${(x as number) + 5} ${(y as number) - 4} c8-4 15 0 17 8-8 2-15-1-17-8Z`}
            fill="#f7d878"
            stroke="#c9942c"
            strokeWidth="1.2"
            transform={`rotate(${(r as number) - 60} ${x} ${y})`}
          />
        </g>
      ))}
    </svg>
  );
}

export function Corner({ className }: { className: string }) {
  return (
    <svg
      className={`oc-corner ${className}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 37V16C3 8 8 3 16 3h21"
        stroke="#e0ac50"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M9 31V19c0-6 4-10 10-10h12"
        stroke="#ecc878"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M13 13c4 0 6 2 6 6-4 0-6-2-6-6Z" fill="#e8bd66" />
    </svg>
  );
}

export function OrderArrivalCard({
  state,
  customerName,
  partySize,
  takeaway,
  dish,
  line,
  onStart,
  prepCook,
  compact = false,
  size,
  bust,
  regular = false,
}: OrderCardProps) {
  const heading =
    state === "walking"
      ? takeaway
        ? "A takeaway customer"
        : partySize > 1
          ? `A party of ${partySize}`
          : "A customer"
      : takeaway
        ? `${customerName}'s order · to go`
        : `${customerName}'s order${partySize > 1 ? ` · table of ${partySize}` : regular ? " · ⭐ regular" : ""}`;
  return (
    <div
      className={`oc${compact ? " oc--compact" : ""}`}
      data-testid="order-card"
      style={{ "--oc": size } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="oc-banner">
        {bust && state === "seated" ? (
          <span className="oc-bust" data-testid="order-card-bust">
            {bust}
          </span>
        ) : null}
        <Hat />
        <Sprig />
        <Sprig flip />
        <p className="oc-banner-text" data-testid="order-card-heading">
          <span aria-hidden="true">◆</span> {heading} <span aria-hidden="true">◆</span>
        </p>
      </div>
      <div className="oc-card">
        <Corner className="oc-corner--tl" />
        <Corner className="oc-corner--tr" />
        <Corner className="oc-corner--bl" />
        <Corner className="oc-corner--br" />
        <div className="oc-dishrow">
          <span className="oc-ico">{dish.emoji}</span>
          <h2 className="oc-name" data-testid="order-card-dish">
            {dish.name}
          </h2>
        </div>
        <p className="oc-line">“{line}”</p>
        <div className="oc-divider" aria-hidden="true">
          <i />
          <b />
          <i />
        </div>
        <div className="oc-startrow">
          <Laurel />
          <button
            type="button"
            className="oc-start"
            data-testid="order-card-start"
            onClick={onStart}
          >
            <span className="oc-start-ico">🍲</span> Start cooking
          </button>
          <Laurel flip />
        </div>
        {prepCook ? (
          <div className="oc-row2">
            <button type="button" className="oc-prep" onClick={prepCook.onCut}>
              <span className="oc-btn-ico">👨‍🍳</span> Prep Cook cuts it
            </button>
            <button
              type="button"
              className={`oc-auto${prepCook.auto ? " is-on" : ""}`}
              onClick={prepCook.onAuto}
            >
              {prepCook.auto ? "Auto: on" : "Auto: off"} <span className="oc-btn-ico">⚙</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
