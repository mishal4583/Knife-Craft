import type { CSSProperties } from "react";
import { NB_SLICE3, NB_SLICE9, nbImage } from "./notebookArt";

/** The notebook's stretching pieces (sizes in notebookArt.ts), drawn as plain boxes: no CSS border-image (hairline seams when scaled). */

type Band = "start" | "mid" | "end";
const BANDS: readonly Band[] = ["start", "mid", "end"];

/** One axis of one of the nine: where it sits, and how its share of the picture is sized and placed. */
function axis(band: Band, size: number, cap: number, k: number) {
  const end = cap * k;
  return {
    from: band === "start" ? 0 : band === "mid" ? end - 1 : undefined,
    to: band === "end" ? 0 : band === "mid" ? end - 1 : undefined,
    length: band === "mid" ? undefined : end,
    position: band === "start" ? "0%" : band === "mid" ? "50%" : "100%",
    background: band === "mid" ? `${(100 * size) / (size - 2 * cap)}%` : `${size * k}px`,
  };
}

/** A nine-slice painted piece filling its (positioned) parent, behind its words. `corner` is the width the corners are drawn at, in px. */
export function Slice9({ piece, corner }: { piece: keyof typeof NB_SLICE9; corner: number }) {
  const { w, h, x, y } = NB_SLICE9[piece];
  const k = corner / x;
  const image = nbImage(piece);
  return (
    <span aria-hidden="true" data-art-piece={piece} className="pn-art-layer">
      {BANDS.flatMap((row) =>
        BANDS.map((col) => {
          const ax = axis(col, w, x, k);
          const ay = axis(row, h, y, k);
          const style: CSSProperties = {
            left: ax.from,
            right: ax.to,
            width: ax.length,
            top: ay.from,
            bottom: ay.to,
            height: ay.length,
            backgroundImage: image,
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${ax.position} ${ay.position}`,
            backgroundSize: `${ax.background} ${ay.background}`,
          };
          return <i key={`${row}-${col}`} style={style} />;
        }),
      )}
    </span>
  );
}

/** A piece stretched between its two ends, as tall as its parent. */
export function Slice3({ piece }: { piece: keyof typeof NB_SLICE3 }) {
  const { w, h, left, right } = NB_SLICE3[piece];
  const image = nbImage(piece);
  const endL = `calc(100cqh * ${left / h})`;
  const endR = `calc(100cqh * ${right / h})`;
  return (
    <span aria-hidden="true" data-art-piece={piece} className="pn-art-layer pn-art-tall">
      {/* the middle first, a pixel under each end */}
      <i
        style={{
          top: 0,
          bottom: 0,
          left: `calc(${endL} - 1px)`,
          right: `calc(${endR} - 1px)`,
          background: `${image} ${(100 * left) / (left + right)}% 0 / ${(100 * w) / (w - left - right)}% 100% no-repeat`,
        }}
      />
      <i
        style={{
          top: 0,
          bottom: 0,
          left: 0,
          width: endL,
          background: `${image} 0 0 / auto 100% no-repeat`,
        }}
      />
      <i
        style={{
          top: 0,
          bottom: 0,
          right: 0,
          width: endR,
          background: `${image} 100% 0 / auto 100% no-repeat`,
        }}
      />
    </span>
  );
}
