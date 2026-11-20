import type { ReactNode } from "react";
import { useLandscape } from "./layoutMode";

/** The film's two edges fade out over about a quarter of its width, into the matching picture round it. */
const FADE =
  "linear-gradient(90deg, transparent 0, rgba(0,0,0,0.5) 7%, #000 14.3%, #000 85.7%, rgba(0,0,0,0.5) 93%, transparent 100%)";

/**
 * A film (the cooking films, the oven film) in a landscape window (developer 2026-11-20): each film has its OWN wide background picture (Codex, `clip-<film>.webp`, the same
 * room and light as the film, with the film's frame in its middle). The picture covers the window (never a bar; the crop comes mostly off the bottom), the film is drawn over
 * the middle of it at exactly the same scale (`share` = the frame's width as a share of the picture's width: 9:16 is 608 / 1920, the oven's 4:5 is 864 / 1920) and its left
 * and right edges fade into the picture, so the two are one scene. Portrait (an upright phone): the film fills the screen as before. `overlay` is drawn over the film's
 * box and is NOT faded (buttons, text).
 */
export function FilmBackdrop({
  art,
  share,
  video,
  overlay,
}: {
  art: string;
  share: number;
  video: ReactNode;
  overlay?: ReactNode;
}) {
  const landscape = useLandscape();
  if (!landscape)
    return (
      <div className="absolute inset-0">
        {video}
        {overlay}
      </div>
    );
  return (
    <div
      className="absolute inset-0 overflow-hidden [container-type:size]"
      data-testid="film-backdrop"
    >
      <div
        className="absolute left-1/2 aspect-[16/9] -translate-x-1/2"
        style={{
          width: "max(100cqw, calc(100cqh * 16 / 9))",
          top: "calc((100cqh - max(100cqh, calc(100cqw * 9 / 16))) * 0.4)",
        }}
      >
        <img
          src={art}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="film-art"
          className="absolute inset-0 h-full w-full select-none"
        />
        {/* The film is drawn a little WIDER than the frame painted in the picture's middle (x1.4, cropped top and bottom by object-cover), so its opaque part covers the seam
            where that frame meets the painted sides, and it fades out over the sides themselves. */}
        <div
          className="absolute left-1/2 top-0 h-full -translate-x-1/2"
          style={{ width: `${share * 140}%` }}
        >
          <div className="absolute inset-0" style={{ WebkitMaskImage: FADE, maskImage: FADE }}>
            {video}
          </div>
        </div>
        <div
          className="absolute left-1/2 top-0 h-full -translate-x-1/2"
          style={{ width: `${share * 100}%` }}
        >
          {overlay}
        </div>
      </div>
    </div>
  );
}
