import { useState } from "react";
import { KButton } from "@/components/kc/common/primitives";
import { isInteractiveTask, useCleaningGame } from "./CleaningGame";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import {
  phaseChecklist,
  type CleanlinessAction,
  type CleanlinessActionResult,
  type ShiftPhase,
} from "@/game/restaurant/cleanliness";

const PHASE_META: Record<ShiftPhase, { title: string; icon: string; goal: string }> = {
  opening: { title: "Opening chores", icon: "🌅", goal: "Prepare: stations, restroom, tables." },
  lull: { title: "Between services", icon: "🕒", goal: "Reset quickly for the next service." },
  closing: {
    title: "Closing chores",
    icon: "🌙",
    goal: "Clean up and leave it ready for tomorrow.",
  },
};

/**
 * A phase's chores (a real restaurant's day, developer 2026-10-11): a filtered
 * view of the Cleanliness tasks — the opening chores on the opening card,
 * the lull's between services, closing's at Closing Time. Each chore is
 * done with its own Do it (its supplies used once, cleanliness.ts; the "Do
 * all" shortcut was removed, developer 2026-10-17); "Buy …" opens the Market
 * line; the full picture is Restaurant → Cleanliness. Never blocks.
 */
export function ShiftChecklist({
  save,
  phase,
  onAction,
  onBuy,
  onOpenCleanliness,
}: {
  save: SaveData;
  phase: ShiftPhase;
  onAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
  onBuy: (id: SupplyId) => void;
  onOpenCleanliness?: () => void;
}) {
  const items = phaseChecklist(save, phase);
  const [flash, setFlash] = useState<string | null>(null);
  // The same cleaning as Restaurant → Cleanliness: scrubbing tasks in the game (CleaningGame.tsx).
  const cleaning = useCleaningGame(save, (a) => run(a));
  if (items.length === 0) return cleaning.game;
  const meta = PHASE_META[phase];
  function run(action: CleanlinessAction): CleanlinessActionResult | null {
    const r = onAction(action);
    if (r && r.cleaned.length) {
      setFlash(`✨ ${r.cleaned.length === 1 ? "Done!" : `${r.cleaned.length} done!`}`);
      window.setTimeout(() => setFlash(null), 1400);
    }
    return r;
  }
  return (
    <div
      className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-2"
      data-testid={`shift-chores-${phase}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[20px]" aria-hidden>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/70">
            {meta.title} · {items.length}
          </p>
          <p className="font-ui text-[12px] text-walnut/60">{meta.goal}</p>
        </div>
      </div>
      {flash ? (
        <p
          className="anim-pop mt-1 text-center font-ui text-[13px] font-extrabold text-olive"
          role="status"
        >
          {flash}
        </p>
      ) : null}
      <ul className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 land:grid-cols-3">
        {items.map((t) => (
          <li
            key={t.kind}
            data-chore-task={t.kind}
            className="flex min-w-0 flex-col gap-2 rounded-[18px] border-2 border-gold/45 bg-gradient-to-b from-ivory to-cream p-2.5 shadow-[0_3px_0_rgba(200,150,50,0.18)]"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95),rgba(240,222,186,0.7)_62%,rgba(220,190,140,0.25)_76%,transparent_78%)] text-[30px] drop-shadow-[0_3px_3px_rgba(60,35,15,0.25)]"
              >
                {t.rule.icon}
              </span>
              <span className="min-w-0 flex-1 font-ui text-[13.5px] font-extrabold leading-snug text-walnut-dark">
                {t.rule.label}
              </span>
            </div>
            {t.needs.length === 0 ? (
              <KButton
                size="sm"
                variant="cream"
                className="min-h-12 w-full shrink-0"
                onClick={() => cleaning.clean(t.kind)}
              >
                {isInteractiveTask(t.kind) ? "🧽 Clean" : "Do it"}
              </KButton>
            ) : (
              t.needs.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-need={id}
                  onClick={() => onBuy(id)}
                  className={cn(
                    "press min-h-12 w-full max-w-full shrink-0 rounded-full bg-tomato/90 px-3 py-1 font-ui text-[12px] font-extrabold leading-tight text-ivory",
                  )}
                >
                  Buy {getSupplyItem(id)?.name.split(" ·")[0]} ›
                </button>
              ))
            )}
          </li>
        ))}
      </ul>
      {onOpenCleanliness ? (
        <button
          type="button"
          onClick={onOpenCleanliness}
          className="press mt-1 min-h-12 w-full rounded-full font-ui text-[12.5px] font-extrabold text-copper"
        >
          See every area in Cleanliness ›
        </button>
      ) : null}
      {cleaning.game}
    </div>
  );
}
