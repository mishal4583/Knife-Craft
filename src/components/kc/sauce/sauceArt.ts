import { useEffect, useState, type CSSProperties } from "react";
import { SHEETS } from "./sauceSheets";

/**
 * Sauce Station's painted art files (public/business/sauce/, built by scripts/make-sauce-assets.py from the Codex kit): the address of one, whether it
 * exists (one tiny probe per file, remembered) so the screen can draw a CSS stand-in until the art is there, and the CSS to show one CELL of a sheet.
 */

export const sauceUrl = (name: string) => `${import.meta.env.BASE_URL}business/sauce/${name}.webp`;

const probed = new Map<string, boolean>();
/** Whether an art file exists (one tiny probe per file, remembered). */
export function useSauceArt(name: string): boolean {
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
    img.src = sauceUrl(name);
    return () => {
      alive = false;
    };
  }, [name]);
  return ok;
}

/** CSS that shows the whole CELL (col, row) of a sheet; the box it is put on must have the aspect of a cell. */
export function cellStyle(sheet: string, col: number, row: number): CSSProperties {
  const s = SHEETS[sheet];
  if (!s) return {};
  return {
    backgroundImage: `url(${sauceUrl(sheet)})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${s.cols * 100}% ${s.rows * 100}%`,
    backgroundPosition: `${s.cols > 1 ? (col / (s.cols - 1)) * 100 : 0}% ${s.rows > 1 ? (row / (s.rows - 1)) * 100 : 0}%`,
  };
}
export const cellAspect = (sheet: string): number => {
  const s = SHEETS[sheet];
  return s ? s.w / s.cols / (s.h / s.rows) : 1;
};

/** CSS that shows one hand-picked pixel box [x, y, w, h] of a sheet (for a sheet whose pictures carry more than the part wanted), and its aspect. */
export function rectStyle(
  sheet: string,
  box: readonly [number, number, number, number],
): { style: CSSProperties; aspect: number } | null {
  const s = SHEETS[sheet];
  if (!s) return null;
  const [x, y, w, h] = box;
  return {
    aspect: w / h,
    style: {
      backgroundImage: `url(${sauceUrl(sheet)})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${(s.w / w) * 100}% ${(s.h / h) * 100}%`,
      backgroundPosition: `${s.w > w ? (x / (s.w - w)) * 100 : 0}% ${s.h > h ? (y / (s.h - h)) * 100 : 0}%`,
    },
  };
}

/** CSS that shows the TIGHT box of cell `index` of a sheet (cropped to the painted pixels), and that box's aspect ratio. */
export function boxStyle(
  sheet: string,
  index: number,
): { style: CSSProperties; aspect: number } | null {
  const s = SHEETS[sheet];
  const b = s?.boxes[index];
  if (!s || !b) return null;
  const [x, y, w, h] = b;
  return {
    aspect: w / h,
    style: {
      backgroundImage: `url(${sauceUrl(sheet)})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${(s.w / w) * 100}% ${(s.h / h) * 100}%`,
      backgroundPosition: `${s.w > w ? (x / (s.w - w)) * 100 : 0}% ${s.h > h ? (y / (s.h - h)) * 100 : 0}%`,
    },
  };
}
