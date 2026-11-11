import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { KButton } from "@/components/kc/common/primitives";
import type { FlowStep, ServiceGate } from "@/game/business/deliveryFlow";

/**
 * THE DELIVERY ROUTINE on screen (developer 2026-11-11: check the delivery, unpack, stock the shelves, Fridge Check; each one mandatory, in order).
 * Two pieces, both reading game/business/deliveryFlow.ts:
 *   - `DeliveryRoutineCard`: at the TOP of the Inventory, so the games are never hidden below the fold: the waiting steps in order, the one to do now
 *     highlighted, a later one locked until the earlier one is done.
 *   - `ServiceGateSheet`: what the Kitchen shows instead of starting a service while a step waits: the same list and one button to the next step.
 */

function StepRow({
  step,
  active,
  onGo,
  compact,
}: {
  step: FlowStep;
  active: boolean;
  onGo: (to: string) => void;
  compact?: boolean;
}) {
  const locked = !!step.lockedBy;
  return (
    <button
      type="button"
      disabled={locked}
      data-testid={`flow-step-${step.id}`}
      data-state={locked ? "locked" : active ? "next" : "waiting"}
      onClick={() => onGo(step.to)}
      className={cn(
        "press flex w-full items-center gap-3 rounded-2xl border-2 px-3 text-left font-ui",
        compact ? "min-h-12 py-1.5" : "min-h-14 py-2",
        locked
          ? "border-walnut/15 bg-ivory/50 text-walnut/55"
          : active
            ? "border-[#b4552f] bg-[linear-gradient(170deg,#fbdcc9,#eeb08f)] text-walnut-dark shadow-soft"
            : "border-[#b8873f] bg-[linear-gradient(170deg,#f7e3b0,#e8c27a)] text-walnut-dark",
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-walnut-dark/85 font-display text-[15px] font-black text-gold"
      >
        {step.n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-extrabold">
          <span aria-hidden>{step.icon}</span> {step.label}
        </span>
        <span className="block truncate text-[12px] font-bold text-walnut/70">
          {locked ? `🔒 ${step.lockedBy}` : step.detail}
        </span>
      </span>
      {!locked ? (
        <span aria-hidden className="text-[18px] font-black text-walnut-dark">
          ›
        </span>
      ) : null}
    </button>
  );
}

/** The ⓘ that says why the routine comes before service (the longer explanation sits behind it). */
function WhyTip() {
  return (
    <InfoTip label="Why these steps?" tone="copper">
      In a real kitchen every delivery is checked for damaged food, unpacked and put in the fridge,
      and the supplies go on their shelves, before service. Finish these steps and you can open.
    </InfoTip>
  );
}

/** The Inventory's top card: the routine's waiting steps. Renders nothing when none waits. */
export function DeliveryRoutineCard({
  steps,
  go,
  className,
}: {
  steps: FlowStep[];
  go: (to: string) => void;
  className?: string;
}) {
  if (steps.length === 0) return null;
  const next = steps.find((s) => !s.lockedBy);
  return (
    <section
      data-testid="delivery-routine"
      aria-label="Delivery routine"
      className={cn(
        "rounded-[20px] border border-[#f3d9a9] bg-[linear-gradient(145deg,#fff9e9,#f6dfb5)] p-3 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#95602c]">
          📦 Before you open
        </p>
        <WhyTip />
      </div>
      <div className="mt-1.5 grid gap-1.5">
        {steps.map((s) => (
          <StepRow key={s.id} step={s} active={s.id === next?.id} onGo={go} compact />
        ))}
      </div>
    </section>
  );
}

/** The Kitchen's answer to "Open for service" while the routine is not done. */
export function ServiceGateSheet({
  gate,
  hasPrepCook,
  go,
  onClose,
}: {
  gate: ServiceGate;
  hasPrepCook: boolean;
  go: (to: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      data-testid="service-gate"
      className="absolute inset-0 z-[70] flex items-center justify-center bg-walnut-dark/55 p-3 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Before you open"
        className="relative w-full max-w-[340px] rounded-[24px] border-2 border-olive/60 bg-ivory p-4 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.16em] text-olive">
              Before you open
            </p>
            <h2 className="font-display text-[21px] font-black leading-tight text-walnut-dark">
              Finish the delivery first
            </h2>
          </div>
          <WhyTip />
        </div>
        <div className="mt-3 grid gap-2">
          {gate.steps.map((s) => (
            <StepRow key={s.id} step={s} active={s.id === gate.next?.id} onGo={go} />
          ))}
        </div>
        {hasPrepCook ? (
          <p className="mt-2 font-ui text-[12.5px] font-bold text-walnut/70">
            🧑‍🍳 Your Prep Cook can do a step for you inside each game.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2">
          {gate.next ? (
            <KButton full onClick={() => go(gate.next!.to)} data-testid="gate-go">
              {gate.next.icon} {gate.next.label}
            </KButton>
          ) : null}
          <KButton full variant="ghost" onClick={onClose} data-testid="gate-close">
            Not now
          </KButton>
        </div>
      </div>
    </div>
  );
}
