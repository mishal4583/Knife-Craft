import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { miniGameViews, type MiniGameView } from "@/game/business/miniGames";
import { useUnlockText } from "./navLevel";
import type { ScreenId } from "./data";

/**
 * The Kitchen's Mini-games sheet (developer 2026-11-17): every mini-game as a logo tile, each one open from its own level.
 * A locked tile says which level opens it; an open one says what waits; a game with nothing to play today rests (the rules
 * stay each game's own: `business/miniGames.ts`). Plain art for now (a glyph on a coloured tile).
 */
export function MiniGamesSheet({
  save,
  level,
  go,
  onClose,
}: {
  save: SaveData;
  level: number;
  go: (s: ScreenId) => void;
  onClose: () => void;
}) {
  const u = useUnlockText();
  const views = miniGameViews(save, level);
  const open = views.filter((v) => v.state !== "locked").length;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-walnut-dark/60 backdrop-blur-[2px] land:items-center"
      onClick={onClose}
      data-testid="minigames-backdrop"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Mini-games"
        data-testid="minigames-sheet"
        onClick={(e) => e.stopPropagation()}
        className="anim-up relative flex max-h-[88%] w-full max-w-[560px] flex-col rounded-t-[26px] border border-b-0 border-[#f3d9a9] bg-[linear-gradient(160deg,#fff9e9_0%,#fff0d0_55%,#f6dfb5_100%)] px-4 pb-5 pt-3 shadow-[0_-8px_28px_rgba(34,18,8,0.45)] land:rounded-[26px] land:border-b"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-black leading-none text-[#392013]">
              🎮 Mini-games
            </h2>
            <p
              data-testid="minigames-count"
              className="mt-1 font-hand text-[14px] italic leading-none text-[#795a3a]"
            >
              {open} of {views.length} open
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close mini-games"
            data-testid="minigames-close"
            onClick={onClose}
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#8f4d1e] bg-[linear-gradient(145deg,#a85d25,#754018)] font-ui text-[18px] font-black text-[#fff5df] shadow-[0_2px_6px_rgba(83,41,13,0.32)]"
          >
            ✕
          </button>
        </div>

        <ul className="mt-3 grid min-h-0 grid-cols-2 gap-2.5 overflow-y-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {views.map((v) => (
            <li key={v.entry.id} className="min-w-0">
              <Tile
                view={v}
                opensText={u.when(v.entry.firstLevel)}
                onPlay={() => {
                  onClose();
                  go(v.entry.screen);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({
  view,
  opensText,
  onPlay,
}: {
  view: MiniGameView;
  opensText: string;
  onPlay: () => void;
}) {
  const { entry, state, text } = view;
  const locked = state === "locked";
  const ready = state === "ready";
  return (
    <button
      type="button"
      data-testid={`minigame-${entry.id}`}
      data-state={state}
      aria-disabled={!ready || undefined}
      aria-label={
        locked ? `${entry.name}, locked, opens ${opensText}` : `${entry.name}, ${text ?? ""}`
      }
      onClick={ready ? onPlay : undefined}
      className={cn(
        "flex min-h-[112px] w-full flex-col items-center gap-1.5 rounded-[18px] border-2 px-2 py-2.5 text-center shadow-soft transition-transform",
        ready
          ? "press border-[#b8873f] bg-[linear-gradient(170deg,#fffaf0,#f6e2b6)] text-walnut-dark"
          : "cursor-default border-walnut/20 bg-ivory/60 text-walnut/70",
      )}
    >
      <span
        aria-hidden
        style={{
          background: locked
            ? "linear-gradient(145deg,#d9d2c5,#b5ab99)"
            : `linear-gradient(145deg,${entry.tint[0]},${entry.tint[1]})`,
        }}
        className={cn(
          "relative grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-white/70 text-[30px] leading-none shadow-[0_3px_0_rgba(111,66,28,0.35),inset_0_2px_0_rgba(255,255,255,0.7)]",
          locked && "grayscale",
          state === "resting" && "opacity-70",
        )}
      >
        {entry.glyph}
        {locked ? (
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-white/80 bg-walnut-dark text-[12px] leading-none">
            🔒
          </span>
        ) : null}
      </span>
      <span className="block font-display text-[14px] font-black leading-tight">{entry.name}</span>
      {locked ? (
        <span className="block font-hand text-[14px] font-bold italic leading-tight text-walnut/70">
          opens {opensText}
        </span>
      ) : (
        <span
          className={cn(
            "block font-ui text-[12px] font-extrabold leading-tight",
            ready ? "text-[#4d7a35]" : "text-walnut/60",
          )}
        >
          {text}
        </span>
      )}
    </button>
  );
}
