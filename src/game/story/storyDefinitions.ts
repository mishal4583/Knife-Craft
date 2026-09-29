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

/** FINALE (4 beats) — ported verbatim from knifecraft.html:10977. Gated `n >= 100 && !story.finaleSeen`. Copy freeze: "You built this." / "They would be proud." — "We did it." must never appear. */
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
 */
export const MILES: MilestoneDef[] = [
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
    bit: 64,
    at: 250,
    kicker: "CAMPAIGN COMPLETE",
    line: "All 250 levels mastered. Every kitchen this place ever held is still here, all at once.",
  },
];

/** Full mask value once all 7 milestones have fired — ported verbatim from the source's own regression-harness mute value for the first 4, extended for the Progression pass's two, then Phase 6's own. Stays correct only while there are exactly 7 milestones. */
export const MILES_FULL_MASK = 127;

/** The finale's own gate — ported verbatim from `n >= 100`. */
export const FINALE_AT = 100;
