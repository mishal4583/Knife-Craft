import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { avocado } from "@/ingredients/definitions/avocado";
import { baguette } from "@/ingredients/definitions/baguette";
import { basil } from "@/ingredients/definitions/basil";
import { broccoli } from "@/ingredients/definitions/broccoli";
import { cheddar } from "@/ingredients/definitions/cheddar";
import { eggplant } from "@/ingredients/definitions/eggplant";
import { lemon } from "@/ingredients/definitions/lemon";
import { parsley } from "@/ingredients/definitions/parsley";
import { applyCuts, plate, wholePiece, type Piece } from "@/ingredients/cutter";
import { drawPiece, renderIngredient } from "@/ingredients/renderer";
import { makeRng } from "@/ingredients/rng";
import { cutLinesFor, plateSpreadFor } from "@/ingredients/techniques";
import type { IngredientDefinition, Technique } from "@/ingredients/types";
import { cn } from "@/lib/utils";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

const INGREDIENTS: IngredientDefinition[] = [
  basil,
  parsley,
  broccoli,
  cheddar,
  baguette,
  eggplant,
  avocado,
  lemon,
];

const BOARD_SIZE = 560;

function Index() {
  const [selectedId, setSelectedId] = useState(INGREDIENTS[0]!.id);
  const def = useMemo(() => INGREDIENTS.find((i) => i.id === selectedId)!, [selectedId]);

  const [pieces, setPieces] = useState<Piece[]>(() => [wholePiece(def.geometry(def.seed))]);
  const [activeTechnique, setActiveTechnique] = useState<Technique | null>(null);
  const cutRoundRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Whenever the ingredient changes, snap back to the whole, uncut form.
  useEffect(() => {
    setPieces([wholePiece(def.geometry(def.seed))]);
    setActiveTechnique(null);
  }, [def]);

  // Repaint the board any time the pieces (or the ingredient) change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssSize = BOARD_SIZE;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    // Cutting board backdrop.
    ctx.fillStyle = "#caa06a";
    ctx.fillRect(0, 0, cssSize, cssSize);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let x = 24; x < cssSize; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssSize);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cssSize - 6, cssSize - 6);

    const cached = renderIngredient(def, 512);
    const scale = def.scale ?? 1;
    const view = {
      cx: cssSize / 2,
      cy: cssSize / 2,
      radius: (cssSize / 2) * 0.78 * scale,
    };
    for (const piece of pieces) drawPiece(ctx, def, cached, piece, view);
  }, [def, pieces]);

  function runTechnique(t: Technique) {
    const geometry = def.geometry(def.seed);
    const lines = cutLinesFor(t, geometry);
    if (!lines.length) {
      // "Peel" isn't modeled as a straight cut; just flag it as the active view.
      setActiveTechnique(t);
      return;
    }
    cutRoundRef.current += 1;
    const cut = applyCuts(geometry, lines, { separate: !!def.separateOnCut });
    const spread = plateSpreadFor[t] ?? 0.2;
    const rnd = makeRng((def.seed ^ 0xc0ffee) + cutRoundRef.current);
    setPieces(plate(cut, spread, rnd));
    setActiveTechnique(t);
  }

  function reset() {
    setPieces([wholePiece(def.geometry(def.seed))]);
    setActiveTechnique(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">
          KnifeCraft — Ingredient Laboratory
        </h1>
        <p className="text-sm text-muted-foreground">
          Procedural ingredients, cut live. Not the production game — a testbed for the food system.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Left: ingredient selector */}
        <aside className="w-full shrink-0 lg:w-56">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredients
          </h2>
          <ul className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {INGREDIENTS.map((ing) => (
              <li key={ing.id}>
                <button
                  onClick={() => setSelectedId(ing.id)}
                  className={cn(
                    "w-full whitespace-nowrap rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    ing.id === selectedId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {ing.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center: cutting board */}
        <main className="flex flex-1 flex-col items-center gap-4">
          <div
            className="overflow-hidden rounded-lg border shadow-sm"
            style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
          >
            <canvas ref={canvasRef} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={reset}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Reset
            </button>
            {def.techniques.map((t) => (
              <button
                key={t}
                onClick={() => runTechnique(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTechnique === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </main>

        {/* Right: ingredient card */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-lg border p-4">
            <h2 className="text-base font-semibold text-foreground">{def.name}</h2>
            <p className="text-sm text-muted-foreground">{def.category}</p>
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Techniques
              </h3>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {def.techniques.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Pieces on board: {pieces.length}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
