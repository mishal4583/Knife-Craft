/**
 * THE CHEF'S SHAREABLE CARDS (the "Chef Pride" plan, Phase 6, developer 2026-11-23: "a picture worth showing off").
 *
 * Four cards for what the CHEF achieved, drawn by the same canvas renderer as the Kitchen Moment cards (components/kc/moments/momentCard.ts) and previewed by the same
 * preview (MomentPreview): a chef title earned, a restaurant prestige tier reached, a league promotion, a rival restaurant passed. They are offered on the celebration card
 * that already announces the achievement, only as a "Share" button the player taps: nothing is ever shared automatically, nothing is uploaded, nothing is copied (no
 * clipboard), no outside call; the button is hidden where sharing is not allowed (YouTube, `sharingAllowed()`).
 *
 * Every line on a card is a real fact of the achievement (the title, the tier, the league and the place, the rival passed and what their chef said): no population claim
 * ("only 8% of chefs..."), no money, no personal data. Pure: builders only, no clock, no random, nothing stored.
 */
import type { KitchenMoment } from "./kitchenMoments";
import { PRESTIGE_TIERS } from "./restaurant/restaurantPrestige";

const base = (kind: KitchenMoment["kind"], key: string, heading: string) => ({
  kind,
  runKey: `chef:${kind}:${key}`,
  // The file name slug (cardFileName) reads this: the heading is the best name for a chef card.
  dishName: heading,
});

/** A chef title earned ("Precision Chef"), with the identity it belongs to. */
export function titleCard(input: { title: string; identity: string }): KitchenMoment {
  return {
    ...base("title", input.title, input.title),
    emoji: "🏅",
    heading: input.title,
    badge: `Chef title · ${input.identity}`,
    lines: [`I earned the ${input.title} title`],
    shareText: `I just earned the ${input.title} title in KnifeCraft!`,
  };
}

/** A restaurant prestige tier reached. */
export function prestigeCard(input: { tier: string }): KitchenMoment {
  const t = PRESTIGE_TIERS.find((x) => x.name === input.tier);
  return {
    ...base("prestige", input.tier, input.tier),
    emoji: "🏛️",
    heading: input.tier,
    badge: "Restaurant prestige",
    lines: t
      ? [t.feel, "My restaurant is a name in the city"]
      : ["My restaurant is a name in the city"],
    shareText: `My KnifeCraft restaurant just became a ${input.tier}!`,
  };
}

/** A promotion in the city league ("Silver League"), with the place the week ended in. */
export function leagueCard(input: {
  nowLeague: string;
  nowIdentity: string;
  rank: number;
  size: number;
  points: number;
}): KitchenMoment {
  return {
    ...base("league", `${input.nowLeague}-${input.points}`, `${input.nowLeague} League`),
    emoji: "🏅",
    heading: `${input.nowLeague} League`,
    badge: `Promoted · ${input.nowIdentity}`,
    lines: [`Finished #${input.rank} of ${input.size} this week`, `${input.points} league points`],
    shareText: `I was promoted to the ${input.nowLeague} League in KnifeCraft!`,
  };
}

/** A rival restaurant passed in the city ranking, and what its chef said. */
export function rivalCard(input: {
  passed: string;
  rankTo: number;
  chefLine?: string;
}): KitchenMoment {
  // The restaurants' emojis do not draw in the card's heading font: the names only.
  const passed = input.passed.replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, "").trim();
  return {
    ...base("rival", `${input.rankTo}`, `Passed ${passed}`),
    emoji: "🏆",
    heading: `Passed ${passed}`,
    badge: `City ranking · #${input.rankTo}`,
    lines: input.chefLine ? [input.chefLine] : [`Now #${input.rankTo} in the city`],
    shareText: `My KnifeCraft restaurant just climbed to #${input.rankTo} in the city!`,
  };
}
