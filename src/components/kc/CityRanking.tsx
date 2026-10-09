import { useState } from "react";
import { KButton, Panel } from "./common/primitives";
import { Bar, Eyebrow } from "./common/Meters";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { PLAYER_RESTAURANT_NAME } from "@/game/progression/restaurantProgress";
import { cityRanking, type CityRanking } from "@/game/restaurant/cityRanking";

/** "1,880 pts" */
const pts = (n: number) => `${n.toLocaleString("en-US")} pts`;

/**
 * Restaurant Progress' top card (restaurant build, developer 2026-10-09):
 * the restaurant's place in the city guide, its reputation and the next
 * rival to pass (restaurant/cityRanking.ts). Read-only.
 */
export function CityRankHero({ save }: { save: SaveData }) {
  const c = cityRanking(save);
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
          {PLAYER_RESTAURANT_NAME} · {pts(c.reputation)}
        </p>
        {c.next ? (
          <div className="mt-3">
            <Bar fraction={c.fraction} />
            <p className="mt-1.5 font-ui text-[12px] font-bold text-ivory/75">
              Next: pass {c.next.emoji} {c.next.name} at Level {c.next.passedAtLevel}
            </p>
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
          Every campaign service you complete builds your reputation. Finish all 250 to be the
          city's best.
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
                      {row.rival ? row.rival.name : PLAYER_RESTAURANT_NAME}
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
