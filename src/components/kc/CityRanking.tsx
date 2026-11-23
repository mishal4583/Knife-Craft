import { useState } from "react";
import { useUnlockText } from "./navLevel";
import { KButton, Panel } from "./common/primitives";
import { Bar, Eyebrow } from "./common/Meters";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { restaurantNameOf } from "@/game/restaurant/restaurantName";
import { cityRanking, type CityRanking } from "@/game/restaurant/cityRanking";
import { LAST_CAMPAIGN_LEVEL } from "@/game/restaurant/restaurantProgression";
import { RANKING_NEWS_FROM_LEVEL } from "@/game/config/earlyLevels";
import { PRESTIGE_FROM_LEVEL, restaurantPrestige } from "@/game/restaurant/restaurantPrestige";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { chefSays, rivalChefOf } from "@/game/restaurant/rivalChefs";
import {
  CHEF_TITLES_FROM_LEVEL,
  chefTitleStatus,
  leadingTitle,
  nextTitleGoal,
} from "@/game/progression/chefTitles";

/** "1,880 pts" */
const pts = (n: number) => `${n.toLocaleString("en-US")} pts`;

/**
 * Restaurant Progress' top card (restaurant build, developer 2026-10-09):
 * the restaurant's place in the city guide, its reputation and the next
 * rival to pass (restaurant/cityRanking.ts). Read-only.
 */
export function CityRankHero({ save }: { save: SaveData }) {
  const u = useUnlockText();
  const c = cityRanking(save);
  // Chef Pride (Phase 2): from the ranking news, the next rival's chef says something (rivalChefs.ts).
  const chef =
    c.next && restaurantLevelOf(save.levelProgress) >= RANKING_NEWS_FROM_LEVEL
      ? rivalChefOf(c.next.id)
      : undefined;
  return (
    <div
      className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift"
      data-testid="city-rank-hero"
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.3),transparent_70%)]" />
      <div className="relative">
        <Eyebrow dark>City ranking</Eyebrow>
        <p className="mt-1 font-display text-[26px] font-black leading-tight text-ivory">
          🏆 #{c.rank} <span className="text-[17.5px] text-ivory/75">of {c.total}</span>
        </p>
        <p className="font-hand text-[17px] text-gold/90">
          {restaurantNameOf(save)} · {pts(c.reputation)}
        </p>
        {c.next ? (
          <div className="mt-3">
            <Bar fraction={c.fraction} />
            <p className="mt-1.5 font-ui text-[12px] font-bold text-ivory/75">
              Next: pass {c.next.emoji} {c.next.name} {u.when(c.next.passedAtLevel)}
            </p>
            {chef ? (
              <p
                className="mt-1 font-hand text-[16px] leading-snug text-gold/90"
                data-testid="rival-chef-line"
              >
                👨‍🍳 {chefSays(chef, "dare")}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 font-ui text-[12.5px] font-bold text-ivory/75">
            The best restaurant in the city — every rival passed.
          </p>
        )}
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
 * "Show all" lists the whole city.
 */
export function CityLeaderboard({ save }: { save: SaveData }) {
  const c = cityRanking(save);
  const [all, setAll] = useState(false);
  const rows = all ? c.table : foldedRows(c);
  return (
    <div data-testid="city-leaderboard">
      <Panel className="p-4">
        <Eyebrow>🏙️ City restaurant guide</Eyebrow>
        <p className="mt-0.5 font-hand text-[15px] leading-snug text-walnut/70">
          Every campaign service you complete builds your reputation. Finish all{" "}
          {LAST_CAMPAIGN_LEVEL} to be the city's best.
        </p>
        <ol className="mt-2">
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
                    "flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5",
                    row.player ? "bg-copper/15 ring-1 ring-copper/40" : "",
                  )}
                  data-city-rank={row.rank}
                  data-city-player={row.player || undefined}
                >
                  <span
                    className={cn(
                      "w-8 shrink-0 text-center font-display text-[15px] font-black",
                      row.rank <= 3 ? "text-copper" : "text-walnut/60",
                    )}
                  >
                    {row.rank === 1
                      ? "🥇"
                      : row.rank === 2
                        ? "🥈"
                        : row.rank === 3
                          ? "🥉"
                          : row.rank}
                  </span>
                  <span className="text-[18px]" aria-hidden>
                    {row.rival ? row.rival.emoji : "🧑‍🍳"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-[13.5px] font-extrabold leading-tight text-walnut-dark">
                      {row.rival ? row.rival.name : restaurantNameOf(save)}
                    </span>
                    <span className="block truncate font-ui text-[12px] font-bold text-walnut/55">
                      {row.rival ? `${row.rival.cuisine} · ${row.rival.district}` : "That's you"}
                    </span>
                  </span>
                  <span className="shrink-0 font-ui text-[12px] font-extrabold text-walnut/70">
                    {pts(row.reputation)}
                  </span>
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
      </Panel>
    </div>
  );
}

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
    <Panel className="p-4" data-testid="chef-title-card">
      <Eyebrow>Your chef title</Eyebrow>
      <p
        className="mt-1 font-display text-[22px] font-black leading-tight text-walnut-dark"
        data-testid="chef-title-name"
      >
        {lead ? `${lead.identity.icon} ${lead.title}` : "No title yet"}
      </p>
      {goal && goal.next ? (
        <div className="mt-2" data-testid="chef-title-goal">
          <Bar fraction={goal.fraction} />
          <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/75">
            {goal.value} of {goal.next.target} {goal.identity.unit} to{" "}
            <span className="text-copper">{goal.next.title}</span>
          </p>
        </div>
      ) : (
        <p className="mt-1 font-ui text-[12.5px] font-bold text-olive">
          Every title earned. Legendary!
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="chef-title-chips">
        {all.map((s) => (
          <span
            key={s.identity.id}
            data-identity={s.identity.id}
            data-tier={s.tier}
            title={s.title ?? `${s.identity.name}: not yet`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-ui text-[11px] font-extrabold",
              s.tier > 0
                ? "border-gold/70 bg-gold/25 text-walnut-dark"
                : "border-walnut/15 bg-ivory/60 text-walnut/55",
            )}
          >
            <span aria-hidden="true">{s.identity.icon}</span>
            {s.identity.name}
            <span aria-label={`${s.tier} of 4`} className="text-copper">
              {s.tier > 0 ? "★".repeat(s.tier) : "–"}
            </span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

/**
 * THE RESTAURANT'S PRESTIGE (Chef Pride plan, Phase 4, developer 2026-11-23: "look what I built"): the tier the restaurant has reached, the bar to the next tier and where
 * the points come from. Read-only, derived from play (restaurant/restaurantPrestige.ts); it opens with `PRESTIGE_FROM_LEVEL`.
 */
export function PrestigeCard({ save }: { save: SaveData }) {
  if (restaurantLevelOf(save.levelProgress) < PRESTIGE_FROM_LEVEL) return null;
  const p = restaurantPrestige(save);
  return (
    <Panel className="p-4" data-testid="prestige-card" data-tier={p.tier.index}>
      <Eyebrow>Restaurant prestige</Eyebrow>
      <p
        className="mt-1 font-display text-[22px] font-black leading-tight text-walnut-dark"
        data-testid="prestige-tier"
      >
        🏛️ {p.tier.name}
      </p>
      <p className="font-hand text-[16px] leading-snug text-walnut/70">{p.tier.feel}</p>
      {p.next ? (
        <div className="mt-2" data-testid="prestige-goal">
          <Bar fraction={p.fraction} />
          <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/75">
            {p.points} of {p.next.from} points to <span className="text-copper">{p.next.name}</span>
          </p>
        </div>
      ) : (
        <p className="mt-1 font-ui text-[12.5px] font-bold text-olive">
          The highest prestige. {p.points} points.
        </p>
      )}
      <div className="mt-2.5 space-y-0.5" data-testid="prestige-parts">
        {p.parts.map((part) => (
          <div
            key={part.id}
            data-part={part.id}
            className="flex items-center justify-between gap-3 font-ui text-[12.5px] font-bold text-walnut/75"
          >
            <span>
              {part.label} <span className="text-walnut/50">· {part.value}</span>
            </span>
            <span className="font-extrabold text-olive">+{part.points}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
