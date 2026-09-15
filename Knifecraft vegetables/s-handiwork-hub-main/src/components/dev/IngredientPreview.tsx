import { useEffect, useRef, useState } from "react";
import type { PreviewMode } from "@/game/preview/IngredientPreviewScene";

/**
 * DEV ONLY preview host. Phaser is imported lazily so it never runs during SSR.
 */
export function IngredientPreview() {
  const mount = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{
    events: { emit: (k: string, v: unknown) => void };
    destroy: (b: boolean) => void;
  } | null>(null);
  const [mode, setMode] = useState<PreviewMode>("whole");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const [{ default: Phaser }, { IngredientPreviewScene }] = await Promise.all([
        import("phaser"),
        import("@/game/preview/IngredientPreviewScene"),
      ]);
      if (disposed || !mount.current) return;
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mount.current,
        width: 1200,
        height: 900,
        backgroundColor: "#6B4226",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [IngredientPreviewScene],
      });
      gameRef.current = game as unknown as typeof gameRef.current;
    })();
    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.events.emit("preview:mode", mode);
  }, [mode]);
  useEffect(() => {
    gameRef.current?.events.emit("preview:scale", scale);
  }, [scale]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["whole", "cross", "silhouette"] as PreviewMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${
              mode === m
                ? "border-transparent bg-[#B87333] text-[#2A1A10]"
                : "border-[#F6E8CC]/30 text-[#F6E8CC]"
            }`}
          >
            {m === "cross" ? "cross-section" : m}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-[#F6E8CC]">
          size
          <input
            type="range"
            min={0.4}
            max={1.2}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
      </div>
      <div ref={mount} className="overflow-hidden rounded-2xl border border-[#F6E8CC]/20" />
    </div>
  );
}
