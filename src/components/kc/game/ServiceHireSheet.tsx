import { KButton } from "../common/primitives";
import { PointerHand } from "../common/PointerHand";
import { StaffPortrait } from "../business/StaffCard";
import { staffPortraitFile } from "../business/staffPortraits";
import { formatUsd } from "@/game/money";
import type { ServiceHirePrompt } from "@/game/restaurant/serviceHire";

/**
 * HIRE WHEN THE GAME NEEDS THEM (developer 2026-11-07): a small card over the dining room at the moment a Server (the plate is
 * ready to go out) or a Cashier (the guest has eaten) is missing. The person's own portrait, one Hire button (permanent, paid
 * from the opening cash). Hiring is the only way on (developer 2026-11-07: "they need to be hired anyway, remove the buttons"): it can
 * never block, because a short wallet puts the fee on supplier credit. The hire itself is App's.
 */
export function ServiceHireSheet({
  prompt,
  onHire,
}: {
  prompt: ServiceHirePrompt;
  onHire: () => void;
}) {
  return (
    <div
      data-testid="service-hire"
      data-hire-role={prompt.role}
      className="absolute inset-0 z-[80] flex items-end justify-center bg-walnut-dark/45 p-3 sm:items-center"
    >
      <div className="w-full max-w-[360px] rounded-[22px] border-2 border-copper/50 bg-ivory p-3 shadow-lift">
        <div className="flex items-center gap-3">
          <span
            className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-copper/40 bg-walnut/10"
            data-hire-portrait={prompt.role}
          >
            <StaffPortrait
              file={staffPortraitFile(prompt.role)}
              name={prompt.name}
              emoji={prompt.role === "server" ? "🤵" : "🧾"}
              className="h-full w-full text-[30px]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[16px] font-extrabold leading-snug text-walnut-dark">
              {prompt.title}
            </p>
            <p className="mt-0.5 font-hand text-[16px] leading-snug text-walnut/80">
              {prompt.gain}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 pb-9">
          <div className="relative flex-1">
            <span
              data-testid="first-run-hand"
              data-hand-for={`hire-${prompt.role}`}
              className="pointer-events-none absolute left-1/2 top-full -mt-1 z-10 -translate-x-1/2"
            >
              <PointerHand size={36} />
            </span>
            <KButton full variant="sage" className="min-h-12" onClick={onHire}>
              Hire {prompt.name} · {formatUsd(prompt.fee)}
            </KButton>
          </div>
        </div>
      </div>
    </div>
  );
}
