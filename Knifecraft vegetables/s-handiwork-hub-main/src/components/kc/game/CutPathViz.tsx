import type { CutPath } from "@/types/game";

function toPolyline(path: CutPath) {
  return path.points.map((p) => `${p.x},${Math.max(10, Math.min(90, p.y))}`).join(" ");
}

/**
 * Renders IDEAL CUT vs YOUR CUT. Both path sets come from the engine —
 * this component draws them, it never derives them.
 */
export function CutPathViz({
  idealPath,
  playerPath,
  size = 96,
}: {
  idealPath: CutPath[];
  playerPath: CutPath[];
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl border border-walnut/20 wood"
      style={{ height: size, width: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {idealPath.map((p, i) => (
          <polyline
            key={`i${i}`}
            points={toPolyline(p)}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.7"
          />
        ))}
        {playerPath.map((p, i) => (
          <polyline
            key={`p${i}`}
            points={toPolyline(p)}
            fill="none"
            stroke="var(--color-sage)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="300"
            style={{ animation: `kc-draw 700ms ${i * 120}ms var(--ease-cozy) both` }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-walnut-dark/55 py-[3px] font-ui text-[8px] font-bold uppercase tracking-wide text-ivory/85">
        <span className="flex items-center gap-1">
          <i className="block h-[2px] w-3 bg-gold" />
          ideal
        </span>
        <span className="flex items-center gap-1">
          <i className="block h-[2px] w-3 bg-sage" />
          yours
        </span>
      </div>
    </div>
  );
}