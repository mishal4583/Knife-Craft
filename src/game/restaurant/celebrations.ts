/**
 * CELEBRATIONS (developer 2026-11-08: "when the popularity and the ranking increase add a congratulations ... and an appreciation from
 * Paige for maintaining the restaurant properly"). Pure rules: what a finished service or a closed night earned in a way the player
 * should FEEL - a climb in the city ranking, rising popularity, a spotless run. It only reads numbers the game already has and moves no
 * money. The card that shows it is `components/kc/common/CelebrationCard.tsx`.
 */
import type { PaigePose } from "./assistant";
import type { KitchenMoment } from "../kitchenMoments";
import { leagueCard, prestigeCard, rivalCard, titleCard } from "../chefCards";

/** Popularity must rise by at least this much (0-100) for a night to be worth a card. */
export const POPULARITY_CARD_DELTA = 3;
/** A spotless run this long earns Paige's thanks. */
export const SPOTLESS_RUN_FOR_THANKS = 2;

/**
 * The "Top N" lines of the city ranking (developer 2026-11-25, first-20-levels plan row 19: "Top 40! Next: top 25"). Crossing one in a climb retitles the rank card and says what
 * the next line is. Pure presentation: no money, no state. The number of the level that crosses it is not fixed (rank is a function of completed levels), so the card is
 * tied to the rank, not to a level.
 */
export const TOP_LINES = [40, 25, 10, 5, 1] as const;

/** The best (smallest) Top line a climb from `from` to `to` crossed, and the next one after it; null when it crossed none. */
export function topMilestone(from: number, to: number): { top: number; next: number | null } | null {
  const crossed = TOP_LINES.filter((line) => from > line && to <= line);
  if (!crossed.length) return null;
  const top = Math.min(...crossed);
  const after = TOP_LINES.filter((line) => line < top);
  return { top, next: after.length ? Math.max(...after) : null };
}

export type Celebration = {
  /** Stable id of the kind: "rank", "title", "popularity", "spotless" or "chest" (the card's data attribute). */
  kind: "rank" | "popularity" | "spotless" | "chest" | "title" | "prestige" | "league" | "rush";
  emoji: string;
  title: string;
  /** The facts, one short line each. */
  lines: string[];
  /** A painted picture for the card instead of the emoji (game/chefArt.ts): the passed rival's chef, or the prestige tier's emblem. The emoji stays as the fallback. */
  portrait?: { kind: "rival"; id: string } | { kind: "prestige"; tier: number };
  /** Paige's words (appreciation), always one short line. */
  paige: string;
  pose: PaigePose;
  /** Chef Pride, Phase 6: the shareable cards this achievement can be turned into (game/chefCards.ts); the card offers a "Share" button for them. Never shared by itself. */
  shares?: KitchenMoment[];
};

export type CelebrationInput = {
  /** The city ranking climbed (rankChange), or null. `rival`: the last rival passed and what their chef says (rivalChefs.ts), when known. */
  rank: { from: number; to: number; passed: string; rival?: string; rivalId?: string } | null;
  /** Popularity (0-100) before and after, or null when it was not measured this time. */
  popularity: { before: number; after: number } | null;
  /** The spotless streak after this service (serviceReport), 0 when it was not spotless or not measured. */
  spotlessStreak: number;
  /** A chef title earned this service (progression/chefTitles.ts `announceTitles`), or null. */
  title?: { title: string; identity: string } | null;
  /** A restaurant prestige tier reached this service (restaurant/restaurantPrestige.ts `announcePrestige`), or null. */
  prestige?: { tier: string; index?: number } | null;
};

export function celebrationFor(input: CelebrationInput): Celebration | null {
  const popUp =
    input.popularity && input.popularity.after - input.popularity.before >= POPULARITY_CARD_DELTA
      ? input.popularity
      : null;
  const thanks = input.spotlessStreak >= SPOTLESS_RUN_FOR_THANKS;
  const titled = input.title ?? null;
  const prestiged = input.prestige ?? null;
  if (!input.rank && !popUp && !thanks && !titled && !prestiged) return null;

  const milestone = input.rank ? topMilestone(input.rank.from, input.rank.to) : null;
  const lines: string[] = [];
  if (input.rank) {
    lines.push(`#${input.rank.from} → #${input.rank.to} in the city`);
    // A Top line crossed (Top 40, 25, 10, 5, #1): what comes next.
    if (milestone?.next) lines.push(`🎯 Next: Top ${milestone.next}`);
    if (input.rank.passed) lines.push(`You passed ${input.rank.passed}`);
    // Chef Pride (Phase 2): the passed rival's chef answers, in their own voice.
    if (input.rank.rival) lines.push(input.rank.rival);
  }
  // Chef Pride (Phase 4): the restaurant reached a new prestige tier.
  if (prestiged) lines.push(`🏛️ Prestige: ${prestiged.tier}`);
  // Chef Pride (Phase 3a): a new chef title, with the identity it belongs to.
  if (titled) lines.push(`🏅 New title: ${titled.title} (${titled.identity})`);
  if (popUp) lines.push(`⭐ Popularity ${popUp.before} → ${popUp.after}`);
  if (thanks) lines.push(`✨ ${input.spotlessStreak} spotless services in a row`);

  // Her thanks for a spotless run came first before titles existed and still does (bug-batch-qa 3e).
  const paige = thanks
    ? "You keep this place spotless. Guests notice, and so do I!"
    : input.rank
      ? "Look at you climb! Your hard work is paying off."
      : prestiged
        ? "Your restaurant is a name in the city now. Look what you built!"
        : titled
          ? "A new title! Everything you practised is paying off."
          : "Word is getting around. Guests are talking about you!";
  // Chef Pride, Phase 6: the cards this celebration can be shared as (a rival passed, a prestige tier, a title).
  const shares: KitchenMoment[] = [
    ...(input.rank
      ? [
          rivalCard({
            passed: input.rank.passed,
            rankTo: input.rank.to,
            ...(input.rank.rival ? { chefLine: input.rank.rival } : {}),
          }),
        ]
      : []),
    ...(prestiged ? [prestigeCard({ tier: prestiged.tier })] : []),
    ...(titled ? [titleCard({ title: titled.title, identity: titled.identity })] : []),
  ];
  const kind: Celebration["kind"] = input.rank
    ? "rank"
    : prestiged
      ? "prestige"
      : titled
        ? "title"
        : popUp
          ? "popularity"
          : "spotless";
  return {
    kind,
    emoji: input.rank ? "🏆" : prestiged ? "🏛️" : titled ? "🏅" : popUp ? "⭐" : "✨",
    title: input.rank
      ? milestone
        ? milestone.top === 1
          ? "You're #1 in the city!"
          : `You're in the Top ${milestone.top}!`
        : `You climbed to #${input.rank.to}!`
      : prestiged
        ? `Your restaurant is a ${prestiged.tier}!`
        : titled
          ? `New title: ${titled.title}!`
          : popUp
            ? "Your restaurant is getting popular!"
            : "Spotless work!",
    lines,
    ...(input.rank?.rivalId
      ? { portrait: { kind: "rival" as const, id: input.rank.rivalId } }
      : !input.rank && prestiged && prestiged.index !== undefined
        ? { portrait: { kind: "prestige" as const, tier: prestiged.index } }
        : {}),
    paige,
    pose: input.rank || thanks || titled || prestiged ? "cheer" : "clap",
    ...(shares.length ? { shares } : {}),
  };
}

/** What the week-end card of the city league says (restaurant/cityLeague.ts). */
export type LeagueWeekEnd = {
  /** The league the week was played in, and the one the player is in now. */
  league: string;
  identity: string;
  nowLeague: string;
  nowIdentity: string;
  rank: number;
  size: number;
  points: number;
  promoted: boolean;
  /** The best rival of the week and a line from their chef, when known. */
  rival?: { name: string; line: string };
};

/**
 * THE LEAGUE WEEK'S RESULT (Chef Pride plan, Phase 5): shown once, the first time the Kitchen is visited after a league week ended. A promotion is a celebration; any other
 * finish is a calm "good week", never a penalty (there is no demotion).
 */
export function leagueCelebration(w: LeagueWeekEnd): Celebration {
  const lines = [`${w.league} League · #${w.rank} of ${w.size} · ${w.points} points`];
  if (w.promoted) lines.push(`🏅 Promoted to ${w.nowLeague} League · ${w.nowIdentity}`);
  if (w.rival) lines.push(w.rival.line);
  return {
    kind: "league",
    emoji: w.promoted ? "🏅" : "🏆",
    title: w.promoted
      ? `Promoted to ${w.nowLeague} League!`
      : `Week finished #${w.rank} of ${w.size}`,
    lines,
    paige: w.promoted
      ? "A promotion! Look who is playing with the big kitchens now."
      : "A good week, Chef! The table starts fresh on Monday.",
    pose: w.promoted ? "cheer" : "clap",
    ...(w.promoted
      ? {
          shares: [
            leagueCard({
              nowLeague: w.nowLeague,
              nowIdentity: w.nowIdentity,
              rank: w.rank,
              size: w.size,
              points: w.points,
            }),
          ],
        }
      : {}),
  };
}
