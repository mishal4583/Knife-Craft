import type { BoardDefinition } from "@/game/boards/boardTypes";

/**
 * Phase 15 — the old standalone Boards screen (buy + equip in one place)
 * is gone; its purchase half moved into Shop.tsx, its equip half into
 * Rack.tsx, both reusing BoardManager exactly as this file always did.
 * BoardPreview stays here and is imported by both — it's genuinely
 * reusable visual code, not a screen.
 */

/** A small CSS thumbnail of the board's tone/pattern/accent — the real material identity lives in the actual gameplay board (textures/boardTexture.ts); this is just a legible card preview, not a second rendering system. */
export function BoardPreview({ board, size = 92 }: { board: BoardDefinition; size?: number }) {
  const [a, b, c] = board.visual.tone;
  const { pattern, accent } = board.visual;
  return (
    <div
      className="relative overflow-hidden rounded-[16px] shadow-soft"
      style={{
        width: size,
        height: size * 0.78,
        background: `linear-gradient(150deg, ${a}, ${b} 55%, ${c})`,
        border: accent ? `2px solid ${accent}` : undefined,
      }}
      aria-hidden
    >
      {pattern === "marble" ? (
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage: `repeating-linear-gradient(35deg, rgba(120,110,100,0.16) 0 2px, transparent 2px 22px)`,
          }}
        />
      ) : (
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: `repeating-linear-gradient(92deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 7px)`,
          }}
        />
      )}
      {pattern === "herb" && accent ? (
        <div
          className="absolute inset-x-0 top-0 h-[18%]"
          style={{ background: `linear-gradient(${accent}88, transparent)` }}
        />
      ) : null}
      <div className="absolute inset-[6px] rounded-[11px] border border-white/20" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_15%,rgba(255,255,255,0.32),transparent_65%)]" />
      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black/25" />
    </div>
  );
}
