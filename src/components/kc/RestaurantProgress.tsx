import { useState } from "react";
import type { ReactNode } from "react";
import { collectableTotal } from "@/game/progression/achievements";
import { useUnlockText } from "./navLevel";
import type { ScreenId } from "./data";
import { Badge, Coin, Divider, KButton, Panel, ScreenHeader, Stars } from "./common/primitives";
import { InfoTip } from "./common/InfoTip";
import { Bar, Eyebrow, Row } from "./common/Meters";
import { BottomNav } from "./Kitchen";
import { KnifeGlyph } from "./Workshop";
import { BoardPreview } from "./Boards";
import { KitchenBackground } from "./KitchenBackground";
import {
  ChefTitleCard,
  CityLeaderboard,
  CityRankHero,
  LeagueCard,
  PrestigeCard,
} from "./CityRanking";
import {
  Art,
  GlossBar,
  IconRow,
  PIcon,
  ProgressCard,
  StatTile,
  StatusMark,
  SubRibbon,
  ValuePill,
} from "./progress/ProgressKit";
import { cn } from "@/lib/utils";
import { opensInMarket } from "@/game/levels/levelMastery";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd, formatUsdChange } from "@/game/money";
import { hasProgressArt } from "@/game/progressArt";
import {
  popularityStars,
  restaurantProgress,
  type RestaurantProgress as Progress,
} from "@/game/progression/restaurantProgress";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import {
  ENDLESS_STARS_PER_DAY,
  endlessStarsOf,
  restaurantStanding,
} from "@/game/restaurant/restaurantStanding";
import { restaurantNameOf } from "@/game/restaurant/restaurantName";
import { piecesWashed, restaurantSuppliesOf } from "@/game/restaurant/serviceSupplies";
import { LAST_CAMPAIGN_LEVEL } from "@/game/restaurant/restaurantProgression";
import {
  SPOTLESS_QUALITY_PCT,
  SPOTLESS_QUALITY_STREAK,
  restaurantRecordOf,
} from "@/game/restaurant/serviceReport";

/**
 * RESTAURANT PROGRESS — the game's progression screen (it replaced the old
 * Rack; equipping now lives in the Market, sharpening in the Blacksmith).
 * Pure display: every number comes from restaurantProgress(save), a
 * read-only view model over existing systems. Nothing on this screen buys,
 * equips or changes anything.
 *
 * PAINTED PAGE (developer 2026-11-25, docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md): the cards are painted paper cards with gold ribbon headings
 * (progress/ProgressKit.tsx) that lay themselves out by their own width; the pictures come from src/game/progressArt.ts and are today's icons until the Codex sheets exist.
 * The restaurant build also dropped what the page said twice: the "city benchmark" ranking (a second, made-up ranking that disagreed with the city guide), the Popularity
 * card (a tile of the prestige strip), the plain summary list (its rows are in Campaign, Standing, Knives and Boards), the "Restaurant Complete" row (the same rule as
 * Endless Restaurant), "Remaining wealth" (the same number as Current cash) and the campaign's plain bar (the track shows it).
 */
export function RestaurantProgress({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const p = restaurantProgress(save);
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title={"🏆 Restaurant Progress"}
          subtitle="see how far your kitchen has come"
          wrapTitle
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => go("achievements")}
            className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-[#e2b24a] bg-[linear-gradient(120deg,#fff6dc,#f6dca0)] px-4 py-3 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-walnut text-xl text-ivory">
                <PIcon name="icons-a/trophy" fallback="🏆" size={28} />
              </span>
              <span>
                <span className="block font-display text-[16px] font-bold text-walnut-dark">
                  Achievements
                </span>
                <span
                  className="block font-ui text-[12px] text-walnut/65"
                  data-testid="achievements-entry-note"
                >
                  {collectableTotal(save) > 0
                    ? `💰 ${formatUsd(collectableTotal(save))} waiting to collect`
                    : "Cash rewards for your real game progress"}
                </span>
              </span>
            </span>
            <span aria-hidden="true" className="font-ui text-xl font-bold text-copper">
              ›
            </span>
          </button>
        </div>

        <div className="space-y-5 px-4">
          {/* Restaurant build: the city ranking (developer 2026-10-09) leads; the café
              stage the old card showed is the standing card's "Kitchen title". */}
          {RESTAURANT_MODE ? (
            <>
              <CityRankHero save={save} />
              <ChefTitleCard save={save} />
              <PrestigeCard save={save} />
              <LeagueCard save={save} />
              <CityLeaderboard save={save} />
              <StandingCard save={save} p={p} />
              <NumbersCard save={save} />
              <NextGoal p={p} />
              <CampaignCard p={p} />
              <Earnings p={p} />
              <Journey p={p} />
              <Knives p={p} />
              <Boards p={p} />
              <Milestones p={p} />
            </>
          ) : (
            <>
              <RankHero p={p} />
              <Summary p={p} />
              <NextGoal p={p} />
              <PopularityCard p={p} />
              <CampaignCard p={p} />
              <Earnings p={p} />
              <Benchmark p={p} />
              <Journey p={p} />
              <Knives p={p} />
              <Boards p={p} />
              <Milestones p={p} />
            </>
          )}
        </div>
      </div>
      <BottomNav active="rack" go={go} />
    </div>
  );
}

/**
 * Supplies plan D (developer 2026-10-10: "they should feel proud"): the
 * restaurant's lifetime numbers — read-only from the save's running totals
 * (serviceSupplies) and record (serviceReport).
 */
function NumbersCard({ save }: { save: SaveData }) {
  const rec = restaurantRecordOf(save);
  const sup = restaurantSuppliesOf(save);
  const stats: [string, string, string, number][] = [
    ["icons-b/pan-egg", "🍳", "Services", rec.services],
    ["icons-b/guests", "🍽️", "Guests at the tables", sup.coversTotal],
    ["icons-b/takeaway-bag", "🥡", "Takeaway orders", sup.takeawayTotal],
    ["icons-b/box", "📦", "Pieces packed", sup.packedTotal],
    ["icons-b/soap", "🧼", "Pieces washed", piecesWashed(sup)],
    ["icons-b/sparkles", "✨", "Spotless services", rec.spotless],
  ];
  return (
    <ProgressCard
      title="Your restaurant in numbers"
      icon={<PIcon name="icons-a/bars" fallback="📊" size={26} />}
    >
      <div data-testid="restaurant-numbers">
        <div className="grid grid-cols-2 gap-2 @min-[720px]:grid-cols-3">
          {stats.map(([art, emoji, label, n]) => (
            <StatTile
              key={label}
              dataNumber={label}
              icon={<PIcon name={art} fallback={emoji} size={40} />}
              value={n.toLocaleString("en-US")}
              label={label}
            />
          ))}
        </div>
        <div className="mt-2.5 grid gap-2 @min-[720px]:grid-cols-[auto_1fr]">
          <ValuePill tone="gold" className="justify-start text-left">
            <PIcon name="icons-b/streak-star" fallback="✨" size={22} />
            <span>
              Spotless streak: {rec.streak} · best {rec.bestStreak}
              {sup.brokenTotal > 0 ? ` · ${sup.brokenTotal} pieces broken` : ""}
            </span>
          </ValuePill>
          <p className="flex flex-wrap items-center gap-x-1.5 rounded-2xl border border-[#ebd2a0] bg-[#fbf1e0] px-3 py-1 font-hand text-[15px] leading-snug text-walnut/75">
            <PIcon name="icons-b/sparkles" fallback="✨" size={18} />
            <span>
              {SPOTLESS_QUALITY_STREAK} spotless in a row → +{SPOTLESS_QUALITY_PCT * 100}% dish
              quality
            </span>
            <span aria-hidden="true" className="text-walnut/30">
              |
            </span>
            <PIcon name="icons-b/inspector" fallback="🕵️" size={22} />
            <span>the inspector notices</span>
          </p>
        </div>
      </div>
    </ProgressCard>
  );
}

/**
 * Restaurant build: the restaurant's standing (restaurantStanding — stage,
 * the Endless Restaurant) and its lifetime Endless stars (status only,
 * never money). Read-only. The painted storefront is the player's own kitchen stage and
 * the ribbon under it is the restaurant's name; "Restaurant Complete" is not a row any more
 * (it is the same rule as "Endless Restaurant", and the stage reads "Restaurant Complete").
 */
function StandingCard({ save, p }: { save: SaveData; p: Progress }) {
  const u = useUnlockText();
  const s = restaurantStanding(save.levelProgress);
  const stars = endlessStarsOf(save);
  const stage = Math.max(
    0,
    p.kitchen.stages.findIndex((k) => k.current),
  );
  return (
    <div data-testid="restaurant-standing">
      <ProgressCard
        title="Restaurant standing"
        icon={<PIcon name="icons-a/storefront" fallback="🍽️" size={26} />}
      >
        <div className="grid gap-3 @min-[720px]:grid-cols-[230px_1fr]">
          <div className="flex flex-col items-center justify-center gap-1.5">
            <Art
              name={`storefronts/stage-${stage}`}
              className="h-32 w-auto max-w-full"
              fallback={<PIcon name="icons-a/storefront" fallback="🏪" size={84} />}
            />
            <ValuePill tone="gold" className="max-w-full">
              <span className="truncate">{restaurantNameOf(save)}</span>
            </ValuePill>
          </div>
          <div>
            <IconRow
              icon={<PIcon name="icons-a/toque" fallback="👨‍🍳" size={26} />}
              label="Kitchen title"
            >
              <ValuePill tone="gold">{s.rank}</ValuePill>
            </IconRow>
            <IconRow icon={<PIcon name="icons-a/stairs" fallback="📶" size={26} />} label="Stage">
              {`${s.stage} · ${s.stageNumber} / ${s.stageCount}`}
            </IconRow>
            {s.nextStage ? (
              <IconRow
                icon={<PIcon name="icons-a/chevrons" fallback="⏩" size={26} />}
                label="Next stage"
              >
                <ValuePill tone="gold">{`${s.nextStage.stage} · ${u.level(s.nextStage.level)}`}</ValuePill>
              </IconRow>
            ) : null}
            <IconRow
              icon={
                <PIcon
                  name={s.endlessUnlocked ? "icons-a/padlock-open" : "icons-a/padlock"}
                  fallback={s.endlessUnlocked ? "🔓" : "🔒"}
                  size={26}
                />
              }
              label="Endless Restaurant"
            >
              <ValuePill tone="gold">{s.endlessUnlocked ? "🔓 Open" : "🔒 Locked"}</ValuePill>
            </IconRow>
          </div>
        </div>
        {s.endlessUnlocked ? (
          <div className="mt-3 rounded-[16px] bg-gold/15 p-3" data-testid="endless-stars">
            <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
              Endless stars
            </p>
            <p className="mt-0.5 font-display text-[22px] font-black leading-tight text-walnut-dark">
              ★ {stars.total}
            </p>
            <p className="font-ui text-[12.5px] font-bold text-walnut/75">
              {stars.days} {stars.days === 1 ? "day" : "days"} run · best day {stars.bestDay} /{" "}
              {ENDLESS_STARS_PER_DAY}
            </p>
            <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/65">
              ⭐ 💵 profitable · 👥 busy · ✨ clean{" "}
              <InfoTip label="How stars are earned">
                Up to {ENDLESS_STARS_PER_DAY} a day: profitable, busy (no guest turned away) and
                clean (inspection passed). Stars show your standing — they are not money.
              </InfoTip>
            </p>
          </div>
        ) : (
          <p className="mt-2 font-hand text-[15px] leading-snug text-walnut/70">
            Complete all {LAST_CAMPAIGN_LEVEL} campaign levels to unlock Endless Restaurant.
          </p>
        )}
      </ProgressCard>
    </div>
  );
}

/** The painted picture and icon of a goal on the reward timeline (levelMastery.ts): a chapter's cuisine, the finale, a rank, a knife, a board, a kitchen. */
function goalArt(goal: { name: string; icon: string }): {
  vignette: string | null;
  icon: [string, string];
} {
  const ch = /^Chapter (\d+)/.exec(goal.name);
  if (ch) return { vignette: `goals/ch${ch[1]}`, icon: ["icons-a/book-open", "📖"] };
  if (goal.icon === "🏁") return { vignette: "goals/finale", icon: ["icons-a/flag", "🏁"] };
  if (goal.icon === "🏆") return { vignette: "goals/rank", icon: ["icons-a/trophy", "🏆"] };
  if (goal.icon === "🔪") return { vignette: null, icon: ["icons-a/knife", "🔪"] };
  if (goal.icon === "🪵") return { vignette: null, icon: ["icons-a/board", "🪵"] };
  if (goal.icon === "🏠") return { vignette: null, icon: ["icons-a/storefront", "🏠"] };
  return { vignette: null, icon: ["icons-a/star", goal.icon] };
}

function NextGoal({ p }: { p: Progress }) {
  const u = useUnlockText();
  const goal = p.nextGoal;
  const art = goal ? goalArt(goal) : null;
  return (
    <ProgressCard title="Next goal" icon={<PIcon name="icons-a/target" fallback="🎯" size={26} />}>
      {goal && art ? (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-[19px] font-black leading-tight text-walnut-dark">
              <PIcon name={art.icon[0]} fallback={art.icon[1]} size={34} />
              <span className="min-w-0">{goal.name}</span>
            </p>
            <p className="font-hand text-[16px] text-walnut/70">
              {opensInMarket(goal)
                ? `Unlocks in the Market ${u.when(goal.atLevel)}`
                : `Unlocks ${u.when(goal.atLevel)}`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex-1">
                <GlossBar
                  tone="green"
                  fraction={Math.min(p.level.current, goal.atLevel) / goal.atLevel}
                  label="Progress to the next goal"
                />
              </span>
              <ValuePill className="shrink-0">
                {Math.min(p.level.current, goal.atLevel)} / {goal.atLevel}
              </ValuePill>
            </div>
          </div>
          {art.vignette ? (
            <Art
              name={art.vignette}
              className="hidden h-24 w-auto max-w-[220px] @min-[560px]:block"
            />
          ) : null}
        </div>
      ) : (
        <>
          <p className="font-display text-[21px] font-black uppercase leading-tight tracking-wide text-walnut-dark">
            🏆 Campaign Complete
          </p>
          <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
            {p.level.completed} / {p.level.total}
          </p>
          <p className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.18em] text-copper">
            Final Reward · Family Legacy
          </p>
          {p.familyLegacy.waived ? (
            <p className="font-hand text-[16px] leading-snug text-walnut/70">
              Finished the campaign before the Final Reward existed · not paid
            </p>
          ) : (
            <p className="font-display text-[26px] font-black leading-tight text-olive">
              {formatUsdChange(p.familyLegacy.reward)}
            </p>
          )}
          <p className="mt-1 font-display text-[16.5px] font-black text-walnut-dark">
            Your restaurant is yours.
          </p>
          <p className="mt-1 font-hand text-[16px] text-walnut/70">
            All {p.level.total} levels mastered · ♾️ Endless Service unlocked
          </p>
        </>
      )}
    </ProgressCard>
  );
}

/** One labelled progress line of the campaign card: a painted icon, the label, a bar and the value. */
function CampaignLine({
  icon,
  label,
  fraction,
  value,
}: {
  icon: ReactNode;
  label: string;
  fraction: number;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid w-8 shrink-0 place-items-center">{icon}</span>
      <span className="w-[104px] shrink-0 font-ui text-[13.5px] font-bold leading-tight text-walnut-dark">
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <GlossBar fraction={fraction} label={label} />
      </span>
      <span className="shrink-0 text-right font-ui text-[13px] font-extrabold text-walnut-dark">
        {value}
      </span>
    </div>
  );
}

function CampaignCard({ p }: { p: Progress }) {
  const pct = (p.level.completed / p.level.total) * 100;
  return (
    <ProgressCard
      title="Campaign progress"
      icon={<PIcon name="icons-a/flag" fallback="🚩" size={26} />}
      right={<ValuePill tone="gold">{Number.isInteger(pct) ? pct : pct.toFixed(1)}%</ValuePill>}
    >
      <p className="flex items-center gap-2 font-display text-[22px] font-black text-walnut-dark">
        <PIcon name="icons-a/map" fallback="🗺️" size={34} />
        {p.level.completed} / {p.level.total} levels
      </p>
      <p className="mt-0.5 font-ui text-[13px] font-bold text-walnut/70">
        {p.campaignComplete
          ? `All ${p.chapter.total} chapters complete`
          : `Chapter ${p.chapter.number} / ${p.chapter.total}${p.chapter.title ? ` · ${p.chapter.title}` : ""}`}
      </p>
      <div className="mt-2.5 grid gap-2 @min-[720px]:grid-cols-2 @min-[720px]:gap-x-6">
        <CampaignLine
          icon={<PIcon name="icons-a/book-open" fallback="📖" size={26} />}
          label="Chapters"
          fraction={p.chapter.total ? p.chapter.completed / p.chapter.total : 0}
          value={`${p.chapter.completed} / ${p.chapter.total} completed`}
        />
        <CampaignLine
          icon={<PIcon name="icons-a/recipe-book" fallback="📒" size={26} />}
          label="Recipes cooked"
          fraction={p.recipes.total ? p.recipes.cooked / p.recipes.total : 0}
          value={`${p.recipes.cooked} / ${p.recipes.total}`}
        />
      </div>
      <Divider />
      <p className="mb-1 inline-block rounded-full border border-[#ebd2a0] bg-[#fdf0c9] px-3 py-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-walnut-dark">
        Your restaurant along the campaign
      </p>
      <JourneyTrack p={p} />
    </ProgressCard>
  );
}

/** The campaign's journey: a painted storefront at the start, a gold check coin at every mark already passed, a glowing chef-hat coin for "you are here" and a ring for each mark ahead. */
function JourneyTrack({ p }: { p: Progress }) {
  const u = useUnlockText();
  const total = p.level.total;
  const at = p.campaignComplete ? total : p.level.current;
  const pos = (lv: number) => ((lv - 1) / Math.max(1, total - 1)) * 100;
  const ticks = [
    ...new Set(
      [1, 0.2, 0.4, 0.6, 0.8].map((value) => (value < 1 ? Math.round(total * value) : value)),
    ),
    total,
  ];
  return (
    <div
      className="mt-1 grid grid-cols-[auto_1fr] items-center gap-2"
      role="img"
      aria-label={`${u.noun} ${at} of ${total}`}
    >
      <PIcon name="icons-a/storefront" fallback="🏪" size={44} />
      <div className="relative mx-3 h-[72px]">
        <span className="absolute inset-x-0 top-[18px] h-[9px] rounded-full bg-[#d9bf98]" />
        <span
          className="absolute left-0 top-[18px] h-[9px] rounded-full bg-[linear-gradient(180deg,#d98f3b,#b0661a)]"
          style={{ width: `${pos(at)}%` }}
        />
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pos(t)}%` }}
          >
            {t === at ? <span className="h-[36px]" /> : <StatusMark done={t < at} />}
            <span className="mt-1 font-ui text-[13px] font-extrabold text-walnut-dark">{t}</span>
          </span>
        ))}
        <span
          className="absolute -top-[2px] z-10 -translate-x-1/2"
          style={{ left: `${pos(at)}%` }}
          data-testid="journey-you-are-here"
        >
          <Art
            name="pieces/you-are-here"
            className="h-10 w-10"
            fallback={
              <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#e9c25a] bg-[radial-gradient(circle_at_35%_30%,#a9d47c,#5f9030)] text-[20px] shadow-[0_0_14px_rgba(255,214,120,0.9)]">
                👨‍🍳
              </span>
            }
          />
        </span>
      </div>
    </div>
  );
}

/* ── 2. WHAT HAVE I BUILT? ─────────────────────────────── */

function Earnings({ p }: { p: Progress }) {
  const u = useUnlockText();
  const last = LAST_CAMPAIGN_LEVEL;
  const finalLabel = u.live ? "Final Reward (final service)" : `Final Reward (Level ${last})`;
  const finalWhen = u.live ? "at the final service" : `at Level ${last}`;
  const col = "min-w-0";
  return (
    <ProgressCard
      title="Restaurant earnings"
      icon={<PIcon name="icons-a/money-bag" fallback="💰" size={26} />}
    >
      {/* a band for the painted cluster in a wide card: the rows start below it (a card cannot query its own width, so the band is a child) */}
      <div className="hidden h-9 @min-[720px]:block" aria-hidden="true" />
      <Art
        name="wide/earnings-cluster"
        className="pointer-events-none absolute right-4 top-1 hidden h-14 w-auto @min-[720px]:block"
      />
      <div className="grid gap-x-8 @min-[720px]:grid-cols-2">
        <div className={col}>
          <IconRow
            icon={<PIcon name="icons-a/cash" fallback="💵" size={26} />}
            label="Current cash"
          >
            <ValuePill>{formatUsd(p.money.balance)}</ValuePill>
          </IconRow>
          <IconRow
            icon={<PIcon name="icons-a/star" fallback="⭐" size={26} />}
            label="Level rewards earned"
          >
            <ValuePill>{formatUsd(p.money.levelRewards)}</ValuePill>
          </IconRow>
          <IconRow
            icon={<PIcon name="icons-a/gift" fallback="🎁" size={26} />}
            label="Milestone rewards"
          >
            <ValuePill>{formatUsd(p.money.milestoneRewards)}</ValuePill>
          </IconRow>
        </div>
        <div className={col}>
          <IconRow
            icon={<PIcon name="icons-a/trophy-laurel" fallback="🏆" size={26} />}
            label={finalLabel}
          >
            <ValuePill>
              {p.familyLegacy.paid
                ? formatUsd(p.money.familyLegacy)
                : p.familyLegacy.waived
                  ? "finished before it existed"
                  : finalWhen}
            </ValuePill>
          </IconRow>
          <IconRow
            icon={<PIcon name="icons-a/coins" fallback="🪙" size={26} />}
            label="Business revenue"
          >
            <ValuePill>{formatUsd(p.money.businessRevenue)}</ValuePill>
          </IconRow>
        </div>
      </div>
      <div className="my-1 border-t border-dashed border-walnut/25" />
      <div className="grid gap-x-8 @min-[720px]:grid-cols-2">
        <div className={col}>
          <IconRow
            icon={<PIcon name="icons-a/storefront" fallback="🏪" size={26} />}
            label="Invested in your restaurant"
          >
            <ValuePill>{formatUsd(p.money.restaurantInvestment)}</ValuePill>
          </IconRow>
          <IconRow
            icon={<PIcon name="icons-b/wrench-hammer" fallback="🛠️" size={26} />}
            label="Business running costs"
          >
            <ValuePill>{formatUsd(p.money.businessCosts)}</ValuePill>
          </IconRow>
        </div>
        <div className={col}>
          <IconRow
            icon={<PIcon name="icons-b/clipboard-check" fallback="📋" size={26} />}
            label="Total spent"
          >
            <ValuePill>{formatUsd(p.money.totalSpent)}</ValuePill>
          </IconRow>
          {/* "Remaining wealth" is the same number as "Current cash" (and as the wallet in the header): the restaurant build shows it once. */}
          {RESTAURANT_MODE ? null : (
            <IconRow
              icon={<PIcon name="icons-a/money-bag" fallback="👛" size={26} />}
              label="Remaining wealth"
            >
              <ValuePill>{formatUsd(p.money.balance)}</ValuePill>
            </IconRow>
          )}
        </div>
      </div>
      <div className="mt-3">
        <SubRibbon icon={<PIcon name="icons-a/chart-trend" fallback="📈" size={22} />}>
          Level rewards at today's rates, cumulative by level
        </SubRibbon>
      </div>
      <div className="mt-2 grid items-center gap-3 @min-[720px]:grid-cols-[230px_1fr]">
        <RewardsPlaque
          total={p.money.rewardCurve[p.money.rewardCurve.length - 1]?.cumulative ?? 0}
        />
        <EarningsChart p={p} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/60">
        📈 The reward curve
        <InfoTip label="About this chart">
          What each completed level pays at today's reward rates — the reward curve, not a record of
          past payouts (those are "Level rewards earned" above).
          {p.money.businessCoverage === "partial"
            ? " Business revenue counts from your earliest saved record."
            : ""}
          {p.historySince === "migration"
            ? " Your totals from before the economy update were reconstructed from your progress: levels paid their full reward back then, and kitchen stages you received free count as $0."
            : ""}
        </InfoTip>
      </p>
    </ProgressCard>
  );
}

/** The dark wooden sign with the total of the level rewards ("$165,130 Total Level Rewards (Cumulative)"); the painted sign when it exists, a wood panel until then. */
function RewardsPlaque({ total }: { total: number }) {
  const painted = hasProgressArt("pieces/plaque");
  return (
    <div
      className={cn(
        "relative mx-auto grid w-full max-w-[250px] place-items-center text-center",
        painted
          ? "aspect-[1.12/1]"
          : "wood min-h-[96px] rounded-2xl border border-walnut-dark/60 shadow-soft @min-[720px]:min-h-[130px]",
      )}
      data-testid="rewards-plaque"
    >
      <Art name="pieces/plaque" className="absolute inset-0 h-full w-full" />
      <div
        className={cn(
          "relative px-3 py-3",
          painted && "absolute inset-x-[12%] bottom-[14%] top-[36%] grid place-content-center p-0",
        )}
      >
        <p
          className={cn(
            "font-display font-black leading-none text-gold",
            painted ? "text-[22px]" : "text-[26px]",
          )}
        >
          {formatUsd(total).replace(/\.00$/, "")}
        </p>
        <p
          className={cn(
            "mt-1 font-ui font-extrabold leading-tight text-ivory",
            painted ? "text-[11px]" : "text-[12.5px]",
          )}
        >
          Total Level Rewards (Cumulative)
        </p>
      </div>
    </div>
  );
}

/** Chart 1 — cumulative level rewards (exact: fixed per-level rewards of every completed level) against level number. */
function EarningsChart({ p }: { p: Progress }) {
  const u = useUnlockText();
  const W = 440;
  const H = 130;
  const left = 44;
  const right = 10;
  const top = 10;
  const bottom = 20;
  const pts = p.money.rewardCurve;
  const total = p.level.total;
  const maxY = Math.max(1, pts[pts.length - 1]?.cumulative ?? 0);
  const x = (lv: number) => left + ((lv - 1) / (total - 1)) * (W - left - right);
  const y = (v: number) => top + (1 - v / maxY) * (H - top - bottom);
  if (pts.length === 0) {
    return (
      <p className="py-4 text-center font-hand text-[15px] text-walnut/60">
        Complete your first level to start this chart.
      </p>
    );
  }
  const path = pts
    .map((q, i) => `${i === 0 ? "M" : "L"}${x(q.level).toFixed(1)},${y(q.cumulative).toFixed(1)}`)
    .join(" ");
  const endX = x(pts[pts.length - 1]!.level);
  const endY = y(pts[pts.length - 1]!.cumulative);
  const area = `${path} L${endX.toFixed(1)},${y(0)} L${x(pts[0]!.level).toFixed(1)},${y(0)} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Level rewards earned: ${formatUsd(maxY)}`}
    >
      <defs>
        <linearGradient id="pg-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f6c453" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f6c453" stopOpacity={0.08} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={left}
            x2={W - right}
            y1={y(maxY * f)}
            y2={y(maxY * f)}
            stroke="var(--color-walnut)"
            strokeOpacity={0.22}
            strokeDasharray={f === 0 ? undefined : "4 3"}
          />
          <text
            x={left - 4}
            y={y(maxY * f) + 3}
            textAnchor="end"
            fontSize={8.5}
            fill="var(--color-walnut-dark)"
            fontFamily="var(--font-ui)"
            fontWeight={800}
          >
            {formatUsd(Math.round((maxY * f) / 100) * 100).replace(/\.00$/, "")}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#pg-area)" />
      <path
        d={path}
        fill="none"
        stroke="#b4651a"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endX} cy={endY} r={5} fill="#f9c940" stroke="#b4651a" strokeWidth={1.6} />
      {[1, 125, total].map((t) => (
        <text
          key={t}
          x={x(t)}
          y={H - 6}
          textAnchor={t === total ? "end" : t === 1 ? "start" : "middle"}
          fontSize={8.5}
          fill="var(--color-walnut)"
          fontFamily="var(--font-ui)"
          fontWeight={700}
        >
          {u.live ? `#${t}` : `Lv ${t}`}
        </text>
      ))}
    </svg>
  );
}

function Journey({ p }: { p: Progress }) {
  const u = useUnlockText();
  const last = p.kitchen.stages.length - 1;
  return (
    <ProgressCard
      title="Your restaurant journey"
      icon={<PIcon name="icons-a/map" fallback="🗺️" size={26} />}
    >
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 @min-[720px]:grid-cols-6">
        {p.kitchen.stages.map((s, i) => (
          <div key={s.id} className="relative flex flex-col items-center gap-1 text-center">
            {s.current ? (
              <span className="-mb-1">
                <PIcon name="icons-a/crown" fallback="👑" size={24} />
              </span>
            ) : null}
            <div
              className={cn(
                "relative aspect-[3/4] w-full max-w-[120px] overflow-hidden rounded-[14px] border-2",
                s.current
                  ? "border-[#e2b24a] shadow-[0_0_14px_rgba(255,214,120,0.8)]"
                  : "border-[#d8bb86]",
                !s.reached && "opacity-50 grayscale-[0.5]",
              )}
            >
              <KitchenBackground skin={s.asset} thumb />
              {s.reached ? (
                <span className="absolute right-1 top-1">
                  <StatusMark done />
                </span>
              ) : null}
            </div>
            {i < last ? (
              <span className="pointer-events-none absolute -right-3.5 top-[38%] hidden @min-[720px]:block">
                <PIcon name="icons-a/chevrons" fallback="»" size={22} />
              </span>
            ) : null}
            <p className="pg-pill rounded-full px-2 py-0.5 font-ui text-[11px] font-extrabold leading-tight text-walnut-dark">
              {s.reached ? "✓" : "🔒"} {s.name}
            </p>
            <p className="font-hand text-[14px] leading-none text-walnut/65">
              {s.current
                ? "your kitchen"
                : s.reached && u.live
                  ? "reached"
                  : u.level(s.unlockLevel)}
            </p>
          </div>
        ))}
      </div>
    </ProgressCard>
  );
}

function Knives({ p }: { p: Progress }) {
  const u = useUnlockText();
  return (
    <ProgressCard
      title="Knives"
      icon={<PIcon name="icons-a/knife" fallback="🔪" size={26} />}
      right={
        <ValuePill tone="gold">
          <PIcon name="icons-c/crate-small" fallback="📦" size={18} />
          {p.knivesOwned} / {p.knives.length} owned
        </ValuePill>
      }
    >
      <div className="grid gap-2 @min-[560px]:grid-cols-2">
        {p.knives.map((k) => (
          <div
            key={k.knife.id}
            data-knife={k.knife.id}
            className={cn(
              "flex min-h-[88px] items-center gap-2.5 rounded-2xl border p-2",
              k.equipped
                ? "border-[#9cc36a] bg-[linear-gradient(180deg,#f3f9e6,#e1efc3)]"
                : k.owned
                  ? "border-[#e6bf5e] bg-[linear-gradient(180deg,#fff7d9,#fde9a8)]"
                  : "border-[#ebd2a0] bg-[#fbf1e0]",
            )}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center">
              {k.equipped ? (
                <PIcon name="icons-c/hand" fallback="✋" size={30} />
              ) : k.owned ? (
                <StatusMark done />
              ) : (
                <PIcon name="icons-c/stall" fallback={k.unlocked ? "🏪" : "🔒"} size={30} />
              )}
            </span>
            <div className={cn("shrink-0", !k.owned && "opacity-55 grayscale")}>
              <Art
                name={`knives/${k.knife.id}`}
                className="h-14 w-[104px]"
                fallback={
                  <div className="rotate-[-8deg]">
                    <KnifeGlyph knife={k.knife} size={84} />
                  </div>
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                {k.knife.name}
              </p>
              <div className="mt-1">
                {k.equipped ? (
                  <Badge tone="sage">In hand · ★{k.blacksmithLevel}</Badge>
                ) : k.owned ? (
                  <Badge tone="cream">Owned · ★{k.blacksmithLevel}</Badge>
                ) : (
                  <Badge tone="locked">
                    {k.unlocked ? "In the Market" : u.badge(k.knife.unlockLevel)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Divider />
      <SubRibbon icon={<PIcon name="icons-a/hammer" fallback="🔨" size={22} />}>
        Knife mastery (Blacksmith)
      </SubRibbon>
      <div className="mt-2 flex items-center gap-3">
        <PIcon name="pieces/anvil-medallion" fallback="⚒️" size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-black text-walnut-dark">
            {p.blacksmith.upgradeSteps} / {p.blacksmith.maxForOwned} upgrade levels
          </p>
          <div className="mt-1">
            <GlossBar
              label="Knife mastery"
              fraction={
                p.blacksmith.maxForOwned ? p.blacksmith.upgradeSteps / p.blacksmith.maxForOwned : 0
              }
            />
          </div>
          <p className="mt-1 font-hand text-[14px] text-walnut/60">
            across the knives you own · {p.blacksmith.maxAll} with the full collection
          </p>
        </div>
        <Art name="pieces/anvil" className="hidden h-20 w-20 @min-[560px]:block" />
      </div>
    </ProgressCard>
  );
}

function Boards({ p }: { p: Progress }) {
  return (
    <ProgressCard
      title="Cutting boards"
      icon={<PIcon name="icons-a/board" fallback="🪵" size={26} />}
      right={
        <ValuePill tone="gold">
          <PIcon name="icons-c/crate-small" fallback="📦" size={18} />
          {p.boardsOwned} / {p.boards.length} owned
        </ValuePill>
      }
    >
      <div className="grid grid-cols-2 gap-2 @min-[480px]:grid-cols-4">
        {p.boards.map((b) => (
          <div
            key={b.board.id}
            data-board={b.board.id}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-2xl border p-2 text-center",
              b.equipped
                ? "border-[#e2b24a] bg-[linear-gradient(180deg,#fff4cc,#fde19a)] shadow-[0_0_12px_rgba(255,214,120,0.6)]"
                : "border-[#ebd2a0] bg-[#fbf1e0]",
            )}
          >
            <div className={cn(!b.owned && "opacity-45 grayscale")}>
              <Art
                name={`boards/${b.board.id}`}
                className="h-[64px] w-[84px]"
                fallback={<BoardPreview board={b.board} size={64} />}
              />
            </div>
            {b.owned ? (
              b.equipped ? (
                <span className="absolute right-1.5 top-1.5">
                  <StatusMark done />
                </span>
              ) : null
            ) : (
              <span className="absolute right-1.5 top-1.5">
                <PIcon name="icons-a/padlock" fallback="🔒" size={22} />
              </span>
            )}
            <p className="font-ui text-[11.5px] font-extrabold leading-tight text-walnut-dark">
              {b.owned ? (b.equipped ? "✓ in use" : "✓") : "🔒"}{" "}
              {b.board.name.replace(/ Board$/, "")}
            </p>
          </div>
        ))}
      </div>
    </ProgressCard>
  );
}

/* ── 3. WHAT AM I WORKING TOWARD? ──────────────────────── */

/** The painted icon of a milestone (and its emoji until the picture exists). */
function milestoneArt(id: string, total: number): [string, string] {
  if (id === "first-dish") return ["icons-c/cloche", "🍽️"];
  if (id === "first-kitchen-upgrade") return ["icons-a/storefront", "🏪"];
  if (id === "first-blacksmith-upgrade") return ["icons-c/anvil", "⚒️"];
  if (id === "first-business-day") return ["icons-c/calendar", "📅"];
  if (id === "first-staff") return ["icons-c/staff", "👥"];
  if (id.startsWith("knife-")) return [`knives/${id.slice(6)}`, "🔪"];
  if (id === "halfway") return ["icons-a/map", "🗺️"];
  if (id === "every-kitchen-stage") return ["icons-b/wrench-hammer", "🛠️"];
  if (id === "final-chapter") return ["icons-a/book-open", "📖"];
  const lv = /^levels-(\d+)$/.exec(id);
  if (lv)
    return Number(lv[1]) >= total ? ["icons-a/trophy-laurel", "🏆"] : ["icons-a/chart-trend", "📈"];
  return ["icons-a/trophy", "🏆"];
}

/** How many milestones the restaurant build shows before "Show all": the next ones still to earn. */
const MILESTONES_SHOWN = 6;

function Milestones({ p }: { p: Progress }) {
  const u = useUnlockText();
  const [all, setAll] = useState(false);
  const done = p.milestones.filter((m) => m.done).length;
  // The restaurant build shows the next milestones still to earn; "Show all" opens the whole table (the plan's audit: it is the longest block on the page).
  const folded = RESTAURANT_MODE && !all && p.milestones.length > MILESTONES_SHOWN;
  const rows = folded
    ? p.milestones.filter((m) => !m.done).slice(0, MILESTONES_SHOWN)
    : p.milestones;
  return (
    <ProgressCard
      title="Milestones"
      icon={<PIcon name="icons-a/trophy" fallback="🎯" size={26} />}
      right={
        RESTAURANT_MODE ? (
          <ValuePill>
            {done} of {p.milestones.length} done
          </ValuePill>
        ) : undefined
      }
    >
      <p className="font-hand text-[14px] leading-snug text-walnut/60 @min-[720px]:min-h-12">
        💰 Each pays once · collect in Achievements
      </p>
      <Art
        name="pieces/clipboard"
        className="pointer-events-none absolute right-4 top-9 hidden h-14 w-14 @min-[720px]:block"
      />
      <ul className="mt-2 space-y-1" data-testid="milestones-list">
        {rows.map((m) => {
          const [art, emoji] = milestoneArt(m.id, p.level.total);
          return (
            <li
              key={m.id}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-xl px-2 py-1 font-ui text-[13.5px]",
                m.done
                  ? "bg-[linear-gradient(90deg,#fdeec7,#fbe6ad)] font-extrabold text-walnut-dark"
                  : "font-bold text-walnut/55",
              )}
            >
              <StatusMark done={m.done} />
              <PIcon name={art} fallback={emoji} size={26} />
              <span className="min-w-0 flex-1">{m.label}</span>
              {!m.done && m.atLevel ? <Badge tone="locked">{u.lv(m.atLevel)}</Badge> : null}
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-right font-ui text-[13px] font-extrabold",
                  m.paid ? "text-olive" : "text-walnut/45",
                )}
              >
                {m.paid ? <PIcon name="icons-c/coin" fallback="🪙" size={18} /> : null}
                {m.waived ? "✓ earlier" : `${m.paid ? "✓ " : ""}${formatUsdChange(m.reward)}`}
              </span>
            </li>
          );
        })}
      </ul>
      {RESTAURANT_MODE && p.milestones.length > MILESTONES_SHOWN ? (
        <KButton
          size="sm"
          variant="ghost"
          full
          className="mt-2 min-h-12"
          onClick={() => setAll((v) => !v)}
        >
          {all ? "Show less" : `Show all ${p.milestones.length}`}
        </KButton>
      ) : null}
    </ProgressCard>
  );
}

/* ── The classic (non-restaurant) build keeps its original cards ───────────── */

function RankHero({ p }: { p: Progress }) {
  const u = useUnlockText();
  const pct = Math.round(p.rank.fraction * 100);
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift">
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.3),transparent_70%)]" />
      <div className="relative">
        <Eyebrow dark>Restaurant rank</Eyebrow>
        <p className="mt-1 font-display text-[26px] font-black leading-tight text-ivory">
          🏆 {p.rank.title}
        </p>
        <p className="font-hand text-[17px] text-gold/90">
          {p.restaurantName} · {u.noun} {p.campaignComplete ? p.level.total : p.level.current} /{" "}
          {p.level.total}
        </p>
        {p.nextRank ? (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="flex-1">
                <Bar fraction={p.rank.fraction} />
              </span>
              <span className="font-ui text-[12.5px] font-extrabold text-ivory">{pct}%</span>
            </div>
            <p className="mt-1.5 font-ui text-[12px] font-bold text-ivory/75">
              Next rank · ⭐ {p.nextRank.title} {u.when(p.nextRank.levelRequired)}
            </p>
          </div>
        ) : (
          <p className="mt-2 font-ui text-[12.5px] font-bold text-ivory/75">
            The highest restaurant rank — every rank reached.
          </p>
        )}
      </div>
    </div>
  );
}

function Summary({ p }: { p: Progress }) {
  const u = useUnlockText();
  const campaignRestaurant = RESTAURANT_MODE && !p.campaignComplete;
  return (
    <Panel className="p-4">
      <Eyebrow>{p.restaurantName}</Eyebrow>
      <div className="mt-1 divide-y divide-walnut/10">
        <Row label="Campaign" value={`${p.level.completed} / ${p.level.total} levels`} />
        <Row label="Chapters" value={`${p.chapter.completed} / ${p.chapter.total} completed`} />
        <Row label="Recipes cooked" value={`${p.recipes.cooked} / ${p.recipes.total}`} />
        <Row label="Restaurant rank" value={p.rank.title} />
        {/* "Kitchen upgrade" (the building) so it can't be confused with the rank's
            "… Kitchen" names (audit 2026-10-08: Growing Kitchen vs Humble Kitchen). */}
        <Row label="Kitchen upgrade" value={p.kitchen.current} />
        <Row label="Knives" value={`${p.knivesOwned} / ${p.knives.length}`} />
        <Row label="Boards" value={`${p.boardsOwned} / ${p.boards.length}`} />
        <Row label="Staff" value={`${p.staff.hired} / ${p.staff.total}`} />
        <Row label="Blacksmith" value={`${p.blacksmith.upgradeSteps} upgrades`} />
        {/* Restaurant build before L250: popularity and the Business Day belong to
            the Endless Restaurant, which isn't open yet. */}
        {campaignRestaurant ? (
          <Row label="Endless Restaurant" value={`Opens ${u.final}`} />
        ) : (
          <>
            <Row label="Popularity" value={`${p.popularity} / 100`} />
            <Row
              label="Business"
              value={
                p.business.daysRun > 0
                  ? `Day ${p.business.day} · ${p.business.daysRun} days run`
                  : "Not opened yet"
              }
            />
          </>
        )}
        <Row label="Level rewards earned" value={formatUsd(p.money.levelRewards)} />
      </div>
    </Panel>
  );
}

function PopularityCard({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>⭐ Popularity</Eyebrow>
        <p className="font-display text-[22px] font-black text-walnut-dark">
          {p.popularity}
          <span className="font-hand text-[15px] font-normal text-walnut/60"> / 100</span>
        </p>
      </div>
      <div className="mt-1">
        <Stars n={p.popularityStars} size={18} />
      </div>
      <div className="mt-2">
        <Bar fraction={p.popularity / 100} tone="sage" />
      </div>
      <p className="mt-2 font-display text-[14.5px] font-black leading-snug text-walnut-dark">
        {p.popularityMood}
      </p>
      <p className="mt-1 flex items-center gap-1.5 font-hand text-[15px] leading-snug text-walnut/70">
        ⭐ Grows with good service
        <InfoTip label="About popularity">
          Popularity is your restaurant's Business Mode score — it grows with good service there.
          Campaign levels grow your rank instead.
        </InfoTip>
      </p>
    </Panel>
  );
}

function Benchmark({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>🏆 Local restaurant rankings — city benchmark</Eyebrow>
      <p className="mt-1 flex items-center gap-1.5 font-hand text-[15px] leading-snug text-walnut/70">
        🏙️ You vs the city
        <InfoTip label="About the rankings">
          See how your restaurant compares with the city's benchmark restaurants. These are
          fictional restaurants in KnifeCraft's world, not other players.
        </InfoTip>
      </p>
      <div className="mt-2 overflow-hidden rounded-[14px] border border-walnut/10">
        {p.benchmark.map((r) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center gap-3 px-3 py-2 font-ui text-[13.5px]",
              r.isPlayer
                ? "bg-gold/25 font-extrabold text-walnut-dark"
                : "bg-ivory/50 font-bold text-walnut/80",
            )}
          >
            <span className="w-5 shrink-0 text-right">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate">
              {r.isPlayer ? r.name.toUpperCase() : r.name}
            </span>
            <span className="shrink-0">
              <Stars n={popularityStars(r.popularity)} size={11} />
            </span>
            <span className="w-7 shrink-0 text-right">{r.popularity}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-right font-ui text-[11px] font-bold text-walnut/50">
        popularity out of 100
      </p>
    </Panel>
  );
}
