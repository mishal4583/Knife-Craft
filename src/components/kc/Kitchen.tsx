import { collectableTotal } from "@/game/progression/achievements";
import { useUnlockText } from "./navLevel";
import { dayClockFor, dayStripText, type DayLight } from "@/game/restaurant/dayClock";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { ENDLESS_RESTAURANT_NAME } from "@/game/restaurant/endlessRestaurant";
import { useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  SECTION_POINTER,
  grandmaTipFor,
  isTabNew,
  isTabOpen,
  tabOpensAt,
} from "@/game/restaurant/firstLevels";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { nextServiceLevel } from "@/game/restaurant/nextService";
import { openMarketIngredients } from "./marketFocus";
import { NavAttentionContext, NavGuideContext, NavLevelContext } from "./navLevel";
import {
  INGREDIENT_LIST_FROM,
  STAR_GRADES,
  dishIngredientsFor,
  hasLevelGoals,
  levelStars,
  starText,
} from "@/game/restaurant/levelGoals";
import { formatStockAmount, measureOf } from "@/game/business/measure";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { ENDLESS_DAILY_COIN_CAP, isEndlessUnlocked } from "@/game/daily/EndlessServiceManager";
import { paidLevelReward } from "@/game/levels/levelRewards";
import { levelPayPreview } from "@/game/restaurant/levelPayPreview";
import type { LevelDefinition } from "@/game/levels/levelTypes";
import { KButton, Coin, DustMotes } from "./common/primitives";
import { PointerHand } from "./common/PointerHand";
import { gameReady } from "@/game/PlayablesSDK";
import { dollars, formatUsd, formatUsdChange } from "@/game/money";
import { pendingCashTotal } from "@/game/economy/pendingCash";
import { DailyGiftCard } from "./DailyGiftCard";
import { KitchenBackground } from "./KitchenBackground";
import type { ScreenId } from "./data";
import { getLevels, isUnlocked, isCompleted, type LevelProgress } from "@/game/levels/LevelManager";
import { CHAPTER_TITLES } from "@/game/levels/levelDefinitions";
import { LAST_CAMPAIGN_LEVEL } from "@/game/restaurant/restaurantProgression";
import {
  describeDifficulty,
  getNextKitchenStagePreview,
  getNextRewardPreview,
  liveUnlockReward,
  opensInMarket,
  levelNumber,
} from "@/game/levels/levelMastery";
import { getCafeProgress } from "@/game/cafe/CafeProgressionManager";
import { CAFE_MILESTONES } from "@/game/cafe/cafeDefinitions";
import { cityRanking } from "@/game/restaurant/cityRanking";
import { kitchenUpgradeOrDefault } from "@/game/kitchen/kitchenUpgradeDefinitions";
import { nextKitchenUpgrade } from "@/game/kitchen/nextKitchenUpgrade";
import type { SaveData } from "@/game/SaveManager";
import { ScrollCue } from "./common/ScrollCue";

/** Icon for a level's own `unlockReward.type` (levelTypes.ts) — display-only. */
const REWARD_TYPE_ICON: Record<"knife" | "board" | "cafe_milestone" | "story", string> = {
  knife: "🔪",
  board: "🪵",
  cafe_milestone: "🏆",
  story: "📖",
};

function Hotspot({
  label,
  sub,
  style,
  position,
  onClick,
  opensAt,
}: {
  label: string;
  sub: string;
  style: React.CSSProperties;
  /** Vertical placement classes — short phones (< 700px tall) move a hotspot so the HUD / Today's Order card never covers it. */
  position: string;
  onClick: () => void;
  /** The level this place opens at, while it's still closed (first levels, firstLevels.ts). */
  opensAt?: number | null;
}) {
  const u = useUnlockText();
  const locked = typeof opensAt === "number";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      aria-disabled={locked || undefined}
      data-locked={locked || undefined}
      style={style}
      className={`press absolute ${position} -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ivory/25 bg-walnut-dark/40 px-3 py-1.5 text-left backdrop-blur-[3px] shadow-soft${locked ? " opacity-75" : ""}`}
    >
      <span className="block font-display text-[13.5px] font-black leading-none text-ivory">
        {locked ? `🔒 ${label}` : label}
      </span>
      <span className="block font-hand text-[14px] leading-tight text-gold/90">
        {locked ? `opens ${u.when(opensAt)}` : sub}
      </span>
    </button>
  );
}

/**
 * What a level pays, for its "ready to prepare" line (audit 2026-10-08): the
 * restaurant shows its orders + completion reward ("about +$363"); the classic
 * game keeps the completion reward it always showed.
 */
function payText(save: SaveData, level: LevelDefinition): string {
  const pay = RESTAURANT_MODE ? levelPayPreview(save, level) : null;
  // "about": the quality bonus comes on top — except on a level that pays nothing (Level 2).
  if (pay) return pay.total > 0 ? `about ${formatUsdChange(pay.total)}` : formatUsdChange(0);
  return formatUsdChange(paidLevelReward(level));
}

/** The single "what should I prepare next" level — the first unlocked-but-not-completed level in campaign order, falling back to the furthest reached one once everything's done. Shared by the compact Kitchen Home card and OrderBoard's own header context. */
function pickTodayLevel(levelProgress: LevelProgress) {
  const levels = getLevels();
  const next = levels.find(
    (l) => isUnlocked(l, levelProgress) && !isCompleted(l.id, levelProgress),
  );
  if (next) return next;
  const lastUnlocked = [...levels].reverse().find((l) => isUnlocked(l, levelProgress));
  return lastUnlocked ?? levels[0]!;
}

/** The kitchen's light by time of day (dayClock.ts): a soft gradient over the art. */
const DAY_LIGHT_TINT: Record<DayLight, string> = {
  dawn: "linear-gradient(180deg,rgba(255,176,128,0.28) 0%,rgba(255,214,170,0.10) 55%,transparent 100%)",
  morning: "linear-gradient(180deg,rgba(255,236,190,0.18) 0%,transparent 60%)",
  midday: "transparent",
  afternoon:
    "linear-gradient(180deg,rgba(255,196,96,0.20) 0%,rgba(255,170,70,0.08) 70%,transparent 100%)",
  // Keep the kitchen art's original color and contrast readable; evening
  // should suggest warm light, not wash a heavy orange veil over the room.
  evening: "linear-gradient(180deg,rgba(255,128,64,0.10) 0%,rgba(120,50,40,0.07) 100%)",
  late: "linear-gradient(180deg,rgba(70,60,140,0.34) 0%,rgba(40,30,70,0.30) 100%)",
  night: "linear-gradient(180deg,rgba(16,26,72,0.55) 0%,rgba(10,14,40,0.45) 100%)",
};

export function Kitchen({
  go,
  save,
  onSelectLevel,
  onOpenDailyGift,
  onCollectTableCash,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onSelectLevel: (levelId: string) => void;
  /** Collects the cash a served order left on the table (optional; it must be in before closing). */
  onCollectTableCash?: () => void;
  /** Phase 5 (B3): opens today's gift sheet (App's openDailyGift) — the one place a gift is taken. */
  onOpenDailyGift?: () => void;
}) {
  const u = useUnlockText();
  const levelProgress = save.levelProgress;
  const attention = useContext(NavAttentionContext);
  const [expandedShortcut, setExpandedShortcut] = useState<string | null>(null);

  // Café progression (Phase 10A) — the restaurant rank card at the top left.
  const cafeProgress = getCafeProgress(levelProgress);
  const cafeMilestoneTitle =
    CAFE_MILESTONES.find((m) => m.id === cafeProgress.current)?.title ?? "Humble Kitchen";
  const rankNumber = Math.max(
    1,
    CAFE_MILESTONES.findIndex((m) => m.id === cafeProgress.current) + 1,
  );
  const nextRank = CAFE_MILESTONES.find((m) => m.id === cafeProgress.next) ?? null;

  // Kitchen upgrades (Phase 12B) — the background is the player's current
  // kitchen: always the highest tier reached, kept in step by
  // KitchenUpgradeManager.syncKitchenUpgradeOwnership (see src/game/kitchen/).
  const equippedUpgrade = kitchenUpgradeOrDefault(save.equippedKitchenUpgradeId);

  // Today's Order — a single compact card, not the full 50-level board
  // (§Part 1 "the level list must not permanently cover the Kitchen").
  const todayLevel = pickTodayLevel(levelProgress);
  const todayUnlocked = isUnlocked(todayLevel, levelProgress);
  const todayCompleted = isCompleted(todayLevel.id, levelProgress);
  const [orderCardExpanded, setOrderCardExpanded] = useState(false);
  // Every level cleared: say so plainly — there is no hidden content left.
  const campaignComplete = getLevels().every((l) => isCompleted(l.id, levelProgress));
  // Phase 1 (developer 2026-10-30): the restaurant build's one button opens the next service;
  // replays are on the Order Board only, and after the last service it opens the restaurant.
  const openService = RESTAURANT_MODE ? nextServiceLevel(levelProgress) : null;
  // First levels (restaurant build): a place that hasn't opened yet shows its level.
  const reached = restaurantLevelOf(levelProgress);
  const todayNumber = levelNumber(todayLevel.id);
  const tip =
    RESTAURANT_MODE && todayUnlocked && !todayCompleted ? grandmaTipFor(todayNumber) : null;
  const showDishIngredients =
    RESTAURANT_MODE &&
    todayUnlocked &&
    !todayCompleted &&
    todayNumber >= INGREDIENT_LIST_FROM &&
    hasLevelGoals(todayNumber);
  // The day clock (restaurant build): which phase of the day it is, and its light.
  const clock = RESTAURANT_MODE ? dayClockFor(save, reached) : null;
  const closedUntil = (id: ScreenId) =>
    RESTAURANT_MODE && !isTabOpen(id, reached) ? tabOpensAt(id) : null;

  // A returning player's first screen: once the Kitchen has actually mounted
  // (its lazily-loaded chunk is in), the game is interactive — tell the platform.
  // Idempotent; Preparation signals it instead for a brand-new player.
  useEffect(() => {
    gameReady();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <KitchenBackground skin={equippedUpgrade.asset} />
      {/* The day clock (restaurant build): the light of the next service's time of day,
          night at closing — an opacity-only tint over the same art (dayClock.ts). */}
      {clock ? (
        <div
          aria-hidden
          data-day-light={clock.light}
          className="pointer-events-none absolute inset-0 transition-[background] duration-700 motion-reduce:transition-none"
          style={{ background: DAY_LIGHT_TINT[clock.light] }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.42)_0%,transparent_22%,transparent_44%,rgba(62,40,25,0.55)_100%)]" />
      <DustMotes count={18} />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        {/* Phase 5 (B3): the daily gift sits under the rank, on the Kitchen's free wall. */}
        <div className="mr-2 flex min-w-0 max-w-[60%] shrink flex-col items-start gap-2 land:max-w-[64%] land:flex-row">
          <button
            type="button"
            onClick={() => {
              // Money waiting: straight to Achievements, where it's collected (developer 2026-10-18).
              if (closedUntil("rack") === null)
                go(collectableTotal(save) > 0 ? "achievements" : "rack");
            }}
            data-testid="kitchen-rank"
            // One line each, never wider than the room the wallet and Settings leave
            // (audit 2026-10-08: at 320 px it wrapped into the Kitchen Upgrade sign).
            className="press min-w-0 max-w-full shrink rounded-2xl border border-ivory/25 bg-walnut-dark/45 px-3 py-2 text-left backdrop-blur-sm"
          >
            {RESTAURANT_MODE ? (
              <CityRankBadge save={save} />
            ) : (
              <>
                {/* The restaurant's rank (developer 2026-10-08): which of the ranks it
                  holds, its name, the bar to the next one and when that comes. */}
                <p className="truncate whitespace-nowrap font-ui text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">
                  <span className="hidden min-[380px]:inline">Restaurant </span>rank · {rankNumber}/
                  {CAFE_MILESTONES.length}
                </p>
                <p className="truncate whitespace-nowrap font-display text-[15.5px] font-black leading-tight text-ivory">
                  🏆 {cafeMilestoneTitle}
                </p>
                <span className="mt-1.5 block h-[4px] w-24 overflow-hidden rounded-full bg-ivory/25">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(cafeProgress.progressFraction * 100)}%`,
                      background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
                    }}
                  />
                </span>
                <p className="mt-1 truncate whitespace-nowrap font-ui text-[10px] font-bold leading-none text-ivory/70">
                  {nextRank
                    ? `Next: ${nextRank.title} · ${u.lv(nextRank.levelRequired)}`
                    : "Highest rank reached"}
                </p>
              </>
            )}
            {collectableTotal(save) > 0 ? (
              <span
                data-testid="kitchen-achievements-waiting"
                className="mt-1.5 block truncate whitespace-nowrap rounded-full bg-gold/90 px-2 py-0.5 font-ui text-[11px] font-extrabold text-walnut-dark"
              >
                💰 {formatUsd(collectableTotal(save))} to collect
              </span>
            ) : null}
          </button>
          {onOpenDailyGift ? (
            <DailyGiftCard save={save} levelNumber={reached} onOpen={onOpenDailyGift} />
          ) : null}
          {RESTAURANT_MODE ? <NextKitchenStrip save={save} go={go} /> : null}
          {pendingCashTotal(save) > 0 && onCollectTableCash ? (
            <button
              type="button"
              data-testid="kitchen-table-cash"
              onClick={onCollectTableCash}
              className="press mt-1.5 min-h-12 w-full rounded-[14px] border border-gold/60 bg-gold/85 px-3 py-2 text-left font-ui text-[13px] font-extrabold text-walnut-dark shadow-soft"
            >
              💵 {formatUsd(pendingCashTotal(save))} on the table · Collect
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Coin n={save.credits} />
          {/* Settings — Phase 15 dissolved the Journal hub, so this is the
              one small persistent entry point Step 7 asks for ("keep
              accessible... do not create a new major navigation
              destination just for it") — a single icon, not a tab. */}
          <button
            type="button"
            onClick={() => go("settings")}
            aria-label="Settings"
            // 48x48dp Playables touch-target minimum (§2.17/§2.8) — was
            // 36x36. Same fix as ScreenHeader's Back button: grow the real
            // button box, glyph stays visually the same size, centered.
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ivory/25 bg-walnut-dark/45 text-ivory backdrop-blur-sm"
          >
            <span aria-hidden className="text-[15.5px]">
              ⚙️
            </span>
          </button>
        </div>
      </div>

      <div className="absolute right-3 top-[16%] z-20 flex flex-col items-end gap-2 [@media(max-height:700px)]:top-[13%] [@media(max-height:700px)]:gap-1.5 land:!top-[68px]">
        <button
          type="button"
          data-testid="daily-check-shortcut"
          aria-expanded={expandedShortcut === "daily-maintenance"}
          aria-label={
            attention.nav["restaurant-map"]
              ? `Daily Check, ${attention.nav["restaurant-map"]} ${attention.nav["restaurant-map"] === 1 ? "item needs" : "items need"} attention${expandedShortcut === "daily-maintenance" ? ". Tap again to open" : ". Tap to expand"}`
              : `Daily Check${expandedShortcut === "daily-maintenance" ? ". Tap again to open" : ". Tap to expand"}`
          }
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setExpandedShortcut("daily-maintenance");
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setExpandedShortcut(null);
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible"))
              setExpandedShortcut("daily-maintenance");
          }}
          onBlur={() => setExpandedShortcut(null)}
          onClick={() => {
            if (expandedShortcut !== "daily-maintenance") {
              setExpandedShortcut("daily-maintenance");
              return;
            }
            go("daily-maintenance");
          }}
          className={cn(
            "press group relative inline-flex h-14 w-14 shrink-0 items-center justify-start overflow-visible rounded-full border border-[#f5d58b] bg-[linear-gradient(145deg,#fff7dc_0%,#f5d998_100%)] px-2 font-ui text-walnut-dark shadow-[0_4px_0_rgba(111,66,28,0.48),0_7px_14px_rgba(35,18,8,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] transition-[width,border-radius,transform,box-shadow] duration-300 ease-out motion-reduce:transition-none hover:w-[166px] hover:rounded-full focus-visible:w-[166px] focus-visible:rounded-full active:translate-y-0.5 active:shadow-[0_2px_0_rgba(111,66,28,0.48),0_4px_8px_rgba(35,18,8,0.3)]",
            expandedShortcut === "daily-maintenance" && "w-[166px] rounded-full",
          )}
        >
          <span aria-hidden className="relative grid h-10 w-10 shrink-0 place-items-center">
            <span className="absolute inset-x-[5px] bottom-[2px] top-[5px] rounded-[6px] border-2 border-[#c88b30] bg-[linear-gradient(145deg,#ffe9a1,#e5ae49)] shadow-[0_2px_3px_rgba(91,48,12,0.28)]" />
            <span className="absolute left-[12px] top-[2px] z-[1] h-[6px] w-[12px] rounded-t-[4px] rounded-b-[2px] border border-[#ae7628] bg-[linear-gradient(180deg,#fff0b8,#d39a3a)]" />
            <span className="absolute bottom-[7px] left-[9px] right-[8px] top-[11px] rounded-[3px] bg-[#fff8e8] shadow-inner">
              <span className="absolute left-[3px] right-[2px] top-[4px] h-[2px] rounded-full bg-[#d9c49a]" />
              <span className="absolute left-[3px] right-[4px] top-[8px] h-[2px] rounded-full bg-[#e5d5b6]" />
            </span>
            <span className="absolute bottom-0 left-0 z-[2] grid h-[19px] w-[19px] place-items-center rounded-full border-2 border-[#fff2d0] bg-[linear-gradient(145deg,#45b5ff,#0876d5)] font-ui text-[11px] font-black leading-none text-white shadow-[0_2px_5px_rgba(0,54,115,0.45)]">
              ✓
            </span>
            <span className="absolute -right-0.5 top-0 text-[10px] leading-none text-[#e4ab37]">
              ✦
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "ml-0 max-w-0 overflow-hidden whitespace-nowrap text-left font-display text-[13px] font-black tracking-[0.01em] opacity-0 transition-[max-width,opacity,margin] duration-200 group-hover:ml-1 group-hover:max-w-[94px] group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:max-w-[94px] group-focus-visible:opacity-100",
              expandedShortcut === "daily-maintenance" && "ml-1 max-w-[94px] opacity-100",
            )}
          >
            Daily Check
          </span>
          <span
            aria-hidden
            className={cn(
              "ml-0 w-0 shrink-0 overflow-hidden text-center font-ui text-[17px] font-black leading-none text-[#82501f] opacity-0 transition-[width,opacity,margin] duration-200 group-hover:ml-1 group-hover:w-3 group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:w-3 group-focus-visible:opacity-100",
              expandedShortcut === "daily-maintenance" && "ml-1 w-3 opacity-100",
            )}
          >
            ›
          </span>
          {attention.nav["restaurant-map"] ? (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-[#fff0d2] bg-[#e53c32] font-ui text-[10px] font-black text-white shadow-md"
            >
              !
            </span>
          ) : null}
        </button>

        {(
          [
            { id: "inventory", label: "Inventory", glyph: "📦" },
            { id: "business", label: "Business", glyph: "📊" },
          ] as const
        ).map((item) => {
          const unlocked = isTabOpen(item.id, reached);
          const opensAt = unlocked ? null : tabOpensAt(item.id);
          const count = unlocked ? attention.nav[item.id] : undefined;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`${item.id}-shortcut`}
              aria-expanded={expandedShortcut === item.id}
              aria-label={
                !unlocked
                  ? `${item.label}, opens ${u.when(opensAt!)}${expandedShortcut === item.id ? ". Locked" : ". Tap to expand"}`
                  : count
                    ? `${item.label}, ${count} ${count === 1 ? "item needs" : "items need"} attention${expandedShortcut === item.id ? ". Tap again to open" : ". Tap to expand"}`
                    : `${item.label}${expandedShortcut === item.id ? ". Tap again to open" : ". Tap to expand"}`
              }
              aria-disabled={!unlocked || undefined}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setExpandedShortcut(item.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setExpandedShortcut(null);
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) setExpandedShortcut(item.id);
              }}
              onBlur={() => setExpandedShortcut(null)}
              onClick={() => {
                if (expandedShortcut !== item.id) {
                  setExpandedShortcut(item.id);
                  return;
                }
                if (unlocked) go(item.id);
              }}
              className={cn(
                "press group relative inline-flex h-14 w-14 shrink-0 items-center justify-start overflow-visible rounded-full border border-[#f5d58b] bg-[linear-gradient(145deg,#fff7dc_0%,#f5d998_100%)] px-2 font-ui text-[13px] font-extrabold text-walnut-dark shadow-[0_4px_0_rgba(111,66,28,0.48),0_7px_14px_rgba(35,18,8,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] transition-[width,border-radius,transform,box-shadow] duration-300 ease-out motion-reduce:transition-none hover:w-[166px] hover:rounded-full focus-visible:w-[166px] focus-visible:rounded-full active:translate-y-0.5 active:shadow-[0_2px_0_rgba(111,66,28,0.48),0_4px_8px_rgba(35,18,8,0.3)]",
                expandedShortcut === item.id && "w-[166px] rounded-full",
                !unlocked && "opacity-75",
              )}
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center text-[22px] leading-none"
              >
                {unlocked ? item.glyph : "🔒"}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "ml-0 max-w-0 overflow-hidden whitespace-nowrap text-left opacity-0 transition-[max-width,opacity,margin] duration-200 group-hover:ml-1 group-hover:max-w-[94px] group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:max-w-[94px] group-focus-visible:opacity-100",
                  expandedShortcut === item.id && "ml-1 max-w-[94px] opacity-100",
                )}
              >
                {unlocked ? item.label : u.lv(opensAt!)}
              </span>
              <span
                aria-hidden
                className={cn(
                  "ml-0 w-0 shrink-0 overflow-hidden text-center text-[19px] font-black leading-none text-[#82501f] opacity-0 transition-[width,opacity,margin] duration-200 group-hover:ml-1 group-hover:w-3 group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:w-3 group-focus-visible:opacity-100",
                  expandedShortcut === item.id && "ml-1 w-3 opacity-100",
                )}
              >
                ›
              </span>
              {count ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[#fff3db] bg-[#e53c32] font-ui text-[12px] font-black leading-none text-white shadow-md"
                >
                  !
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* The city-ranking badge above is the Kitchen screen's entry point
          for Restaurant Progress; Market remains in BottomNav. */}

      {/* Today's Order — collapsed by default so it keeps the kitchen visible;
          details and the order board expand on demand. */}
      <div className="absolute inset-x-0 bottom-[104px] z-20 px-6 land:bottom-3 land:left-4 land:right-[84px] land:mx-auto land:max-w-[640px] land:px-0">
        {clock ? (
          <p
            data-testid="day-strip"
            data-day-phase={clock.phase}
            className="mx-auto mb-2 w-fit max-w-full truncate rounded-full border border-ivory/25 bg-walnut-dark/70 px-3 py-1.5 font-ui text-[12.5px] font-extrabold text-ivory shadow-soft backdrop-blur-sm [@media(max-height:700px)]:mb-1 [@media(max-height:700px)]:px-2.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:text-[11px]"
          >
            {dayStripText(clock)}
          </p>
        ) : null}
        <div className="anim-up relative mx-auto rounded-[20px] border border-[#f3d9a9] bg-[linear-gradient(145deg,#fff9e9_0%,#fff0d0_52%,#f6dfb5_100%)] p-2.5 shadow-[0_7px_18px_rgba(34,18,8,0.38),inset_0_2px_0_rgba(255,255,255,0.9)] sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.19em] text-[#95602c]">
              {campaignComplete
                ? RESTAURANT_MODE
                  ? "🏆 Every recipe learned"
                  : `Campaign Complete · ${LAST_CAMPAIGN_LEVEL} Levels Mastered`
                : RESTAURANT_MODE
                  ? "Next customer"
                  : "Today's Order"}
            </p>
            <button
              type="button"
              aria-expanded={orderCardExpanded}
              aria-controls="kitchen-order-details"
              onClick={() => setOrderCardExpanded((expanded) => !expanded)}
              className="press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[#8f4d1e] bg-[linear-gradient(145deg,#a85d25,#754018)] px-2.5 font-ui text-[10px] font-extrabold text-[#fff5df] shadow-[0_2px_6px_rgba(83,41,13,0.32),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
            >
              {orderCardExpanded ? "Hide Details" : "View Details"}
              <span aria-hidden className="text-[14px] leading-none">
                {orderCardExpanded ? "⌃" : "›"}
              </span>
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className={`min-w-0 flex-1 ${todayUnlocked ? "" : "opacity-50"}`}>
              <p className="line-clamp-2 font-display text-[18px] font-black leading-[1.06] text-[#392013] sm:text-[20px]">
                {todayLevel.title}
              </p>
              <p className="mt-0.5 font-hand text-[13px] italic leading-snug text-[#795a3a] sm:text-[14px]">
                {campaignComplete
                  ? RESTAURANT_MODE
                    ? "📖 every recipe is yours · 🍽️ the restaurant runs on"
                    : "📖 every recipe is yours · 🔁 replay or 🍽️ run the restaurant"
                  : openService
                    ? `ready · ${payText(save, todayLevel)}`
                    : !todayUnlocked
                      ? "locked · finish the level before it"
                      : todayCompleted
                        ? "prepared already · replay pays nothing"
                        : `ready to prepare · ${payText(save, todayLevel)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                role="img"
                aria-label={`${todayLevel.title} dish`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#edd8b4] bg-[radial-gradient(circle_at_35%_28%,#fffdf5,#ecdcbf)] text-[26px] shadow-[0_3px_6px_rgba(92,56,25,0.18),inset_0_2px_3px_rgba(255,255,255,0.9)] sm:h-12 sm:w-12"
              >
                {todayUnlocked ? todayLevel.emoji : "🔒"}
              </span>
              {RESTAURANT_MODE ? (
                <KButton
                  variant="sage"
                  className="min-h-[48px] rounded-[14px] px-3 font-ui text-[12px] font-extrabold shadow-[0_3px_7px_rgba(36,62,37,0.24)] sm:px-4 sm:text-[13px]"
                  onClick={() => {
                    if (!openService) return go("business");
                    onSelectLevel(openService.id);
                    go("gameplay");
                  }}
                >
                  {openService ? "Open for service" : "🍽️ Run the restaurant"}
                </KButton>
              ) : (
                <KButton
                  // Prepare (a new order) is the green "go" button; Replay is a quiet
                  // outlined one, so the two never look alike (developer 2026-10-08).
                  variant={todayCompleted ? "ghost" : "sage"}
                  className="min-h-[42px] rounded-[14px] px-3 font-ui text-[12px] font-extrabold shadow-[0_3px_7px_rgba(36,62,37,0.24)] sm:px-4 sm:text-[13px]"
                  disabled={!todayUnlocked}
                  onClick={() => {
                    if (!todayUnlocked) return;
                    onSelectLevel(todayLevel.id);
                    go("gameplay");
                  }}
                >
                  {todayCompleted ? "Replay" : "Prepare"}
                </KButton>
              )}
            </div>
          </div>
          <div
            id="kitchen-order-details"
            hidden={!orderCardExpanded}
            className={orderCardExpanded ? "anim-up" : undefined}
          >
            {/* First levels (Levels 1–15): Grandma says what's new; her action
                  stays beside the order-board link when the details are open. */}
            {tip ? (
              <p
                className="mt-2 rounded-xl bg-gold/15 px-2.5 py-1 font-hand text-[14px] leading-snug text-walnut-dark [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:py-0.5 [@media(max-height:700px)]:text-[12px]"
                data-testid="kitchen-tip"
              >
                👵 {tip.text}
              </p>
            ) : null}
            {showDishIngredients ? <DishIngredientsToggle save={save} level={todayLevel} /> : null}
            <div className="mt-2.5 flex gap-2">
              <KButton variant="cream" size="sm" full className="h-12" onClick={() => go("board")}>
                See all orders →
              </KButton>
              {tip?.to && tip.button ? (
                <KButton
                  size="sm"
                  variant="copper"
                  full
                  className="h-12"
                  onClick={() =>
                    tip.focus === "ingredients" ? openMarketIngredients(go) : go(tip.to!)
                  }
                >
                  {tip.button}
                </KButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

export function OrderBoard({
  go,
  save,
  onSelectLevel,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onSelectLevel: (levelId: string) => void;
}) {
  const u = useUnlockText();
  const levelProgress = save.levelProgress;
  const levels = getLevels();
  // The most recently-reached milestone, not just the highest chapter's —
  // finding the LAST (highest campaign-order) completed level that set one
  // means this naturally picks up Level 10/20/30's milestones as each is
  // reached, with no per-milestone UI code.
  const latestMilestone = [...levels]
    .reverse()
    .find((l) => l.milestone && isCompleted(l.id, levelProgress));
  // After the final level there is nothing left to unlock, so the per-row
  // "Next/Reward" previews (which describe early-game unlocks) give way to
  // one completion card. Before that, the hints are unchanged.
  const campaignComplete = levels.every((l) => isCompleted(l.id, levelProgress));
  // Everything unlocked, then the first locked level as a mystery; the rest are only counted.
  const firstLocked = levels.findIndex((l) => !isUnlocked(l, levelProgress));
  const visibleLevels = firstLocked === -1 ? levels : levels.slice(0, firstLocked + 1);
  const hiddenCount = levels.length - visibleLevels.length;
  // The level to play next: the first unlocked one not yet completed.
  const nextLevelId = visibleLevels.find(
    (l) => isUnlocked(l, levelProgress) && !isCompleted(l.id, levelProgress),
  )?.id;
  // Open the board on that level — as levels are completed it would
  // otherwise sit below the fold under the finished ones.
  useEffect(() => {
    if (!nextLevelId) return;
    document
      .querySelector(`[data-level-row="${nextLevelId}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [nextLevelId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 wood opacity-90" />
      <div className="absolute inset-2 rounded-[26px] paper shadow-lift" />
      <div className="relative flex h-full flex-col pb-24">
        <ScreenHeaderBoard
          go={go}
          credits={save.credits}
          latestMilestone={latestMilestone?.milestone}
        />
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
          {/* Corrective pass — the only entry points to Daily Order/
              Endless Service. Placed here (a scrollable screen with real
              room) rather than the Kitchen home card, which is already
              tightly bottom-anchored against BottomNav (see its own
              comment on a previous clipping bug). */}
          {campaignComplete ? (
            <div className="mb-3 rounded-[16px] border border-gold/50 bg-gold/20 p-3 text-center">
              <p className="font-display text-[17.5px] font-black leading-tight text-walnut-dark">
                🏆 Campaign Complete
              </p>
              <p className="mt-0.5 font-hand text-[15px] leading-snug text-walnut/75">
                All {levels.length} levels mastered · 🔁 replay or 🍽️ run the restaurant
              </p>
            </div>
          ) : null}
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => go("daily")}
              className="press rounded-[16px] border border-copper/30 bg-gold/15 p-3 text-left"
            >
              <span className="block text-[20px]">📅</span>
              <span className="mt-1 block font-display text-[13.5px] font-black text-walnut-dark">
                Today's Special
              </span>
              <span className="block font-hand text-[13px] text-walnut/60">one featured order</span>
            </button>
            <button
              type="button"
              // Once the campaign is complete, the restaurant carries on as Endless
              // Restaurant (the Business engine, opened from the Business tab).
              onClick={() => go(RESTAURANT_MODE ? "business" : "endless")}
              data-testid="endless-tile"
              className="press rounded-[16px] border border-sage/40 bg-sage/15 p-3 text-left"
            >
              <span className="block text-[20px]">🍽️</span>
              <span className="mt-1 block font-display text-[13.5px] font-black text-walnut-dark">
                {RESTAURANT_MODE ? ENDLESS_RESTAURANT_NAME : "Endless Service"}
              </span>
              <span className="block font-hand text-[13px] text-walnut/60">
                {!isEndlessUnlocked(levelProgress)
                  ? `🔒 unlocks ${u.final}`
                  : RESTAURANT_MODE
                    ? "your restaurant, open every day"
                    : `ongoing earnings · up to ${formatUsd(ENDLESS_DAILY_COIN_CAP).replace(/\.00$/, "")}/day`}
              </span>
            </button>
            {/* Phase 3 (B): Endless Prep Rush — an optional arcade challenge on
                its own screen, open from the start; it pays nothing and saves nothing. */}
            <button
              type="button"
              onClick={() => go("prep-rush")}
              data-testid="prep-rush-tile"
              className="press col-span-2 flex items-center gap-3 rounded-[16px] border border-copper/30 bg-copper/10 px-3 py-2.5 text-left"
            >
              <span className="text-[20px]">🏃</span>
              <span className="min-w-0">
                <span className="block font-display text-[13.5px] font-black text-walnut-dark">
                  Prep Rush
                </span>
                <span className="block font-hand text-[13px] text-walnut/60">
                  cut the conveyor clean · just for fun
                </span>
              </span>
            </button>
          </div>
          <div className="space-y-2.5">
            {visibleLevels.map((level, i) => {
              const unlocked = isUnlocked(level, levelProgress);
              // Upcoming levels stay a surprise: only finished levels, the
              // current one and ONE locked "Upcoming Order" are listed — no
              // name, dish, ingredient or chapter theme until it unlocks.
              if (!unlocked) {
                const newChapter = i === 0 || level.chapter !== visibleLevels[i - 1]!.chapter;
                return (
                  <div key={level.id}>
                    {newChapter ? (
                      <p className="pb-1 pt-1.5 font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-walnut/50">
                        Chapter {level.chapter} · ???
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-dashed border-walnut/20 bg-ivory/30 p-2.5">
                      <div className="opacity-60">
                        <p className="font-display text-[16.5px] font-black leading-none text-walnut-dark">
                          Upcoming Order
                        </p>
                        <p className="font-hand text-[14px] leading-tight text-walnut/70">
                          🔒 finish the level above
                        </p>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-walnut/10 text-[18px]">
                        🔒
                      </span>
                    </div>
                  </div>
                );
              }
              const canOpen = unlocked;
              const completed = isCompleted(level.id, levelProgress);
              const prevChapter = i > 0 ? visibleLevels[i - 1]!.chapter : null;
              const showChapterDivider = level.chapter !== prevChapter;
              // Difficulty is a pre-play word estimate
              // (levelMastery.describeDifficulty), never a performance
              // score — no stars, no percentage mastery anywhere on this
              // screen. "prepared already" above already covers
              // completion in plain words; this row is just the pre-play
              // difficulty word and the reward preview.
              const difficulty = describeDifficulty(level);
              // This level's OWN reward (level.unlockReward, ~a dozen
              // levels — see levelTypes.ts) takes priority when present;
              // every other level falls back to the derived "what's next"
              // timeline so the player always sees something truthful,
              // never a fabricated per-level reward.
              // Only while it is still true (liveUnlockReward: since every knife and board
              // is for sale by Level 5, a later level's knife no longer "unlocks" there).
              const ownUnlock = liveUnlockReward(level);
              const ownReward = ownUnlock
                ? {
                    atLevel: levelNumber(level.id),
                    name: ownUnlock.name,
                    icon: REWARD_TYPE_ICON[ownUnlock.type],
                  }
                : null;
              const nextReward = ownReward ?? getNextRewardPreview(levelNumber(level.id));
              // A knife or board a level "unlocks" becomes BUYABLE in the Market —
              // it is never handed over, so the row says so rather than "Reward".
              const marketUnlock = ownUnlock?.type === "knife" || ownUnlock?.type === "board";
              const rewardLabel = ownReward ? "Unlocks" : "Next";
              // A row showing its OWN reward would otherwise hide a kitchen
              // background unlocking right behind it (Lv 40 Cleaver → Lv 41
              // Established Kitchen), so that one case gets a second hint.
              const stageAfter = ownReward
                ? getNextKitchenStagePreview(levelNumber(level.id))
                : null;
              return (
                <div key={level.id} data-level-row={level.id}>
                  {showChapterDivider ? (
                    <p className="pb-1 pt-1.5 font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-walnut/50">
                      Chapter {level.chapter} · {CHAPTER_TITLES[level.chapter] ?? level.chapterId}
                    </p>
                  ) : null}
                  <div className="flex items-end justify-between gap-3 rounded-[16px] border border-walnut/10 bg-ivory/40 p-2.5">
                    <div className={canOpen ? undefined : "opacity-50"}>
                      <p className="font-display text-[16.5px] font-black leading-none text-walnut-dark">
                        {level.title}
                      </p>
                      <p className="font-hand text-[14px] leading-tight text-walnut/70">
                        {!unlocked
                          ? "locked · finish the level before it"
                          : completed
                            ? "prepared already · replay pays nothing"
                            : `ready to prepare · ${payText(save, level)}`}
                      </p>
                      {/* Pass 3 (Levels 1–15): the best stars — the engine's own grade
                          on the dish, never money (levelGoals.ts). */}
                      {RESTAURANT_MODE && completed && hasLevelGoals(levelNumber(level.id))
                        ? (() => {
                            const stars = levelStars(save, level);
                            return stars === null ? null : (
                              <p
                                className="font-ui text-[12px] font-extrabold text-copper"
                                data-level-stars={stars}
                              >
                                {starText(stars)}{" "}
                                <span className="font-bold text-walnut/55">
                                  best ·{" "}
                                  {stars === 0 ? "keep practising" : STAR_GRADES[stars - 1]!.grade}
                                </span>
                              </p>
                            );
                          })()
                        : null}
                      {RESTAURANT_MODE &&
                      canOpen &&
                      !completed &&
                      levelNumber(level.id) >= INGREDIENT_LIST_FROM &&
                      hasLevelGoals(levelNumber(level.id)) ? (
                        <DishIngredientsToggle save={save} level={level} />
                      ) : null}
                      {canOpen && !completed ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span className="font-ui text-[11px] font-bold text-walnut/45">
                            {difficulty}
                          </span>
                          {nextReward && !campaignComplete ? (
                            <span className="font-ui text-[11px] font-bold text-copper/80">
                              {nextReward.icon} {rewardLabel}: {nextReward.name}
                              {ownReward
                                ? marketUnlock
                                  ? " in the Market"
                                  : ""
                                : `${opensInMarket(nextReward) ? " in the Market" : ""} · ${u.lv(nextReward.atLevel)}`}
                            </span>
                          ) : null}
                          {stageAfter && !campaignComplete ? (
                            <span className="font-ui text-[11px] font-bold text-copper/80">
                              {stageAfter.icon} Next: {stageAfter.name} · {u.lv(stageAfter.atLevel)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[20px]">{canOpen ? level.emoji : "🔒"}</span>
                      <KButton
                        size="sm"
                        variant={completed ? "ghost" : "sage"}
                        disabled={!canOpen}
                        onClick={() => {
                          if (!canOpen) return;
                          onSelectLevel(level.id);
                          go("gameplay");
                        }}
                      >
                        {completed ? "Replay" : "Prepare"}
                      </KButton>
                    </div>
                  </div>
                </div>
              );
            })}
            {hiddenCount > 0 ? (
              <p className="pt-1 text-center font-hand text-[16px] text-walnut/55">
                + {hiddenCount} more {hiddenCount === 1 ? "order" : "orders"} to discover
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <BottomNav active={null} go={go} />
    </div>
  );
}

/** A thin local header (matching ScreenHeader's own look) so OrderBoard can show the QA/milestone pills the old inline panel had, without ScreenHeader needing a new prop just for this one screen. Phase 15 — also the Recipe Book's one remaining entry point (Step 8): the Recipe Book is real and still fully routed, it's just no longer a primary bottom-nav tab, and "order details" (this full order list) is its natural, uncluttered home. */
function ScreenHeaderBoard({
  go,
  credits,
  latestMilestone,
}: {
  go: (s: ScreenId) => void;
  credits: number;
  latestMilestone?: string | undefined;
}) {
  return (
    // Buttons + wallet on the top row; the title and its pills get the full
    // width below, so neither truncates nor collides with the icons on a
    // 320px phone. Buttons are 48px (the Playables touch-target minimum).
    <header className="px-4 pb-2 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go("kitchen")}
          aria-label="Back"
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-walnut shadow-soft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => go("recipes")}
          aria-label="Recipe Book"
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-[18px] text-walnut shadow-soft"
        >
          📖
        </button>
        <Coin n={credits} />
      </div>
      <h1 className="mt-2 font-display text-[24px] font-black leading-none tracking-tight text-walnut-dark">
        Today's Board
      </h1>
      {latestMilestone ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-sage/25 px-2 py-[2px] font-ui text-[10px] font-extrabold uppercase tracking-[0.1em] text-olive">
            ✦ {latestMilestone} unlocked
          </span>
        </div>
      ) : null}
    </header>
  );
}

/**
 * Pass 3 (Levels 9–15): the dish's own ingredients before cooking — its
 * planned use next to what the fridge holds (levelGoals.dishIngredientsFor).
 * Read-only: opening it buys, uses or changes nothing.
 */
function DishIngredientsToggle({ save, level }: { save: SaveData; level: LevelDefinition }) {
  const [open, setOpen] = useState(false);
  const measure = measureOf(save);
  return (
    <div className="mt-1" data-testid="dish-ingredients">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex min-h-12 items-center gap-1 rounded-full border border-walnut/15 px-3 font-ui text-[12.5px] font-extrabold text-walnut-dark card-warm"
      >
        🧾 {open ? "Hide ingredients" : "What's in this dish?"}
      </button>
      {open ? (
        <div className="mt-1 space-y-1" data-testid="dish-ingredients-list">
          {dishIngredientsFor(save, level).map((d) => (
            <div key={d.dish}>
              <p className="font-ui text-[12px] font-extrabold text-walnut/70">{d.dish}</p>
              <ul>
                {d.rows.map((r) => (
                  <li
                    key={r.ingredientId}
                    data-dish-ingredient={r.ingredientId}
                    className="font-ui text-[12.5px] text-walnut-dark"
                  >
                    {INGREDIENT_EMOJI[r.ingredientId]} {INGREDIENTS[r.ingredientId].name} ·{" "}
                    {formatStockAmount(r.ingredientId, r.need, measure)}
                    <span className={r.have >= r.need ? "text-olive" : "text-tomato"}>
                      {" "}
                      (fridge: {formatStockAmount(r.ingredientId, r.have, measure)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Bottom navigation ─────────────────────────────────── */

const NAV: { id: ScreenId; label: string; glyph: string }[] = [
  { id: "kitchen", label: "Kitchen", glyph: "🏠" },
  { id: "shop", label: "Market", glyph: "🛒" },
  { id: "restaurant-map", label: "Restaurant", glyph: "🍽️" },
];

/**
 * `active` = the bottom-bar section the screen belongs to, or null for a
 * screen that is none of the three (the Order Board: Level 1–10 UX pass — it
 * used to light up Kitchen, as if the player were on the Kitchen home).
 */
export function BottomNav({ active, go }: { active: ScreenId | null; go: (s: ScreenId) => void }) {
  const u = useUnlockText();
  // First levels (restaurant build): a section that hasn't opened shows a lock
  // and its level; a tap says when it opens (game/restaurant/firstLevels.ts).
  const reached = useContext(NavLevelContext);
  const attention = useContext(NavAttentionContext);
  // Grandma points at a section that just opened (firstLevels.ts SECTION_POINTER).
  const guide = useContext(NavGuideContext);
  const pointer = guide && active === "kitchen" ? guide : null;
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 2200);
    return () => window.clearTimeout(t);
  }, [hint]);
  return (
    // Phone landscape: the bar becomes a rail down the left edge (styles.css pads the screen).
    <nav
      data-bottom-nav
      className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-walnut-dark/40 bg-[linear-gradient(180deg,rgba(62,40,25,0.82),rgba(45,41,36,0.95))] px-2 pb-3 pt-2 backdrop-blur-sm land:inset-x-auto land:inset-y-0 land:left-0 land:w-[var(--kc-rail)] land:flex-col land:justify-center land:gap-3 land:border-r land:border-t-0 land:bg-[linear-gradient(90deg,rgba(62,40,25,0.9),rgba(45,41,36,0.96))] land:px-1 land:py-2"
    >
      {/* Every screen with the bottom bar: "▾ More" / "▴ Top" for a list longer than the screen. */}
      <ScrollCue hidden={!!hint || !!pointer} />
      {hint ? (
        <p
          role="status"
          data-testid="nav-lock-hint"
          className="anim-up pointer-events-none absolute inset-x-4 bottom-full mb-2 land:inset-x-auto land:bottom-4 land:left-full land:mb-0 land:ml-2 land:w-max land:max-w-[300px] rounded-full border border-walnut-dark/40 bg-walnut-dark/90 px-4 py-2 text-center font-ui text-[13.5px] font-extrabold text-ivory shadow-lift"
        >
          {hint}
        </p>
      ) : null}
      {pointer ? (
        <div
          data-testid="section-pointer"
          data-pointer-tab={pointer.tab}
          className="anim-up absolute inset-x-0 bottom-full h-[1200px] bg-[rgba(30,20,12,0.55)] land:inset-x-auto land:inset-y-0 land:bottom-auto land:left-full land:h-auto land:w-[2000px]"
        >
          <div className="paper absolute inset-x-4 bottom-[64px] rounded-3xl p-4 shadow-lift land:inset-x-auto land:bottom-4 land:left-4 land:w-[340px]">
            <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
              {SECTION_POINTER[pointer.tab].title}
            </p>
            <p className="mt-1 font-hand text-[16px] leading-snug text-walnut">
              👵 “{SECTION_POINTER[pointer.tab].line}”
            </p>
            <div className="mt-3 flex gap-2">
              <KButton variant="ghost" className="min-h-12 flex-1" onClick={pointer.dismiss}>
                Later
              </KButton>
              <KButton
                variant="copper"
                className="min-h-12 flex-[2]"
                onClick={() =>
                  pointer.tab === "shop" ? openMarketIngredients(go) : go(pointer.tab)
                }
              >
                Show me →
              </KButton>
            </div>
          </div>
        </div>
      ) : null}
      {NAV.map((n) => {
        const on = n.id === active;
        const pointed = pointer?.tab === n.id;
        const opensAt =
          RESTAURANT_MODE && reached !== null && !isTabOpen(n.id, reached)
            ? tabOpensAt(n.id)
            : null;
        const locked = opensAt !== null;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => (locked ? setHint(`🔒 ${n.label} opens ${u.when(opensAt!)}`) : go(n.id))}
            aria-label={
              locked
                ? `${n.label}, opens ${u.when(opensAt!)}`
                : attention.nav[n.id]
                  ? `${n.label}, ${attention.nav[n.id]} ${attention.nav[n.id] === 1 ? "item needs" : "items need"} attention`
                  : undefined
            }
            data-nav={n.id}
            data-locked={locked || undefined}
            className={cn(
              "press relative flex min-h-12 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 land:min-h-[54px] land:min-w-[60px]",
              pointer && !pointed && "opacity-40",
              pointed && "ring-2 ring-gold",
            )}
            style={
              on || pointed
                ? { background: pointed ? "rgba(246,232,204,0.22)" : "rgba(246,232,204,0.14)" }
                : undefined
            }
          >
            {pointed ? (
              // The glove's fingertip rests on the tab's icon (PointerHand: x 30/64, y 6/80),
              // tilted around it so the hand leans off the tab's name.
              <span
                data-testid="pointer-hand"
                className="pointer-events-none absolute left-1/2 top-2 z-10 -ml-[20px]"
                style={{ transformOrigin: "20px 4px", transform: "rotate(-24deg)" }}
              >
                <PointerHand size={42} />
              </span>
            ) : null}
            {/* First levels: a section that just opened says so for two levels. */}
            {RESTAURANT_MODE && !locked && reached !== null && isTabNew(n.id, reached) ? (
              <span
                data-nav-new
                className="absolute -top-1 right-0 rounded-full bg-copper px-1.5 font-ui text-[11px] font-extrabold leading-[15px] text-ivory shadow-soft"
              >
                NEW
              </span>
            ) : null}
            {!locked && attention.nav[n.id] ? (
              <span
                aria-hidden="true"
                title={`${attention.nav[n.id]} ${attention.nav[n.id] === 1 ? "item needs" : "items need"} attention`}
                className="absolute -right-0.5 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full border border-[#fff0d0] bg-[#d83b2e] font-ui text-[12px] font-black leading-none text-white shadow-[0_2px_5px_rgba(0,0,0,0.55)]"
              >
                !
              </span>
            ) : null}
            <span
              className="text-[17.5px]"
              style={{
                filter: on ? "none" : "grayscale(0.5)",
                opacity: locked ? 0.6 : on ? 1 : 0.72,
              }}
            >
              {locked ? (
                <span className="whitespace-nowrap font-ui text-[11px] font-extrabold text-ivory">
                  {u.badge(opensAt!)}
                </span>
              ) : (
                n.glyph
              )}
            </span>
            <span
              className="font-ui text-[11px] font-extrabold leading-[14px] tracking-wide"
              style={{
                color: on
                  ? "var(--color-gold)"
                  : locked
                    ? "rgba(246,232,204,0.42)"
                    : "rgba(246,232,204,0.62)",
              }}
            >
              {n.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The Kitchen's top-left card in the restaurant build (developer 2026-10-09):
 * the restaurant's place in the city guide, a bar to the next rival and who
 * that is (restaurant/cityRanking.ts). Opens Restaurant Progress.
 */
/**
 * The next kitchen upgrade (Transformation Phase C): its existing name, price and
 * level, and the wallet's progress towards it. Read-only — building happens on
 * the Kitchen Upgrades screen it opens. Hidden once every tier is built.
 */
function NextKitchenStrip({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const u = useUnlockText();
  const next = nextKitchenUpgrade(save);
  if (!next) return null;
  const pct = Math.round(next.progress * 100);
  return (
    <button
      type="button"
      onClick={() => go("kitchen-upgrades")}
      data-testid="next-kitchen-strip"
      data-state={next.ready ? "ready" : next.state}
      aria-label={`Next kitchen: ${next.name}, ${formatUsd(next.price)}${next.state === "locked" ? `, opens ${u.when(next.unlockLevel)}` : ""}. You have ${formatUsd(save.credits)}.`}
      className="press min-h-12 w-[188px] max-w-full rounded-2xl border border-ivory/25 bg-walnut-dark/45 px-3 py-1.5 text-left backdrop-blur-sm"
    >
      <p className="truncate whitespace-nowrap font-ui text-[11px] font-extrabold text-gold">
        🏠 {next.name}
      </p>
      <span className="mt-1 block h-[5px] overflow-hidden rounded-full bg-ivory/25">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
          }}
        />
      </span>
      {/* The price always shows in full; the status sits beside it (320 px: the name may truncate, never the price). */}
      <p className="mt-1 flex items-center justify-between gap-1.5 whitespace-nowrap font-ui text-[11px] font-bold leading-none text-ivory/80">
        <span>{formatUsd(next.price)}</span>
        <span className={next.ready ? "text-gold" : undefined}>
          {next.ready ? "✓ Ready" : next.state === "locked" ? u.badge(next.unlockLevel) : `${pct}%`}
        </span>
      </p>
    </button>
  );
}

function CityRankBadge({ save }: { save: SaveData }) {
  const u = useUnlockText();
  const c = cityRanking(save);
  return (
    <>
      <p className="truncate whitespace-nowrap font-ui text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">
        City ranking
      </p>
      <p className="truncate whitespace-nowrap font-display text-[15.5px] font-black leading-tight text-ivory">
        🏆 #{c.rank} <span className="text-ivory/70">of {c.total}</span>
      </p>
      <span className="mt-1.5 block h-[4px] w-24 overflow-hidden rounded-full bg-ivory/25">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.round(c.fraction * 100)}%`,
            background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
          }}
        />
      </span>
      <p className="mt-1 truncate whitespace-nowrap font-ui text-[10px] font-bold leading-none text-ivory/70">
        {c.next
          ? `Next: pass ${c.next.name} · ${u.lv(c.next.passedAtLevel)}`
          : "The city's best restaurant"}
      </p>
    </>
  );
}
