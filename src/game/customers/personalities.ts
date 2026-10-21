import type { QualityLabel } from "@/types/game";
import type { CustomerDefinition } from "./customerTypes";

/**
 * PERSONALITIES — Phase 4 (B, developer 2026-10-21): five memorable
 * customers — the Food Critic, the Impatient Regular, the Mystery Customer,
 * Grandma's Old Friend and the Giant Eater.
 *
 * A personality is PRESENTATION over an ordinary service order: the order,
 * its recipe, its customer id, its pay, its tip rule, the Knife Report and
 * the Serve → payment path are exactly the normal ones (the order engine
 * never knows). What changes is who the player sees: the name and avatar
 * on the order card and the serve card, a short arrival card, and a
 * reaction line that follows the dish's REAL grade (the same QualityLabel
 * its pay came from) — and, for the Regular, how long the prep really took.
 * No personality pays, charges, saves or remembers anything.
 *
 * WHEN (deterministic, this page session only — a reload starts over):
 * - only a service order (there is a customer), never one that teaches a
 *   technique (coaching.ts), never before campaign Level MIN_LEVEL (any
 *   Business order qualifies);
 * - the FIRST_AT-th eligible order gets the first one, then every EVERY-th,
 *   in the fixed ROTATION — so four ordinary customers come between two
 *   special ones;
 * - decided once per order id and cached, so the HUD, the serve card, a
 *   React StrictMode double render or a remount of the same order all see
 *   the same customer (and no counter moves twice).
 * The existing twelve customers stay the pool for every other order.
 */
export type PersonalityId =
  "food-critic" | "impatient-regular" | "mystery-customer" | "grandmas-old-friend" | "giant-eater";

export const PERSONALITY_CADENCE = {
  FIRST_AT: 2,
  EVERY: 5,
  MIN_LEVEL: 4,
  ROTATION: [
    "food-critic",
    "impatient-regular",
    "mystery-customer",
    "grandmas-old-friend",
    "giant-eater",
  ] as const satisfies readonly PersonalityId[],
  /** How many decided orders are remembered (bounded). */
  CACHE: 64,
} as const;

export type PersonalityDef = {
  id: PersonalityId;
  /** Shown as the customer's name. */
  name: string;
  avatarEmoji: string;
  /** The small mark beside the avatar (and the card's accent). */
  badge: string;
  /** The arrival card: one short line under the name. */
  entrance: string;
  /** Replaces the customer's greeting on the order card. */
  greeting: string;
};

export const PERSONALITIES: Record<PersonalityId, PersonalityDef> = {
  "food-critic": {
    id: "food-critic",
    name: "The Food Critic",
    avatarEmoji: "🧐",
    badge: "📝",
    entrance: "Notebook open. Tonight, the knife work is under review.",
    greeting: "I'll be judging the cuts, not the décor.",
  },
  "impatient-regular": {
    id: "impatient-regular",
    name: "The Regular",
    avatarEmoji: "🙎‍♂️",
    badge: "⏱️",
    entrance: "Same table, same order — and he's already checking his watch.",
    greeting: "The usual — and quick, please!",
  },
  "mystery-customer": {
    id: "mystery-customer",
    name: "Mystery Guest",
    avatarEmoji: "🕵️",
    badge: "❔",
    entrance: "A stranger in a long coat takes the corner table.",
    greeting: "Surprise me.",
  },
  "grandmas-old-friend": {
    id: "grandmas-old-friend",
    name: "Grandma's Old Friend",
    avatarEmoji: "👵🏻",
    badge: "💐",
    entrance: "She used to sit at this very table with your grandmother.",
    greeting: "Let's see what you've learned, dear.",
  },
  "giant-eater": {
    id: "giant-eater",
    name: "Big Bruno",
    avatarEmoji: "🧔‍♂️",
    badge: "🍽️",
    entrance: "The chair creaks. Bruno has arrived — and he is hungry.",
    greeting: "One portion? Make it a big one!",
  },
};

/** Who the Mystery Guest turns out to be (fixed, in turn). */
export const MYSTERY_REVEALS: readonly string[] = [
  "a travelling chef",
  "the food writer from the morning paper",
  "the baker from across the square",
  "one of Grandma's old kitchen crew",
];

/** `levelOk`: a Business order, or campaign Level MIN_LEVEL+ (App decides). */
export type Eligibility = { service: boolean; teaching: boolean; levelOk: boolean };

export function personalityEligible(e: Eligibility): boolean {
  return e.service && !e.teaching && e.levelOk;
}

let eligibleOrders = 0;
let specialsSoFar = 0;
const decided = new Map<string, { id: PersonalityId; nth: number } | null>();
let forced: PersonalityId | null = null;

/** Whether the n-th eligible order (1-based) is a special customer's. */
export function isPersonalitySlot(n: number): boolean {
  return (
    n >= PERSONALITY_CADENCE.FIRST_AT &&
    (n - PERSONALITY_CADENCE.FIRST_AT) % PERSONALITY_CADENCE.EVERY === 0
  );
}

/**
 * This order's special customer (or null) — decided the first time the
 * order is asked about, then cached for its id.
 */
export function personalityForOrder(
  orderId: string,
  e: Eligibility,
): { id: PersonalityId; nth: number } | null {
  if (decided.has(orderId)) return decided.get(orderId)!;
  let out: { id: PersonalityId; nth: number } | null = null;
  if (personalityEligible(e)) {
    if (forced) {
      // Development hook only (kitchenChaos.ts' __kcSpecials): this order, counters untouched.
      out = { id: forced, nth: specialsSoFar };
      forced = null;
    } else {
      eligibleOrders += 1;
      if (isPersonalitySlot(eligibleOrders)) {
        const r = PERSONALITY_CADENCE.ROTATION;
        out = { id: r[specialsSoFar % r.length]!, nth: specialsSoFar };
        specialsSoFar += 1;
      }
    }
  }
  decided.set(orderId, out);
  if (decided.size > PERSONALITY_CADENCE.CACHE) decided.delete(decided.keys().next().value!);
  return out;
}

/** The next eligible order's customer (null clears it). For the browser tests' development hook. */
export function forceNextPersonality(id: PersonalityId | null): void {
  forced = id;
}

/** Test hook: a fresh page session. */
export function resetPersonalitiesForTests(): void {
  eligibleOrders = 0;
  specialsSoFar = 0;
  decided.clear();
  forced = null;
}

/** The customer the player sees for this order: the personality's face and name over the order's own customer. */
export function presentedCustomer(
  customer: CustomerDefinition,
  p: PersonalityId | null,
): CustomerDefinition {
  if (!p) return customer;
  const d = PERSONALITIES[p];
  return { ...customer, name: d.name, avatarEmoji: d.avatarEmoji, greeting: d.greeting };
}

// ── the Impatient Regular's clock (cosmetic) ────────────────────────────
/**
 * How long the Regular expects to wait: the game has no service timer, so
 * this is a documented, generous par — 8 s plus 1.5 s per cut the order
 * asks for — measured on unpaused prep time only. Passing it never costs
 * anything: he just says so (once, on the order card) and reacts at Serve.
 */
export const REGULAR_PAR = { BASE_MS: 8000, PER_CUT_MS: 1500 } as const;
export function regularParMs(totalCuts: number): number {
  return REGULAR_PAR.BASE_MS + REGULAR_PAR.PER_CUT_MS * Math.max(0, totalCuts);
}

// ── reactions ───────────────────────────────────────────────────────────
type Band = "top" | "good" | "fair" | "rough";
function band(q: QualityLabel | undefined): Band {
  return q === "Masterful" ? "top" : q === "Clean" ? "good" : q === "Honest" ? "fair" : "rough";
}

export type PersonalityReaction = {
  line: string;
  /** The avatar's motion — the same cheer / nod the serve card already has. */
  mood: "cheer" | "nod" | null;
  /** The Mystery Guest's identity, revealed at Serve. */
  reveal?: string;
};

const LINES: Record<
  Exclude<PersonalityId, "impatient-regular" | "mystery-customer">,
  Record<Band, string>
> = {
  "food-critic": {
    top: "Exquisite. I'll be writing about this.",
    good: "Precise, clean work. A fine plate.",
    fair: "Competent — the cuts could be more even.",
    rough: "Rustic. The heart is there; the knife isn't, yet.",
  },
  "grandmas-old-friend": {
    top: "Just like your grandmother made it. She'd be so proud.",
    good: "That takes me right back to this very table.",
    fair: "She'd tell you to slow your knife down — but it's lovely.",
    rough: "Ah, her first ones looked just like this, too.",
  },
  "giant-eater": {
    top: "Gone in one bite! Best plate I've had all week!",
    good: "Delicious! …Is there more?",
    fair: "Tasty! I could eat three more.",
    rough: "Still hungry — but thanks, chef!",
  },
};
const MYSTERY_LINES: Record<Band, string> = {
  top: "“Remarkable. I'll be back.”",
  good: "“Very good indeed.”",
  fair: "“Not bad at all.”",
  rough: "“Hm. Interesting.”",
};

/**
 * What the special customer says at Serve — from the dish's real grade
 * (and for the Regular, whether the prep beat his par). Never a payment:
 * the serve card shows the money from the normal settlement.
 */
export function personalityReaction(
  p: { id: PersonalityId; nth: number },
  quality: QualityLabel | undefined,
  prep?: { ms: number; parMs: number },
): PersonalityReaction {
  const b = band(quality);
  const mood = b === "top" ? "cheer" : b === "good" ? "nod" : null;
  switch (p.id) {
    case "impatient-regular": {
      const onTime = prep ? prep.ms <= prep.parMs : true;
      return {
        line: onTime
          ? b === "rough"
            ? "Fast, at least! Same again tomorrow."
            : "Right on time — that's why I keep coming back!"
          : b === "top" || b === "good"
            ? "Finally! …All right. Worth the wait."
            : "Finally! I nearly missed my bus.",
        mood: onTime ? mood : b === "top" ? "nod" : null,
      };
    }
    case "mystery-customer":
      return {
        line: MYSTERY_LINES[b],
        mood,
        reveal: MYSTERY_REVEALS[p.nth % MYSTERY_REVEALS.length]!,
      };
    default:
      return { line: LINES[p.id][b], mood };
  }
}
