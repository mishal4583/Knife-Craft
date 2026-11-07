import { useEffect, useState, type CSSProperties } from "react";
import { PEOPLE_SHEETS, peopleUrl } from "@/game/restaurant/peopleLooks";

/**
 * Loading and cutting the painted people's sheets (NPC realism, developer 2026-11-07): the load state of each sheet (a sheet that fails to
 * load leaves the old SVG puppet) and the background style that shows one cell of it. The components are in CharacterSprite.tsx.
 */
export type SheetName = "a" | "b" | "bust";
type Status = "loading" | "ok" | "fail";

const status = new Map<string, Status>();
const waiting = new Set<() => void>();

const urlOf = (id: string, sheet: SheetName) => peopleUrl(id, sheet, import.meta.env.BASE_URL);

function probe(id: string, sheet: SheetName) {
  const url = urlOf(id, sheet);
  if (status.has(url)) return;
  status.set(url, "loading");
  const img = new Image();
  img.onload = () => {
    status.set(url, "ok");
    waiting.forEach((f) => f());
  };
  img.onerror = () => {
    status.set(url, "fail");
    waiting.forEach((f) => f());
  };
  img.src = url;
}

/** The loading state of `id`'s sheet (starts the load the first time it is asked). */
export function sheetStatus(id: string, sheet: SheetName): Status {
  probe(id, sheet);
  return status.get(urlOf(id, sheet)) ?? "loading";
}

/** Re-renders when any people sheet finishes loading; returns the status lookup. */
export function usePeopleSheets(
  ids: readonly string[],
  sheet: SheetName = "a",
): (id: string) => Status {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    waiting.add(f);
    return () => {
      waiting.delete(f);
    };
  }, []);
  for (const id of ids) probe(id, sheet);
  return (id) => sheetStatus(id, sheet);
}

const pos = (i: number, n: number) => (n > 1 ? `${(i / (n - 1)) * 100}%` : "0%");

/** Background style showing cell (col, row) of a sheet. */
export function cellStyle(id: string, sheet: SheetName, col: number, row = 0): CSSProperties {
  const g = PEOPLE_SHEETS[sheet];
  return {
    backgroundImage: `url(${urlOf(id, sheet)})`,
    backgroundSize: `${g.cols * 100}% ${g.rows * 100}%`,
    backgroundPosition: `${pos(col, g.cols)} ${pos(row, g.rows)}`,
  };
}
