import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { getRecipeBookEntries, getRecipeBookCategories } from "@/game/levels/recipeBook";
import { getLevel, isUnlocked, isCompleted } from "@/game/levels/LevelManager";
import { isLevelPrepared } from "@/game/levels/levelMastery";
import type { UnlockRequirement } from "@/game/levels/levelTypes";
import type { SaveData } from "@/game/SaveManager";

/** A short, friendly line for a locked entry — reuses the same plain-language style OrderBoard already uses ("locked · finish the level before it") rather than a literal requirement-tree dump. */
function describeUnlockRequirement(req: UnlockRequirement): string {
  switch (req.type) {
    case "always":
      return "";
    case "levelCompleted": {
      const level = getLevel(req.levelId);
      return level ? `Finish "${level.title}" to unlock` : "Finish an earlier order to unlock";
    }
    case "chapterCompleted":
      return `Finish Chapter ${req.chapter} to unlock`;
    case "and":
      return req.requirements.map(describeUnlockRequirement).filter(Boolean).join(" and ");
    case "or":
      return req.requirements.map(describeUnlockRequirement).filter(Boolean).join(" or ");
  }
}

export function RecipeBook({
  go,
  save,
  onOpen,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onOpen: (levelId: string) => void;
}) {
  // Only chapters the player has reached get a tab, and within a chapter
  // only unlocked recipes plus the next locked one (as "Upcoming Recipe") —
  // upcoming dishes stay a surprise, same rule as the Order Board.
  const allEntries = getRecipeBookEntries();
  const reached = new Set(
    allEntries.filter((e) => isUnlocked(e.level, save.levelProgress)).map((e) => e.chapterTitle),
  );
  const categories = getRecipeBookCategories().filter((c) => reached.has(c));
  const [cat, setCat] = useState(categories[categories.length - 1] ?? "");
  const inChapter = allEntries.filter((e) => e.chapterTitle === cat);
  const firstLocked = inChapter.findIndex((e) => !isUnlocked(e.level, save.levelProgress));
  const entries = firstLocked === -1 ? inChapter : inChapter.slice(0, firstLocked + 1);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 wood opacity-90" />
      <div className="absolute inset-2 rounded-[26px] paper shadow-lift" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Recipe Book"
          subtitle="the café's handwritten pages"
          onBack={() => go("kitchen")}
        />

        {/* Tabs as paper index cards — only real chapters, no empty placeholder categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "press shrink-0 rounded-t-xl rounded-b-md border px-3 py-1.5 font-ui text-[11px] font-extrabold tracking-wide",
                c === cat
                  ? "border-copper/50 bg-gold/30 text-walnut-dark shadow-soft"
                  : "border-walnut/15 bg-ivory/70 text-walnut/60",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-3 px-4">
          {entries.map((entry) => {
            const unlocked = isUnlocked(entry.level, save.levelProgress);
            const completed = isCompleted(entry.level.id, save.levelProgress);
            const prepared = isLevelPrepared(save.recipeProgress, entry.level);
            const ready = unlocked && !completed;
            if (!unlocked) {
              return (
                <div
                  key={entry.level.id}
                  className="flex w-full items-center gap-3 rounded-[20px] border border-dashed border-walnut/20 p-3 opacity-60"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-walnut/15 bg-cream/70 text-[26px]">
                    🔒
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[16px] font-black leading-tight text-walnut-dark">
                      Upcoming Recipe
                    </span>
                    <span className="mt-1 block font-hand text-[14px] leading-tight text-walnut/60">
                      finish the recipe above to reveal it
                    </span>
                  </span>
                  <Badge tone="locked">Locked</Badge>
                </div>
              );
            }
            return (
              <button
                key={entry.level.id}
                type="button"
                onClick={() => onOpen(entry.level.id)}
                className={cn(
                  "lift flex w-full items-center gap-3 rounded-[20px] border p-3 text-left card-warm",
                  ready ? "border-copper/45 ring-1 ring-gold/25" : "border-walnut/15",
                  !unlocked && "opacity-55",
                )}
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-walnut/15 bg-cream/70 text-[26px]">
                  {unlocked ? entry.level.emoji : "🔒"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[16px] font-black leading-tight text-walnut-dark">
                    {entry.level.title}
                  </span>
                  <span className="mt-1 block font-hand text-[14px] leading-tight text-walnut/60">
                    {unlocked
                      ? entry.ingredientNames.join(" · ")
                      : describeUnlockRequirement(entry.level.unlockRequirements)}
                  </span>
                </span>
                {/* Cookbook Prepared Stamp — corrective pass: a permanent
                    "Done" badge once the recipe has been prepared, no
                    numeric/percentage readout of any kind (the plate is
                    the score, not a score on the plate). */}
                <span className="shrink-0 text-right">
                  {!unlocked ? (
                    <Badge tone="locked">Locked</Badge>
                  ) : prepared ? (
                    <Badge tone="sage">Prepared</Badge>
                  ) : (
                    <Badge tone="copper">Ready</Badge>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

export function RecipeDetail({
  levelId,
  save,
  go,
  onSelectLevel,
}: {
  levelId: string;
  save: SaveData;
  go: (s: ScreenId) => void;
  onSelectLevel: (levelId: string) => void;
}) {
  const level = getLevel(levelId);
  if (!level) {
    // Shouldn't happen from real navigation, but keeps the screen safe if it ever does.
    return (
      <div className="relative h-full w-full overflow-hidden bg-cream">
        <ScreenHeader title="Recipe" subtitle="not found" onBack={() => go("recipes")} />
        <BottomNav active="kitchen" go={go} />
      </div>
    );
  }

  // getRecipeBookEntries() derives one entry per LEVELS item and `level`
  // above came from that same LEVELS array (via getLevel), so this lookup
  // always succeeds.
  const bookEntry = getRecipeBookEntries().find((e) => e.level.id === level.id)!;
  const unlocked = isUnlocked(level, save.levelProgress);
  const completed = isCompleted(level.id, save.levelProgress);
  const prepared = isLevelPrepared(save.recipeProgress, level);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(85%_45%_at_50%_0%,rgba(216,168,78,0.3),transparent_62%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title={level.title}
          subtitle={bookEntry.chapterTitle}
          onBack={() => go("recipes")}
        />

        <div className="px-4">
          <div className="relative grid h-[210px] place-items-center overflow-hidden rounded-[26px] border border-walnut/15 card-warm">
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,247,232,0.9),transparent_70%)]" />
            <span className="relative text-[92px] drop-shadow-[0_14px_18px_rgba(62,40,25,0.28)]">
              {unlocked ? level.emoji : "🔒"}
            </span>
            <span className="absolute bottom-3 font-hand text-[16px] text-walnut/60">
              {level.subtitle}
            </span>
          </div>
        </div>

        {unlocked ? (
          <p className="px-6 pt-3 text-center font-hand text-[16px] leading-snug text-walnut/70">
            {level.description}
          </p>
        ) : null}

        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              {/* Cookbook Prepared Stamp — corrective pass: a permanent
                  "Prepared" fact once this recipe has ever been
                  completed (recipeProgress[id].done, pre-existing data),
                  never a numeric/percentage rating. */}
              {!unlocked ? (
                <span className="font-ui text-[11px] font-extrabold text-walnut/55">
                  {describeUnlockRequirement(level.unlockRequirements)}
                </span>
              ) : prepared ? (
                <Badge tone="sage">Prepared</Badge>
              ) : (
                <span className="font-ui text-[11px] text-walnut/45">Not prepared yet</span>
              )}
            </div>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Ingredients
            </p>
            <ul className="mt-2 space-y-1.5">
              {bookEntry.ingredientNames.map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 font-ui text-[13px] font-bold text-walnut-dark"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  {i}
                </li>
              ))}
            </ul>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Techniques
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bookEntry.techniqueNames.map((t) => (
                <Badge key={t} tone="sage">
                  {t}
                </Badge>
              ))}
            </div>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Preparation
            </p>
            <ol className="mt-2 space-y-1.5">
              {bookEntry.steps.map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  className="flex items-center gap-2 font-ui text-[13px] font-bold text-walnut-dark"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-walnut/10 font-ui text-[10px] text-walnut/60">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <KButton
            full
            size="lg"
            disabled={!unlocked}
            onClick={() => {
              if (!unlocked) return;
              onSelectLevel(level.id);
              go("gameplay");
            }}
          >
            {!unlocked ? "Locked" : completed ? "Replay" : "Prepare"}
          </KButton>
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}
