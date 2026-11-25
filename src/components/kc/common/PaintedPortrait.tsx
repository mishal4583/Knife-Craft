import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A painted picture from a Codex sheet (a rival chef's bust, a prestige emblem, the health inspector: `game/chefArt.ts` holds the paths). Lazy, decorative (the words next to it say
 * what it is), and if the file cannot load the `fallback` (the old emoji or icon) is drawn instead, so a missing picture is never a hole.
 *
 * `round` crops it to a circle from the top (a face); otherwise it keeps its own shape and `ratio` is its height over its width.
 */
export function PaintedPortrait({
  path,
  width,
  ratio = 1,
  round = false,
  fallback,
  className,
  ...rest
}: {
  /** Relative to the app's base URL (`game/chefArt.ts`). */
  path: string;
  /** Width in px; the height is `width * ratio`. */
  width: number;
  ratio?: number;
  round?: boolean;
  fallback: ReactNode;
  className?: string;
  "data-portrait"?: string;
}) {
  const [bad, setBad] = useState(false);
  if (bad) return <>{fallback}</>;
  return (
    <img
      src={`${import.meta.env.BASE_URL}${path}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      width={width}
      height={Math.round(width * ratio)}
      onError={() => setBad(true)}
      className={cn(
        "shrink-0 select-none",
        round && "rounded-full object-cover object-top",
        className,
      )}
      style={{ width, height: Math.round(width * ratio) }}
      {...rest}
    />
  );
}
