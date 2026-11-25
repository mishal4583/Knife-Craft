import { useState } from "react";
import { useUnlockText } from "./navLevel";
import { KButton } from "./common/primitives";
import { Eyebrow } from "./common/Meters";
import {
  ChefFace,
  GlossBar,
  PIcon,
  ProgressCard,
  RankMedal,
  ValuePill,
  Art,
} from "./progress/ProgressKit";
import { InfoTip } from "./common/InfoTip";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { restaurantNameOf } from "@/game/restaurant/restaurantName";
import { cityRanking, type CityRanking } from "@/game/restaurant/cityRanking";
import { LAST_CAMPAIGN_LEVEL } from "@/game/restaurant/restaurantProgression";
import { RANKING_NEWS_FROM_LEVEL } from "@/game/config/earlyLevels";
import { PRESTIGE_FROM_LEVEL, restaurantPrestige } from "@/game/restaurant/restaurantPrestige";
import { bestPlateOf, chefRecordOf } from "@/game/restaurant/chefRecord";
import {
  LEAGUE_FROM_LEVEL,
  PROMOTION_RANK,
  dayOfWeek,
  leagueView,
  weekStartOf,
} from "@/game/restaurant/cityLeague";
import { useToday } from "./useToday";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import {
  RESPECT_FROM_RANK,
  chefRespects,
  chefSays,
  rivalChefOf,
} from "@/game/restaurant/rivalChefs";
import {
  CHEF_TITLES_FROM_LEVEL,
  chefTitleStatus,
  identityProgressText,
  leadingTitle,
  nextTitleGoal,
} from "@/game/progression/chefTitles";

/** "1,880 pts" */
const pts = (n: number) => `${n.toLocaleString("en-US")} pts`;

/**
 * Restaurant Progress' top card (restaurant build, developer 2026-10-09):
 * the restaurant's place in the city guide, its reputation and the next
 * rival to pass (restaurant/cityRanking.ts). Read-only. Painted card (developer 2026-11-25): a wood banner under a gold "City ranking" tab, the trophy at the
 * left and the laurel emblem at the right (progress/ProgressKit.tsx, pictures from src/game/progressArt.ts).
 */
export function CityRankHero({ save }: { save: SaveData }) {
  const u = useUnlockText();
  const c = cityRanking(save);
  // Chef Pride (Phase 2): from the ranking news, the next rival's chef says something (rivalChefs.ts).
  const chef =
    c.next && restaurantLevelOf(save.levelProgress) >= RANKING_NEWS_FROM_LEVEL
      ? rivalChefOf(c.next.id)
      : undefined;
  // Late in the game (the top ten) the rival just behind the player says something respectful (rivalChefs.ts `respect`, hand-written or a template).
  const behind =
    c.passed &&
    c.rank <= RESPECT_FROM_RANK &&
    restaurantLevelOf(save.levelProgress) >= RANKING_NEWS_FROM_LEVEL
      ? rivalChefOf(c.passed.id)
      : undefined;
  return (
    <div
      className="@container relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood px-4 pb-4 pt-10 shadow-lift"
      data-testid="city-rank-hero"
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.3),transparent_70%)]" />
      <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-b-2xl border border-t-0 border-[#d29a2c] bg-[linear-gradient(180deg,#ffe7a3,#f1b84a)] px-7 py-1 font-display text-[14px] font-black uppercase tracking-[0.16em] text-[#5a2d08] shadow-md">
        City ranking
      </span>
      <div className="relative grid grid-cols-[auto_1fr] items-center gap-x-3 @min-[560px]:grid-cols-[auto_1fr_auto]">
        <PIcon name="pieces/trophy" fallback="🏆" size={64} />
        <div className="min-w-0">
          <p className="font-display text-[28px] font-black leading-tight text-ivory">
            #{c.rank} <span className="text-[17.5px] text-ivory/75">of {c.total}</span>
          </p>
          <p className="font-hand text-[17px] text-gold/90">
            {restaurantNameOf(save)} · {pts(c.reputation)}
          </p>
        </div>
        <div className="hidden @min-[560px]:block">
          <Art name="pieces/emblem" className="h-24 w-24" />
        </div>
      </div>
      <div className="relative">
        {c.next ? (
          <div className="mt-3">
            <GlossBar fraction={c.fraction} label="Progress to the next rival" />
            <p className="mt-1.5 font-ui text-[12.5px] font-bold text-ivory/80">
              Next: pass {c.next.emoji} {c.next.name} {u.when(c.next.passedAtLevel)}
            </p>
            {chef ? (
              <p
                className="mt-1 flex items-start gap-1.5 font-hand text-[16px] leading-snug text-gold/90"
                data-testid="rival-chef-line"
              >
                <ChefFace seed={c.next.id} size={22} />
                <span className="min-w-0">{chefSays(chef, "dare")}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 font-ui text-[12.5px] font-bold text-ivory/75">
            The best restaurant in the city — every rival passed.
          </p>
        )}
        {behind && c.passed ? (
          <p
            className="mt-1.5 flex items-start gap-1.5 font-hand text-[16px] leading-snug text-gold/90"
            data-testid="rival-chef-respect"
          >
            <ChefFace seed={c.passed.id} size={22} />
            <span className="min-w-0">{chefRespects(behind, c.passed)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The rows the leaderboard shows folded: the top 3, then two above you, you, and two below. */
function foldedRows(c: CityRanking) {
  const around = new Set([c.rank - 2, c.rank - 1, c.rank, c.rank + 1, c.rank + 2]);
  return c.table.filter((r) => r.rank <= 3 || around.has(r.rank));
}

/**
 * The city's restaurant guide (restaurant build): every rival and the
 * player, best first. Folded to the top 3 and the rows around the player;
 * "Show all" lists the whole city. Painted card (developer 2026-11-25): laurel medals for 1 to 3 with a painted building each, number pills for the rest, the
 * player's own row gold.
 */
export function CityLeaderboard({ save }: { save: SaveData }) {
  const c = cityRanking(save);
  const [all, setAll] = useState(false);
  const rows = all ? c.table : foldedRows(c);
  return (
    <div data-testid="city-leaderboard">
      <ProgressCard
        title="City restaurant guide"
        icon={<PIcon name="icons-a/skyline" fallback="🏙️" size={26} />}
      >
        <p className="font-hand text-[15px] leading-snug text-walnut/70">
          Every campaign service you complete builds your reputation. Finish all{" "}
          {LAST_CAMPAIGN_LEVEL} to be the city's best.
        </p>
        <ol className="mt-2 space-y-1">
          {rows.map((row, i) => {
            const gap = i > 0 && row.rank - rows[i - 1]!.rank > 1;
            return (
              <li key={row.rival?.id ?? "you"}>
                {gap ? (
                  <p className="py-0.5 text-center font-ui text-[12px] font-bold text-walnut/40">
                    ⋯
                  </p>
                ) : null}
                <div
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-2xl px-2 py-1.5",
                    row.player
                      ? "pg-you"
                      : row.rank <= 3
                        ? "border border-[#ecd9b3] bg-[#fbf1e0]"
                        : "",
                  )}
                  data-city-rank={row.rank}
                  data-city-player={row.player || undefined}
                >
                  <RankMedal rank={row.rank} player={row.player} />
                  {row.player ? (
                    <ChefFace seed="you" size={30} />
                  ) : row.rank <= 3 ? (
                    <Art
                      name={`storefronts/podium-${row.rank}`}
                      className="h-12 w-14 shrink-0"
                      fallback={
                        <span className="grid w-9 place-items-center text-[22px]" aria-hidden>
                          {row.rival ? row.rival.emoji : "🧑‍🍳"}
                        </span>
                      }
                    />
                  ) : (
                    <span className="grid w-9 shrink-0 place-items-center text-[20px]" aria-hidden>
                      {row.rival ? row.rival.emoji : "🧑‍🍳"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-[14px] font-extrabold leading-tight text-walnut-dark">
                      {row.rival ? row.rival.name : restaurantNameOf(save)}
                    </span>
                    <span
                      className={cn(
                        "block truncate font-ui text-[12px] font-bold leading-tight",
                        row.rival ? "text-walnut/55" : "font-hand text-[15px] italic text-copper",
                      )}
                    >
                      {row.rival ? `${row.rival.cuisine} · ${row.rival.district}` : "That's you"}
                    </span>
                  </span>
                  <ValuePill className="shrink-0 px-2.5">
                    <PIcon name="icons-a/star" fallback="⭐" size={16} />
                    {pts(row.reputation)}
                  </ValuePill>
                </div>
              </li>
            );
          })}
        </ol>
        <KButton
          size="sm"
          variant="ghost"
          full
          className="mt-2 min-h-12"
          onClick={() => setAll((v) => !v)}
        >
          {all ? "Show less" : `Show all ${c.total}`}
        </KButton>
      </ProgressCard>
    </div>
  );
}

/** The painted icon of a chef identity (the chip and the title); the emoji of the identity until the picture exists. */
const IDENTITY_ART: Record<string, string> = {
  precision: "icons-a/knife",
  speed: "icons-b/bolt",
  organizer: "icons-b/crate",
  cleanliness: "icons-b/sparkles",
  favourite: "icons-b/heart",
  restaurateur: "icons-a/trophy",
};

/**
 * THE CHEF TITLE (Chef Pride plan, Phase 3a, developer 2026-11-23): the title the player wears (the highest tier earned in any identity), the bar to the next
 * tier of the identity they are furthest along in, and one chip per identity with its stars. Read-only, derived from play (progression/chefTitles.ts); it opens
 * with `CHEF_TITLES_FROM_LEVEL`. Before the first title it says which one is closest.
 */
export function ChefTitleCard({ save }: { save: SaveData }) {
  if (restaurantLevelOf(save.levelProgress) < CHEF_TITLES_FROM_LEVEL) return null;
  const lead = leadingTitle(save);
  // The bar follows the identity the title came from; with no title yet, the closest one to its first tier.
  const goal = lead && lead.next ? lead : nextTitleGoal(save);
  const all = chefTitleStatus(save);
  return (
    <ProgressCard data-testid="chef-title-card">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Your chef title</Eyebrow>
        <InfoTip label="How chef titles are earned">
          Six kinds of chef, four titles each. Precision: perfect cuts, and plates of 95% or better.
          Speed: your fastest plate. Organizer: Fridge Sort crates with three stars. Cleanliness:
          spotless services, and spotless services in a row. Customer Favourite: popularity, and the
          tips customers leave. Restaurateur: places climbed in the city, and Endless stars for the
          top title. A title needs both numbers of its tier. Nothing here costs or pays money.
        </InfoTip>
      </div>
      <p
        className="mt-1 flex items-center gap-2 font-display text-[24px] font-black leading-tight text-walnut-dark"
        data-testid="chef-title-name"
      >
        {lead ? (
          <>
            <PIcon
              name={IDENTITY_ART[lead.identity.id] ?? "icons-a/trophy"}
              fallback={lead.identity.icon}
              size={30}
            />
            {lead.title}
          </>
        ) : (
          "No title yet"
        )}
      </p>
      {goal && goal.next ? (
        <div className="mt-2" data-testid="chef-title-goal">
          <GlossBar fraction={goal.fraction} label="Progress to the next title" />
          <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/75">
            {identityProgressText(save, goal)} to{" "}
            <span className="text-copper">{goal.next.title}</span>
          </p>
        </div>
      ) : (
        <p className="mt-1 font-ui text-[12.5px] font-bold text-olive">
          Every title earned. Legendary!
        </p>
      )}
      {bestPlateOf(save) > 0 || chefRecordOf(save).fastestMs > 0 ? (
        <p
          className="mt-2 font-ui text-[12.5px] font-bold text-walnut/70"
          data-testid="chef-title-records"
        >
          {[
            bestPlateOf(save) > 0 ? `Best plate ${bestPlateOf(save)}%` : null,
            chefRecordOf(save).fastestMs > 0
              ? `Fastest ${Math.round(chefRecordOf(save).fastestMs / 1000)} s`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="chef-title-chips">
        {all.map((s) => (
          <span
            key={s.identity.id}
            data-identity={s.identity.id}
            data-tier={s.tier}
            title={s.title ?? `${s.identity.name}: not yet`}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 font-ui text-[11px] font-extrabold",
              s.tier > 0
                ? "border-[#e2b24a] bg-[linear-gradient(180deg,#fff0b8,#fbd978)] text-walnut-dark"
                : "border-walnut/15 bg-ivory/60 text-walnut/55",
            )}
          >
            <PIcon
              name={IDENTITY_ART[s.identity.id] ?? "icons-a/trophy"}
              fallback={s.identity.icon}
              size={18}
            />
            {s.identity.name}
            <span aria-label={`${s.tier} of 4`} className="text-copper">
              {s.tier > 0 ? "★".repeat(s.tier) : "–"}
            </span>
          </span>
        ))}
      </div>
    </ProgressCard>
  );
}

/** The painted icon of each part of the prestige score. */
const PART_ART: Record<string, [string, string]> = {
  stage: ["icons-a/storefront", "🏪"],
  ranking: ["icons-a/bars", "📊"],
  popularity: ["icons-b/people", "👥"],
  spotless: ["icons-b/sparkles", "✨"],
  endless: ["icons-a/star", "⭐"],
};

/**
 * THE RESTAURANT'S PRESTIGE (Chef Pride plan, Phase 4, developer 2026-11-23: "look what I built"): the tier the restaurant has reached, the bar to the next tier and where
 * the points come from. Read-only, derived from play (restaurant/restaurantPrestige.ts); it opens with `PRESTIGE_FROM_LEVEL`. The parts are a strip of five tiles (developer
 * 2026-11-25): each is one part of the score, with its points, not a second copy of the value.
 */
export function PrestigeCard({ save }: { save: SaveData }) {
  if (restaurantLevelOf(save.levelProgress) < PRESTIGE_FROM_LEVEL) return null;
  const p = restaurantPrestige(save);
  return (
    <ProgressCard data-testid="prestige-card" data-tier={p.tier.index}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Restaurant prestige</Eyebrow>
        <InfoTip label="How prestige works">
          Prestige is how well-known your restaurant is. It grows with your kitchen stage, your
          place in the city ranking, your popularity, your spotless services and your Endless stars.
          It pays nothing: it is yours to be proud of.
        </InfoTip>
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <PIcon name={`icons-b/prestige-${p.tier.index}`} fallback="🏛️" size={40} />
        <div className="min-w-0">
          <p
            className="font-display text-[24px] font-black leading-tight text-walnut-dark"
            data-testid="prestige-tier"
          >
            {p.tier.name}
          </p>
          <p className="font-hand text-[16px] leading-snug text-walnut/70">{p.tier.feel}</p>
        </div>
      </div>
      {p.next ? (
        <div className="mt-2" data-testid="prestige-goal">
          <GlossBar fraction={p.fraction} label="Progress to the next prestige" />
          <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/75">
            {p.points} of {p.next.from} points to <span className="text-copper">{p.next.name}</span>
          </p>
        </div>
      ) : (
        <p className="mt-1 font-ui text-[12.5px] font-bold text-olive">
          The highest prestige. {p.points} points.
        </p>
      )}
      <div
        className="mt-2.5 grid grid-cols-2 gap-1.5 @min-[480px]:grid-cols-3 @min-[900px]:grid-cols-5"
        data-testid="prestige-parts"
      >
        {p.parts.map((part) => {
          const [art, emoji] = PART_ART[part.id] ?? ["icons-a/star", "⭐"];
          return (
            <div
              key={part.id}
              data-part={part.id}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-[#ebd2a0] bg-[#fbf1e0] px-2 py-1.5"
            >
              <PIcon name={art} fallback={emoji} size={26} />
              <span className="min-w-0 flex-1 font-ui text-[12px] font-bold leading-tight text-walnut/75">
                {part.label} <span className="block text-walnut-dark">{part.value}</span>
              </span>
              <span className="shrink-0 font-ui text-[12.5px] font-extrabold text-olive">
                +{part.points}
              </span>
            </div>
          );
        })}
      </div>
    </ProgressCard>
  );
}

/**
 * THE CITY LEAGUE (Chef Pride plan, Phase 5, developer 2026-11-23): this week's table of ten, the player and nine of the city's restaurants, in the player's league. The week
 * runs Monday to Sunday of the device's calendar; the top three go up a league and nothing ever goes down. A contest against the game's restaurants, not other players
 * (restaurant/cityLeague.ts). It opens with `LEAGUE_FROM_LEVEL`.
 */
export function LeagueCard({ save }: { save: SaveData }) {
  const today = useToday();
  const level = restaurantLevelOf(save.levelProgress);
  if (level < LEAGUE_FROM_LEVEL) return null;
  const rec = chefRecordOf(save);
  const v = leagueView(rec, today, level);
  if (!v) return null;
  const last = rec.league?.last ?? null;
  const daysLeft = 7 - dayOfWeek(today);
  return (
    <ProgressCard data-testid="league-card" data-league={v.league.tier}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Eyebrow>City league · this week</Eyebrow>
          <div className="mt-1 flex items-center gap-2.5">
            <PIcon name={`medals/medal-${v.league.tier}`} fallback="🏅" size={40} />
            <div className="min-w-0">
              <p
                className="font-display text-[24px] font-black leading-tight text-walnut-dark"
                data-testid="league-name"
              >
                {v.league.name} League
              </p>
              <p className="font-hand text-[16px] leading-snug text-walnut/70">
                {v.league.identity} ·{" "}
                {daysLeft === 0
                  ? "last day of the week"
                  : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <Art
            name={`medals/badge-${v.league.tier}`}
            className="hidden h-20 w-20 @min-[480px]:block"
          />
          <InfoTip label="How the city league works">
            Each week you earn points: 1 for every perfect cut, 2 for every Clean plate, 10 for
            every finished service and 15 more when it is spotless. The other nine are the city's
            own restaurants, not other players. When the week ends the top three move up a league.
            Nobody ever moves down.
          </InfoTip>
        </div>
      </div>
      <p className="mt-1.5" data-testid="league-goal">
        <ValuePill tone="gold" className="text-left">
          <PIcon name="icons-a/star" fallback="⭐" size={18} />
          {v.rank <= PROMOTION_RANK
            ? v.next
              ? `In the promotion places (top ${PROMOTION_RANK}) for ${v.next.name}`
              : "In the top places of the highest league"
            : `${v.toPromotion ?? 1} more points to reach the top ${PROMOTION_RANK}`}
        </ValuePill>
      </p>
      <ol className="mt-2 space-y-1" data-testid="league-table">
        {v.table.map((r, i) => (
          <li
            key={r.id}
            data-row={r.player ? "player" : "rival"}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-2xl px-2 py-1 font-ui text-[13.5px] font-extrabold",
              r.player ? "pg-you text-walnut-dark" : "bg-[#fbf1e0] text-walnut-dark",
              i + 1 === PROMOTION_RANK && "mb-2 border-b border-dashed border-walnut/30",
            )}
          >
            <RankMedal rank={i + 1} player={r.player} />
            {r.player ? (
              <ChefFace seed="you" size={26} />
            ) : (
              <span className="grid w-7 shrink-0 place-items-center text-[18px]" aria-hidden>
                {r.emoji}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <ValuePill className="shrink-0 px-3">{r.points}</ValuePill>
          </li>
        ))}
      </ol>
      {last ? (
        <p className="mt-2 font-ui text-[12px] font-bold text-walnut/60" data-testid="league-last">
          Last week ({weekStartOf(last.week)}): #{last.rank} of 10
          {last.promoted ? ", promoted" : ""}
        </p>
      ) : null}
      <p className="mt-1.5 font-hand text-[14px] leading-snug text-walnut/55">
        The city's restaurants compete each week. Nobody drops down a league.
      </p>
    </ProgressCard>
  );
}
