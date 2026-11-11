import { useState } from "react";
import { cn } from "@/lib/utils";
import { ASSISTANT_NAME, type PaigePose } from "@/game/restaurant/assistant";

/**
 * Paige's painted pieces (public/business/assistant/, cut from the generated sheets by scripts/make-assistant-assets.py). Every piece is
 * drawn from here, from ONE folder; a picture that cannot load is hidden (or replaced by an emoji for her face), so the bubble and its
 * buttons always work.
 */
export const paigeUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/assistant/${name}.webp`;

/** A painted UI piece (ring, arrow, notebook, sticky note, ...). Decorative. */
export function PaigePiece({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={paigeUrl(name)}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-paige-piece={name}
      onError={() => setFailed(true)}
      className={cn("pointer-events-none select-none", className)}
      style={style}
    />
  );
}

/** Paige in one pose (half body, all poses on one canvas size so she never jumps between poses). */
export function PaigePoseImg({ pose, className }: { pose: PaigePose; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={cn("grid place-items-center text-[64px]", className)} aria-hidden="true">
        👩‍🍳
      </span>
    );
  return (
    <img
      src={paigeUrl(`pose-${pose}`)}
      alt={ASSISTANT_NAME}
      draggable={false}
      data-paige-pose={pose}
      onError={() => setFailed(true)}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}

/**
 * Paige as a standalone cutout (developer 2026-11-11). The new full cutouts (`cutout-<pose>.webp`, drawn from the Codex prompts in
 * docs/planning/PAIGE-CUTOUT-CODEX-PROMPTS-2026-11-11.md) are used when they exist; otherwise the half-body pose of the first set, then an emoji.
 * One fixed box, so she never jumps between poses.
 */
// Which new cutout files do not exist (any subset of the twelve may be delivered): remembered per pose, so a missing file is ONE 404 per visit and not
// one every time she gives a tip with that pose; a delivered one is always tried.
const missingCutouts = new Set<string>();
const art = { nameplate: true };

export function PaigeCutout({ pose, className }: { pose: PaigePose; className?: string }) {
  const startStage = (p: PaigePose) => (missingCutouts.has(p) ? "old" : "new");
  const [stage, setStage] = useState<"new" | "old" | "none">(startStage(pose));
  // A new pose starts with the new cutout again (unless none exists).
  const [forPose, setForPose] = useState(pose);
  if (forPose !== pose) {
    setForPose(pose);
    setStage(startStage(pose));
  }
  if (stage === "none")
    return (
      <span className={cn("grid place-items-center text-[88px]", className)} aria-hidden="true">
        👩‍🍳
      </span>
    );
  return (
    <img
      src={paigeUrl(stage === "new" ? `cutout-${pose}` : `pose-${pose}`)}
      alt={ASSISTANT_NAME}
      draggable={false}
      data-paige-pose={pose}
      data-paige-art={stage}
      onError={() => {
        if (stage === "new") missingCutouts.add(pose);
        setStage(stage === "new" ? "old" : "none");
      }}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}

/** The small PAIGE nameplate on the bubble: the painted plate (`nameplate.webp`) when it exists, else a brass plate in CSS. */
export function PaigeNameplate({ tone = "normal" }: { tone?: "normal" | "success" | "warning" }) {
  const [painted, setPainted] = useState(art.nameplate);
  return (
    <span className="paige-nameplate" data-tone={tone} data-testid="assistant-nameplate">
      {painted ? (
        <img
          src={paigeUrl("nameplate")}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => {
            art.nameplate = false;
            setPainted(false);
          }}
          className="paige-nameplate-art"
        />
      ) : null}
      <span className="paige-nameplate-text">{ASSISTANT_NAME}</span>
    </span>
  );
}

export type PaigeFace = "kind" | "laugh" | "worried" | "wink";

/** Her oval cameo (as drawn: about 1.3 : 1); the emoji shows if it cannot load. */
export function PaigeAvatar({
  face = "kind",
  className,
}: {
  face?: PaigeFace;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={cn("grid place-items-center", className)} aria-hidden="true">
        👩‍🍳
      </span>
    );
  return (
    <img
      src={paigeUrl(`avatar-${face}`)}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-paige-avatar={face}
      onError={() => setFailed(true)}
      className={cn("pointer-events-none select-none object-contain", className)}
    />
  );
}
