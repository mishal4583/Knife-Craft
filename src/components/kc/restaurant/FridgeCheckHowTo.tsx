import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { INGREDIENTS } from "@/game/definitions";
import {
  checkTiers,
  type CheckCard,
  type CheckStage,
  type CheckTier,
  type Verdict,
} from "@/game/restaurant/fridgeCheck";
import { SortButton } from "../inventory/sort/SortParts";
import { FcArt, InspectionCard, SHELF_LIFE_GUIDE } from "./FridgeCheckParts";

/**
 * FRIDGE CHECK — THE HOW-TO TOUR (developer 2026-11-07: "no proper instruction when I played the third mini game... show beginners how the game
 * works, what is spoiled, what is good to use, and everything"). A few short pages with the game's OWN pictures (the same food picture and paper
 * card the game draws), in the order a beginner needs them: what the game is, what fresh / going-off / spoiled look like, how to count the days,
 * how to answer, and what it earns. It shows by itself once per stage (saved as seen), and again from the "?" button any time. Presentation only.
 */

const sample = (
  id: CheckCard["id"],
  age: number,
  shelfLife: number,
  state: CheckCard["state"],
  verdict: Verdict,
): CheckCard => ({
  id,
  name: INGREDIENTS[id].name,
  quantity: 2,
  age,
  shelfLife,
  state,
  verdict,
  expires: 0,
  daysLeft: Math.max(0, shelfLife - age - 1),
  category: INGREDIENTS[id].category,
});

/** The three states of ONE vegetable (7 days of life): fresh on day 1, going off on day 5, spoiled on day 6 (judged for tomorrow). */
const FRESH = sample("tomato", 1, 7, "FRESH", "keep");
const GOING_OFF = sample("tomato", 5, 7, "NEAR_EXPIRY", "use-first");
const SPOILED = sample("tomato", 6, 7, "EXPIRED", "bin");

const CHIP: Record<Verdict, { label: string; cls: string }> = {
  keep: { label: "KEEP", cls: "bg-[#3f8a52] text-white" },
  "use-first": { label: "USE NEXT", cls: "bg-[#c98a1f] text-white" },
  bin: { label: "BIN", cls: "bg-[#b4452f] text-white" },
};

function Chip({ v }: { v: Verdict }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 font-ui text-[12px] font-black tracking-wide",
        CHIP[v].cls,
      )}
    >
      {CHIP[v].label}
    </span>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

type Page = { title: string; art?: string; body: ReactNode };

function sortPages(tier: CheckTier, measure: "lb" | "kg"): Page[] {
  const cueLevel = checkTiers()[0]!.from; // the card with every hint on
  const three = tier.piles === 3;
  const kinds: [CheckCard, string][] = [
    [FRESH, "Fresh. Bright and clean."],
    ...(three
      ? ([[GOING_OFF, "Going off. Dull and spotty. Cook it first."]] as [CheckCard, string][])
      : []),
    [SPOILED, "Spoiled. Mold, grey, flies."],
  ];
  return [
    {
      title: "Fresh or spoiled?",
      art: "bin-open",
      body: (
        <ol className="grid gap-2 text-left">
          <Line icon="🧊">Every card is real food in your fridge.</Line>
          <Line icon="🌙">Closing Time throws out what has spoiled. You judge it first.</Line>
          <Line icon="⭐">Right answers give stars and Hype. Nothing here costs money.</Line>
        </ol>
      ),
    },
    {
      title: "What does it look like?",
      body: (
        <div>
          <div className={cn("grid gap-1.5", three ? "grid-cols-3" : "grid-cols-2")}>
            {kinds.map(([card, line]) => (
              <div key={card.state} className="flex flex-col items-center gap-1 text-center">
                <InspectionCard card={card} level={cueLevel} measure={measure} className="w-full" />
                <Chip v={card.verdict} />
                <p className="font-ui text-[12px] font-bold leading-tight text-walnut-dark">
                  {line}
                </p>
              </div>
            ))}
          </div>
          {three ? null : (
            <p className="mt-2 font-ui text-[12px] font-bold text-walnut/75">
              No Use-first pile yet: food that is going off is still a KEEP.
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Count the days",
      body: (
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-[34%] shrink-0">
              <InspectionCard
                card={SPOILED}
                level={cueLevel}
                measure={measure}
                className="w-full"
              />
            </div>
            <ol className="grid min-w-0 flex-1 gap-1.5 text-left font-ui text-[13px] font-bold leading-snug text-walnut-dark">
              <li>
                <b className="text-copper">1.</b> <i>Bought</i> = how old it is: <b>6 days</b>.
              </li>
              <li>
                <b className="text-copper">2.</b> <i>Lasts</i> = its shelf life: <b>7 days</b>.
              </li>
              <li>
                <b className="text-copper">3.</b> Closing judges it for <b>tomorrow</b>: 6 + 1 = 7.
                All its days are used, so it is spoiled: <Chip v="bin" />
              </li>
            </ol>
          </div>
          <ul className="mt-2 grid gap-1 text-left font-ui text-[12.5px] font-bold text-walnut-dark">
            {three ? (
              <li>
                Three quarters of its days or more used: <Chip v="use-first" />
              </li>
            ) : null}
            <li>
              Plenty of days left: <Chip v="keep" />
            </li>
          </ul>
          <p className="mt-2 rounded-xl bg-[#12303b]/10 p-2 text-left font-ui text-[12px] font-bold leading-snug text-walnut-dark">
            {tier.cues.days
              ? SHELF_LIFE_GUIDE
              : `Later nights hide the days. Trust the picture and remember: ${SHELF_LIFE_GUIDE}`}
          </p>
        </div>
      ),
    },
    {
      title: "Swipe it",
      body: (
        <ol className="grid gap-2 text-left">
          <Line icon="👉">
            Swipe <b>right</b> to <b>KEEP</b>. Swipe <b>left</b> to <b>BIN</b>.
            {three ? (
              <>
                {" "}
                Swipe <b>up</b> for <b>USE NEXT</b>.
              </>
            ) : null}
          </Line>
          <Line icon="👆">Or tap a pile below. Each card gets a one-line reason.</Line>
          <Line icon="⭐">Right answers earn stars and Hype. Three perfect nights earn a pin.</Line>
        </ol>
      ),
    },
  ];
}

function wrapPages(tier: CheckTier): Page[] {
  return [
    {
      title: "Wrap and label",
      art: "film-dispenser",
      body: (
        <ol className="grid gap-2 text-left">
          <Line icon="📦">The food that stays tonight stands on the shelf.</Line>
          <Line icon="👆">
            Tap the food that goes off <b>first</b>. It is wrapped and labelled.
          </Line>
          <Line icon="➡️">Then the next one, in order, until the shelf is done.</Line>
        </ol>
      ),
    },
    {
      title: "Which goes off first?",
      body: (
        <div>
          <div className="flex items-end justify-center gap-6">
            {(
              [
                ["salmon", "2 d", true],
                ["carrot", "6 d", false],
              ] as const
            ).map(([id, days, first]) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <span className="relative grid h-[84px] w-[84px] place-items-center rounded-2xl bg-white/60">
                  <IngredientIcon
                    id={id}
                    fallback={<span className="text-[40px]">🥬</span>}
                    className="!h-[62px] !w-[62px] object-contain"
                  />
                  <span className="absolute -bottom-1 rounded-full bg-[#12303b]/90 px-2 py-[1px] font-ui text-[11px] font-extrabold text-ivory">
                    {days}
                  </span>
                </span>
                <span className="font-ui text-[12px] font-black text-walnut-dark">
                  {first ? "Tap this FIRST" : "Then this"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-left font-ui text-[13px] font-bold leading-snug text-walnut-dark">
            The fewest days left goes first.
          </p>
          <p className="mt-1 text-left font-ui text-[13px] font-bold leading-snug text-walnut-dark">
            Its label is red at 1 day, yellow at 2, green at 3+.
          </p>
          {tier.cues.days ? null : (
            <p className="mt-2 rounded-xl bg-[#12303b]/10 p-2 text-left font-ui text-[12px] font-bold leading-snug text-walnut-dark">
              The days are hidden on this night. {SHELF_LIFE_GUIDE}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Stars and Hype",
      body: (
        <ol className="grid gap-2 text-left">
          <Line icon="✅">The right order gives stars. A wrong tap only costs points.</Line>
          <Line icon="🔥">Stars add Hype once a night. Nothing costs money.</Line>
          <Line icon="❓">Tap the ? any time to see this again.</Line>
        </ol>
      ),
    },
  ];
}

export function FridgeCheckHowTo({
  stage,
  tier,
  measure,
  onDone,
}: {
  stage: CheckStage;
  tier: CheckTier;
  measure: "lb" | "kg";
  /** Closed with "Got it" or "Skip" (the screen remembers the tour was seen). */
  onDone: () => void;
}) {
  const pages = stage === "sort" ? sortPages(tier, measure) : wrapPages(tier);
  const [i, setI] = useState(0);
  // The spoiled example on page 2 must never show an empty card: its painted picture is fetched while page 1 is read.
  useEffect(() => {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}business/ingredients-spoiled/${SPOILED.id}.webp`;
  }, []);
  const page = pages[i]!;
  const last = i === pages.length - 1;
  return (
    <div
      className="absolute inset-0 z-[60] grid place-items-center bg-black/75 p-4"
      data-testid="fc-guide"
      data-page={i + 1}
      data-pages={pages.length}
    >
      <div className="flex max-h-[92%] w-full max-w-[350px] flex-col rounded-3xl border-4 border-[#6aa5b8] bg-[#f7edd7] p-3.5 text-center">
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          {page.art ? (
            <FcArt name={page.art} className="mx-auto h-[60px] w-auto object-contain" />
          ) : null}
          <p className="font-display text-[22px] font-extrabold leading-tight text-walnut-dark">
            {page.title}
          </p>
          <div
            className="mt-2 font-ui text-[14px] font-bold text-walnut-dark"
            data-testid="fc-guide-body"
          >
            {page.body}
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-center gap-1.5" aria-hidden>
          {pages.map((_, k) => (
            <span
              key={k}
              className={cn(
                "h-2 rounded-full transition-all",
                k === i ? "w-5 bg-copper" : "w-2 bg-walnut/25",
              )}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-[auto_1fr] items-center gap-2">
          {i > 0 ? (
            <SortButton quiet testId="fc-guide-back" onClick={() => setI(i - 1)}>
              Back
            </SortButton>
          ) : (
            <span />
          )}
          <SortButton
            testId={last ? "fc-guide-ok" : "fc-guide-next"}
            onClick={() => (last ? onDone() : setI(i + 1))}
          >
            {last ? "Got it" : "Next"}
          </SortButton>
        </div>
        {last ? null : (
          <button
            type="button"
            data-testid="fc-guide-skip"
            onClick={onDone}
            className="mx-auto mt-1.5 min-h-10 px-3 font-ui text-[12.5px] font-extrabold text-walnut/70 underline"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
