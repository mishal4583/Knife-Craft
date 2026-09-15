import { KButton, Panel, Stars } from "../common/primitives";
import { CurrencyPill } from "../common/Indicators";

export function OrderComplete({
  dishName,
  score,
  previousBest,
  credits,
  onContinueCooking,
  onRetry,
  onKitchen,
}: {
  dishName: string;
  score: number;
  previousBest: number;
  credits: number;
  onContinueCooking: () => void;
  onRetry: () => void;
  onKitchen: () => void;
}) {
  const isBest = score > previousBest;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[82%] p-6 text-center">
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.24em] text-copper">
          Order Complete
        </p>
        <p className="mt-1 font-display text-[24px] font-black tracking-tight text-walnut-dark">
          {dishName}
        </p>
        <p className="font-hand text-[18px] text-olive">Beautifully prepared</p>
        <p className="mt-2 font-display text-[38px] font-black leading-none text-walnut-dark">
          {score}%
        </p>
        <div className="mt-2 flex justify-center">
          <Stars n={Math.max(1, Math.round(score / 20))} size={16} />
        </div>
        {isBest ? (
          <p className="mt-2 font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
            ✦ New Best
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-center gap-3 font-ui text-[11px] font-bold text-walnut/60">
          <span>Previous {previousBest}%</span>
          <span className="rounded-full bg-sage/25 px-2 py-[2px] text-olive">
            {score - previousBest >= 0 ? "+" : ""}
            {score - previousBest}%
          </span>
        </div>
        <div className="mt-3 flex justify-center">
          <CurrencyPill amount={credits} />
        </div>
        <div className="mt-5 space-y-2">
          <KButton full onClick={onContinueCooking}>
            Continue Cooking
          </KButton>
          <KButton full variant="cream" onClick={onRetry}>
            Retry
          </KButton>
          <KButton full variant="ghost" onClick={onKitchen}>
            Kitchen
          </KButton>
        </div>
      </Panel>
    </div>
  );
}