import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { DecoyKind, DefectKind, Mark } from "@/game/business/deliveryInspection";

/**
 * The look of Delivery Inspection's marks (rules: business/deliveryInspection.ts). The painted art (public/business/inspection/: `defects.webp` a 4 x 3
 * sheet, `decoys.webp` a 3 x 2 sheet, `crate-back.webp`, `crate-front.webp`, `backdrop.webp`, built from the Codex kit D01-D10) is used when it is there;
 * until then every mark is drawn from plain CSS so the game is complete without it. Presentation only.
 */

export const inspUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/inspection/${name}.webp`;

const probed = new Map<string, boolean>();
/** Whether an art file exists (one tiny probe per file, remembered). */
export function useArt(name: string): boolean {
  const [ok, setOk] = useState<boolean>(probed.get(name) ?? false);
  useEffect(() => {
    if (probed.has(name)) {
      setOk(probed.get(name)!);
      return;
    }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      probed.set(name, true);
      if (alive) setOk(true);
    };
    img.onerror = () => {
      probed.set(name, false);
      if (alive) setOk(false);
    };
    img.src = inspUrl(name);
    return () => {
      alive = false;
    };
  }, [name]);
  return ok;
}

/** The sheet cell of each defect / decoy (the order the Codex prompts D04 and D05 ask for). */
const DEFECT_CELL: Record<DefectKind, (v: number) => number> = {
  mold: (v) => v % 4,
  rot: (v) => 4 + (v % 2),
  bruise: (v) => 6 + (v % 2),
  wilt: () => 8,
  slime: () => 9,
  pests: () => 10,
  shrivel: () => 11,
};
const DECOY_CELL: Record<DecoyKind, number> = {
  soil: 0,
  drop: 1,
  scuff: 2,
  freckles: 3,
  sun: 4,
  speck: 5,
};

/** CSS stand-ins for the painted overlays. */
const DEFECT_CSS: Record<DefectKind, (v: number) => string> = {
  mold: (v) =>
    v % 2 === 0
      ? "radial-gradient(circle at 50% 50%, #f4fbe6 0 18%, #b9d98f 38%, #7da35c 58%, transparent 74%), radial-gradient(circle at 30% 65%, #dff0c4 0 12%, transparent 30%)"
      : "radial-gradient(circle at 50% 50%, #d9f0ee 0 16%, #7fc0b4 40%, #4c8f86 60%, transparent 75%), radial-gradient(circle at 68% 35%, #bfe4dd 0 10%, transparent 26%)",
  rot: () =>
    "radial-gradient(circle at 45% 45%, #1f1008 0 22%, #4b2a12 46%, #6b4423 62%, transparent 76%)",
  bruise: (v) =>
    v % 2 === 0
      ? "radial-gradient(circle at 50% 50%, #5b3a22 0 30%, #8a5d38 55%, transparent 74%)"
      : "radial-gradient(circle at 50% 50%, #4a3550 0 30%, #7b6580 55%, transparent 74%)",
  wilt: () =>
    "radial-gradient(circle at 50% 50%, transparent 0 34%, #c2a431 52%, #8c6a1c 66%, transparent 78%)",
  slime: () =>
    "radial-gradient(circle at 40% 38%, #ffffff99 0 8%, transparent 14%), radial-gradient(circle at 50% 50%, #cfe58a 0 30%, #9cc060 56%, transparent 76%)",
  pests: () =>
    [
      "radial-gradient(circle at 30% 35%, #1a1008 0 6%, transparent 9%)",
      "radial-gradient(circle at 62% 28%, #1a1008 0 5%, transparent 8%)",
      "radial-gradient(circle at 50% 58%, #1a1008 0 7%, transparent 10%)",
      "radial-gradient(circle at 25% 70%, #1a1008 0 5%, transparent 8%)",
      "radial-gradient(circle at 72% 66%, #1a1008 0 6%, transparent 9%)",
    ].join(","),
  shrivel: () =>
    "repeating-radial-gradient(circle at 50% 50%, #a98a57 0 3%, #7d6338 5% 7%, transparent 7% 9%), radial-gradient(circle, #a98a5788 0 40%, transparent 72%)",
};
const DECOY_CSS: Record<DecoyKind, string> = {
  soil: "radial-gradient(circle at 50% 50%, #8a6a45 0 24%, #a8895f 44%, transparent 70%)",
  drop: "radial-gradient(circle at 36% 32%, #ffffff 0 10%, #bfe3f5aa 24%, #8ec6e6aa 44%, transparent 56%)",
  scuff: "linear-gradient(110deg, transparent 38%, #f5ead099 46% 54%, transparent 62%)",
  freckles: [
    "radial-gradient(circle at 28% 40%, #b08a56 0 5%, transparent 8%)",
    "radial-gradient(circle at 55% 30%, #b08a56 0 5%, transparent 8%)",
    "radial-gradient(circle at 70% 58%, #b08a56 0 5%, transparent 8%)",
    "radial-gradient(circle at 40% 68%, #b08a56 0 5%, transparent 8%)",
  ].join(","),
  sun: "radial-gradient(circle at 50% 50%, #fff0b866 0 30%, transparent 70%)",
  speck: "radial-gradient(ellipse at 50% 50%, #4a7a2a 0 22%, transparent 44%)",
};

/** One mark (a defect or a harmless look-alike), drawn over an ingredient: `scale` is its share of the picture's box. */
export function MarkArt({
  mark,
  scale,
  className,
  style,
}: {
  mark: Mark;
  scale: number;
  className?: string;
  style?: CSSProperties;
}) {
  const sheetName = mark.type === "defect" ? "defects" : "decoys";
  const painted = useArt(sheetName);
  const base: CSSProperties = {
    left: `${(0.5 + mark.dx - scale / 2) * 100}%`,
    top: `${(0.5 + mark.dy - scale / 2) * 100}%`,
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    ...style,
  };
  if (painted) {
    const cell =
      mark.type === "defect" ? DEFECT_CELL[mark.kind](mark.variant) : DECOY_CELL[mark.kind];
    const [cols, rows] = mark.type === "defect" ? [4, 3] : [3, 2];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return (
      <span
        aria-hidden
        data-mark={`${mark.type}-${mark.kind}`}
        className={cn("pointer-events-none absolute", className)}
        style={{
          ...base,
          backgroundImage: `url(${inspUrl(sheetName)})`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-mark={`${mark.type}-${mark.kind}`}
      className={cn("pointer-events-none absolute rounded-full", className)}
      style={{
        ...base,
        backgroundImage:
          mark.type === "defect" ? DEFECT_CSS[mark.kind](mark.variant) : DECOY_CSS[mark.kind],
      }}
    />
  );
}

/** The feedback marks (`markers.webp`, a 2 x 2 sheet): 0 the red stamp ring, 1 the red cross, 2 the chalk ring, 3 the green tick. null until the art is there. */
export function MarkerArt({ cell, className }: { cell: 0 | 1 | 2 | 3; className?: string }) {
  const painted = useArt("markers");
  if (!painted) return null;
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `url(${inspUrl("markers")})`,
        backgroundSize: "200% 200%",
        backgroundPosition: `${(cell % 2) * 100}% ${Math.floor(cell / 2) * 100}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** Whether the painted feedback marks exist (then the CSS rings step aside). */
export const useMarkers = (): boolean => useArt("markers");

/** The Sharp Eye pin number `n` (1-12) of `pins.webp` (a 4 x 3 sheet); null until the art is there. */
export function PinArt({ n, className }: { n: number; className?: string }) {
  const painted = useArt("pins");
  if (!painted) return null;
  const cell = Math.min(11, Math.max(0, n - 1));
  return (
    <span
      aria-hidden
      data-testid="insp-pin"
      className={cn("inline-block aspect-square", className)}
      style={{
        backgroundImage: `url(${inspUrl("pins")})`,
        backgroundSize: "400% 300%",
        backgroundPosition: `${((cell % 4) / 3) * 100}% ${(Math.floor(cell / 4) / 2) * 100}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
