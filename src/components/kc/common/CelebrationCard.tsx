import { ASSISTANT_NAME } from "@/game/restaurant/assistant";
import type { Celebration } from "@/game/restaurant/celebrations";
import { KButton } from "./primitives";
import { PaigePiece, PaigePoseImg } from "../assistant/PaigeArt";
import "../assistant/assistant.css";

/**
 * A moment that should feel like an achievement (game/restaurant/celebrations.ts): the city ranking climbed, popularity rose, a spotless
 * run. The same popup look as Paige's tips (a card over a dimmed, blurred screen); her appreciation in her own words. Transform and
 * opacity animation only; it moves no money.
 */
export function CelebrationCard({
  celebration,
  onClose,
}: {
  celebration: Celebration;
  onClose: () => void;
}) {
  return (
    <div
      data-testid="celebration"
      data-celebration={celebration.kind}
      className="absolute inset-0 z-[75] flex items-center justify-center bg-walnut-dark/55 p-3 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="paige-in relative w-full max-w-[340px] overflow-hidden rounded-[24px] border-2 border-olive/60 bg-ivory p-4 text-center shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <PaigePiece
          name="ui-sparkle"
          className="paige-sparkle absolute left-3 top-3 h-7 w-7 opacity-80"
        />
        <PaigePiece
          name="ui-sparkle"
          className="paige-sparkle absolute right-3 top-6 h-6 w-6 opacity-80"
        />
        <p className="text-[44px] leading-none" aria-hidden>
          {celebration.emoji}
        </p>
        <p className="mt-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.16em] text-olive">
          Congratulations
        </p>
        <h2 className="font-display text-[22px] font-black leading-tight text-walnut-dark">
          {celebration.title}
        </h2>
        <ul className="mt-2 space-y-0.5" data-testid="celebration-lines">
          {celebration.lines.map((l) => (
            <li key={l} className="font-ui text-[14px] font-bold text-walnut-dark">
              {l}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-cream/70 p-2 text-left">
          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-copper/40 bg-walnut/10">
            <PaigePoseImg
              pose={celebration.pose}
              className="h-full w-full object-cover object-[50%_12%]"
            />
          </span>
          <p className="min-w-0 flex-1 font-hand text-[17px] leading-snug text-walnut-dark">
            <span className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-copper">
              {ASSISTANT_NAME}
            </span>
            <br />
            {celebration.paige}
          </p>
        </div>
        <KButton full variant="sage" className="mt-3 min-h-12" onClick={onClose}>
          Keep going ›
        </KButton>
      </div>
    </div>
  );
}
