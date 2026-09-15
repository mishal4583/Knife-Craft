import { KButton, Coin, DustMotes } from "./common/primitives";
import { KitchenBackground } from "./KitchenBackground";
import type { ScreenId } from "./data";
import { getLevels, isUnlocked, isCompleted, type LevelProgress } from "@/game/levels/LevelManager";
import { CHAPTER_TITLES } from "@/game/levels/levelDefinitions";
import { describeDifficulty, getNextRewardPreview, levelNumber } from "@/game/levels/levelMastery";
import { QA_MODE } from "@/game/qaMode";
import { getCafeProgress } from "@/game/cafe/CafeProgressionManager";
import { CAFE_MILESTONES } from "@/game/cafe/cafeDefinitions";
import { kitchenUpgradeOrDefault } from "@/game/kitchen/kitchenUpgradeDefinitions";
import type { SaveData } from "@/game/SaveManager";
import type { ServiceSession } from "@/game/service/ServiceManager";

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
  onClick,
}: {
  label: string;
  sub: string;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="press absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ivory/25 bg-walnut-dark/40 px-3 py-1.5 text-left backdrop-blur-[3px] shadow-soft"
    >
      <span className="block font-display text-[13px] font-black leading-none text-ivory">
        {label}
      </span>
      <span className="block font-hand text-[13px] leading-tight text-gold/90">{sub}</span>
    </button>
  );
}

/** The single "what should I prepare next" level — the first unlocked-but-not-completed level in campaign order, falling back to the furthest reached one once everything's done. Shared by the compact Kitchen Home card and OrderBoard's own header context. */
function pickTodayLevel(levelProgress: LevelProgress) {
  const levels = getLevels();
  const next = levels.find(
    (l) => (isUnlocked(l, levelProgress) || QA_MODE) && !isCompleted(l.id, levelProgress),
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

  // Café progression (Phase 10A) — the "Prep Cook" HUD badge.
  const cafeProgress = getCafeProgress(levelProgress);
  const cafeMilestoneTitle =
    CAFE_MILESTONES.find((m) => m.id === cafeProgress.current)?.title ?? "Humble Kitchen";

  // Kitchen upgrades (Phase 12B) — the background is now whichever
  // kitchen upgrade the player currently has EQUIPPED, not derived
  // directly from level progress (see src/game/kitchen/).
  const equippedUpgrade = kitchenUpgradeOrDefault(save.equippedKitchenUpgradeId);

  // Today's Order — a single compact card, not the full 50-level board
  // (§Part 1 "the level list must not permanently cover the Kitchen").
  const todayLevel = pickTodayLevel(levelProgress);
  const todayUnlocked = isUnlocked(todayLevel, levelProgress) || QA_MODE;
  const todayCompleted = isCompleted(todayLevel.id, levelProgress);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <KitchenBackground skin={equippedUpgrade.asset} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.42)_0%,transparent_22%,transparent_44%,rgba(62,40,25,0.55)_100%)]" />
      <DustMotes count={18} />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <button
          type="button"
          onClick={() => go("progression")}
          className="press rounded-2xl border border-ivory/25 bg-walnut-dark/45 px-3 py-2 text-left backdrop-blur-sm"
        >
          <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-gold">
            Prep Cook
          </p>
          <p className="font-display text-[15px] font-black leading-none text-ivory">
            {cafeMilestoneTitle}
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
        </button>
        <div className="flex items-center gap-2">
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
            <span aria-hidden className="text-[15px]">
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
        label="Rack"
        sub="choose your equipment"
        style={{ left: "26%", top: "35%" }}
        onClick={() => go("rack")}
      />
      <Hotspot
        label="Shop"
        sub="buy knives & boards"
        style={{ left: "76%", top: "50%" }}
        onClick={() => go("shop")}
      />
      <Hotspot
        label="Kitchen Upgrade"
        sub="improve your kitchen"
        style={{ left: "50%", top: "17%" }}
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
            <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Today's Order
            </p>
            {QA_MODE ? (
              <span className="rounded-full bg-walnut-dark/80 px-2 py-[2px] font-ui text-[9px] font-extrabold uppercase tracking-[0.1em] text-gold">
                QA MODE
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className={todayUnlocked ? undefined : "opacity-50"}>
              <p className="font-display text-[18px] font-black leading-none text-walnut-dark">
                {todayLevel.title}
              </p>
              <p className="font-hand text-[14px] leading-tight text-walnut/70">
                {!todayUnlocked
                  ? "locked · finish the level before it"
                  : todayCompleted
                    ? "prepared already · replay pays no coins"
                    : `ready to prepare · +${todayLevel.reward.coins} credits`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[24px]">{todayUnlocked ? todayLevel.emoji : "🔒"}</span>
              <KButton
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

/**
 * Phase 2 — the restaurant-service loop's own current/next/recent board
 * (brief §6/§7/§8/§9): NOT the campaign level list below it (which
 * still lists all 120 levels for direct campaign access, §32 — the
 * ability to select/play a campaign level is preserved). This card only
 * ever shows one recent + one current + one next order — never the
 * full future queue.
 */
function ServiceQueueCard({
  session,
  onStartService,
}: {
  session: ServiceSession | null;
  onStartService: () => void;
}) {
  return (
    <div className="mb-3 rounded-[16px] border border-copper/30 bg-ivory/50 p-3">
      <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.2em] text-copper">
        Restaurant Service
      </p>
      {session?.recent ? (
        <p className="mt-1 font-hand text-[13px] text-walnut/55">
          ✓ Served · {session.recent.customer.avatarEmoji} {session.recent.customer.name} ·{" "}
          {session.recent.recipe.name}
        </p>
      ) : null}
      {session?.current ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-black leading-none text-walnut-dark">
              {session.current.customer.avatarEmoji} {session.current.customer.name}
            </p>
            <p className="truncate font-hand text-[13px] leading-tight text-walnut/70">
              {session.current.recipe.emoji} {session.current.recipe.name}
            </p>
          </div>
          <KButton size="sm" onClick={onStartService}>
            Continue
          </KButton>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="font-hand text-[13px] text-walnut/60">
            Open the counter and start taking real orders.
          </p>
          <KButton size="sm" onClick={onStartService}>
            Start Service
          </KButton>
        </div>
      )}
      {session?.next ? (
        <p className="mt-1.5 font-hand text-[12px] text-walnut/50">
          Next: {session.next.customer.avatarEmoji} {session.next.customer.name} ·{" "}
          {session.next.recipe.name}
        </p>
      ) : null}
    </div>
  );
}

/* ── Order Board — the full level/chapter list, moved off Kitchen Home
   (§Part 1). Same rendering the old inline panel used, unchanged. ── */

export function OrderBoard({
  go,
  save,
  onSelectLevel,
  serviceSession,
  onStartService,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onSelectLevel: (levelId: string) => void;
  /** Phase 2 — the active restaurant-service queue, or null before "Start Service" has ever been tapped. */
  serviceSession: ServiceSession | null;
  onStartService: () => void;
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
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => go("daily")}
              className="press rounded-[16px] border border-copper/30 bg-gold/15 p-3 text-left"
            >
              <span className="block text-[20px]">📅</span>
              <span className="mt-1 block font-display text-[13px] font-black text-walnut-dark">
                Today's Special
              </span>
              <span className="block font-hand text-[12px] text-walnut/60">one featured order</span>
            </button>
            <button
              type="button"
              onClick={() => go("endless")}
              className="press rounded-[16px] border border-sage/40 bg-sage/15 p-3 text-left"
            >
              <span className="block text-[20px]">🍽️</span>
              <span className="mt-1 block font-display text-[13px] font-black text-walnut-dark">
                Endless Service
              </span>
              <span className="block font-hand text-[12px] text-walnut/60">no lives, no timer</span>
            </button>
          </div>
          <ServiceQueueCard session={serviceSession} onStartService={onStartService} />
          <div className="space-y-2.5">
            {levels.map((level, i) => {
              const unlocked = isUnlocked(level, levelProgress);
              // Pre-Phase-8 QA mode: a render-only bypass — isUnlocked's
              // own result (`unlocked`, above) still reflects the REAL
              // progression, used for the hint text below so QA testing
              // never lies about what a normal player would actually see.
              // Only `canOpen` (dim/lock-icon/disabled/tap-through) is
              // relaxed. See qaMode.ts.
              const canOpen = unlocked || QA_MODE;
              const completed = isCompleted(level.id, levelProgress);
              const prevChapter = i > 0 ? levels[i - 1]!.chapter : null;
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
              const rewardLabel = ownReward ? "Reward" : "Next";
              return (
                <div key={level.id}>
                  {showChapterDivider ? (
                    <p className="pb-1 pt-1.5 font-ui text-[10px] font-extrabold uppercase tracking-[0.18em] text-walnut/50">
                      Chapter {level.chapter} · {CHAPTER_TITLES[level.chapter] ?? level.chapterId}
                    </p>
                  ) : null}
                  <div className="flex items-end justify-between gap-3 rounded-[16px] border border-walnut/10 bg-ivory/40 p-2.5">
                    <div className={canOpen ? undefined : "opacity-50"}>
                      <p className="font-display text-[16px] font-black leading-none text-walnut-dark">
                        {level.title}
                      </p>
                      <p className="font-hand text-[13px] leading-tight text-walnut/70">
                        {!unlocked
                          ? QA_MODE
                            ? "QA unlocked · normally locked"
                            : "locked · finish the level before it"
                          : completed
                            ? "prepared already · replay pays no coins"
                            : `ready to prepare · +${level.reward.coins} credits`}
                      </p>
                      {canOpen ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span className="font-ui text-[10px] font-bold text-walnut/45">
                            {difficulty}
                          </span>
                          {nextReward ? (
                            <span className="font-ui text-[10px] font-bold text-copper/80">
                              {nextReward.icon} {rewardLabel}: {nextReward.name}
                              {ownReward ? "" : ` · Lv ${nextReward.atLevel}`}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[20px]">{canOpen ? level.emoji : "🔒"}</span>
                      <KButton
                        size="sm"
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
          </div>
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
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
    <header className="flex items-start gap-3 px-4 pb-2 pt-4">
      <button
        type="button"
        onClick={() => go("kitchen")}
        aria-label="Back"
        className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-walnut shadow-soft"
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
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[22px] font-black leading-none tracking-tight text-walnut-dark">
          Today's Board
        </h1>
        <div className="mt-1.5 flex items-center gap-1.5">
          {QA_MODE ? (
            <span className="rounded-full bg-walnut-dark/80 px-2 py-[2px] font-ui text-[9px] font-extrabold uppercase tracking-[0.1em] text-gold">
              QA MODE
            </span>
          ) : null}
          {latestMilestone ? (
            <span className="rounded-full bg-sage/25 px-2 py-[2px] font-ui text-[9px] font-extrabold uppercase tracking-[0.1em] text-olive">
              ✦ {latestMilestone} unlocked
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => go("recipes")}
        aria-label="Recipe Book"
        className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-[16px] text-walnut shadow-soft"
      >
        📖
      </button>
      <Coin n={credits} />
    </header>
  );
}

/* ── Bottom navigation ─────────────────────────────────── */

const NAV: { id: ScreenId; label: string; glyph: string }[] = [
  { id: "kitchen", label: "Kitchen", glyph: "🏠" },
  { id: "shop", label: "Shop", glyph: "🛒" },
  { id: "rack", label: "Rack", glyph: "🔪" },
];

export function BottomNav({ active, go }: { active: ScreenId; go: (s: ScreenId) => void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-walnut-dark/40 bg-[linear-gradient(180deg,rgba(62,40,25,0.82),rgba(45,41,36,0.95))] px-2 pb-3 pt-2 backdrop-blur-sm">
      {NAV.map((n) => {
        const on = n.id === active;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => go(n.id)}
            className="press flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5"
            style={on ? { background: "rgba(246,232,204,0.14)" } : undefined}
          >
            <span
              className="text-[17px]"
              style={{ filter: on ? "none" : "grayscale(0.5)", opacity: on ? 1 : 0.72 }}
            >
              {n.glyph}
            </span>
            <span
              className="font-ui text-[10px] font-extrabold tracking-wide"
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
