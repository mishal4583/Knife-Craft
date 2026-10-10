/**
 * The tutorial hand (developer 2026-10-10, "make the hand like" the game
 * gesture icons): a white cartoon glove pointing up, its fingertip at the
 * top centre of the box, tapping with a ripple under the fingertip
 * (`.kc-tap-hand` / `.kc-tap-ripple` in styles.css; still under reduced
 * motion). Inline SVG — no image asset. Decorative (aria-hidden).
 */
export function PointerHand({ size = 46, className }: { size?: number; className?: string }) {
  const h = Math.round((size * 80) / 64);
  return (
    <span
      aria-hidden
      className={`pointer-events-none relative block ${className ?? ""}`}
      style={{ width: size, height: h }}
    >
      {/* The ripple sits under the fingertip (x 30/64, y 6/80 of the glove). */}
      <span
        className="kc-tap-ripple absolute rounded-full border-[3px] border-ivory/90"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          left: (size * 30) / 64 - size * 0.31,
          top: (h * 6) / 80 - size * 0.31,
        }}
      />
      <svg
        className="kc-tap-hand absolute inset-0"
        width={size}
        height={h}
        viewBox="0 0 64 80"
        style={{ filter: "drop-shadow(0 3px 4px rgba(30,20,12,0.45))" }}
      >
        <g stroke="#3a2a1d" strokeWidth="2.2" strokeLinejoin="round">
          {/* thumb */}
          <rect
            x="7"
            y="37"
            width="13"
            height="23"
            rx="6.5"
            transform="rotate(-28 13.5 48.5)"
            fill="#fff"
          />
          {/* palm */}
          <rect x="15" y="35" width="40" height="30" rx="13" fill="#fff" />
          {/* folded fingers */}
          <rect x="35" y="30" width="11" height="17" rx="5.5" fill="#fff" />
          <rect x="44" y="34" width="10" height="16" rx="5" fill="#fff" />
          {/* index finger */}
          <rect x="23.5" y="3" width="13" height="44" rx="6.5" fill="#fff" />
          {/* cuff */}
          <rect x="17" y="60" width="36" height="15" rx="6" fill="#eef2f6" />
        </g>
        {/* soft shading, like the reference glove */}
        <path d="M49 40 q4 10 -2 22" stroke="#cfd8e3" strokeWidth="3" fill="none" />
        <path d="M33 8 v34" stroke="#e3e9f0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="35" cy="67.5" rx="13" ry="3.2" fill="#d5dee8" />
      </svg>
    </span>
  );
}
