import { KButton } from "../common/primitives";
import type { GuideStep } from "@/game/restaurant/restaurantGuide";

/**
 * The Restaurant Guide's card (restaurant/restaurantGuide.ts): one "what to do
 * next, and why" step over the Kitchen. Both buttons count as seen; "Show me"
 * also opens the section. Presentation only.
 */
export function GuideCard({
  step,
  onLater,
  onGo,
}: {
  step: GuideStep;
  onLater: () => void;
  onGo: () => void;
}) {
  return (
    <div
      data-testid="guide-card"
      data-guide-step={step.id}
      className="anim-up absolute inset-0 z-40 flex items-end bg-[rgba(30,20,12,0.55)] px-4 pb-[78px] land:items-center land:justify-center land:pb-4 land:pl-[calc(var(--kc-rail)+16px)]"
    >
      <div
        role="dialog"
        aria-label={step.title}
        className="paper w-full max-w-[420px] rounded-3xl p-4 shadow-lift"
      >
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-copper">
          🎯 Next step
        </p>
        <p className="mt-1 font-display text-[20px] font-black leading-tight text-walnut-dark">
          <span aria-hidden>{step.icon}</span> {step.title}
        </p>
        <p className="mt-1.5 font-hand text-[16.5px] leading-snug text-walnut">{step.why}</p>
        <div className="mt-3 flex gap-2">
          <KButton variant="ghost" className="min-h-12 flex-1" onClick={onLater}>
            Later
          </KButton>
          <KButton variant="copper" className="min-h-12 flex-[2]" onClick={onGo}>
            {step.button} →
          </KButton>
        </div>
      </div>
    </div>
  );
}
