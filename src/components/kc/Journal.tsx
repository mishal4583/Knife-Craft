import type { Measure } from "@/game/business/measure";
import type { ScreenId } from "./data";
import { paidLevelReward } from "@/game/levels/levelRewards";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Steam } from "./common/primitives";
import { dollars, formatUsd, formatUsdChange } from "@/game/money";
import { BottomNav } from "./Kitchen";
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

// JournalHome (the old "Chef's Journal" hub screen, plus its private
// Stat/JournalRow helpers) was removed in Phase 15 — its rows were
// redistributed to real homes rather than kept as one dashboard: My
// Knives/My Boards -> Restaurant Progress (+ the Market for equipping),
// My Kitchen -> Kitchen Upgrade, Market -> Shop, Chef Rank -> the Kitchen
// HUD + Restaurant Progress, Settings -> the small gear icon on Kitchen
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
                <span className="text-copper">{formatUsdChange(paidLevelReward(level))}</span>
              </div>
              <div className="flex justify-between">
                <span>Today's bonus</span>
                <span className="text-olive">
                  {claimed ? "already claimed today" : formatUsdChange(DAILY_ORDER_BONUS_COINS)}
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
          subtitle="ongoing earnings after the campaign"
          onBack={() => go("kitchen")}
        />

        <div className="px-4 pt-2">
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Today
            </p>
            <div className="mt-2 space-y-2 font-ui text-[12px] font-bold text-walnut/75">
              <div className="flex justify-between">
                <span>Earned today</span>
                <span className="text-walnut-dark">
                  {formatUsd(earnedToday)} / {formatUsd(ENDLESS_DAILY_COIN_CAP)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={capReached ? "text-walnut/50" : "text-olive"}>
                  {capReached ? "Daily earnings limit reached" : "Earning normally"}
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
              <p className="text-[40px] leading-none">🔒</p>
              <p className="mt-2 font-display text-[17px] font-black text-walnut-dark">
                Unlocks after Level 250
              </p>
              <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/65">
                Endless Service is an ongoing earning mode for after the campaign: serve orders from
                the campaign's service levels, one after another, and earn up to{" "}
                {formatUsd(ENDLESS_DAILY_COIN_CAP)} every day.
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
                  ? "still counts toward the Cookbook — no more earnings until tomorrow"
                  : `up to ${formatUsdChange(remaining)} left today`}
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
  onSetMeasure,
  onResetProgress,
}: {
  go: (s: ScreenId) => void;
  settings: { sound: boolean; reducedMotion: boolean; measure?: Measure };
  onToggleSetting: (key: "sound" | "reducedMotion") => void;
  /** Restaurant build: pick lb or kg for weighed ingredients (absent in the classic build). */
  onSetMeasure?: ((measure: Measure) => void) | undefined;
  onResetProgress: () => void;
}) {
  const measure: Measure = settings.measure === "kg" ? "kg" : "lb";
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader title="Settings" subtitle="keep it simple" onBack={() => go("kitchen")} />
        <div className="space-y-3 px-4">
          <Panel className="divide-y divide-walnut/10 p-1">
            <Toggle label="Sound" on={settings.sound} onToggle={() => onToggleSetting("sound")} />
            <Toggle
              label="Reduced motion"
              on={settings.reducedMotion}
              onToggle={() => onToggleSetting("reducedMotion")}
            />
          </Panel>
          {onSetMeasure ? (
            <div data-testid="measure-setting">
              <Panel className="p-3">
                <p className="font-ui text-[13px] font-bold text-walnut-dark">Weights</p>
                <p className="font-hand text-[14px] leading-snug text-walnut/65">
                  How the Market, the fridge and your orders weigh ingredients.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Weights">
                  {(
                    [
                      ["lb", "Pounds (lb)"],
                      ["kg", "Kilograms (kg)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={measure === value}
                      onClick={() => onSetMeasure(value)}
                      className={cn(
                        "press h-12 rounded-2xl border font-ui text-[13px] font-extrabold",
                        measure === value
                          ? "wood border-walnut-dark/50 text-ivory"
                          : "card-warm border-walnut/15 text-walnut-dark",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Credits
            </p>
            <p className="mt-1.5 font-hand text-[16px] leading-snug text-walnut/70">
              KnifeCraft — a small kitchen made by a small team.
            </p>
          </Panel>
          <KButton full variant="ghost" onClick={onResetProgress}>
            Reset Progress
          </KButton>
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
      className="flex min-h-12 w-full items-center justify-between px-3 py-3 text-left"
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
