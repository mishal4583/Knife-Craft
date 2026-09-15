import type { ReactNode } from "react";

/**
 * Responsive playable container.
 * Keeps a 540x960 portrait composition centred in any viewport
 * (portrait phone, landscape, tablet, desktop) with no page scrolling.
 */
export function GameShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#3E2819,#231710_70%)]">
      <div className="flex h-full w-full items-center justify-center gap-6 p-2 sm:p-4">
        {aside}
        <div
          className="relative overflow-hidden rounded-[clamp(0px,4vmin,34px)] border-[3px] border-[#241811] shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
          style={{
            aspectRatio: "540 / 960",
            height: "min(100%, calc((100vw - 16px) * 960 / 540))",
            maxWidth: "100%",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Full-bleed layer inside the shell — every screen uses this. */
export function ScreenContainer({
  children,
  tone = "cream",
}: {
  children: ReactNode;
  tone?: "cream" | "paper" | "wood";
}) {
  const bg = {
    cream: "bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]",
    paper: "paper",
    wood: "wood",
  }[tone];
  return (
    <section className={`anim-up absolute inset-0 flex h-full w-full flex-col ${bg}`}>
      {children}
    </section>
  );
}

/** Scrollable body region — the shell itself never scrolls. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-1">{children}</div>
  );
}