import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { BAR_LEFT, BAR_MARKS, BAR_RIGHT, barX, fsUrl } from "./sortUtils";

/**
 * The look the two sorting mini-games share (Fridge Sort, Stockroom Sort): the game button, the painted wooden plaque, the painted star bar
 * and the clock text. The painted HUD pieces live in `public/business/fridge-sort/` (hud-*, starbar-*, star-*, result-panel); Stockroom Sort
 * reuses them on purpose (plan 2026-11-06: HUD, star bar and result board are not redrawn).
 */

/** A button in the games' own look (KButton has no test ids): wood = the main action, ghost = the quiet one. */
export function SortButton({
  children,
  onClick,
  quiet,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  quiet?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        AudioManager.playSfx("tap");
        onClick();
      }}
      className={cn(
        "press inline-flex h-12 w-full items-center justify-center rounded-2xl font-ui text-[14.5px] font-extrabold tracking-wide",
        quiet
          ? "border border-walnut/25 bg-ivory/70 text-walnut"
          : "wood border border-walnut-dark/50 text-ivory shadow-soft",
      )}
    >
      {children}
    </button>
  );
}

/** One painted piece of the Fridge Sort art set; hidden if it fails to load. */
export function Art({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={fsUrl(name)}
      alt=""
      draggable={false}
      data-fridge-art={name}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className={cn("pointer-events-none select-none", className)}
      style={style}
    />
  );
}

/** A wooden plaque: the painted frame is a 9-slice border so the carving never stretches, the text sits on a plain layer above it. */
export function Plaque({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("relative flex items-center justify-center bg-[#3a2417]/80", className)}
      style={{ borderRadius: 14 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: "14px 26px",
          borderImage: `url(${fsUrl("hud-wide")}) 40 80 40 80 fill / 14px 26px 14px 26px stretch`,
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
    </div>
  );
}

/** The painted star bar: the frame, a fill that grows with `progress`, and a star on each painted ring. */
export function StarBar({
  progress,
  marks,
}: {
  progress: number;
  marks: readonly [number, number, number];
}) {
  return (
    <div className="relative mx-auto aspect-[480/72] w-full max-w-[420px]" aria-hidden>
      <Art name="starbar-frame" className="absolute inset-0 h-full w-full object-fill" />
      <div
        className="absolute overflow-hidden rounded-full"
        style={{
          left: `${BAR_LEFT * 100}%`,
          right: `${(1 - BAR_RIGHT) * 100}%`,
          top: "27%",
          bottom: "27%",
        }}
      >
        <Art
          name="starbar-fill"
          className="h-full w-full object-fill transition-[clip-path] duration-200"
          style={{
            clipPath: `inset(0 ${(100 - ((barX(progress, marks) - BAR_LEFT) / (BAR_RIGHT - BAR_LEFT)) * 100).toFixed(1)}% 0 0)`,
          }}
        />
      </div>
      {marks.map((s, i) => (
        <Art
          key={i}
          name={progress >= s ? "star-full" : "star-empty"}
          className={cn(
            "absolute top-1/2 h-[62%] w-auto -translate-x-1/2 -translate-y-1/2",
            progress >= s && "drop-shadow-[0_0_4px_rgba(255,214,90,0.9)]",
          )}
          style={{ left: `${BAR_MARKS[i]! * 100}%` }}
        />
      ))}
    </div>
  );
}
