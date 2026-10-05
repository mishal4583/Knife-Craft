import { KButton, Divider } from "../common/primitives";
import { ENCOURAGEMENT } from "@/game/qualityCopy";
import { StatRow } from "../common/Indicators";
import { CutPathViz } from "./CutPathViz";
import type { CutResult } from "@/types/game";

/**
 * Design doc Law 4 ("the plate is the score" — no stars, no visible
 * percentage as a level-success readout). The headline used to be a big
 * "91%" + a 5-star row; now it's just the qualityLabel language the
 * engine already computes ("Masterful"/"Clean"/"Honest"/"Rustic"/
 * "Learning" — see CutEvaluator's GRADE_THRESHOLDS). `result.score`/
 * `previousBest` are still passed in and still used by the caller for
 * mastery tracking, they're just not rendered as digits here anymore.
 * Evenness/Consistency stay as bars — internal quality detail the brief
 * explicitly allows to remain ("useful for visual rendering and future
 * mastery"), not the primary pass/fail judgment the Laws target.
 */
export function KnifeReport({
  dishName,
  stepName,
  result,
  onRetry,
  onContinue,
}: {
  dishName: string;
  stepName: string;
  result: CutResult;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-walnut-dark/45 backdrop-blur-[3px]">
      <div className="anim-up paper m-3 w-[calc(100%-24px)] rounded-[26px] border border-walnut/20 p-5 shadow-lift">
        <p className="text-center font-ui text-[10px] font-extrabold uppercase tracking-[0.22em] text-copper">
          Knife Report
        </p>
        <p className="text-center font-hand text-[16px] text-walnut/70">
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

        <Divider />

        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="space-y-2">
            <StatRow label="Evenness" value={result.evenness} />
            <StatRow label="Consistency" value={result.consistency} />
            {/* Rhythm is a bonus, never a percentage — it can only add to the score, never subtract. */}
            <div className="flex items-center gap-3">
              <span className="w-[68px] shrink-0 font-ui text-[11px] font-bold text-walnut/80">
                Rhythm
              </span>
              <span className="flex-1 truncate font-hand text-[13px] text-walnut/50">
                {result.rhythmBonus > 0 ? "steady pace" : "a steady pace adds a bonus"}
              </span>
              <span className="w-[62px] shrink-0 text-right font-ui text-[11px] font-extrabold text-olive">
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
