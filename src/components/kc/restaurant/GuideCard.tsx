import { KButton } from "../common/primitives";
import type { GuideStep } from "@/game/restaurant/restaurantGuide";
import { StaffPortrait } from "../business/StaffCard";
import { staffFallbackEmoji, staffPortraitFile } from "../business/staffPortraits";
import { PaigeStage } from "../assistant/PaigeStage";

/**
 * The Restaurant Guide's card (restaurant/restaurantGuide.ts): one "what to do
 * next, and why" step over the Kitchen. Both buttons count as seen; "Show me"
 * also opens the section. Presentation only.
 */
export function GuideCard({
  step,
  paige = false,
  onLater,
  onGo,
}: {
  step: GuideStep;
  /** Paige is hired: the card speaks in her voice (her face and name), same step, same buttons. */
  paige?: boolean;
  onLater: () => void;
  onGo: () => void;
}) {
  if (paige) {
    // Paige's voice (developer 2026-11-12: it looked like an app notification): the same cutout and speech bubble as every tip, over a blurred, dimmed
    // Kitchen. The same step, the same two buttons, the same test ids.
    return (
      <div
        data-testid="guide-card"
        data-guide-step={step.id}
        className="absolute inset-0 z-40 bg-[rgba(30,20,12,0.55)] backdrop-blur-[3px]"
      >
        <div
          role="dialog"
          aria-label={step.title}
          className="absolute inset-x-0 bottom-0 flex justify-center land:pl-[calc(var(--kc-rail)+16px)]"
        >
          <PaigeStage pose="point">
            <p className="paige-kicker" data-testid="guide-card-paige">
              Next step
            </p>
            <p className="paige-title font-display text-walnut-dark">
              {step.focus && staffPortraitFile(step.focus) ? (
                <span className="mr-1.5 inline-block h-8 w-8 overflow-hidden rounded-full border-2 border-copper/40 align-middle">
                  <StaffPortrait
                    file={staffPortraitFile(step.focus)}
                    name={step.title}
                    emoji={staffFallbackEmoji(step.focus)}
                    className="h-full w-full text-[16px]"
                  />
                </span>
              ) : (
                <span aria-hidden>{step.icon}</span>
              )}{" "}
              {step.title}
            </p>
            <p className="paige-hand">{step.why}</p>
            <div className="paige-actions">
              <KButton variant="ghost" className="paige-btn" onClick={onLater}>
                Later
              </KButton>
              <KButton variant="copper" className="paige-btn paige-main" onClick={onGo}>
                {step.button} ›
              </KButton>
            </div>
          </PaigeStage>
        </div>
      </div>
    );
  }
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
        <p className="flex items-center gap-1.5 font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-copper">
          🎯 Next step
        </p>
        <p className="mt-1 font-display text-[20px] font-black leading-tight text-walnut-dark">
          {step.focus && staffPortraitFile(step.focus) ? (
            // A hire step shows the person themself (the same portrait as their Staff card).
            <span className="mr-1.5 inline-block h-10 w-10 overflow-hidden rounded-full border-2 border-copper/40 align-middle">
              <StaffPortrait
                file={staffPortraitFile(step.focus)}
                name={step.title}
                emoji={staffFallbackEmoji(step.focus)}
                className="h-full w-full text-[20px]"
              />
            </span>
          ) : (
            <span aria-hidden>{step.icon}</span>
          )}{" "}
          {step.title}
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
