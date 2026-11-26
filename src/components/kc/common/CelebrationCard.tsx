import { useState } from "react";
import type { Celebration } from "@/game/restaurant/celebrations";
import { sharingAllowed } from "@/game/PlayablesSDK";
import { MomentPreview } from "../moments/MomentPreview";
import { KButton } from "./primitives";
import { PaintedPortrait } from "./PaintedPortrait";
import { prestigeEmblemPath, rivalPortraitPath } from "@/game/chefArt";
import { PaigeCutout, PaigeNameplate, PaigePiece } from "../assistant/PaigeArt";
import { CelebrationFx } from "./CelebrationFx";
import "../assistant/assistant.css";

/**
 * A moment that should feel like an achievement (game/restaurant/celebrations.ts): the city ranking climbed, popularity rose, a spotless
 * run. The facts sit in a small plaque at the top; Paige says her appreciation the same way she gives every tip (developer 2026-11-11: "Paige
 * should come like this", a standalone cutout on the left and one big speech bubble to the right, over the blurred, dimmed screen), with the
 * "Keep going" button at the foot of her bubble. Transform and opacity animation only; it moves no money.
 */
export function CelebrationCard({
  celebration,
  onClose,
}: {
  celebration: Celebration;
  onClose: () => void;
}) {
  // Chef Pride, Phase 6: the achievement can be turned into a picture to share. Only when the player taps; hidden where sharing is not allowed (YouTube).
  const [preview, setPreview] = useState(false);
  const shares = sharingAllowed() ? (celebration.shares ?? []) : [];
  // The painted picture (the passed rival's chef, the prestige tier's emblem) when the card has one; the emoji otherwise or if it cannot load.
  const portraitPath = celebration.portrait
    ? celebration.portrait.kind === "rival"
      ? rivalPortraitPath(celebration.portrait.id)
      : prestigeEmblemPath(celebration.portrait.tier)
    : null;
  return (
    <div
      data-testid="celebration"
      data-celebration={celebration.kind}
      className="absolute inset-0 z-[75] flex flex-col items-center bg-walnut-dark/55 px-3 pt-3 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="paige-in relative w-full max-w-[340px] overflow-hidden rounded-[26px] border-[3px] border-olive/70 bg-[radial-gradient(120%_90%_at_50%_0%,#fffdf6,#f6ecce)] px-4 py-4 text-center shadow-lift"
          onClick={(e) => e.stopPropagation()}
        >
          <CelebrationFx />
          <PaigePiece
            name="ui-sparkle"
            className="paige-sparkle absolute left-3 top-3 h-7 w-7 opacity-80"
          />
          <PaigePiece
            name="ui-sparkle"
            className="paige-sparkle absolute right-3 top-6 h-6 w-6 opacity-80"
          />
          {portraitPath ? (
            <div className="flex justify-center" data-testid="celebration-portrait">
              <PaintedPortrait
                path={portraitPath}
                width={celebration.portrait?.kind === "rival" ? 88 : 96}
                round={celebration.portrait?.kind === "rival"}
                className={
                  celebration.portrait?.kind === "rival"
                    ? "border-2 border-gold bg-ivory/60 shadow-lift"
                    : "drop-shadow-[0_4px_8px_rgba(168,116,47,0.45)]"
                }
                fallback={
                  <p
                    className="text-[46px] leading-none drop-shadow-[0_4px_8px_rgba(168,116,47,0.45)]"
                    aria-hidden
                  >
                    {celebration.emoji}
                  </p>
                }
              />
            </div>
          ) : (
            <p
              className="text-[46px] leading-none drop-shadow-[0_4px_8px_rgba(168,116,47,0.45)]"
              aria-hidden
            >
              {celebration.emoji}
            </p>
          )}
          <p className="mt-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.16em] text-olive">
            Congratulations
          </p>
          <h2 className="font-display text-[26px] font-black leading-tight text-walnut-dark">
            {celebration.title}
          </h2>
          <ul className="mt-1.5 space-y-0.5" data-testid="celebration-lines">
            {celebration.lines.map((l) => (
              <li
                key={l}
                className={
                  // Chef Pride (Phase 2): a rival chef's reply is in the chef's own hand.
                  /^Chef \S+: /.test(l)
                    ? "pt-0.5 font-hand text-[17px] leading-snug text-copper"
                    : "font-ui text-[15px] font-bold text-walnut-dark"
                }
                {...(/^Chef \S+: /.test(l) ? { "data-testid": "celebration-rival" } : {})}
              >
                {l}
              </li>
            ))}
          </ul>
          {shares.length ? (
            <button
              type="button"
              data-testid="celebration-share"
              onClick={() => setPreview(true)}
              className="press mt-2.5 min-h-12 rounded-full border-2 border-olive/50 bg-ivory/70 px-5 font-ui text-[14px] font-extrabold text-walnut-dark"
            >
              📸 Share this
            </button>
          ) : null}
        </div>
      </div>
      <div
        data-edge="bottom"
        className="paige-stage paige-in pointer-events-none relative w-full max-w-[520px]"
        data-tone="success"
        data-testid="celebration-paige"
      >
        <PaigeCutout pose={celebration.pose} className="paige-cutout absolute bottom-0 left-0" />
        <div
          className="paige-speech pointer-events-auto absolute"
          data-tone="success"
          onClick={(e) => e.stopPropagation()}
        >
          <PaigeNameplate tone="success" />
          <div className="paige-scroll">
            <p className="paige-words font-display font-extrabold text-walnut-dark">
              {celebration.paige}
            </p>
            <div className="paige-actions">
              <KButton variant="sage" className="paige-btn" onClick={onClose}>
                Keep going ›
              </KButton>
            </div>
          </div>
        </div>
      </div>
      {preview && shares.length ? (
        <div onClick={(e) => e.stopPropagation()}>
          <MomentPreview moments={shares} onClose={() => setPreview(false)} />
        </div>
      ) : null}
    </div>
  );
}
