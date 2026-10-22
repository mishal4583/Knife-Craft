import { useEffect } from "react";
import { KButton, Divider } from "../common/primitives";
import { ENCOURAGEMENT } from "@/game/qualityCopy";
import { StatRow } from "../common/Indicators";
import { CutPathViz } from "./CutPathViz";
import { AudioManager } from "@/game/AudioManager";
import { bestVerdict, formatScorePair } from "@/game/bestVerdict";
import type { CutResult } from "@/types/game";

/**
 * Design doc Law 4 ("the plate is the score" — no stars, no visible
 * percentage as a level-success readout). The headline used to be a big
 * "91%" + a 5-star row; now it's just the qualityLabel language the
 * engine already computes ("Masterful"/"Clean"/"Honest"/"Rustic"/
 * "Learning" — see CutEvaluator's GRADE_THRESHOLDS). `result.score`/
 * `previousBest` are still passed in and still used by the caller for
 * mastery tracking; they are not rendered as digits here, except in the
 * Phase 1 "New Best!" line described below.
 * Evenness/Consistency stay as bars — internal quality detail the brief
 * explicitly allows to remain ("useful for visual rendering and future
 * mastery"), not the primary pass/fail judgment the Laws target.
 *
 * Phase 1 (developer decision 2026-10-21) adds the "New Best!" beat, its
 * improvement line and — deliberately overriding Law 4 for this one
 * celebration — the old best and the new score as digits ("Best 72 → 85").
 * The override is narrow on purpose: the headline is still the
 * qualityLabel, and the digits appear ONLY on a genuine new best (never on
 * a first plate, an equal or a worse run), so the report still never reads
 * as a plain score sheet. This is the developer's call, not an oversight:
 * do not "restore" Law 4 here without asking them (OrderComplete keeps
 * Law 4 as before and is unaffected).
 */
export function KnifeReport({
  dishName,
  stepName,
  result,
  previousBest,
  onRetry,
  onContinue,
  specials = [],
}: {
  dishName: string;
  stepName: string;
  result: CutResult;
  /** The player's best for this recipe BEFORE this run; 0 when never completed. */
  previousBest: number;
  onRetry: () => void;
  onContinue: () => void;
  /** Phase 3 (C/D) — the order's chaos event and variant, acknowledged (specialsReport.ts). Never money. */
  specials?: { id: string; text: string; good: boolean }[];
}) {
  const verdict = bestVerdict(result.score, previousBest);
  const isBest = verdict.kind === "best";

  // A restrained accent for a genuine improvement only — the same warm
  // two-note chime the game already uses for a finished plate, not a new
  // sound. Mount-only, so a re-render can never fire it twice, and the
  // report mounts once per result.
  useEffect(() => {
    if (isBest) AudioManager.playChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one accent per report, on mount
  }, []);

  return (
    <div className="@container absolute inset-0 z-40 flex items-end bg-walnut-dark/45 backdrop-blur-[3px] land:items-center land:justify-center">
      <div className="anim-up paper m-3 w-[calc(100%-24px)] rounded-[26px] border border-walnut/20 p-4 shadow-lift @min-[390px]:p-5 land:max-h-[calc(100%-16px)] land:max-w-[620px] land:overflow-y-auto">
        <p className="text-center font-ui text-[11px] font-extrabold uppercase tracking-[0.22em] text-copper">
          Knife Report
        </p>
        <p className="text-center font-hand text-[17px] text-walnut/70">
          {dishName} · {stepName}
        </p>
        <p className="mt-2 text-center font-display text-[30px] font-black leading-tight text-walnut-dark">
          {result.qualityLabel}
        </p>
        {/* Level 1–10 UX pass: the line follows the grade (the same words as the
            per-cut toast) instead of "looked lovely" for every result. */}
        <p className="text-center font-hand text-[18px] text-olive">
          {ENCOURAGEMENT[result.qualityLabel]}
        </p>

        {/* Phase 1 (B4) — the celebration, and (B5) the honest improvement
            line under it. Both are omitted entirely when this run did not
            beat the stored best, so neither can ever congratulate a worse
            or equal result. */}
        {isBest ? (
          <>
            <p
              className="anim-pop mt-2 text-center font-ui text-[13px] font-extrabold uppercase tracking-[0.2em] text-copper"
              data-testid="knife-report-best"
            >
              ✦ New Best!
            </p>
            {/* B4 — the old best and this run's score. Only inside the
                genuine-new-best branch (see the doc above). The visible
                digits are aria-hidden and a full sentence goes to screen
                readers, since a bare "72 → 85" reads poorly aloud. */}
            {(() => {
              const [before, after] = formatScorePair(previousBest, result.score);
              return (
                <p
                  className="mt-0.5 flex items-center justify-center gap-2 font-ui text-[13px] font-extrabold tabular-nums"
                  data-testid="knife-report-scores"
                >
                  <span className="sr-only">
                    Previous best {before}, new score {after}.
                  </span>
                  <span aria-hidden="true" className="font-bold text-walnut/50">
                    Best
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-walnut/45 line-through decoration-walnut/30"
                  >
                    {before}
                  </span>
                  <span aria-hidden="true" className="text-walnut/40">
                    →
                  </span>
                  <span aria-hidden="true" className="text-copper">
                    {after}
                  </span>
                </p>
              );
            })()}
            {verdict.gain !== null ? (
              <p
                className="text-center font-hand text-[16px] text-olive"
                data-testid="knife-report-gain"
              >
                Cleaner than your best +{verdict.gain}%
              </p>
            ) : null}
          </>
        ) : verdict.kind === "first" ? (
          <p
            className="mt-2 text-center font-hand text-[16px] text-walnut/55"
            data-testid="knife-report-first"
          >
            your first plate of this dish
          </p>
        ) : null}

        {specials.length > 0 ? (
          <div className="mt-1.5 space-y-0.5" data-testid="knife-report-specials">
            {specials.map((line) => (
              <p
                key={line.id}
                data-special={line.id}
                className={
                  "line-clamp-2 text-center font-ui text-[12.5px] font-extrabold leading-snug " +
                  (line.good ? "text-copper" : "text-walnut/60")
                }
              >
                {line.text}
              </p>
            ))}
          </div>
        ) : null}

        <Divider />

        {/* The stats column is minmax(0, 1fr), not 1fr: a plain 1fr track can't
            shrink below its content's min-content width, and the Rhythm line's
            nowrap text ("a steady pace adds a bonus") made that ~280 px, pushing
            the diagram off the card at every game width up to ~460 px (and
            clipping "100" to "10" at 320 px). When the GAME is under 390 px wide
            the card, the gaps and the value column tighten so the bars keep a
            usable length at 320 px; from 390 px up the layout is exactly the
            original. "The game" is a container query on this overlay, not the
            window: the game is a contain-fit portrait frame, so on a short, wide
            window it is far narrower than the window (1280×720 → ~380 px).
            Checked by tools/e2e/knifereport.mjs. */}
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 @min-[390px]:gap-4"
          data-testid="knife-report-stats"
        >
          <div className="space-y-2">
            <StatRow label="Evenness" value={result.evenness} />
            <StatRow label="Consistency" value={result.consistency} />
            {/* Rhythm is a bonus, never a percentage — it can only add to the score, never subtract. */}
            <div className="flex items-center gap-2 @min-[390px]:gap-3">
              <span className="w-[68px] shrink-0 font-ui text-[12px] font-bold text-walnut/80">
                Rhythm
              </span>
              <span className="min-w-0 flex-1 truncate font-hand text-[14px] text-walnut/50">
                {result.rhythmBonus > 0 ? "steady pace" : "a steady pace adds a bonus"}
              </span>
              <span className="min-w-7 shrink-0 text-right font-ui text-[12px] font-extrabold text-olive @min-[390px]:w-[62px]">
                +{result.rhythmBonus}
              </span>
            </div>
          </div>
          <CutPathViz idealPath={result.idealPath} playerPath={result.playerPath} />
        </div>

        <div className="mt-4 flex gap-2">
          <KButton variant="cream" full onClick={onRetry}>
            Prepare Again
          </KButton>
          <KButton full onClick={onContinue}>
            Continue
          </KButton>
        </div>
      </div>
    </div>
  );
}
