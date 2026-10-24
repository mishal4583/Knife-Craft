import { useState, type ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import {
  cleanlinessOf,
  type CleanArea,
  type CleanlinessAction,
  type CleanlinessActionResult,
  type TaskKind,
  TASK_RULES,
} from "@/game/restaurant/cleanliness";
import { cleaningVariant } from "@/game/restaurant/cleaningDirt";
import { cleanlinessRoomImageUrl, kitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import { AreaCleaningPrototype } from "../business/AreaCleaningPrototype";

/**
 * The tasks cleaned in the cleaning game (scrubbing the room's painting) —
 * the rest are one tap. The same set everywhere (developer 2026-10-24: the
 * night chores "in the same cleanliness section", done like the day's).
 */
export const INTERACTIVE_CLEANING_TASKS: Record<CleanArea, ReadonlySet<TaskKind>> = {
  kitchen: new Set<TaskKind>([
    "equipment",
    "grease",
    "degrease",
    "deep-kitchen",
    "sweep-line",
    "wipe-boards",
  ]),
  dining: new Set<TaskKind>(["tables", "floor", "spill", "mop-all", "deep-dining", "clear-tables"]),
  restroom: new Set<TaskKind>(["toilet", "restroom-floor", "restroom-disinfect", "deep-restroom"]),
};

/** Whether `kind` is cleaned in the cleaning game (else one tap). */
export const isInteractiveTask = (kind: TaskKind) =>
  INTERACTIVE_CLEANING_TASKS[TASK_RULES[kind].area].has(kind);

/** Fresh dirt every clean (developer 2026-10-22), steady while the task waits. */
export const cleaningVariantFor = (st: ReturnType<typeof cleanlinessOf>, task: TaskKind) =>
  cleaningVariant(st.cleaned, st.tasks.find((t) => t.kind === task)?.since ?? 0, task);

/**
 * One way to clean a task, wherever it is listed (Restaurant → Cleanliness,
 * the Pre-Service Check, Closing Time): `clean(task)` opens the cleaning game
 * for a scrubbing task — finishing it is the cleanliness action "clean" — or
 * cleans a one-tap task at once. Render `game` where the overlay belongs.
 */
export function useCleaningGame(
  save: SaveData,
  run: (action: CleanlinessAction) => CleanlinessActionResult | null,
): { clean: (task: TaskKind) => void; game: ReactNode } {
  const [active, setActive] = useState<{ area: CleanArea; task: TaskKind } | null>(null);
  const st = cleanlinessOf(save);
  const stage = kitchenMapArtStage(save.equippedKitchenUpgradeId);
  const clean = (task: TaskKind) => {
    if (isInteractiveTask(task)) setActive({ area: TASK_RULES[task].area, task });
    else run({ kind: "clean", task });
  };
  const game = active ? (
    <AreaCleaningPrototype
      key={`${active.area}-${active.task}-${stage}-${cleaningVariantFor(st, active.task)}`}
      area={active.area}
      task={active.task}
      stage={stage}
      variant={cleaningVariantFor(st, active.task)}
      image={cleanlinessRoomImageUrl(active.area, save.equippedKitchenUpgradeId)}
      onClose={() => setActive(null)}
      onComplete={() => {
        run({ kind: "clean", task: active.task });
        setActive(null);
      }}
    />
  ) : null;
  return { clean, game };
}
