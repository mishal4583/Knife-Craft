import { ASSISTANT_NAME } from "@/game/restaurant/assistant";
import { KButton, Panel } from "../common/primitives";
import { StaffPortrait } from "../business/StaffCard";
import { useAssistant } from "./AssistantContext";

/**
 * "Your assistant" on the Staff screen: Paige's portrait (public/business/staff-portraits/assistant.webp, the same frame as every staff
 * portrait), that she is free and has no wage, her tips switch and her notebook. Not a hireable role: it moves no money.
 */
export function AssistantCard() {
  const paige = useAssistant();
  if (!paige) return null;
  return (
    <Panel tone="cream" className="p-3" data-testid="assistant-card">
      <div className="flex items-center gap-3">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-copper/40 bg-walnut/10">
          <StaffPortrait
            file="assistant"
            name={ASSISTANT_NAME}
            emoji="👩‍🍳"
            className="h-full w-full text-[28px]"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[18px] font-black leading-tight text-walnut-dark">
            {ASSISTANT_NAME} · Assistant
          </p>
          <p className="font-ui text-[12.5px] font-bold text-olive">
            {paige.hired ? "On your team · free, no wages" : "Free to hire, no wages"}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        {paige.hired ? (
          <>
            <KButton variant="cream" className="min-h-12 flex-1" onClick={paige.openNotebook}>
              📒 Notebook
            </KButton>
            <KButton
              variant={paige.tipsOff ? "ghost" : "sage"}
              className="min-h-12 flex-1"
              data-testid="assistant-card-tips"
              onClick={() => paige.setTips(paige.tipsOff)}
            >
              Tips: {paige.tipsOff ? "Off" : "On"}
            </KButton>
          </>
        ) : (
          <KButton variant="sage" full className="min-h-12" onClick={paige.hire}>
            Hire {ASSISTANT_NAME} · Free
          </KButton>
        )}
      </div>
    </Panel>
  );
}
