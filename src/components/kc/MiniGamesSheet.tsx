import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { miniGameViews, type MiniGameView } from "@/game/business/miniGames";
import { useUnlockText } from "./navLevel";
import type { ScreenId } from "./data";
import { frameStyle, mgUrl, useMiniGameArt } from "./minigamesArt";
import { CLEANING_FROM_LEVEL } from "@/game/config/cleaningStart";
import { cleanlinessOf } from "@/game/restaurant/cleanliness";
import { PaintedPic } from "./ChoreTiles";

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
  // Two sections (developer 2026-11-22: Cleaning is a section of its own under this button, apart from the games and from Business).
  const [section, setSection] = useState<"games" | "cleaning">("games");
  const cleaningLocked = level < CLEANING_FROM_LEVEL;
  const cleaningWaiting = cleaningLocked ? 0 : cleanlinessOf(save).tasks.length;

  // Focus goes into the dialog, stays inside it (Tab wraps) and returns to what opened it when it closes.
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [
        ...(sheetRef.current?.querySelectorAll<HTMLElement>("button:not([aria-disabled='true'])") ??
          []),
      ];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const here = document.activeElement;
      if (e.shiftKey && (here === first || !sheetRef.current?.contains(here))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (here === last || !sheetRef.current?.contains(here))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      opener?.focus?.();
    };
  }, []);

  const panel = has("sheet-panel");
  const ribbon = has("title-ribbon");
  const closeArt = has("close-button");

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-walnut-dark/60 backdrop-blur-[2px]"
      onClick={onClose}
      data-testid="minigames-backdrop"
    >
      {/* The painted panel (sheet-panel.webp) has NO bottom edge: it is a bottom sheet. It stays one at every size (landscape included, developer 2026-11-19), flush with the bottom of the window, never a floating card with an open bottom. */}
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mini-games"
        data-testid="minigames-sheet"
        data-art={panel ? "1" : "0"}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "anim-up relative flex max-h-[90%] w-full max-w-[560px] flex-col rounded-t-[26px] px-4 pb-3 shadow-[0_-8px_28px_rgba(34,18,8,0.45)] land:max-h-[92%] land:max-w-[780px]",
          panel
            ? "pt-[18px] land:pt-[14px]"
            : "border border-b-0 border-[#f3d9a9] bg-[linear-gradient(160deg,#fff9e9_0%,#fff0d0_55%,#f6dfb5_100%)] pt-3",
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
          <div className="min-w-0 land:flex land:items-center land:gap-3">
            {ribbon ? (
              <div className="relative h-[52px] w-[208px] max-w-full shrink-0 land:h-[44px] land:w-[176px]">
                <img
                  src={mgUrl("title-ribbon")}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <h2 className="relative grid h-full place-items-center pb-1 font-display text-[19px] font-black leading-none text-[#4a2410] land:text-[17px] [text-shadow:0_1px_0_rgba(255,255,255,0.6)]">
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
              className="mt-0.5 font-hand text-[14px] italic leading-none text-[#795a3a] land:mt-0"
            >
              {section === "cleaning"
                ? cleaningLocked
                  ? "locked"
                  : cleaningWaiting > 0
                    ? `${cleaningWaiting} ${cleaningWaiting === 1 ? "job" : "jobs"} waiting`
                    : "all clean"
                : `${open} of ${views.length} open`}
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

        <div
          role="tablist"
          aria-label="Mini-games sections"
          data-testid="minigames-tabs"
          className="relative mt-2 grid grid-cols-2 gap-2 land:mt-1"
        >
          {(
            [
              { id: "games", icon: "🎮", label: "Mini-games", badge: null },
              { id: "cleaning", icon: "🧹", label: "Cleaning", badge: cleaningWaiting },
            ] as const
          ).map((t) => {
            const on = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`minigames-tab-${t.id}`}
                onClick={() => setSection(t.id)}
                className={cn(
                  "press relative flex h-12 items-center justify-center gap-2 rounded-2xl border-2 font-ui text-[14.5px] font-extrabold",
                  on
                    ? "border-[#8f4d1e] bg-[linear-gradient(170deg,#b8742f,#8a4b1c)] text-[#fff5df] shadow-soft"
                    : "border-[#c9a366] bg-[#fff6df]/80 text-[#4a2410]",
                )}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
                {t.badge ? (
                  <span
                    data-testid={`minigames-tab-badge-${t.id}`}
                    className="grid h-6 min-w-6 place-items-center rounded-full bg-tomato px-1.5 font-ui text-[12px] font-black text-ivory"
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {section === "games" ? (
          <ul className="relative -mx-4 mt-1 grid min-h-0 grid-cols-2 gap-x-2.5 gap-y-3 overflow-y-auto overscroll-contain px-4 pb-7 pt-5 [-webkit-overflow-scrolling:touch] [mask-image:linear-gradient(to_bottom,#000_calc(100%-22px),transparent)] land:mt-0 land:grid-cols-4 land:gap-x-2 land:gap-y-3 land:pt-5">
            {views.map((v) => (
              <li key={v.entry.id} className="flex min-w-0 flex-col">
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
        ) : (
          <div
            data-testid="minigames-cleaning-section"
            className="relative -mx-4 min-h-0 overflow-y-auto overscroll-contain px-4 pb-7 pt-4 [-webkit-overflow-scrolling:touch]"
          >
            <CleaningSection
              save={save}
              level={level}
              opensText={u.when(CLEANING_FROM_LEVEL)}
              onOpen={() => {
                onClose();
                go("business-cleanliness");
              }}
            />
          </div>
        )}
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
        "relative flex min-h-[132px] w-full flex-1 flex-col items-center gap-1 px-3 pb-5 pt-5 text-center transition-transform [container-type:inline-size] [@media(max-height:700px)]:pb-[18px] [@media(max-height:700px)]:pt-[18px] land:px-2 land:pb-4 land:pt-4",
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
          className="relative block h-[68px] w-[68px] shrink-0 [@media(max-height:700px)]:h-[58px] [@media(max-height:700px)]:w-[58px] land:h-[46px] land:w-[46px]"
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
      <span className="relative block font-display text-[14px] font-black leading-tight land:text-[13px]">
        {entry.name}
      </span>
      <span
        data-testid={`mg-status-${entry.id}`}
        style={pill ? frameStyle(pillName) : undefined}
        className={cn(
          "relative block min-h-[28px] max-w-full px-0.5 py-[3px] font-ui text-[clamp(9px,6.4cqw,11.5px)] font-extrabold leading-tight",
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

/**
 * The Cleaning section (developer 2026-11-22: Cleanliness left the Business screen and sits under the Mini-games button as a section of its own): one
 * wide card that opens the cleaning screen (rooms, supplies, the Cleaner; the cleaning games themselves are played from there). It opens at
 * CLEANING_FROM_LEVEL and says how many jobs wait.
 */
function CleaningSection({
  save,
  level,
  opensText,
  onOpen,
}: {
  save: SaveData;
  level: number;
  opensText: string;
  onOpen: () => void;
}) {
  const locked = level < CLEANING_FROM_LEVEL;
  const waiting = locked ? 0 : cleanlinessOf(save).tasks.length;
  const status = locked
    ? `opens ${opensText}`
    : waiting > 0
      ? `${waiting} ${waiting === 1 ? "job" : "jobs"} waiting`
      : "All clean";
  return (
    <div data-testid="minigames-cleaning">
      <button
        type="button"
        data-testid="minigame-cleaning"
        data-state={locked ? "locked" : waiting > 0 ? "ready" : "resting"}
        aria-disabled={locked || undefined}
        aria-label={locked ? `Cleanliness, locked, opens ${opensText}` : `Cleanliness, ${status}`}
        onClick={locked ? undefined : onOpen}
        className={cn(
          "relative flex min-h-[72px] w-full items-center gap-3 rounded-[18px] border-2 px-3 py-2 text-left shadow-soft",
          locked
            ? "cursor-default border-walnut/20 bg-ivory/60 text-walnut/70"
            : "press border-[#b8873f] bg-[linear-gradient(170deg,#fffaf0,#f6e2b6)] text-walnut-dark",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95),rgba(240,222,186,0.7)_62%,rgba(220,190,140,0.25))] p-1.5",
            locked && "grayscale opacity-70",
          )}
        >
          <PaintedPic name="broom" fallback="🧹" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-black leading-tight">
            Cleanliness
          </span>
          <span className="block font-ui text-[12.5px] font-semibold leading-snug text-walnut/70">
            Kitchen · dining room · restroom · the Cleaner
          </span>
        </span>
        <span
          data-testid="mg-status-cleaning"
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 font-ui text-[12px] font-extrabold leading-tight",
            locked
              ? "bg-walnut/10 text-walnut/70"
              : waiting > 0
                ? "bg-copper text-ivory"
                : "bg-[#e3efd0] text-[#4d7a35]",
          )}
        >
          {status}
        </span>
      </button>
    </div>
  );
}
