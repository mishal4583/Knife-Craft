import { useEffect, useState } from "react";

/**
 * Delivery Inspection's painted art files (public/business/inspection/, built by scripts/make-inspection-assets.py from the Codex kit): the
 * address of one, and whether it exists (one tiny probe per file, remembered), so the screen can draw a CSS stand-in until the art is there.
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

/** Whether the painted feedback marks exist (then the CSS rings step aside). */
export const useMarkers = (): boolean => useArt("markers");
