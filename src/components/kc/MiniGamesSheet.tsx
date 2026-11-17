import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { miniGameViews, type MiniGameView } from "@/game/business/miniGames";
import { useUnlockText } from "./navLevel";
import type { ScreenId } from "./data";
import { frameStyle, mgUrl, useMiniGameArt } from "./minigamesArt";

/**
 * The Kitchen's Mini-games sheet (developer 2026-11-17: every mini-game as a logo tile, each one open from its own level). A locked tile says which
 * level opens it; an open one says what waits; a game with nothing to play today rests (the rules stay each game's own: `business/miniGames.ts`).
 *
 * Painted (developer 2026-11-18, plan docs/planning/MINIGAMES-SHEET-ART-PLAN-AND-CODEX-PROMPTS-2026-11-18.md): a painted icon per game that rises a
 * little above its card, three painted card plates (ready / resting / locked), the painted sheet panel, title ribbon, close button, status pills, a
 * lock badge and, for a game with something really waiting, a gold glow and a star. Every word and number is still drawn by the code. Each piece
 * falls back to the earlier plain look until its file is there (`minigamesArt.ts`).
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
  const has = useMiniGameArt();
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

  const panel = has("sheet-panel");
  const ribbon = has("title-ribbon");
  const closeArt = has("close-button");

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
        data-art={panel ? "1" : "0"}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "anim-up relative flex max-h-[88%] w-full max-w-[560px] flex-col rounded-t-[26px] px-4 pb-5 shadow-[0_-8px_28px_rgba(34,18,8,0.45)] land:rounded-[26px]",
          panel
            ? "pt-[22px]"
            : "border border-b-0 border-[#f3d9a9] bg-[linear-gradient(160deg,#fff9e9_0%,#fff0d0_55%,#f6dfb5_100%)] pt-3 land:border-b",
        )}
      >
        {panel ? (
          <div
            aria-hidden
            data-testid="minigames-panel"
            className="pointer-events-none absolute inset-0"
            style={frameStyle("sheet-panel")}
          />
        ) : null}
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            {ribbon ? (
              <div className="relative h-[60px] w-[240px] max-w-full">
                <img
                  src={mgUrl("title-ribbon")}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <h2 className="relative grid h-full place-items-center pb-1 font-display text-[21px] font-black leading-none text-[#4a2410] [text-shadow:0_1px_0_rgba(255,255,255,0.6)]">
                  Mini-games
                </h2>
                {has("header-sparkle") ? (
                  <img
                    src={mgUrl("header-sparkle")}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="pointer-events-none absolute -right-7 -top-2 w-[44px]"
                  />
                ) : null}
              </div>
            ) : (
              <h2 className="font-display text-[22px] font-black leading-none text-[#392013]">
                🎮 Mini-games
              </h2>
            )}
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
            className={cn(
              "press relative grid h-12 w-12 shrink-0 place-items-center rounded-full font-ui text-[18px] font-black text-[#fff5df]",
              closeArt
                ? "[text-shadow:0_1px_2px_rgba(40,15,0,0.8)]"
                : "border border-[#8f4d1e] bg-[linear-gradient(145deg,#a85d25,#754018)] shadow-[0_2px_6px_rgba(83,41,13,0.32)]",
            )}
          >
            {closeArt ? (
              <img
                src={mgUrl("close-button")}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            ) : null}
            <span className="relative">✕</span>
          </button>
        </div>

        <ul className="relative mt-3 grid min-h-0 grid-cols-2 gap-x-2.5 gap-y-3.5 overflow-y-auto px-0.5 pb-1 pt-6 [-webkit-overflow-scrolling:touch]">
          {views.map((v) => (
            <li key={v.entry.id} className="min-w-0">
              <Tile
                view={v}
                opensText={u.when(v.entry.firstLevel)}
                has={has}
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
  has,
  onPlay,
}: {
  view: MiniGameView;
  opensText: string;
  has: (name: string) => boolean;
  onPlay: () => void;
}) {
  const { entry, state, text, waiting } = view;
  const locked = state === "locked";
  const ready = state === "ready";
  const plateName = ready ? "card-ready" : locked ? "card-locked" : "card-resting";
  const plate = has(plateName);
  const icon = has(`icon-${entry.id}`);
  const pillName = ready ? "pill-ready" : locked ? "pill-locked" : "pill-rest";
  const pill = has(pillName);
  const glow = ready && waiting && has("ready-glow");
  const star = ready && waiting && has("badge-ready");
  const dark = locked && plate;
  return (
    <button
      type="button"
      data-testid={`minigame-${entry.id}`}
      data-state={state}
      data-art={plate && icon ? "1" : "0"}
      data-waiting={waiting ? "1" : undefined}
      aria-disabled={!ready || undefined}
      aria-label={
        locked ? `${entry.name}, locked, opens ${opensText}` : `${entry.name}, ${text ?? ""}`
      }
      onClick={ready ? onPlay : undefined}
      className={cn(
        "relative flex min-h-[132px] w-full flex-col items-center gap-1 px-2 pb-2.5 pt-3.5 text-center transition-transform",
        plate
          ? "rounded-[20px]"
          : cn(
              "rounded-[18px] border-2 shadow-soft",
              ready
                ? "border-[#b8873f] bg-[linear-gradient(170deg,#fffaf0,#f6e2b6)]"
                : "border-walnut/20 bg-ivory/60",
            ),
        ready
          ? "press text-walnut-dark"
          : cn("cursor-default", dark ? "text-[#f4e4bd]" : "text-walnut/70"),
      )}
    >
      {glow ? (
        <span
          aria-hidden
          data-testid={`mg-glow-${entry.id}`}
          className="pointer-events-none absolute -inset-[18px] opacity-90"
          style={frameStyle("ready-glow", false)}
        />
      ) : null}
      {plate ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 drop-shadow-[0_4px_5px_rgba(60,30,10,0.28)]"
          style={frameStyle(plateName)}
        />
      ) : null}
      {icon ? (
        <span
          aria-hidden
          className="relative -mt-[22px] block h-[76px] w-[76px] shrink-0"
          data-testid={`mg-icon-${entry.id}`}
        >
          <img
            src={mgUrl(`icon-${entry.id}`)}
            alt=""
            draggable={false}
            className={cn(
              "h-full w-full object-contain drop-shadow-[0_3px_3px_rgba(60,30,10,0.35)]",
              locked && "grayscale brightness-75 opacity-80",
              state === "resting" && "opacity-80",
            )}
          />
          {locked ? (
            has("lock-badge") ? (
              <img
                src={mgUrl("lock-badge")}
                alt=""
                draggable={false}
                className="absolute -bottom-1 -right-1 h-[30px] w-[30px]"
              />
            ) : (
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-white/80 bg-walnut-dark text-[12px] leading-none">
                🔒
              </span>
            )
          ) : null}
        </span>
      ) : (
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
      )}
      {star ? (
        <img
          src={mgUrl("badge-ready")}
          alt=""
          aria-hidden
          draggable={false}
          data-testid={`mg-star-${entry.id}`}
          className="pointer-events-none absolute -right-2 -top-3 h-[32px] w-[32px] drop-shadow-[0_2px_2px_rgba(60,30,10,0.4)]"
        />
      ) : null}
      <span className="relative block font-display text-[14px] font-black leading-tight">
        {entry.name}
      </span>
      <span
        data-testid={`mg-status-${entry.id}`}
        style={pill ? frameStyle(pillName) : undefined}
        className={cn(
          "relative block min-h-[26px] max-w-full px-0.5 font-ui text-[11.5px] font-extrabold leading-tight",
          pill && "flex items-center justify-center",
          pill
            ? ready
              ? "text-[#fffbe8] [text-shadow:0_1px_2px_rgba(20,70,10,0.75)]"
              : locked
                ? "text-[#f1dfb5] [text-shadow:0_1px_2px_rgba(20,8,0,0.7)]"
                : "text-[#6b4a2a]"
            : locked
              ? "font-hand text-[14px] font-bold italic text-walnut/70"
              : ready
                ? "text-[#4d7a35]"
                : "text-walnut/60",
        )}
      >
        {locked ? `opens ${opensText}` : text}
      </span>
    </button>
  );
}
