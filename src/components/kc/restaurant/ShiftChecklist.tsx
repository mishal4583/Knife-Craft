import { useState } from "react";
import { KButton } from "@/components/kc/common/primitives";
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
  if (items.length === 0) return null;
  const meta = PHASE_META[phase];
  function run(action: CleanlinessAction) {
    const r = onAction(action);
    if (r && r.cleaned.length) {
      setFlash(`✨ ${r.cleaned.length === 1 ? "Done!" : `${r.cleaned.length} done!`}`);
      window.setTimeout(() => setFlash(null), 1400);
    }
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
      <ul className="mt-1 space-y-1">
        {items.map((t) => (
          <li
            key={t.kind}
            data-chore-task={t.kind}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-cream/70 px-2 py-1"
          >
            <span className="text-[18px]" aria-hidden>
              {t.rule.icon}
            </span>
            <span className="min-w-0 flex-1 font-ui text-[13.5px] font-bold text-walnut-dark">
              {t.rule.label}
            </span>
            {t.needs.length === 0 ? (
              <KButton
                size="sm"
                variant="cream"
                className="min-h-12 shrink-0"
                onClick={() => run({ kind: "clean", task: t.kind })}
              >
                Do it
              </KButton>
            ) : (
              t.needs.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-need={id}
                  onClick={() => onBuy(id)}
                  className={cn(
                    "press min-h-12 shrink-0 rounded-full bg-tomato/90 px-3 font-ui text-[12px] font-extrabold text-ivory",
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
    </div>
  );
}
