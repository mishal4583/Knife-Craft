import { KButton, Panel } from "../common/primitives";
import { formatUsdChange } from "@/game/money";
import { CurrencyPill } from "../common/Indicators";
import type { QualityLabel } from "@/types/game";

/**
 * Design doc Law 4 ("the plate is the score" — no stars, no visible
 * percentage as a level-success readout) is REINSTATED as written.
 *
 * CORRECTIVE PASS — a prior progression pass added a 3-star readout here,
 * reasoning that an explicit request superseded Law 4. That reasoning was
 * rejected: the star/percentage system is not approved, full stop. The
 * star row, `starsForScore`/`MASTERY_LABEL` import, "Chef Standard" and
 * "Almost Chef Standard — improve your preparation to earn ★★★" copy are
 * all removed. `qualityLabel` (Masterful/Clean/Honest/Rustic/Learning) is
 * once again the only quality language on this screen, exactly as
 * before. `score`/`previousBest` stay as plain numbers the component
 * receives (still needed for the "your best plate yet" callout below,
 * which shows no digits itself) but are never rendered as a number or a
 * star count. Internal grading itself (CutEvaluator/computeGrade) was
 * never touched by either pass.
 */
export function OrderComplete({
  dishName,
  score,
  previousBest,
  qualityLabel,
  rewardCoins,
  credits,
  onRetry,
  onKitchen,
  nextLevelTitle,
  onNextLevel,
}: {
  dishName: string;
  score: number;
  previousBest: number;
  qualityLabel: QualityLabel;
  /** This run's reward in wallet cents — 0 on replay (Law 2), the level's reward on first completion. */
  rewardCoins: number;
  credits: number;
  onRetry: () => void;
  onKitchen: () => void;
  /** Present only when a next campaign level exists AND is unlocked (App.tsx computes this) — omitted entirely (no button) at the end of the campaign or when the next level is still locked. */
  nextLevelTitle?: string;
  onNextLevel?: () => void;
}) {
  const isBest = score > previousBest;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[82%] p-6 text-center">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.24em] text-copper">
          Order Complete
        </p>
        <p className="mt-1 font-display text-[24px] font-black tracking-tight text-walnut-dark">
          {dishName}
        </p>
        <p className="font-hand text-[18px] text-olive">Beautifully prepared</p>
        <p className="mt-2 font-display text-[26px] font-black leading-tight text-walnut-dark">
          {qualityLabel}
        </p>
        {isBest ? (
          <p className="mt-2 font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
            ✦ Your best plate yet
          </p>
        ) : null}
        {rewardCoins > 0 ? (
          <p className="mt-3 font-hand text-[20px] text-olive">{formatUsdChange(rewardCoins)}</p>
        ) : (
          <p className="mt-3 font-hand text-[16px] text-walnut/55">
            replayed for the love of cutting
          </p>
        )}
        <div className="mt-2 flex justify-center">
          <CurrencyPill amount={credits} />
        </div>
        {/* "Prepare Again" / "Next Level" — the result-screen structure the
            progression pass asked for. Next Level only renders when App.tsx
            found one (exists AND unlocked); "Continue Cooking" and
            "Kitchen" used to be two separate buttons wired to the exact
            same handler (onExit) — collapsed to the one real destination,
            "Kitchen", rather than keep a second button that did nothing
            different. */}
        <div className="mt-5 space-y-2">
          {/* Moving on is the main action; replaying comes second. */}
          {onNextLevel && nextLevelTitle ? (
            <KButton full onClick={onNextLevel}>
              Next Dish · {nextLevelTitle}
            </KButton>
          ) : null}
          <KButton
            full
            variant={onNextLevel && nextLevelTitle ? "cream" : "wood"}
            onClick={onRetry}
          >
            Prepare Again
          </KButton>
          <KButton full variant="ghost" onClick={onKitchen}>
            Kitchen
          </KButton>
        </div>
      </Panel>
    </div>
  );
}
