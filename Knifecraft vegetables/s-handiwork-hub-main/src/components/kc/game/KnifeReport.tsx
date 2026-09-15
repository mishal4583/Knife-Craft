import { KButton, Divider, Stars } from "../common/primitives";
import { StatRow } from "../common/Indicators";
import { CutPathViz } from "./CutPathViz";
import type { CutResult } from "@/types/game";

export function KnifeReport({
  dishName,
  stepName,
  result,
  previousBest,
  onRetry,
  onContinue,
}: {
  dishName: string;
  stepName: string;
  result: CutResult;
  previousBest: number;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const delta = result.score - previousBest;
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-walnut-dark/45 backdrop-blur-[3px]">
      <div className="anim-up paper m-3 w-[calc(100%-24px)] rounded-[26px] border border-walnut/20 p-5 shadow-lift">
        <p className="text-center font-ui text-[10px] font-extrabold uppercase tracking-[0.22em] text-copper">
          Knife Report
        </p>
        <p className="text-center font-hand text-[16px] text-walnut/70">
          {dishName} · {stepName}
        </p>
        <p className="mt-1 text-center font-display text-[42px] font-black leading-none text-walnut-dark">
          {result.score}%
        </p>
        <div className="mt-1 flex justify-center">
          <Stars n={Math.max(1, Math.round(result.score / 20))} size={16} />
        </div>
        <p className="text-center font-hand text-[18px] text-olive">{result.qualityLabel} cut.</p>

        <Divider />

        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="space-y-2">
            <StatRow label="Accuracy" value={result.accuracy} />
            <StatRow label="Spacing" value={result.spacing} />
            <StatRow label="Rhythm" value={result.rhythm} />
          </div>
          <CutPathViz idealPath={result.idealPath} playerPath={result.playerPath} />
        </div>

        <Divider />

        <div className="flex items-center justify-between font-ui text-[11px] font-bold text-walnut/70">
          <span>Previous best {previousBest}%</span>
          <span className="rounded-full bg-sage/25 px-2 py-[2px] text-olive">
            {delta >= 0 ? `+${delta}%` : `${delta}%`}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <KButton variant="cream" full onClick={onRetry}>
            Prep Again
          </KButton>
          <KButton full onClick={onContinue}>
            Continue
          </KButton>
        </div>
      </div>
    </div>
  );
}