import { useEffect, useRef } from "react";

/**
 * The wide maps show their WHOLE picture (developer 2026-11-21: "make sure the entrance area and the outdoor area are included properly and do not crop any portion"), so a window that is not
 * 16:9 has margins (the sides of a wider window, the top and bottom of a taller one). The margins are never bars: they carry on the picture's own outermost edge, which is only garden, hedge and
 * cobbles (never the wall). A thin strip of it (1.4 % of the picture) is copied outward again and again, every other copy mirrored, so each seam is the same pixels reflected (no line, no blur).
 * Drawn on a canvas from exact source rectangles, so there are no sub-pixel seams.
 *
 * `box` is where the whole picture is drawn in the viewport (`wideFit`); put this BEFORE the stage so the stage is drawn over it.
 */
const STRIP = 0.014;

export function MapEdgeFill({
  src,
  box,
  vp,
}: {
  src: string;
  box: { left: number; top: number; sw: number; sh: number };
  vp: { w: number; h: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || vp.w <= 0 || vp.h <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vp.w * dpr);
    canvas.height = Math.round(vp.h * dpr);
    const g = canvas.getContext("2d");
    if (!g) return;
    const img = new Image();
    let alive = true;
    img.onload = () => {
      if (!alive) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, vp.w, vp.h);
      // the picture itself first, a hair larger than the stage: the stage's own edge (a fractional pixel) can then never show a gap
      g.drawImage(img, box.left - 1, box.top - 1, box.sw + 2, box.sh + 2);
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const stripW = Math.max(2, Math.round(W * STRIP));
      const stripH = Math.max(2, Math.round(H * STRIP));
      const tw = (box.sw * stripW) / W; // a strip's width on screen
      const th = (box.sh * stripH) / H;
      // one strip, drawn at (x, y, w, h) from the source rectangle (sx, sy), mirrored when `flipX` / `flipY`
      const strip = (
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        x: number,
        y: number,
        w: number,
        h: number,
        flipX: boolean,
        flipY: boolean,
      ) => {
        g.save();
        g.translate(flipX ? x + w : x, flipY ? y + h : y);
        g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        g.restore();
      };
      const right = box.left + box.sw;
      const bottom = box.top + box.sh;
      // left and right margins, beside the picture (the picture's own rows only)
      for (let i = 0; box.left - i * tw > -tw && i < 200; i++)
        strip(
          0,
          0,
          stripW,
          H,
          box.left - (i + 1) * tw - 0.5,
          box.top,
          tw + 1,
          box.sh,
          i % 2 === 0,
          false,
        );
      for (let i = 0; right + i * tw < vp.w && i < 200; i++)
        strip(
          W - stripW,
          0,
          stripW,
          H,
          right + i * tw - 0.5,
          box.top,
          tw + 1,
          box.sh,
          i % 2 === 0,
          false,
        );
      // top and bottom margins (a window taller than 16:9)
      for (let i = 0; box.top - i * th > -th && i < 200; i++)
        strip(
          0,
          0,
          W,
          stripH,
          box.left,
          box.top - (i + 1) * th - 0.5,
          box.sw,
          th + 1,
          false,
          i % 2 === 0,
        );
      for (let i = 0; bottom + i * th < vp.h && i < 200; i++)
        strip(
          0,
          H - stripH,
          W,
          stripH,
          box.left,
          bottom + i * th - 0.5,
          box.sw,
          th + 1,
          false,
          i % 2 === 0,
        );
      // the four corners (both margins meet): the corner pixel block of the picture, mirrored out
      const corner = (cx: number, cy: number, sx: number, sy: number, fx: boolean, fy: boolean) => {
        for (let ix = 0; ix < 80; ix++) {
          const x = fx ? cx + ix * tw : cx - (ix + 1) * tw;
          if (x > vp.w || x < -tw) break;
          for (let iy = 0; iy < 80; iy++) {
            const y = fy ? cy + iy * th : cy - (iy + 1) * th;
            if (y > vp.h || y < -th) break;
            strip(
              sx,
              sy,
              stripW,
              stripH,
              x - 0.5,
              y - 0.5,
              tw + 1,
              th + 1,
              ix % 2 === 0 ? fx : !fx,
              iy % 2 === 0 ? fy : !fy,
            );
          }
        }
      };
      if (box.left > 0.5 && box.top > 0.5) corner(box.left, box.top, 0, 0, false, false);
      if (box.left > 0.5 && vp.h - bottom > 0.5)
        corner(box.left, bottom, 0, H - stripH, false, true);
      if (vp.w - right > 0.5 && box.top > 0.5) corner(right, box.top, W - stripW, 0, true, false);
      if (vp.w - right > 0.5 && vp.h - bottom > 0.5)
        corner(right, bottom, W - stripW, H - stripH, true, true);
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src, box.left, box.top, box.sw, box.sh, vp.w, vp.h]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="map-edge-fill"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
