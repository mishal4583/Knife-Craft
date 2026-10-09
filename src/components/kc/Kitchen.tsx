import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { ENDLESS_RESTAURANT_NAME } from "@/game/restaurant/endlessRestaurant";
import { useEffect } from "react";
import { ENDLESS_DAILY_COIN_CAP, isEndlessUnlocked } from "@/game/daily/EndlessServiceManager";
import { paidLevelReward } from "@/game/levels/levelRewards";
import { levelPayPreview } from "@/game/restaurant/levelPayPreview";
import type { LevelDefinition } from "@/game/levels/levelTypes";
import { KButton, Coin, DustMotes } from "./common/primitives";
import { gameReady } from "@/game/PlayablesSDK";
import { dollars, formatUsd, formatUsdChange } from "@/game/money";
import { KitchenBackground } from "./KitchenBackground";
import type { ScreenId } from "./data";
import { getLevels, isUnlocked, isCompleted, type LevelProgress } from "@/game/levels/LevelManager";
import { CHAPTER_TITLES } from "@/game/levels/levelDefinitions";
import {
  describeDifficulty,
  getNextKitchenStagePreview,
  getNextRewardPreview,
  opensInMarket,
  levelNumber,
} from "@/game/levels/levelMastery";
import { getCafeProgress } from "@/game/cafe/CafeProgressionManager";
import { CAFE_MILESTONES } from "@/game/cafe/cafeDefinitions";
import { kitchenUpgradeOrDefault } from "@/game/kitchen/kitchenUpgradeDefinitions";
import type { SaveData } from "@/game/SaveManager";

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
}: {
  label: string;
  sub: string;
  style: React.CSSProperties;
  /** Vertical placement classes — short phones (< 700px tall) move a hotspot so the HUD / Today's Order card never covers it. */
  position: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`press absolute ${position} -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ivory/25 bg-walnut-dark/40 px-3 py-1.5 text-left backdrop-blur-[3px] shadow-soft`}
    >
      <span className="block font-display text-[14.5px] font-black leading-none text-ivory">
        {label}
      </span>
      <span className="block font-hand text-[15px] leading-tight text-gold/90">{sub}</span>
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
  return pay ? `about ${formatUsdChange(pay.total)}` : formatUsdChange(paidLevelReward(level));
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

export function Kitchen({
  go,
  save,
  onSelectLevel,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onSelectLevel: (levelId: string) => void;
}) {
  const levelProgress = save.levelProgress;

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
  // Every level cleared: say so plainly — there is no hidden content left.
  const campaignComplete = getLevels().every((l) => isCompleted(l.id, levelProgress));

  // A returning player's first screen: once the Kitchen has actually mounted
  // (its lazily-loaded chunk is in), the game is interactive — tell the platform.
  // Idempotent; Preparation signals it instead for a brand-new player.
  useEffect(() => {
    gameReady();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <KitchenBackground skin={equippedUpgrade.asset} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.42)_0%,transparent_22%,transparent_44%,rgba(62,40,25,0.55)_100%)]" />
      <DustMotes count={18} />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <button
          type="button"
          onClick={() => go("rack")}
          data-testid="kitchen-rank"
          // One line each, never wider than the room the wallet and Settings leave
          // (audit 2026-10-08: at 320 px it wrapped into the Kitchen Upgrade sign).
          className="press mr-2 min-w-0 max-w-[60%] shrink rounded-2xl border border-ivory/25 bg-walnut-dark/45 px-3 py-2 text-left backdrop-blur-sm"
        >
          {/* The restaurant's rank (developer 2026-10-08): which of the ranks it
              holds, its name, the bar to the next one and when that comes. */}
          <p className="truncate whitespace-nowrap font-ui text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-gold">
            <span className="hidden min-[380px]:inline">Restaurant </span>rank · {rankNumber}/
            {CAFE_MILESTONES.length}
          </p>
          <p className="truncate whitespace-nowrap font-display text-[16.5px] font-black leading-tight text-ivory">
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
          <p className="mt-1 truncate whitespace-nowrap font-ui text-[10.5px] font-bold leading-none text-ivory/70">
            {nextRank
              ? `Next: ${nextRank.title} · Lv ${nextRank.levelRequired}`
              : "Highest rank reached"}
          </p>
        </button>
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
            <span aria-hidden className="text-[16.5px]">
              ⚙️
            </span>
          </button>
        </div>
      </div>

      {/* Environment hotspots — Phase 15 consolidated the previous five
          (Knife Rack, Recipe Board, Boards, Workshop, Journal) down to
          the three real management destinations, kept at three of the
          same, already-tested screen positions so the layout doesn't
          shift, just simplifies. */}
      <Hotspot
        label="Progress"
        sub="your restaurant so far"
        style={{ left: "26%" }}
        position="top-[35%]"
        onClick={() => go("rack")}
      />
      <Hotspot
        label="Market"
        sub="tools, ingredients & suppliers"
        style={{ left: "76%" }}
        position="top-[50%] [@media(max-height:700px)]:top-[40%]"
        onClick={() => go("shop")}
      />
      <Hotspot
        label="Kitchen Upgrade"
        sub="improve your kitchen"
        style={{ left: "50%" }}
        position="top-[17%] [@media(max-height:700px)]:top-[26%]"
        onClick={() => go("kitchen-upgrades")}
      />

      {/* Today's Order — one compact card, the kitchen stays the main
          visual (§Part 1's visual priority: environment > HUD/hotspots >
          current order > secondary panels). The full level board opens
          as its own screen via "See all orders".
          Phase 12C — the card sat on a fixed `bottom-[86px]` offset that
          only cleared BottomNav's real rendered height (~75px) by ~11px;
          on real devices (different emoji/font metrics, safe-area insets)
          that margin was thin enough for "See all orders" — the card's
          last line — to clip under the nav. Bumped to a comfortably safe
          fixed offset and trimmed the card's own padding a touch so the
          whole card, footer button included, always clears the nav with
          real headroom instead of a razor-thin margin. No scrolling, no
          smaller type — same card, same style, more breathing room. */}
      <div className="absolute inset-x-0 bottom-[104px] z-20 px-5">
        <div className="paper anim-up relative mx-auto -rotate-[0.8deg] rounded-[18px] border border-walnut/20 p-3.5 shadow-lift">
          <div className="flex items-center justify-between">
            <p className="font-ui text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-copper">
              {campaignComplete ? "Campaign Complete · 250 Levels Mastered" : "Today's Order"}
            </p>
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className={todayUnlocked ? undefined : "opacity-50"}>
              <p className="line-clamp-2 font-display text-[18px] font-black leading-none text-walnut-dark">
                {todayLevel.title}
              </p>
              <p className="font-hand text-[16px] leading-tight text-walnut/70">
                {campaignComplete
                  ? "every recipe is yours · replay any level or run your restaurant"
                  : !todayUnlocked
                    ? "locked · finish the level before it"
                    : todayCompleted
                      ? "prepared already · replay pays nothing"
                      : `ready to prepare · ${payText(save, todayLevel)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[24px]">{todayUnlocked ? todayLevel.emoji : "🔒"}</span>
              <KButton
                // Prepare (a new order) is the green "go" button; Replay is a quiet
                // outlined one, so the two never look alike (developer 2026-10-08).
                variant={todayCompleted ? "ghost" : "sage"}
                disabled={!todayUnlocked}
                onClick={() => {
                  if (!todayUnlocked) return;
                  onSelectLevel(todayLevel.id);
                  go("gameplay");
                }}
              >
                {todayCompleted ? "Replay" : "Prepare"}
              </KButton>
            </div>
          </div>
          <KButton variant="cream" size="sm" full className="mt-2.5" onClick={() => go("board")}>
            See all orders →
          </KButton>
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
              <p className="font-display text-[18px] font-black leading-tight text-walnut-dark">
                🏆 Campaign Complete
              </p>
              <p className="mt-0.5 font-hand text-[16px] leading-snug text-walnut/75">
                All {levels.length} levels mastered — replay any level or run your restaurant.
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
              <span className="mt-1 block font-display text-[14.5px] font-black text-walnut-dark">
                Today's Special
              </span>
              <span className="block font-hand text-[14px] text-walnut/60">one featured order</span>
            </button>
            <button
              type="button"
              // Unified Restaurant: after L250 the restaurant carries on as the Endless
              // Restaurant (the Business engine, opened from the Restaurant tab).
              onClick={() => go(RESTAURANT_MODE ? "business" : "endless")}
              data-testid="endless-tile"
              className="press rounded-[16px] border border-sage/40 bg-sage/15 p-3 text-left"
            >
              <span className="block text-[20px]">🍽️</span>
              <span className="mt-1 block font-display text-[14.5px] font-black text-walnut-dark">
                {RESTAURANT_MODE ? ENDLESS_RESTAURANT_NAME : "Endless Service"}
              </span>
              <span className="block font-hand text-[14px] text-walnut/60">
                {!isEndlessUnlocked(levelProgress)
                  ? "🔒 unlocks after Level 250"
                  : RESTAURANT_MODE
                    ? "your restaurant, open every day"
                    : `ongoing earnings · up to ${formatUsd(ENDLESS_DAILY_COIN_CAP).replace(/\.00$/, "")}/day`}
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
                      <p className="pb-1 pt-1.5 font-ui text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-walnut/50">
                        Chapter {level.chapter} · ???
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-dashed border-walnut/20 bg-ivory/30 p-2.5">
                      <div className="opacity-60">
                        <p className="font-display text-[17px] font-black leading-none text-walnut-dark">
                          Upcoming Order
                        </p>
                        <p className="font-hand text-[15px] leading-tight text-walnut/70">
                          finish the level above to reveal it
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
              const ownReward = level.unlockReward
                ? {
                    atLevel: levelNumber(level.id),
                    name: level.unlockReward.name,
                    icon: REWARD_TYPE_ICON[level.unlockReward.type],
                  }
                : null;
              const nextReward = ownReward ?? getNextRewardPreview(levelNumber(level.id));
              // A knife or board a level "unlocks" becomes BUYABLE in the Market —
              // it is never handed over, so the row says so rather than "Reward".
              const marketUnlock =
                level.unlockReward?.type === "knife" || level.unlockReward?.type === "board";
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
                    <p className="pb-1 pt-1.5 font-ui text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-walnut/50">
                      Chapter {level.chapter} · {CHAPTER_TITLES[level.chapter] ?? level.chapterId}
                    </p>
                  ) : null}
                  <div className="flex items-end justify-between gap-3 rounded-[16px] border border-walnut/10 bg-ivory/40 p-2.5">
                    <div className={canOpen ? undefined : "opacity-50"}>
                      <p className="font-display text-[17px] font-black leading-none text-walnut-dark">
                        {level.title}
                      </p>
                      <p className="font-hand text-[15px] leading-tight text-walnut/70">
                        {!unlocked
                          ? "locked · finish the level before it"
                          : completed
                            ? "prepared already · replay pays nothing"
                            : `ready to prepare · ${payText(save, level)}`}
                      </p>
                      {canOpen && !completed ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span className="font-ui text-[11.5px] font-bold text-walnut/45">
                            {difficulty}
                          </span>
                          {nextReward && !campaignComplete ? (
                            <span className="font-ui text-[11.5px] font-bold text-copper/80">
                              {nextReward.icon} {rewardLabel}: {nextReward.name}
                              {ownReward
                                ? marketUnlock
                                  ? " in the Market"
                                  : ""
                                : `${opensInMarket(nextReward) ? " in the Market" : ""} · Lv ${nextReward.atLevel}`}
                            </span>
                          ) : null}
                          {stageAfter && !campaignComplete ? (
                            <span className="font-ui text-[11.5px] font-bold text-copper/80">
                              {stageAfter.icon} Next: {stageAfter.name} · Lv {stageAfter.atLevel}
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
              <p className="pt-1 text-center font-hand text-[17px] text-walnut/55">
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
          <span className="rounded-full bg-sage/25 px-2 py-[2px] font-ui text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-olive">
            ✦ {latestMilestone} unlocked
          </span>
        </div>
      ) : null}
    </header>
  );
}

/* ── Bottom navigation ─────────────────────────────────── */

const NAV: { id: ScreenId; label: string; glyph: string }[] = [
  { id: "kitchen", label: "Kitchen", glyph: "🏠" },
  { id: "shop", label: "Market", glyph: "🛒" },
  // Inventory — stock control (what the restaurant has), between where it's
  // bought (Market) and how the restaurant performs (Business).
  { id: "inventory", label: "Inventory", glyph: "📦" },
  // Economy V3 Phase 1 — the Business Simulation layer's own bottom-nav
  // destination (see data.ts's own doc on "business" for why this is a full
  // tab, not a Kitchen hotspot).
  // Unified Restaurant: Campaign and Business are one restaurant, so the tab is "Restaurant".
  { id: "business", label: RESTAURANT_MODE ? "Restaurant" : "Business", glyph: "📊" },
  { id: "rack", label: "Progress", glyph: "🏆" },
];

/**
 * `active` = the bottom-bar section the screen belongs to, or null for a
 * screen that is none of the five (the Order Board: Level 1–10 UX pass — it
 * used to light up Kitchen, as if the player were on the Kitchen home).
 */
export function BottomNav({ active, go }: { active: ScreenId | null; go: (s: ScreenId) => void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-walnut-dark/40 bg-[linear-gradient(180deg,rgba(62,40,25,0.82),rgba(45,41,36,0.95))] px-2 pb-3 pt-2 backdrop-blur-sm">
      {NAV.map((n) => {
        const on = n.id === active;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => go(n.id)}
            className="press flex min-h-12 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5"
            style={on ? { background: "rgba(246,232,204,0.14)" } : undefined}
          >
            <span
              className="text-[18px]"
              style={{ filter: on ? "none" : "grayscale(0.5)", opacity: on ? 1 : 0.72 }}
            >
              {n.glyph}
            </span>
            <span
              className="font-ui text-[11.5px] font-extrabold leading-[14px] tracking-wide"
              style={{ color: on ? "var(--color-gold)" : "rgba(246,232,204,0.62)" }}
            >
              {n.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
