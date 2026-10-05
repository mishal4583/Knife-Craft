import type { ReactNode } from "react";
import type { ScreenId } from "./data";
import { Badge, Coin, Divider, Panel, ScreenHeader, Stars } from "./common/primitives";
import { Bar, Eyebrow, Row } from "./common/Meters";
import { BottomNav } from "./Kitchen";
import { KnifeGlyph } from "./Workshop";
import { BoardPreview } from "./Boards";
import { KitchenBackground } from "./KitchenBackground";
import { cn } from "@/lib/utils";
import { opensInMarket } from "@/game/levels/levelMastery";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd, formatUsdChange } from "@/game/money";
import {
  popularityStars,
  restaurantProgress,
  type RestaurantProgress as Progress,
} from "@/game/progression/restaurantProgress";

/**
 * RESTAURANT PROGRESS — the game's progression screen (it replaced the old
 * Rack; equipping now lives in the Market, sharpening in the Blacksmith).
 * Pure display: every number comes from restaurantProgress(save), a
 * read-only view model over existing systems. Nothing on this screen buys,
 * equips or changes anything.
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

        <div className="space-y-3 px-4">
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
        </div>
      </div>
      <BottomNav active="rack" go={go} />
    </div>
  );
}

/* ── 1. WHERE AM I? ────────────────────────────────────── */

function RankHero({ p }: { p: Progress }) {
  const pct = Math.round(p.rank.fraction * 100);
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift">
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.3),transparent_70%)]" />
      <div className="relative">
        <Eyebrow dark>Restaurant rank</Eyebrow>
        <p className="mt-1 font-display text-[26px] font-black leading-tight text-ivory">
          🏆 {p.rank.title}
        </p>
        <p className="font-hand text-[16px] text-gold/90">
          {p.restaurantName} · Level {p.campaignComplete ? p.level.total : p.level.current} /{" "}
          {p.level.total}
        </p>
        {p.nextRank ? (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="flex-1">
                <Bar fraction={p.rank.fraction} />
              </span>
              <span className="font-ui text-[12px] font-extrabold text-ivory">{pct}%</span>
            </div>
            <p className="mt-1.5 font-ui text-[11px] font-bold text-ivory/75">
              Next rank · ⭐ {p.nextRank.title} at Level {p.nextRank.levelRequired}
            </p>
          </div>
        ) : (
          <p className="mt-2 font-ui text-[12px] font-bold text-ivory/75">
            The highest restaurant rank — every rank reached.
          </p>
        )}
      </div>
    </div>
  );
}

function Summary({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>{p.restaurantName}</Eyebrow>
      <div className="mt-1 divide-y divide-walnut/10">
        <Row label="Campaign" value={`${p.level.completed} / ${p.level.total} levels`} />
        <Row label="Chapters" value={`${p.chapter.completed} / ${p.chapter.total} completed`} />
        <Row label="Recipes cooked" value={`${p.recipes.cooked} / ${p.recipes.total}`} />
        <Row label="Restaurant rank" value={p.rank.title} />
        <Row label="Kitchen" value={p.kitchen.current} />
        <Row label="Knives" value={`${p.knivesOwned} / ${p.knives.length}`} />
        <Row label="Boards" value={`${p.boardsOwned} / ${p.boards.length}`} />
        <Row label="Staff" value={`${p.staff.hired} / ${p.staff.total}`} />
        <Row label="Blacksmith" value={`${p.blacksmith.upgradeSteps} upgrades`} />
        <Row label="Popularity" value={`${p.popularity} / 100`} />
        <Row
          label="Business"
          value={
            p.business.daysRun > 0
              ? `Day ${p.business.day} · ${p.business.daysRun} days run`
              : "Not opened yet"
          }
        />
        <Row label="Level rewards earned" value={formatUsd(p.money.levelRewards)} />
      </div>
    </Panel>
  );
}

function NextGoal({ p }: { p: Progress }) {
  const goal = p.nextGoal;
  return (
    <Panel tone="cream" className="p-4">
      <Eyebrow>🎯 Next goal</Eyebrow>
      {goal ? (
        <>
          <p className="mt-1 font-display text-[19px] font-black leading-tight text-walnut-dark">
            {goal.icon} {goal.name}
          </p>
          <p className="font-hand text-[15px] text-walnut/70">
            {opensInMarket(goal)
              ? `Unlocks in the Market at Level ${goal.atLevel}`
              : `Unlocks at Level ${goal.atLevel}`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-1">
              <Bar fraction={Math.min(p.level.current, goal.atLevel) / goal.atLevel} tone="sage" />
            </span>
            <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
              {Math.min(p.level.current, goal.atLevel)} / {goal.atLevel}
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 font-display text-[21px] font-black uppercase leading-tight tracking-wide text-walnut-dark">
            🏆 Campaign Complete
          </p>
          <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
            {p.level.completed} / {p.level.total}
          </p>
          <p className="mt-2 font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-copper">
            Final Reward · Family Legacy
          </p>
          {p.familyLegacy.waived ? (
            <p className="font-hand text-[15px] leading-snug text-walnut/70">
              You finished the campaign before the Final Reward existed, so it wasn't paid.
            </p>
          ) : (
            <p className="font-display text-[26px] font-black leading-tight text-olive">
              {formatUsdChange(p.familyLegacy.reward)}
            </p>
          )}
          <p className="mt-1 font-display text-[16px] font-black text-walnut-dark">
            Your restaurant is yours.
          </p>
          <p className="mt-1 font-hand text-[15px] text-walnut/70">
            All {p.level.total} levels mastered. Endless Service is now unlocked — ongoing earnings
            every day — alongside Business Mode and Today's Special.
          </p>
        </>
      )}
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
          <span className="font-hand text-[14px] font-normal text-walnut/60"> / 100</span>
        </p>
      </div>
      <div className="mt-1">
        <Stars n={p.popularityStars} size={18} />
      </div>
      <div className="mt-2">
        <Bar fraction={p.popularity / 100} tone="sage" />
      </div>
      <p className="mt-2 font-display text-[14px] font-black leading-snug text-walnut-dark">
        {p.popularityMood}
      </p>
      <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/70">
        Popularity is your restaurant's Business Mode score — it grows with good service there.
        Campaign levels grow your rank instead.
      </p>
    </Panel>
  );
}

function CampaignCard({ p }: { p: Progress }) {
  const pct = (p.level.completed / p.level.total) * 100;
  return (
    <Panel className="p-4">
      <Eyebrow>📖 Campaign progress</Eyebrow>
      <p className="mt-1 font-display text-[20px] font-black text-walnut-dark">
        {p.level.completed} / {p.level.total} levels
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1">
          <Bar fraction={p.level.completed / p.level.total} />
        </span>
        <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
          {Number.isInteger(pct) ? pct : pct.toFixed(1)}%
        </span>
      </div>
      <p className="mt-2 font-ui text-[12px] font-bold text-walnut/70">
        {p.campaignComplete
          ? `All ${p.chapter.total} chapters complete`
          : `Chapter ${p.chapter.number} / ${p.chapter.total}${p.chapter.title ? ` · ${p.chapter.title}` : ""}`}
      </p>
      <Divider />
      <p className="mb-1 font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-walnut/55">
        Your restaurant along the campaign
      </p>
      <JourneyTrack p={p} />
    </Panel>
  );
}

/** Chart 2 — the campaign's real milestones (kitchen stages) on a 1→250 track, with the player's position. */
function JourneyTrack({ p }: { p: Progress }) {
  const W = 300;
  const H = 64;
  const pad = 12;
  const total = p.level.total;
  const x = (lv: number) => pad + ((lv - 1) / (total - 1)) * (W - pad * 2);
  const at = p.campaignComplete ? total : p.level.current;
  const ticks = [1, 50, 100, 150, 200, total];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Level ${at} of ${total}`}
    >
      <line
        x1={x(1)}
        x2={x(total)}
        y1={30}
        y2={30}
        stroke="var(--color-walnut)"
        strokeOpacity={0.2}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={x(1)}
        x2={x(at)}
        y1={30}
        y2={30}
        stroke="var(--color-copper)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      {p.kitchen.stages
        .filter((s) => s.unlockLevel > 1)
        .map((s) => (
          <g key={s.id}>
            <circle
              cx={x(s.unlockLevel)}
              cy={30}
              r={5}
              fill={s.reached ? "var(--color-gold)" : "var(--color-ivory)"}
              stroke="var(--color-walnut-dark)"
              strokeWidth={1.2}
            />
            <text x={x(s.unlockLevel)} y={16} textAnchor="middle" fontSize={9}>
              🏠
            </text>
          </g>
        ))}
      <circle
        cx={x(at)}
        cy={30}
        r={7}
        fill="var(--color-olive)"
        stroke="var(--color-ivory)"
        strokeWidth={2}
      />
      {ticks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={56}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-walnut)"
          fontFamily="var(--font-ui)"
          fontWeight={700}
        >
          {t}
        </text>
      ))}
    </svg>
  );
}

/* ── 2. WHAT HAVE I BUILT? ─────────────────────────────── */

function Earnings({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>💰 Restaurant earnings</Eyebrow>
      <div className="mt-1 divide-y divide-walnut/10">
        <Row label="Current cash" value={formatUsd(p.money.balance)} />
        <Row label="Level rewards earned" value={formatUsd(p.money.levelRewards)} />
        <Row label="Milestone rewards" value={formatUsd(p.money.milestoneRewards)} />
        <Row
          label="Final Reward (Level 250)"
          value={
            p.familyLegacy.paid
              ? formatUsd(p.money.familyLegacy)
              : p.familyLegacy.waived
                ? "finished before it existed"
                : "at Level 250"
          }
        />
        <Row label="Business revenue" value={formatUsd(p.money.businessRevenue)} />
      </div>
      <Divider />
      <div className="divide-y divide-walnut/10">
        <Row label="Invested in your restaurant" value={formatUsd(p.money.restaurantInvestment)} />
        <Row label="Business running costs" value={formatUsd(p.money.businessCosts)} />
        <Row label="Total spent" value={formatUsd(p.money.totalSpent)} />
        <Row label="Remaining wealth" value={formatUsd(p.money.balance)} />
      </div>
      <Divider />
      <p className="mb-1 font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-walnut/55">
        Level rewards at today's rates, cumulative by level
      </p>
      <EarningsChart p={p} />
      <p className="mt-1 font-hand text-[13px] leading-snug text-walnut/60">
        What each completed level pays at today's reward rates — the reward curve, not a record of
        past payouts (those are "Level rewards earned" above).
        {p.money.businessCoverage === "partial"
          ? " Business revenue counts from your earliest saved record."
          : ""}
        {p.historySince === "migration"
          ? " Your totals from before the economy update were reconstructed from your progress: levels paid their full reward back then, and kitchen stages you received free count as $0."
          : ""}
      </p>
    </Panel>
  );
}

/** Chart 1 — cumulative level rewards (exact: fixed per-level rewards of every completed level) against level number. */
function EarningsChart({ p }: { p: Progress }) {
  const W = 300;
  const H = 120;
  const left = 44;
  const right = 8;
  const top = 8;
  const bottom = 20;
  const pts = p.money.rewardCurve;
  const total = p.level.total;
  const maxY = Math.max(1, pts[pts.length - 1]?.cumulative ?? 0);
  const x = (lv: number) => left + ((lv - 1) / (total - 1)) * (W - left - right);
  const y = (v: number) => top + (1 - v / maxY) * (H - top - bottom);
  if (pts.length === 0) {
    return (
      <p className="py-4 text-center font-hand text-[14px] text-walnut/60">
        Complete your first level to start this chart.
      </p>
    );
  }
  const path = pts
    .map((q, i) => `${i === 0 ? "M" : "L"}${x(q.level).toFixed(1)},${y(q.cumulative).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${x(pts[pts.length - 1]!.level).toFixed(1)},${y(0)} L${x(pts[0]!.level).toFixed(1)},${y(0)} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Level rewards earned: ${formatUsd(maxY)}`}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={left}
            x2={W - right}
            y1={y(maxY * f)}
            y2={y(maxY * f)}
            stroke="var(--color-walnut)"
            strokeOpacity={0.12}
          />
          <text
            x={left - 4}
            y={y(maxY * f) + 3}
            textAnchor="end"
            fontSize={8.5}
            fill="var(--color-walnut)"
            fontFamily="var(--font-ui)"
            fontWeight={700}
          >
            {formatUsd(Math.round((maxY * f) / 100) * 100).replace(/\.00$/, "")}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--color-gold)" fillOpacity={0.22} />
      <path
        d={path}
        fill="none"
        stroke="var(--color-copper)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
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
          Lv {t}
        </text>
      ))}
    </svg>
  );
}

function Benchmark({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>🏆 Local restaurant rankings — city benchmark</Eyebrow>
      <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/70">
        See how your restaurant compares with the city's benchmark restaurants. These are fictional
        restaurants in KnifeCraft's world, not other players.
      </p>
      <div className="mt-2 overflow-hidden rounded-[14px] border border-walnut/10">
        {p.benchmark.map((r) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center gap-3 px-3 py-2 font-ui text-[13px]",
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
      <p className="mt-1 text-right font-ui text-[10px] font-bold text-walnut/50">
        popularity out of 100
      </p>
    </Panel>
  );
}

function Journey({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>🏠 Your restaurant journey</Eyebrow>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {p.kitchen.stages.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-1 text-center">
            <div
              className={cn(
                "relative overflow-hidden rounded-[12px] border",
                s.current ? "border-copper ring-2 ring-gold/50" : "border-walnut/15",
                !s.reached && "opacity-50 grayscale-[0.5]",
              )}
              style={{ width: 72, height: 92 }}
            >
              <KitchenBackground skin={s.asset} thumb />
            </div>
            <p className="font-ui text-[10px] font-extrabold leading-tight text-walnut-dark">
              {s.reached ? "✓" : "🔒"} {s.name}
            </p>
            <p className="font-ui text-[9px] font-bold text-walnut/55">
              {s.current ? "your kitchen" : `Level ${s.unlockLevel}`}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Knives({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>🔪 Knives</Eyebrow>
        <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
          {p.knivesOwned} / {p.knives.length} owned
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {p.knives.map((k) => (
          <div
            key={k.knife.id}
            className={cn(
              "flex flex-col items-center rounded-[14px] border p-2 card-warm",
              k.equipped ? "border-copper/60" : "border-walnut/15",
            )}
          >
            <div className={cn("rotate-[-8deg]", !k.owned && "opacity-45 grayscale")}>
              <KnifeGlyph knife={k.knife} size={84} />
            </div>
            <p className="font-display text-[12px] font-black leading-tight text-walnut-dark">
              {k.knife.name}
            </p>
            <div className="mt-1">
              {k.equipped ? (
                <Badge tone="sage">In hand · ★{k.blacksmithLevel}</Badge>
              ) : k.owned ? (
                <Badge tone="cream">Owned · ★{k.blacksmithLevel}</Badge>
              ) : (
                <Badge tone="locked">
                  {k.unlocked ? "In the Market" : `🔒 Lv ${k.knife.unlockLevel}`}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      <Divider />
      <Eyebrow>🔨 Knife mastery (Blacksmith)</Eyebrow>
      <p className="mt-1 font-display text-[17px] font-black text-walnut-dark">
        {p.blacksmith.upgradeSteps} / {p.blacksmith.maxForOwned} upgrade levels
      </p>
      <div className="mt-1">
        <Bar
          fraction={
            p.blacksmith.maxForOwned ? p.blacksmith.upgradeSteps / p.blacksmith.maxForOwned : 0
          }
        />
      </div>
      <p className="mt-1 font-hand text-[13px] text-walnut/60">
        across the knives you own · {p.blacksmith.maxAll} with the full collection
      </p>
    </Panel>
  );
}

function Boards({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>🪵 Cutting boards</Eyebrow>
        <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
          {p.boardsOwned} / {p.boards.length} owned
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {p.boards.map((b) => (
          <div key={b.board.id} className="flex flex-col items-center gap-1 text-center">
            <div className={cn(!b.owned && "opacity-40 grayscale")}>
              <BoardPreview board={b.board} size={52} />
            </div>
            <p className="font-ui text-[9px] font-extrabold leading-tight text-walnut-dark">
              {b.owned ? (b.equipped ? "✓ in use" : "✓") : "🔒"}{" "}
              {b.board.name.replace(/ Board$/, "")}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ── 3. WHAT AM I WORKING TOWARD? ──────────────────────── */

function Milestones({ p }: { p: Progress }) {
  return (
    <Panel className="p-4">
      <Eyebrow>🎯 Milestones</Eyebrow>
      <p className="mt-0.5 font-hand text-[13px] leading-snug text-walnut/60">
        Each milestone pays its reward once, the moment you reach it.
      </p>
      <ul className="mt-2 space-y-1.5">
        {p.milestones.map((m) => (
          <li
            key={m.id}
            className={cn(
              "flex items-center gap-2 font-ui text-[13px]",
              m.done ? "font-extrabold text-walnut-dark" : "font-bold text-walnut/45",
            )}
          >
            <span aria-hidden className="w-5 text-center">
              {m.done ? "✓" : "○"}
            </span>
            <span className="min-w-0 flex-1">{m.label}</span>
            {!m.done && m.atLevel ? <Badge tone="locked">Lv {m.atLevel}</Badge> : null}
            <span
              className={cn(
                "shrink-0 text-right font-ui text-[12px] font-extrabold",
                m.paid ? "text-olive" : "text-walnut/45",
              )}
            >
              {m.waived ? "✓ earlier" : `${m.paid ? "✓ " : ""}${formatUsdChange(m.reward)}`}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
