import { useEffect, useRef } from "react";
import { GameBridge } from "@/game/GameBridge";

/**
 * GAME_VIEWPORT — the boundary between React and Phaser (§7).
 *
 * This mounts a GameBridge-owned Phaser.Game into a plain div and does
 * nothing else: no gameplay state, no scoring, no pointer handling.
 * Everything inside the mounted canvas is Phaser's; everything outside
 * it (HUD, overlays, menus) stays regular React/DOM, composited above
 * this element by the parent.
 */
export function GameViewport({ bridge }: { bridge: GameBridge }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    bridge.mount(el);
    return () => bridge.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge identity is stable for the component's lifetime
  }, []);

  return (
    <div
      ref={containerRef}
      data-game-viewport
      className="absolute inset-x-0 top-[12%] z-10 h-[74%] touch-none"
    />
  );
}
