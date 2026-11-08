import { useEffect, useState } from "react";

/**
 * The full-screen dishwashing art (public/dishwashing/, built by scripts/make-wash-assets.py from the Codex kit W01-W21). Each layer is used only
 * when its file exists (one tiny probe per file, remembered), so the sink is complete with any part of the art, and with none.
 */
export const washUrl = (name: string) => `${import.meta.env.BASE_URL}dishwashing/${name}.webp`;

const probed = new Map<string, boolean>();
export function useWashArt(name: string): boolean {
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
    img.src = washUrl(name);
    return () => {
      alive = false;
    };
  }, [name]);
  return ok;
}
