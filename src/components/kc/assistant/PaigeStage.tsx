import type { ReactNode } from "react";
import type { PaigePose } from "@/game/restaurant/assistant";
import { PaigeCutout, PaigeNameplate } from "./PaigeArt";
import "./assistant.css";

/**
 * PAIGE SPEAKING (developer 2026-11-11 / 12: "Paige should come like this": a standalone cutout rising from the bottom edge, ONE big speech bubble to
 * the right with a PAIGE nameplate, never a card that looks like an app notification). Every place she talks (her tips, the Congratulations card, the
 * Next-step card, the section pointer) uses this one piece. `children` are the words and the buttons; the bubble grows with them and scrolls if a phone is
 * tiny. Put it at the BOTTOM of a dimmed, blurred screen (`edge="bottom"`, the default).
 */
export function PaigeStage({
  pose,
  tone = "normal",
  edge = "bottom",
  testId,
  children,
}: {
  pose: PaigePose;
  tone?: "normal" | "success" | "warning";
  edge?: "bottom" | "free";
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="paige-stage paige-in pointer-events-none relative w-full max-w-[520px]"
      data-tone={tone}
      data-edge={edge}
      data-testid={testId}
    >
      <PaigeCutout pose={pose} className="paige-cutout absolute bottom-0 left-0" />
      <div className="paige-speech pointer-events-auto absolute" data-tone={tone}>
        <PaigeNameplate tone={tone} />
        <div className="paige-scroll">{children}</div>
      </div>
    </div>
  );
}
