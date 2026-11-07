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
