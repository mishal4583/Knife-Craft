import { useEffect, useState } from "react";

/**
 * The game's own (logical) size, kept up to date: a landscape layout that picks a number of columns from the room it has (Stock the shelves) reads it. The shell scales the
 * whole game, so this measures the `[data-game-content]` box when there is one, else the window.
 */
export function useWindowSize(): { w: number; h: number } {
  const read = () => {
    const el =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>("[data-game-content]")
        : null;
    return { w: el?.offsetWidth ?? window.innerWidth, h: el?.offsetHeight ?? window.innerHeight };
  };
  const [size, setSize] = useState(read);
  useEffect(() => {
    const on = () => setSize(read());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}
