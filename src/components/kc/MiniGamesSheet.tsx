import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { miniGameViews, type MiniGameView } from "@/game/business/miniGames";
import { useUnlockText } from "./navLevel";
import { useLandscape } from "./game/layoutMode";
import type { ScreenId } from "./data";
import { STRETCH, mgUrl, useMiniGameArt, type StretchArt } from "./minigamesArt";
import { CLEANING_FROM_LEVEL } from "@/game/config/cleaningStart";
import { cleanlinessOf } from "@/game/restaurant/cleanliness";
import { PaintedPic } from "./ChoreTiles";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { FESTIVAL_FIRST_LEVEL } from "@/game/festival/events";
import { waitingFestival } from "@/game/festival/schedule";

/**
 * The Kitchen's Mini-games sheet (developer 2026-11-17: every mini-game as a logo tile, each one open from its own level). A locked tile says when it
 * opens; an open one says what waits; a game with nothing to play today rests (the rules stay each game's own: `business/miniGames.ts`).
 *
 * THE FAIR-STALL LOOK (developer 2026-11-28, a mock-up: "make the minigame section exactly like this"): a striped awning, a red title plaque, the
 * Mini-games / Cleaning bar, eight red and purple cards in the order they unlock (a lock over a locked one's picture, a star on a waiting one, the
 * name on a cream ribbon, a pill under it) and the Festival Competition as a tall panel at the right (upright: a banner above the cards). The
 * artwork is Codex's, painted after the mock-up (`minigamesArt.ts`); every piece falls back to the earlier plain look, drawn by CSS, until its
 * file is there. Every word and number is drawn by the code.
 *
 * ITS SIZE (developer 2026-11-28, "reduce the size of the minigames page to the older small page"): a bottom sheet in the Kitchen, as before that look
 * (560 px wide upright, 780 px and at most 92 % of the height on its side), with the dimmed Kitchen round it. It never covers the whole window.
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

  // the cards stand in the order they unlock (the mock-up's order)
  const ordered = [...views].sort((a, b) => a.entry.firstLevel - b.entry.firstLevel);
  const painted = has("name-ribbon") && has("pill-ready") && has("pill-locked");
  const tabsPainted = has("tab-on") && has("tab-off");
  const festival = RESTAURANT_MODE && section === "games";

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-walnut-dark/60 backdrop-blur-[2px]"
      onClick={onClose}
      data-testid="minigames-backdrop"
    >
      {/* Flush with the bottom of the window at every size, never a floating card: the dim strip round it stays (a tap there closes it). */}
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mini-games"
        data-testid="minigames-sheet"
        data-art={painted ? "1" : "0"}
        onClick={(e) => e.stopPropagation()}
        className="anim-up relative flex h-[90%] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] px-3 pb-2 pt-[26px] shadow-[0_-8px_28px_rgba(34,18,8,0.45)] land:h-[min(92%,520px)] land:max-w-[780px] [@media(max-height:430px)]:pt-[16px]"
      >
        <div
          aria-hidden
          data-testid="minigames-panel"
          className="pointer-events-none absolute inset-0 border-x-[5px] border-[#e9a83c] bg-[radial-gradient(circle_at_50%_26%,#fff6dd_0%,#fbe6b8_62%,#efc986_100%)]"
        />
        <Awning painted={has("awning")} />
        <Leaves has={has} />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {has("title-plaque") ? (
              <div className="relative h-[54px] w-[171px] shrink-0 [@media(max-width:359px)]:h-[44px] [@media(max-width:359px)]:w-[139px] [@media(max-height:430px)]:h-[50px] [@media(max-height:430px)]:w-[159px]">
                <img
                  src={mgUrl("title-plaque")}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute inset-0 h-full w-full drop-shadow-[0_4px_4px_rgba(60,15,0,0.4)]"
                />
                {/* (the plaque's middle sits below its chef's hat) */}
                <h2 className="relative flex h-full items-center justify-center whitespace-nowrap pt-[9%] font-display text-[18px] [@media(max-width:359px)]:text-[15px] font-black leading-none text-[#fff3d4] [text-shadow:0_2px_2px_rgba(60,8,0,0.75)] [@media(max-height:430px)]:text-[17px]">
                  Mini-games
                </h2>
              </div>
            ) : (
              <div className="relative shrink-0 rounded-[16px] border-[3px] border-[#ffd36b] bg-[linear-gradient(180deg,#d4311f,#8e130c)] px-4 py-1.5 shadow-[0_0_0_2px_#a4611a,0_4px_6px_rgba(60,15,0,0.35)]">
                <h2 className="whitespace-nowrap font-display text-[19px] font-black leading-none text-[#fff3d4] [text-shadow:0_2px_2px_rgba(60,8,0,0.7)]">
                  Mini-games
                </h2>
              </div>
            )}
            <p
              data-testid="minigames-count"
              className="min-w-0 whitespace-nowrap rounded-full border-2 border-[#d9ae62] [@media(max-width:359px)]:px-1.5 [@media(max-width:359px)]:text-[11px] bg-[#fff6df] px-3 py-1 font-display text-[12.5px] font-black leading-tight text-[#4a2410] shadow-sm"
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
              "press relative grid h-12 w-12 shrink-0 place-items-center rounded-full font-ui text-[22px] font-black leading-none text-white",
              !has("close-button") &&
                "border-[3px] border-[#ffd36b] bg-[radial-gradient(circle_at_40%_30%,#f2573f,#a8160c_72%)] shadow-[0_0_0_2px_#a4611a,0_4px_6px_rgba(60,15,0,0.4)] [text-shadow:0_2px_2px_rgba(60,8,0,0.6)]",
            )}
          >
            {has("close-button") ? (
              // the painted button carries its own cross
              <img
                src={mgUrl("close-button")}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_3px_4px_rgba(60,15,0,0.45)]"
              />
            ) : (
              "✕"
            )}
          </button>
        </div>

        <div
          className={cn(
            "relative mt-2 flex min-h-0 flex-1 flex-col gap-2",
            festival &&
              "land:grid land:grid-cols-[minmax(0,1fr)_clamp(160px,23%,180px)] land:grid-rows-[auto_minmax(0,1fr)] land:gap-x-3",
          )}
        >
          <div
            role="tablist"
            aria-label="Mini-games sections"
            data-testid="minigames-tabs"
            className={cn(
              "flex shrink-0 gap-1.5",
              !tabsPainted &&
                "rounded-full border-[3px] border-[#ffd36b] bg-[linear-gradient(180deg,#fff1cc,#f4d391)] p-[3px] shadow-[0_0_0_2px_#a4611a,0_3px_5px_rgba(60,20,0,0.3)]",
            )}
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
                    "press relative flex h-12 items-center justify-center gap-2 rounded-full font-display text-[15px] font-black",
                    // the Mini-games half takes the bar, as in the mock-up; Cleaning keeps its place beside it
                    t.id === "games" ? "flex-[1.5] land:flex-[2.2]" : "flex-1",
                    "min-w-0 whitespace-nowrap [@media(max-width:359px)]:gap-1 [@media(max-width:359px)]:text-[13px]",
                    on
                      ? "text-[#fff6df] [text-shadow:0_1px_2px_rgba(30,0,40,0.75)]"
                      : "text-[#4a2410]",
                    on &&
                      !tabsPainted &&
                      "bg-[linear-gradient(180deg,#8d2bb0,#521170)] shadow-[inset_0_2px_0_rgba(255,255,255,0.28)]",
                  )}
                >
                  {tabsPainted ? <Stretched name={on ? "tab-on" : "tab-off"} /> : null}
                  {t.id === "games" && has("icon-gamepad") ? (
                    <img
                      src={mgUrl("icon-gamepad")}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="relative h-[28px] w-[42px] shrink-0 object-contain [@media(max-width:359px)]:w-[30px]"
                    />
                  ) : t.id === "cleaning" ? (
                    <span
                      aria-hidden
                      className="relative grid h-[28px] w-[28px] shrink-0 place-items-center"
                    >
                      <PaintedPic name="broom" fallback={t.icon} />
                    </span>
                  ) : (
                    <span aria-hidden className="relative text-[20px] leading-none">
                      {t.icon}
                    </span>
                  )}
                  <span className="relative">{t.label}</span>
                  {t.badge ? (
                    <span
                      data-testid={`minigames-tab-badge-${t.id}`}
                      className="relative grid h-6 min-w-6 place-items-center rounded-full bg-tomato px-1.5 font-ui text-[12px] font-black text-ivory"
                    >
                      {t.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {RESTAURANT_MODE ? (
            section === "games" ? (
              <div className="shrink-0 land:col-start-2 land:row-span-2 land:row-start-1 land:min-h-0">
                <FestivalCard
                  save={save}
                  level={level}
                  opensText={u.when(FESTIVAL_FIRST_LEVEL)}
                  has={has}
                  onPlay={() => {
                    onClose();
                    go("festival");
                  }}
                />
              </div>
            ) : null
          ) : null}

          {section === "games" ? (
            <ul className="-mx-1 grid min-h-0 flex-1 auto-rows-[minmax(182px,1fr)] grid-cols-2 gap-x-2.5 gap-y-3 overflow-y-auto overscroll-contain px-2 pb-3 pt-3 [-webkit-overflow-scrolling:touch] land:auto-rows-[minmax(132px,1fr)] land:grid-cols-4 land:gap-x-2 land:gap-y-2.5 land:pt-2">
              {ordered.map((v, i) => (
                <li key={v.entry.id} className="flex min-w-0 flex-col">
                  <Tile
                    view={v}
                    tone={CARD_TONES[i % CARD_TONES.length]!}
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-5 pt-3 [-webkit-overflow-scrolling:touch]"
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
        </div>
      </section>
    </div>
  );
}

/** A painted piece stretched between its two ends, filling its box behind the words (see `STRETCH`). */
function Stretched({ name }: { name: StretchArt }) {
  const { w, h, cap } = STRETCH[name];
  const end = `calc(100cqh * ${cap / h})`;
  const image = `url(${mgUrl(name)})`;
  return (
    <span
      aria-hidden
      data-art-piece={name}
      className="pointer-events-none absolute inset-0 [container-type:size]"
    >
      {/* the middle first, a pixel under each end */}
      <span
        className="absolute inset-y-0"
        style={{
          left: `calc(${end} - 1px)`,
          right: `calc(${end} - 1px)`,
          background: `${image} 50% 0 / ${(100 * w) / (w - 2 * cap)}% 100% no-repeat`,
        }}
      />
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: end, background: `${image} 0 0 / auto 100% no-repeat` }}
      />
      <span
        className="absolute inset-y-0 right-0"
        style={{ width: end, background: `${image} 100% 0 / auto 100% no-repeat` }}
      />
    </span>
  );
}

/** The striped shop awning across the top, with its scalloped edge. */
function Awning({ painted }: { painted: boolean }) {
  if (painted)
    return (
      <div
        aria-hidden
        data-testid="mg-awning"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34px] drop-shadow-[0_3px_3px_rgba(90,30,0,0.3)] [@media(max-height:430px)]:h-[24px]"
        style={{ background: `url(${mgUrl("awning")}) 0 0 / auto 100% repeat-x` }}
      />
    );
  const scallop = (colour: string) =>
    `radial-gradient(circle at 13.5px 0, ${colour} 13px, transparent 13.8px)`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
      <div className="h-[13px] bg-[repeating-linear-gradient(90deg,#d3321f_0_27px,#fff0d2_27px_54px)] land:h-[10px]" />
      <div
        className="h-[14px] drop-shadow-[0_3px_2px_rgba(90,30,0,0.3)]"
        style={{
          background: `${scallop("#d3321f")} 0 0 / 54px 14px repeat-x, ${scallop("#fff0d2")} 27px 0 / 54px 14px repeat-x`,
        }}
      />
    </div>
  );
}

/** The leafy bushes in the four corners, behind everything on the screen (one picture, mirrored). */
function Leaves({ has }: { has: (name: string) => boolean }) {
  if (!has("leaves-corner")) return null;
  return (
    <>
      {[
        "left-0 top-0",
        "right-0 top-0 -scale-x-100",
        "bottom-0 left-0 -scale-y-100",
        "bottom-0 right-0 -scale-100",
      ].map((corner) => (
        <img
          key={corner}
          src={mgUrl("leaves-corner")}
          alt=""
          aria-hidden
          draggable={false}
          className={cn("pointer-events-none absolute w-[48px]", corner)}
        />
      ))}
    </>
  );
}

/** The cards' colours by place, as in the mock-up: a chequer of red and purple. */
const CARD_TONES = ["red", "purple", "red", "purple", "purple", "red", "purple", "red"] as const;
const rays = (glow: string, top: string, bottom: string) =>
  `radial-gradient(circle at 50% 30%, ${glow} 0%, transparent 58%), repeating-conic-gradient(from 4deg at 50% 32%, rgba(255,255,255,0.08) 0deg 8deg, transparent 8deg 18deg), linear-gradient(180deg, ${top}, ${bottom})`;
const CARD_FILL = {
  red: rays("rgba(255,176,74,0.55)", "#c9271c", "#740d0b"),
  purple: rays("rgba(201,116,255,0.5)", "#6d2399", "#33105a"),
} as const;

function Tile({
  view,
  tone,
  opensText,
  has,
  onPlay,
}: {
  view: MiniGameView;
  tone: keyof typeof CARD_FILL;
  opensText: string;
  has: (name: string) => boolean;
  onPlay: () => void;
}) {
  const { entry, state, text, waiting } = view;
  const locked = state === "locked";
  const ready = state === "ready";
  const pillName = ready ? "pill-ready" : locked ? "pill-locked" : "pill-rest";
  const pill = has(pillName);
  const icon = has(`icon-${entry.id}`);
  const ribbon = has("name-ribbon");
  const card = tone === "red" ? "card-red" : "card-purple";
  const plate = has(card);
  const glow = ready && waiting;
  const star = ready && waiting && has("badge-ready");
  return (
    <button
      type="button"
      data-testid={`minigame-${entry.id}`}
      data-state={state}
      data-tone={tone}
      data-art={icon && ribbon && pill ? "1" : "0"}
      data-waiting={waiting ? "1" : undefined}
      aria-disabled={!ready || undefined}
      aria-label={
        locked ? `${entry.name}, locked, opens ${opensText}` : `${entry.name}, ${text ?? ""}`
      }
      onClick={ready ? onPlay : undefined}
      className={cn(
        "relative flex min-h-[132px] w-full flex-1 flex-col items-center justify-end rounded-[18px] px-1.5 pb-1.5 pt-1 text-center transition-transform [container-type:inline-size]",
        ready ? "press" : "cursor-default",
      )}
    >
      {glow ? (
        <span
          aria-hidden
          data-testid={`mg-glow-${entry.id}`}
          className="pointer-events-none absolute inset-[5px] rounded-[20px] shadow-[0_0_14px_9px_rgba(255,206,70,0.95)]"
        />
      ) : null}
      <span
        aria-hidden
        data-testid={`mg-card-${entry.id}`}
        className={cn(
          "pointer-events-none absolute inset-0",
          plate
            ? "drop-shadow-[0_4px_5px_rgba(60,20,0,0.4)]"
            : "rounded-[18px] border-[3px] border-[#ffd36b] shadow-[0_0_0_2px_#a4611a,0_5px_7px_rgba(60,20,0,0.35),inset_0_0_0_2px_rgba(120,60,0,0.45),inset_0_0_16px_rgba(255,214,120,0.35)]",
        )}
        style={{
          background: plate ? `url(${mgUrl(card)}) 0 0 / 100% 100% no-repeat` : CARD_FILL[tone],
        }}
      />
      <span aria-hidden className="relative block min-h-0 w-full flex-1">
        {icon ? (
          <span data-testid={`mg-icon-${entry.id}`} className="absolute inset-0 block">
            <img
              src={mgUrl(`icon-${entry.id}`)}
              alt=""
              draggable={false}
              className={cn(
                "h-full w-full object-contain drop-shadow-[0_5px_5px_rgba(30,5,0,0.45)]",
                state === "resting" && "opacity-85",
              )}
            />
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[44px] leading-none">
            {entry.glyph}
          </span>
        )}
        {locked ? (
          has("lock-badge") ? (
            <img
              src={mgUrl("lock-badge")}
              alt=""
              draggable={false}
              className="absolute bottom-0 left-1/2 h-[min(60px,56%)] w-auto -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(30,5,0,0.5)]"
            />
          ) : (
            <span className="absolute bottom-0 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border-2 border-[#ffd36b] bg-walnut-dark text-[16px] leading-none">
              🔒
            </span>
          )
        ) : null}
      </span>
      {star ? (
        <img
          src={mgUrl("badge-ready")}
          alt=""
          aria-hidden
          draggable={false}
          data-testid={`mg-star-${entry.id}`}
          className="pointer-events-none absolute -right-2 -top-2.5 h-[44px] w-[44px] object-contain drop-shadow-[0_2px_3px_rgba(60,20,0,0.5)] land:h-[clamp(34px,22cqw,60px)] land:w-[clamp(34px,22cqw,60px)]"
        />
      ) : null}
      {/* the name on its cream ribbon */}
      <span
        className={cn(
          "relative -mx-1 flex h-[40px] w-[calc(100%+8px)] shrink-0 items-center justify-center [@media(max-height:430px)]:h-[30px]",
          !ribbon && "rounded-md bg-[#ffeec4]",
        )}
      >
        {ribbon ? <Stretched name="name-ribbon" /> : null}
        <span className="relative block max-w-[90%] pb-[4px] font-display text-[clamp(10.5px,8.4cqw,19px)] font-black leading-none text-[#4a2008] [@media(max-height:430px)]:text-[9.8px]">
          {entry.name}
        </span>
      </span>
      <span
        data-testid={`mg-status-${entry.id}`}
        className={cn(
          "relative mt-0.5 flex min-h-[30px] w-[94%] shrink-0 [@media(max-height:430px)]:mt-0 [@media(max-height:430px)]:min-h-[26px] items-center justify-center font-ui text-[clamp(9.5px,6.8cqw,15px)] font-extrabold leading-tight",
          !pill && "rounded-full bg-black/45",
          ready
            ? "text-[#fffbe8] [text-shadow:0_1px_2px_rgba(20,70,10,0.8)]"
            : locked || !pill
              ? "text-[#fbeac2] [text-shadow:0_1px_2px_rgba(20,8,0,0.75)]"
              : "text-[#5a3a18]",
        )}
      >
        {pill ? <Stretched name={pillName} /> : null}
        <span className="relative block px-2 first-letter:uppercase">
          {locked ? `opens ${opensText}` : text}
        </span>
      </span>
    </button>
  );
}

/**
 * The Festival Fast Food Competition (developer 2026-11-27): a panel of its own beside the games (it is a whole mode, not one more tile): tall at
 * the right of a window on its side, a banner above the cards on an upright one (developer 2026-11-28, the mock-up). It opens at
 * FESTIVAL_FIRST_LEVEL; a star and the waiting festival's name show while an open one has never been played. It pays no money.
 */
function FestivalCard({
  save,
  level,
  opensText,
  has,
  onPlay,
}: {
  save: SaveData;
  level: number;
  opensText: string;
  has: (name: string) => boolean;
  onPlay: () => void;
}) {
  const wide = useLandscape();
  const locked = level < FESTIVAL_FIRST_LEVEL;
  const waiting = locked ? undefined : waitingFestival(save);
  const status = locked
    ? `opens ${opensText}`
    : waiting
      ? `${waiting.name} is waiting`
      : "Play the festivals";
  const scene = has("festival-scene-tall") && has("festival-scene-wide");
  const frame =
    has("festival-frame-top") && has("festival-frame-mid") && has("festival-frame-bottom");
  const ribbon = has("festival-ribbon");
  const button = has("button-green");
  const dim = locked && "brightness-[0.64] saturate-[0.75]";
  return (
    <button
      type="button"
      data-testid="mg-festival"
      data-state={locked ? "locked" : "ready"}
      data-art={scene && frame && ribbon && button ? "1" : "0"}
      data-waiting={waiting ? "1" : undefined}
      aria-disabled={locked || undefined}
      aria-label={
        locked
          ? `Festival Competition, locked, opens ${opensText}`
          : `Festival Competition, ${status}`
      }
      onClick={locked ? undefined : onPlay}
      className={cn(
        "relative block h-[124px] w-full text-center [container-type:size] land:h-full",
        locked ? "cursor-default" : "press",
      )}
    >
      {/* the fair, inside the frame: upright a wide banner, on its side the tall panel under the frame's arch */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 overflow-hidden rounded-[20px] border-[4px] border-[#ffcf5a] shadow-[0_0_0_2px_#a4611a,0_5px_8px_rgba(60,20,0,0.4)]",
          frame &&
            "land:inset-x-[3cqw] land:bottom-[3cqw] land:top-[3cqw] land:rounded-[50%_50%_4cqw_4cqw/22cqw_22cqw_4cqw_4cqw] land:border-0 land:shadow-none",
          !scene && "bg-[linear-gradient(180deg,#5b2a86,#d9591d_60%,#7a2a10)]",
        )}
      >
        {scene ? (
          // only the picture that is shown is fetched
          <img
            src={mgUrl(wide ? "festival-scene-tall" : "festival-scene-wide")}
            alt=""
            draggable={false}
            className={cn(
              "h-full w-full object-cover",
              wide ? "object-bottom" : "object-[80%_50%]",
              dim,
            )}
          />
        ) : null}
      </span>
      {/* the marquee: its arched top, its side bulbs repeated to any height, its foot (on an upright banner, dots do the bulbs) */}
      {frame ? (
        <span aria-hidden data-testid="mg-festival-frame" className="hidden land:contents">
          <span
            className="absolute inset-x-0 bottom-[27cqw] top-[40cqw]"
            style={{
              background: `url(${mgUrl("festival-frame-mid")}) 0 0 / 100% auto no-repeat round`,
            }}
          />
          <img
            src={mgUrl("festival-frame-top")}
            alt=""
            draggable={false}
            className="absolute inset-x-0 top-0 w-full"
          />
          <img
            src={mgUrl("festival-frame-bottom")}
            alt=""
            draggable={false}
            className="absolute inset-x-0 bottom-0 w-full"
          />
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "absolute inset-[3px] rounded-[14px] border-[5px] border-dotted border-[#fff3b0] drop-shadow-[0_0_3px_#ffb52e]",
          frame && "land:hidden",
        )}
      />

      <span className="relative flex h-full items-center gap-2 px-3 land:flex-col land:gap-[1cqh] land:px-[7cqw] land:pb-[9cqw] land:pt-[7cqw]">
        <img
          src={
            has("festival-trophy")
              ? mgUrl("festival-trophy")
              : `${import.meta.env.BASE_URL}festival/ui/first-trophy.webp`
          }
          alt=""
          aria-hidden
          draggable={false}
          loading="lazy"
          className={cn(
            "h-[82px] w-[82px] shrink-0 object-contain drop-shadow-[0_0_10px_rgba(255,214,90,0.85)] [@media(max-width:359px)]:h-[62px] [@media(max-width:359px)]:w-[62px] land:h-[min(62cqw,30cqh)] land:w-full",
            locked && "grayscale-[0.45]",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5 land:w-full land:justify-between land:gap-1">
          {/* the title: the painted ribbon on a window on its side, a small red plate otherwise */}
          <span
            className={cn(
              "block max-w-full rounded-[14px] border-[3px] border-[#ffd36b] bg-[linear-gradient(180deg,#cf2c1b,#850f0a)] px-3 py-1 font-display text-[15px] font-black leading-tight text-[#fff3d4] shadow-[0_3px_6px_rgba(40,0,0,0.5)] [text-shadow:0_2px_2px_rgba(60,8,0,0.75)]",
              ribbon
                ? "land:relative land:flex land:aspect-[480/218] land:w-[104%] land:max-w-none land:items-center land:justify-center land:rounded-none land:border-0 land:bg-transparent land:bg-none land:p-0 land:text-[min(8.8cqw,26px)] land:shadow-none"
                : "land:w-full land:px-1 land:py-2 land:text-[min(10cqw,24px)]",
              "[@media(max-height:430px)]:land:-mt-[5cqw]",
              "[@media(max-width:359px)]:whitespace-nowrap [@media(max-width:359px)]:px-1.5 [@media(max-width:359px)]:text-[12.5px]",
            )}
          >
            {ribbon ? (
              <img
                src={mgUrl("festival-ribbon")}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 hidden h-full w-full land:block"
              />
            ) : null}
            <span className={cn("relative", ribbon && "land:block land:w-[68%] land:pt-[2%]")}>
              Festival Competition
            </span>
          </span>
          <span className="flex w-full flex-col items-center gap-1 land:gap-[1.5cqh]">
            <span
              data-testid="mg-festival-status"
              className="block max-w-full rounded-full bg-[rgba(48,12,4,0.84)] px-2.5 py-0.5 font-ui text-[12px] font-extrabold leading-snug text-[#fbeac2] [@media(max-width:359px)]:px-1.5 [@media(max-width:359px)]:text-[10px] land:text-[clamp(11px,4.6cqw,15px)]"
            >
              {waiting ? "⭐ " : locked ? "🔒 " : ""}
              <span className="inline-block first-letter:uppercase">{status}</span>
            </span>
            {locked ? null : (
              <span
                aria-hidden
                className={cn(
                  "relative flex h-[46px] w-[94%] items-center justify-center whitespace-nowrap font-display text-[16px] font-black leading-none text-white [text-shadow:0_1px_2px_rgba(10,50,0,0.85)] land:text-[min(8.4cqw,23px)] [@media(max-height:430px)]:h-[34px]",
                  !button &&
                    "rounded-full border-[3px] border-[#ffe08a] bg-[linear-gradient(180deg,#7ad42a,#2f8a12)] shadow-[0_3px_0_#1f5d0a]",
                )}
              >
                {button ? <Stretched name="button-green" /> : null}
                <span className="relative">Join Now ▸</span>
              </span>
            )}
          </span>
        </span>
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
