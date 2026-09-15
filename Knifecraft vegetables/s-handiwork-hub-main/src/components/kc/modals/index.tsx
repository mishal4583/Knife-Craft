import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KButton, Modal, Panel } from "../common/primitives";
import { CurrencyPill } from "../common/Indicators";

export { Modal };

export function ConfirmationModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Not now",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <p className="text-center font-display text-[20px] font-black text-walnut-dark">{title}</p>
      <p className="mt-1 text-center font-hand text-[17px] text-walnut/70">{body}</p>
      <div className="mt-4 flex gap-2">
        <KButton variant="ghost" full onClick={onClose}>
          {cancelLabel}
        </KButton>
        <KButton full onClick={onConfirm}>
          {confirmLabel}
        </KButton>
      </div>
    </Modal>
  );
}

export function RewardPopup({
  open,
  title,
  note,
  credits,
  onClose,
}: {
  open: boolean;
  title: string;
  note?: string;
  credits?: number;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-walnut-dark/45 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[76%] p-6 text-center">
        <span className="anim-shimmer mx-auto mb-2 block text-[26px] text-gold">✦</span>
        <p className="font-display text-[20px] font-black text-walnut-dark">{title}</p>
        {note ? <p className="mt-1 font-hand text-[17px] text-walnut/70">{note}</p> : null}
        {typeof credits === "number" ? (
          <div className="mt-3 flex justify-center">
            <CurrencyPill amount={credits} />
          </div>
        ) : null}
        <div className="mt-5">
          <KButton full onClick={onClose}>
            Lovely
          </KButton>
        </div>
      </Panel>
    </div>
  );
}

export function Toast({
  message,
  tone = "sage",
  className,
}: {
  message: ReactNode;
  tone?: "sage" | "copper";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "anim-pop pointer-events-none absolute left-1/2 top-[22%] z-40 -translate-x-1/2",
        className,
      )}
      role="status"
    >
      <span
        className={cn(
          "rounded-full border px-4 py-1.5 font-display text-[15px] font-black tracking-tight shadow-soft",
          tone === "sage"
            ? "border-olive/40 bg-sage/90 text-ivory"
            : "border-copper/40 bg-gold/90 text-walnut-dark",
        )}
      >
        {message}
      </span>
    </div>
  );
}

export function PauseOverlay({
  open,
  onResume,
  onRestart,
  onExit,
}: {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-walnut-dark/45 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[74%] p-5 text-center">
        <p className="font-display text-[22px] font-black tracking-tight text-walnut-dark">Paused</p>
        <p className="mt-1 font-hand text-[16px] text-walnut/70">The kitchen will wait.</p>
        <div className="mt-4 space-y-2">
          <KButton full onClick={onResume}>
            Resume
          </KButton>
          <KButton full variant="cream" onClick={onRestart}>
            Restart Prep
          </KButton>
          <KButton full variant="ghost" onClick={onExit}>
            Exit to Kitchen
          </KButton>
        </div>
      </Panel>
    </div>
  );
}