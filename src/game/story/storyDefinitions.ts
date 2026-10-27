import { CAMPAIGN_150_SOURCE_LEVEL_NUMBERS } from "../levels/campaignSelection";

/**
 * STORY_DEFINITIONS — THE LAST WISH, ported directly (data, not
 * paraphrased) from knifecraft.html's actual `Story` IIFE
 * (`knifecraft.html:10772`). `FINALE` (`:10977`) and `MILES` (`:10997`)
 * are copied verbatim from the source. The opening intro started as beats
 * here too and is now the painted cinematic (introCinematic.ts).
 *
 * Two things the source has that this port intentionally does NOT carry
 * over, because production has no equivalent system and inventing one
 * is out of scope for this pass:
 *
 * - `cam` (a cinematic camera-pan system, `Camera.go(name, ms)`) —
 *   production has no story-driven camera; every beat just renders as a
 *   full-screen overlay over whatever's already on screen.
 * - `onEnter` (a per-beat callback, used only by the CHEF sequence's own
 *   last beat to call `SceneFlow.prep(); startRecipe(0)`) — production's
 *   equivalent is simply StoryOverlay's own `onDone` callback, fired
 *   once after the LAST beat in a sequence, which the caller (App.tsx)
 *   already uses to decide what screen to land on next.
 *
 * `tint`/`veil`/`bare` are carried as data so the renderer CAN use them
 * for a visual treatment matching the source's own (a warm/faded/clean/
 * thriving color wash, a darkening veil behind art, hiding the normal
 * game chrome) — StoryOverlay.tsx is where that's actually applied.
 */

/** One card shown in the Fresh-Start "your savings" beat — ported from the source's `const CARDS`. */
import { remapCampaignThreshold } from "../levels/campaignSelection";

export type StoryCardId = "board" | "knife" | "ing";

/** One line of on-screen dialogue — ported from the source's `dlg:{who,art,say,side?}` shape. */
export type StoryDialogue = {
  who: string;
  /** Key into STORY_ART (storyArt.ts) — "chef" or "you". */
  art: "chef" | "you";
  say: string;
  side?: "you";
};

export type StoryBeat = {
  tint: "sFaded" | "sDecline" | "sClean" | "sThrive";
  /** Hides the normal game chrome behind the story overlay — every beat in this port is `bare`. */
  bare?: boolean;
  /** Darkens behind the beat's own art, for a scene (bedside/dining) rather than a plain color wash. */
  veil?: boolean;
  /** Key into STORY_ART (storyArt.ts). */
  art?: "bedside" | "keys" | "dining";
  /** `sProp` in the source — the keys render as a small held prop, not a full scene. Cosmetic only. */
  artClass?: "sProp";
  fx?: "dust" | "spark" | "coins";
  lines?: string[];
  quote?: string;
  /** Present only on a beat that waits for a tap instead of auto-advancing after `hold` ms. */
  btn?: string;
  kicker?: string;
  title?: string;
  step?: string;
  cards?: StoryCardId[];
  dlg?: StoryDialogue;
  /** Auto-advance delay in ms — ignored (the beat waits for `btn` instead) when `btn` is present. */
  hold?: number;
};

/*
 * The opening intro is no longer a beat sequence: it is the painted
 * cinematic in introCinematic.ts (played by CinematicIntro.tsx). The
 * beats below (FINALE) still play through StoryOverlay.
 */

/** FINALE (4 beats), shown at the midpoint of the curated campaign. */
export const FINALE: StoryBeat[] = [
  {
    tint: "sThrive",
    hold: 4200,
    // no art — the room IS the art: the restored kitchen the player has been standing in all along.
    lines: ["You came here to keep a promise.", "You stayed because you wanted to."],
  },
  {
    tint: "sThrive",
    hold: 4400,
    lines: [
      "Years ago, this place was almost forgotten.",
      "Today, it’s the best restaurant in town.",
    ],
  },
  {
    tint: "sThrive",
    veil: true,
    art: "dining",
    hold: 4600,
    lines: ["You didn’t just inherit your grandparent’s restaurant.", "You built this."],
  },
  {
    tint: "sThrive",
    veil: true,
    art: "dining",
    title: "THE RESTAURANT LIVES ON",
    quote: "They would be proud.",
    btn: "BACK TO THE KITCHEN",
  },
];

export type MilestoneDef = { bit: number; at: number; kicker: string; line: string };

/**
 * MILES — the first 4 entries (bits 1/2/4/8) are ported verbatim from
 * knifecraft.html:10997, with one corrective-pass change: the first
 * milestone's `at` moved from 8 to 10, matching the progression pass's
 * required new-save sequence (Level 10/20/45/70/100). This is safe for
 * existing saves: `checkStoryFlush` only ever fires a bit once
 * (`!(mask & bit)`), so a save that already fired bit 1 at count 8 is
 * completely unaffected (the mask already has it set, forward-only); a
 * save that hasn't reached count 8 yet simply fires it two levels later
 * than before — never a replay, never a re-fire.
 *
 * Two entries (bits 16/32) extend the campaign's own milestone beats to
 * the Progression pass's Chapter 11/12 (110/120). A seventh (bit 64) does
 * the same for Phase 6's own campaign-completion point (250) — `at`
 * stays a count of distinct completed levels, exactly like every other
 * entry (see StoryManager.ts's `playedCount`), so these just naturally
 * fire once a player reaches that many completed levels, campaign-order
 * or not. This is deliberately NOT a second FINALE: FINALE/FINALE_AT
 * below stay frozen exactly as shipped (their own copy is explicitly
 * frozen, see FINALE's own doc) — Level 250 gets one more forward-only
 * milestone beat, the same mechanism Levels 110/120 already used, never
 * a second one-time finale sequence.
 *
 * Story for Levels 121–250 (developer 2026-10-11, text approved
 * verbatim): four more milestones on free mask bits (128/256/512/1024 at
 * 140/165/190/220), and the bit-64 "CAMPAIGN COMPLETE" banner is retired —
 * Level 250 now plays LEGACY ("THE LAST PAGE", below), which marks bit 64
 * along with its own LEGACY_BIT so a save that already saw the old banner
 * never sees it again. FINALE / FINALE_AT stay exactly as shipped.
 */
const SOURCE_MILES: MilestoneDef[] = [
  {
    bit: 1,
    at: 10,
    kicker: "THE ROOM COMES BACK",
    line: "It’s starting to feel like a real restaurant again.",
  },
  { bit: 2, at: 20, kicker: "WORD GETS AROUND", line: "People are coming back." },
  {
    bit: 4,
    at: 45,
    kicker: "SOMETHING WORTH KEEPING",
    line: "I never thought I’d care this much about this place.",
  },
  { bit: 8, at: 70, kicker: "THE LAST WISH", line: "They would have loved seeing this." },
  {
    bit: 16,
    at: 110,
    kicker: "THE KITCHEN GROWS",
    line: "There’s meat and fish on the board now. This kitchen keeps changing.",
  },
  {
    bit: 32,
    at: 120,
    kicker: "GRAND SERVICE",
    line: "Every station, every dish — the kitchen you built runs itself now.",
  },
  {
    bit: 128,
    at: 140,
    kicker: "A NAME IN TOWN",
    line: "Strangers come in asking for the house dish by name now.",
  },
  {
    bit: 256,
    at: 165,
    kicker: "THE NEXT GENERATION",
    line: "A young cook asked to learn from me today. I remember asking the same.",
  },
  {
    bit: 512,
    at: 190,
    kicker: "ONE OF THE BEST",
    line: "The city guide put us on its list. The first page.",
  },
  {
    bit: 1024,
    at: 220,
    kicker: "THE OLD RECIPE BOOK",
    line: "I found their old recipe book in the cellar. The last page is blank.",
  },
];

export const MILES: MilestoneDef[] = SOURCE_MILES.map((milestone) => ({
  ...milestone,
  at: remapCampaignThreshold(milestone.at),
}));
/** The retired Level 250 "CAMPAIGN COMPLETE" banner's bit — marked with LEGACY_BIT, never shown again. */
export const RETIRED_CAMPAIGN_COMPLETE_BIT = 64;

/** Full mask value once every milestone (and the retired 250 banner) has fired — derived, so it can't go stale. */
export const MILES_FULL_MASK = MILES.reduce(
  (mask, m) => mask | m.bit,
  RETIRED_CAMPAIGN_COMPLETE_BIT,
);

/** The narrative midpoint of the curated campaign. */
export const FINALE_AT = Math.ceil(CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.length / 2);

/**
 * LEGACY — "THE LAST PAGE", the Level 250 ending (developer 2026-10-11,
 * text approved verbatim). Plays once through StoryOverlay like FINALE,
 * gated on LEGACY_BIT in `story.milestoneMask` (no new save field). The
 * narrative never names the grandparent ("they"), never reuses FINALE's
 * frozen lines, and "We did it." never appears.
 */
export const LEGACY: StoryBeat[] = [
  {
    tint: "sThrive",
    art: "keys",
    artClass: "sProp",
    fx: "dust",
    hold: 4200,
    lines: ["Every recipe they ever wrote is in here.", "Except the last page."],
  },
  {
    tint: "sThrive",
    hold: 4400,
    lines: ["One hundred and fifty dishes later,", "you know what belongs on it."],
  },
  {
    tint: "sThrive",
    veil: true,
    art: "dining",
    hold: 4600,
    lines: ["It isn’t a recipe.", "It’s this room. Full, every night."],
  },
  {
    tint: "sThrive",
    veil: true,
    art: "dining",
    fx: "spark",
    title: "THE LAST PAGE",
    quote: "They asked you to keep it alive. You did more than that.",
    btn: "BACK TO THE KITCHEN",
  },
];

/** LEGACY's own bit in `story.milestoneMask`, and the completed-level count that plays it. */
export const LEGACY_BIT = 2048;
export const LEGACY_AT = CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.length;
