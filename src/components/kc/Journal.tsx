import type { ScreenId } from "./data";
import { getLevels, isCompleted } from "@/game/levels/LevelManager";
import { getCafeProgress } from "@/game/cafe/CafeProgressionManager";
import { CAFE_MILESTONES } from "@/game/cafe/cafeDefinitions";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Badge, Divider, Steam } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { QA_MODE } from "@/game/qaMode";
import { cn } from "@/lib/utils";
import {
  pickDailyLevel,
  hasClaimedToday,
  DAILY_ORDER_BONUS_COINS,
} from "@/game/daily/DailyOrderManager";
import {
  endlessPool,
  coinsEarnedToday,
  capRemainingToday,
  ENDLESS_DAILY_COIN_CAP,
} from "@/game/daily/EndlessServiceManager";

/* ── Chef's Journey (progression) ──────────────────────── */

/** Level ids are formatted "level-N" — the same parsing KnifeManager/BoardManager/CafeProgressionManager/KitchenUpgradeManager already use for their own level-gated logic, kept consistent rather than inventing a second "current level" concept. */
function reachedLevelNumber(save: SaveData): number {
  const match = /-(\d+)$/.exec(save.levelProgress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

export function Progression({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const level = reachedLevelNumber(save);
  const cafeProgress = getCafeProgress(save.levelProgress);
  const currentMilestone = CAFE_MILESTONES.find((m) => m.id === cafeProgress.current);
  const nextMilestone = CAFE_MILESTONES.find((m) => m.id === cafeProgress.next);

  // Real, small, data-driven — the 5 chapter-transition milestones already
  // authored on LEVELS (level.milestone, at Level 10/20/30/40/50), the
  // same field OrderBoard already reads for its own "✦ unlocked" pill. No
  // second milestone catalog: unlock/done state comes straight from
  // isCompleted(level.id, levelProgress), never a hand-picked boolean.
  const campaignMilestones = getLevels().filter((l) => l.milestone);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_45%_at_50%_0%,rgba(125,146,112,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Chef's Journey"
          subtitle="a craft, learned slowly"
          onBack={() => go("kitchen")}
        />

        <div className="px-4">
          <Panel tone="dark" className="relative overflow-hidden p-5 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(216,168,78,0.28),transparent_65%)]" />
            <div className="relative">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.24em] text-gold">
                Current Rank
              </p>
              <p className="font-display text-[28px] font-black leading-none text-ivory">
                {currentMilestone?.title ?? "Humble Kitchen"}
              </p>
              <p className="mt-1 font-hand text-[17px] text-ivory/70">Level {level}</p>
              {nextMilestone ? (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="font-ui text-[10px] font-bold text-ivory/60">
                      {currentMilestone?.levelRequired ?? 1}
                    </span>
                    <span className="relative h-[9px] flex-1 overflow-hidden rounded-full bg-ivory/15">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.round(cafeProgress.progressFraction * 100)}%`,
                          background:
                            "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
                        }}
                      />
                    </span>
                    <span className="font-ui text-[10px] font-bold text-ivory/60">
                      {nextMilestone.levelRequired}
                    </span>
                  </div>
                  <p className="mt-2 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ivory/70">
                    Next · {nextMilestone.title}
                  </p>
                </>
              ) : (
                <p className="mt-4 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ivory/70">
                  Every kitchen milestone reached
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Milestones
            </p>
            <ul className="mt-3 space-y-2.5">
              {campaignMilestones.map((m) => {
                const done = isCompleted(m.id, save.levelProgress);
                const match = /-(\d+)$/.exec(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]",
                        done
                          ? "border-olive/40 bg-sage/30 text-olive"
                          : "border-walnut/20 bg-walnut/8 text-walnut/45",
                      )}
                    >
                      {done ? "✓" : "🔒"}
                    </span>
                    <span
                      className={cn(
                        "flex-1 font-ui text-[13px] font-bold",
                        done ? "text-walnut-dark" : "text-walnut/50",
                      )}
                    >
                      {m.milestone}
                    </span>
                    {!done ? <Badge tone="locked">Level {match?.[1] ?? "?"}</Badge> : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <p className="px-8 pb-2 pt-5 text-center font-hand text-[16px] text-walnut/50">
          “Skill is just attention, repeated.”
        </p>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

// JournalHome (the old "Chef's Journal" hub screen, plus its private
// Stat/JournalRow helpers) was removed in Phase 15 — its rows were
// redistributed to real homes rather than kept as one dashboard: My
// Knives/My Boards -> Rack, My Kitchen -> Kitchen Upgrade, Market ->
// Shop, Chef Rank -> the Kitchen HUD (already showed it) + this file's
// Progression screen below, Settings -> the small gear icon on Kitchen
// Home. Its "Best Preparations" list and the ACHIEVEMENTS mock array
// (never backed by SaveManager) had no other natural home and were
// dropped rather than carried into a screen with nowhere left to live —
// every real number they showed (recipeProgress, ownedKnifeIds/
// ownedBoardIds, campaign level) still lives in SaveData untouched.

/* ── Daily order ───────────────────────────────────────── */

/**
 * DAILY_ORDER — a real screen, corrective pass. Previously a fully
 * static mockup (hardcoded "Fresh Garden Salad"/"98%"/"Chef XP", never
 * wired into ScreensRouter — "Accept Order" just navigated to whatever
 * level happened to be active). Now: the level shown is genuinely
 * today's featured pick (DailyOrderManager.pickDailyLevel, deterministic
 * per calendar day, drawn only from levels already unlocked), the
 * reward line is the level's own real coin reward plus the real daily
 * bonus, and "Prepare Order" starts that exact level via `onStartDaily`
 * (App.tsx's `startDaily`, which also puts the session in `daily` mode
 * so completion pays the bonus instead of normal campaign progression).
 * No stars, no percentage — a plain "claimed today" state once the
 * bonus has already been collected.
 */
export function DailyOrder({
  go,
  save,
  onStartDaily,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onStartDaily: () => void;
}) {
  const today = new Date();
  const level = pickDailyLevel(save.levelProgress, today);
  const claimed = hasClaimedToday(save.dailyOrder, today);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_10%,rgba(216,168,78,0.32),transparent_62%)]" />
      <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Today's Special"
          subtitle="one order, no hurry"
          onBack={() => go("kitchen")}
        />

        <div className="flex flex-1 flex-col justify-center px-4">
          <div className="paper anim-up relative -rotate-[1deg] rounded-[22px] border border-walnut/20 p-6 shadow-lift">
            <Steam className="left-[46%] top-8" />
            <p className="text-center text-[64px] leading-none">{level.emoji}</p>
            <p className="mt-3 text-center font-display text-[26px] font-black leading-none text-walnut-dark">
              {level.title}
            </p>
            <p className="mt-1 text-center font-hand text-[17px] text-walnut/65">
              {level.subtitle}
            </p>
            <Divider />
            <div className="space-y-2 font-ui text-[12px] font-bold text-walnut/75">
              <div className="flex justify-between">
                <span>Reward</span>
                <span className="text-copper">+{level.reward.coins} Kitchen Coins</span>
              </div>
              <div className="flex justify-between">
                <span>Today's bonus</span>
                <span className="text-olive">
                  {claimed ? "already claimed today" : `+${DAILY_ORDER_BONUS_COINS} Coins`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Streak</span>
                <span className="text-walnut-dark">
                  {save.dailyOrder.streak} day{save.dailyOrder.streak === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <Divider />
            <div className="mt-4">
              <KButton full size="lg" onClick={onStartDaily}>
                {claimed ? "Prepare Again" : "Prepare Order"}
              </KButton>
            </div>
          </div>
          <p className="pt-4 text-center font-hand text-[15px] text-walnut/45">
            the order waits as long as you need — missing a day never locks anything
          </p>
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

/* ── Endless Service ───────────────────────────────────── */

/**
 * ENDLESS_SERVICE — corrective pass, new screen. Cycles through the
 * campaign's own SERVICE-type levels (EndlessServiceManager.endlessPool
 * — Levels 91-100 and 117-120, whichever are already unlocked), one
 * "Prepare" at a time, no timer (Law 5), no new recipes. Shows today's
 * running coin total against the daily cap plainly — once the cap is
 * reached, the button still works (the mode never stops), it just says
 * so instead of promising more coins it won't pay.
 */
export function EndlessService({
  go,
  save,
  onStartEndless,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onStartEndless: () => void;
}) {
  const today = new Date();
  const pool = endlessPool(save.levelProgress);
  const earnedToday = coinsEarnedToday(save.endless, today);
  const remaining = capRemainingToday(save.endless, today);
  const capReached = remaining <= 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_10%,rgba(125,146,112,0.3),transparent_62%)]" />
      <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Endless Service"
          subtitle="one order after another, for as long as you like"
          onBack={() => go("kitchen")}
        />

        <div className="px-4 pt-2">
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Today
            </p>
            <div className="mt-2 space-y-2 font-ui text-[12px] font-bold text-walnut/75">
              <div className="flex justify-between">
                <span>Coins earned today</span>
                <span className="text-walnut-dark">
                  {earnedToday} / {ENDLESS_DAILY_COIN_CAP}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={capReached ? "text-walnut/50" : "text-olive"}>
                  {capReached ? "Daily coin cap reached" : "Earning normally"}
                </span>
              </div>
            </div>
            <span className="relative mt-2 block h-[6px] overflow-hidden rounded-full bg-walnut/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-gold),var(--color-copper))]"
                style={{
                  width: `${Math.round((earnedToday / ENDLESS_DAILY_COIN_CAP) * 100)}%`,
                }}
              />
            </span>
          </Panel>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4">
          {pool.length === 0 ? (
            <Panel className="p-5 text-center">
              <p className="font-hand text-[16px] leading-snug text-walnut/65">
                Come back once you've unlocked a Service-style level — Chapter 10's "Chef's Service"
                is the first.
              </p>
            </Panel>
          ) : (
            <Panel className="p-5 text-center">
              <p className="text-[48px] leading-none">🍽️</p>
              <p className="mt-2 font-display text-[18px] font-black text-walnut-dark">
                {pool.length} service{pool.length === 1 ? "" : "s"} in rotation
              </p>
              <p className="mt-1 font-hand text-[15px] text-walnut/60">
                {capReached
                  ? "still counts toward the Cookbook — no more coins until tomorrow"
                  : `up to +${remaining} coins left today`}
              </p>
              <div className="mt-4">
                <KButton full size="lg" onClick={onStartEndless}>
                  Prepare
                </KButton>
              </div>
            </Panel>
          )}
          <p className="pt-4 text-center font-hand text-[15px] text-walnut/45">
            no lives, no timer — stop whenever you want
          </p>
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────── */

export function Settings({
  go,
  settings,
  onToggleSetting,
  onResetProgress,
}: {
  go: (s: ScreenId) => void;
  settings: { sound: boolean; music: boolean; reducedMotion: boolean };
  onToggleSetting: (key: "sound" | "music" | "reducedMotion") => void;
  onResetProgress: () => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader title="Settings" subtitle="keep it simple" onBack={() => go("kitchen")} />
        <div className="space-y-3 px-4">
          <Panel className="divide-y divide-walnut/10 p-1">
            <Toggle label="Sound" on={settings.sound} onToggle={() => onToggleSetting("sound")} />
            <Toggle label="Music" on={settings.music} onToggle={() => onToggleSetting("music")} />
            <Toggle
              label="Reduced motion"
              on={settings.reducedMotion}
              onToggle={() => onToggleSetting("reducedMotion")}
            />
            <Row label="Language" value="English" />
            <Row label="Accessibility" value="Larger cut guides" />
          </Panel>
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Credits
            </p>
            <p className="mt-1.5 font-hand text-[16px] leading-snug text-walnut/70">
              KnifeCraft — a small kitchen made by a small team. Music by the morning radio.
            </p>
          </Panel>
          <KButton full variant="ghost" onClick={onResetProgress}>
            Reset Progress
          </KButton>
          {/* Phase 18A — dev/QA only, same gating convention as Kitchen's
              own "QA MODE" badge/level bypass (see qaMode.ts): never
              rendered in a real `npm run build` (QA_MODE is statically
              false there), so this button doesn't exist for a real
              player even if they find this screen. */}
          {QA_MODE ? (
            <Panel className="p-4">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                QA Mode
              </p>
              <p className="mt-1.5 font-hand text-[15px] leading-snug text-walnut/70">
                Inspect and cut-test every production ingredient with the real rendering/cutting
                pipeline. Does not affect progression, coins, or recipes.
              </p>
              <div className="mt-3">
                <KButton full variant="sage" onClick={() => go("ingredient-lab")}>
                  🔬 Ingredient Lab
                </KButton>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on?: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex w-full items-center justify-between px-3 py-3 text-left"
    >
      <span className="font-ui text-[13px] font-bold text-walnut-dark">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors",
          on ? "border-olive/40 bg-sage/70" : "border-walnut/20 bg-walnut/12",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-ivory shadow-soft transition-all duration-300",
            on ? "left-[23px]" : "left-[2px]",
          )}
        />
      </span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="font-ui text-[13px] font-bold text-walnut-dark">{label}</span>
      <span className="font-ui text-[12px] font-bold text-walnut/55">{value} ›</span>
    </div>
  );
}
