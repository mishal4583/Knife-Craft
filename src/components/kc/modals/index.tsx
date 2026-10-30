import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KButton, Modal, Panel } from "../common/primitives";
import { CurrencyPill } from "../common/Indicators";

export { Modal };

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
          "rounded-full border px-4 py-1.5 font-display text-[15.5px] font-black tracking-tight shadow-soft",
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
