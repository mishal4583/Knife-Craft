import { useRef } from "react";
import tomatoImg from "@/assets/tomato.png";
import { cn } from "@/lib/utils";
import type { Board, CutPath, Ingredient } from "@/types/game";

/**
 * GAME_VIEWPORT — replaceable boundary.
 *
 * Everything inside this component is placeholder presentation only:
 * no physics, no scoring, no game loop. Claude Code can swap the whole
 * body for a <canvas> / Phaser mount without touching any other UI.
 *
 * It emits a raw normalised gesture path (0..100 coordinate space) and
 * nothing else — scoring belongs to the engine.
 */
export function GameViewport({
  ingredient,
  board,
  cutsDone,
  guides,
  interactive,
  showHint,
  onGesture,
}: {
  ingredient: Ingredient;
  board: Board;
  cutsDone: number;
  guides: number[];
  interactive: boolean;
  showHint: boolean;
  onGesture: (path: CutPath) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const path = useRef<{ x: number; y: number }[]>([]);
  const live = useRef<SVGLineElement>(null);

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  function down(e: React.PointerEvent) {
    if (!interactive) return;
    path.current = [local(e)];
  }

  function move(e: React.PointerEvent) {
    if (!interactive || path.current.length === 0) return;
    const p = local(e);
    path.current.push(p);
    const first = path.current[0]!;
    const el = live.current;
    if (el) {
      el.setAttribute("x1", String(first.x));
      el.setAttribute("y1", String(first.y));
      el.setAttribute("x2", String(p.x));
      el.setAttribute("y2", String(p.y));
      el.setAttribute("opacity", "0.95");
    }
  }

  function up() {
    const pts = path.current;
    path.current = [];
    live.current?.setAttribute("opacity", "0");
    if (!interactive || pts.length < 2) return;
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 12) return;
    onGesture({ points: pts });
  }

  return (
    <div
      ref={ref}
      data-game-viewport
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      className="absolute inset-x-0 top-[12%] z-10 h-[74%] touch-none"
      style={{ cursor: interactive ? "crosshair" : "default" }}
    >
      {/* board */}
      <div
        className="absolute left-1/2 top-1/2 h-[74%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[46px] shadow-[0_28px_50px_rgba(62,40,25,0.45)]"
        style={{
          background: `repeating-linear-gradient(94deg, ${board.tone[0]} 0 8px, ${board.tone[1]} 8px 17px, ${board.tone[2]} 17px 21px)`,
        }}
      >
        <div className="absolute inset-[10px] rounded-[38px] border border-ivory/15" />
        <div className="absolute inset-0 rounded-[46px] bg-[radial-gradient(80%_60%_at_25%_10%,rgba(255,247,232,0.24),transparent_60%)]" />
      </div>

      {/* chef guides + registered cuts */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {guides.map((g, i) => {
          const state = i < cutsDone ? "done" : i === cutsDone ? "active" : "idle";
          return (
            <line
              key={g}
              x1={g}
              y1={26}
              x2={g}
              y2={74}
              stroke="var(--color-ivory)"
              strokeWidth={state === "active" ? 0.5 : 0.35}
              strokeLinecap="round"
              strokeDasharray="2 2.4"
              opacity={state === "done" ? 0.08 : state === "active" ? 0.72 : 0.22}
              className={state === "active" ? "anim-shimmer" : undefined}
              style={{ transition: "opacity 600ms ease" }}
            />
          );
        })}
        <line ref={live} stroke="var(--color-ivory)" strokeWidth="0.7" strokeLinecap="round" opacity="0" />
      </svg>

      {/* ingredient */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 w-[50%] -translate-x-1/2 -translate-y-1/2",
          cutsDone === 0 && "anim-breathe",
        )}
      >
        <img
          src={tomatoImg}
          alt={`${ingredient.name} on the cutting board`}
          width={420}
          height={420}
          className="w-full drop-shadow-[0_18px_22px_rgba(62,40,25,0.4)]"
          style={{
            clipPath:
              cutsDone > 0
                ? `inset(0 ${Math.max(0, 60 - cutsDone * 15)}% 0 0 round 50%)`
                : undefined,
            transition: "clip-path 500ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>

      {/* prepared pieces */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-y-1/2 gap-[6px]">
        {Array.from({ length: cutsDone }).map((_, i) => (
          <span
            key={i}
            className="anim-pop block h-[52px] w-[13px] rounded-full border border-[#8e2f1f]/40 shadow-[0_6px_10px_rgba(62,40,25,0.35)]"
            style={{
              background: "radial-gradient(60% 60% at 50% 40%, #ef7a5f, #c9563d 70%, #a83f2c)",
              transform: `translateY(${(i % 2 ? 1 : -1) * 4}px) rotate(${(i % 2 ? 1 : -1) * 5}deg)`,
              animationDelay: `${i * 40}ms`,
            }}
          />
        ))}
      </div>

      {showHint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[4%] flex flex-col items-center gap-1">
          <svg width="86" height="34" viewBox="0 0 86 34" fill="none" aria-hidden>
            <path
              d="M6 26C22 6 60 6 78 24"
              stroke="var(--color-ivory)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 5"
              opacity="0.7"
            />
            <circle cx="78" cy="24" r="5" fill="var(--color-ivory)" opacity="0.85" />
          </svg>
          <span className="font-hand text-[19px] text-ivory/90 drop-shadow-[0_2px_4px_rgba(62,40,25,0.6)]">
            swipe to cut
          </span>
        </div>
      ) : null}
    </div>
  );
}