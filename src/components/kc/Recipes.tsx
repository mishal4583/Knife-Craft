import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { getRecipeBookEntries, getRecipeBookCategories } from "@/game/levels/recipeBook";
import { getLevel, isUnlocked, isCompleted } from "@/game/levels/LevelManager";
import { isLevelPrepared, recipeIdsOfLevel } from "@/game/levels/levelMastery";
import {
  TIER_INFO,
  TIER_ORDER,
  bestOfRecipes,
  collectionSummary,
  memoryFor,
  nextTier,
  sessionDish,
  tierFor,
} from "@/game/signatureDishes";
import { VARIANTS } from "@/game/specialVariants";
import { qualityFor } from "@/game/CutEvaluator";
import { TierBadge, TIER_STYLE } from "./signature/TierBadge";
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
  // Phase 4 (A): each page's presentation tier, from the saved best of the
  // recipes it can serve (signatureDishes.ts — no new save field).
  const tierOf = (level: (typeof allEntries)[number]["level"]) => {
    const rec = bestOfRecipes(save.recipeProgress, recipeIdsOfLevel(level));
    return tierFor(rec.best, rec.done);
  };
  const summary = collectionSummary(
    allEntries.filter((e) => isUnlocked(e.level, save.levelProgress)).map((e) => tierOf(e.level)),
  );

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
                "press shrink-0 rounded-t-xl rounded-b-md border px-3 py-1.5 font-ui text-[12px] font-extrabold tracking-wide",
                c === cat
                  ? "border-copper/50 bg-gold/30 text-walnut-dark shadow-soft"
                  : "border-walnut/15 bg-ivory/70 text-walnut/60",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Phase 4 (A8): the collection at a glance — how many pages are at each tier. */}
        <div
          className="mx-4 mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[16px] border border-gold/40 bg-gold/10 px-3 py-2 font-ui text-[12px] font-extrabold text-walnut-dark"
          data-testid="signature-summary"
        >
          <span className="w-full text-center text-[10.5px] uppercase tracking-[0.18em] text-copper">
            Signature dishes
          </span>
          {[...TIER_ORDER].reverse().map((t) => (
            <span key={t} data-tier-count={t}>
              {TIER_INFO[t].icon} {summary[t]} {TIER_INFO[t].name}
            </span>
          ))}
        </div>

        <div className="space-y-3 px-4">
          {entries.map((entry) => {
            const unlocked = isUnlocked(entry.level, save.levelProgress);
            const completed = isCompleted(entry.level.id, save.levelProgress);
            const prepared = isLevelPrepared(save.recipeProgress, entry.level);
            const tier = prepared ? tierOf(entry.level) : null;
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
                    <span className="block font-display text-[16.5px] font-black leading-tight text-walnut-dark">
                      Upcoming Recipe
                    </span>
                    <span className="mt-1 block font-hand text-[15px] leading-tight text-walnut/60">
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
                  tier
                    ? TIER_STYLE[tier].frame
                    : ready
                      ? "border-copper/45 ring-1 ring-gold/25"
                      : "border-walnut/15",
                  !unlocked && "opacity-55",
                )}
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-walnut/15 bg-cream/70 text-[26px]">
                  {unlocked ? entry.level.emoji : "🔒"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[16.5px] font-black leading-tight text-walnut-dark">
                    {entry.level.title}
                  </span>
                  <span className="mt-1 block font-hand text-[15px] leading-tight text-walnut/60">
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
                    // Phase 4 (A3): the Prepared stamp now says HOW it was
                    // prepared — every tier means "Prepared" (Homemade is the
                    // first one). Words, never a score.
                    tier ? (
                      <TierBadge tier={tier} className="max-[359px]:px-1.5" />
                    ) : (
                      <Badge tone="sage">Prepared</Badge>
                    )
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
  // Phase 4 (A): the page's tier, best plate (as a grade word), memories and
  // this visit's extras (signatureDishes.ts).
  const recipeIds = recipeIdsOfLevel(level);
  const record = bestOfRecipes(save.recipeProgress, recipeIds);
  const tier = prepared ? tierFor(record.best, record.done) : null;
  const upNext = nextTier(tier);
  const reached = tier ? TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier) + 1) : [];
  const visit = sessionDish(recipeIds);

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
          {/* Phase 4 (A6): the page's illustration — the dish's own picture
              (the game draws dishes as their emoji; there is no separate dish
              art) framed by its tier, with the tier's ribbon. A page not
              written yet shows the dish faded. */}
          <div
            className={cn(
              "relative grid h-[210px] place-items-center overflow-hidden rounded-[26px] border card-warm",
              tier ? TIER_STYLE[tier].frame : "border-walnut/15",
            )}
            data-testid="signature-illustration"
            data-tier={tier ?? ""}
          >
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,247,232,0.9),transparent_70%)]" />
            {tier ? (
              <span
                className={cn(
                  "absolute left-3 top-3 rounded-full px-2.5 py-1 font-ui text-[10.5px] font-extrabold uppercase tracking-[0.12em] shadow-soft",
                  TIER_STYLE[tier].ribbon,
                )}
              >
                {TIER_INFO[tier].icon} {TIER_INFO[tier].name}
              </span>
            ) : null}
            <span
              className={cn(
                "relative text-[92px] drop-shadow-[0_14px_18px_rgba(62,40,25,0.28)]",
                unlocked && !prepared && "opacity-45 grayscale",
              )}
            >
              {unlocked ? level.emoji : "🔒"}
            </span>
            <span className="absolute bottom-3 font-hand text-[17px] text-walnut/60">
              {level.subtitle}
            </span>
          </div>
        </div>

        {unlocked ? (
          <p className="px-6 pt-3 text-center font-hand text-[17px] leading-snug text-walnut/70">
            {level.description}
          </p>
        ) : null}

        {/* Phase 4 (A3/A4/A5/A7): the Signature Dish — the three tiers and how
            to reach each, the best plate as its grade word, the family
            memories this page has earned, and this visit's extras. */}
        {unlocked ? (
          <div className="px-4 pt-3">
            <Panel className="p-4" data-testid="signature-panel">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
                Signature dish
              </p>
              <ol className="mt-2 space-y-1.5">
                {TIER_ORDER.map((t) => {
                  const got = reached.includes(t);
                  return (
                    <li
                      key={t}
                      className="flex items-start gap-2"
                      data-tier-step={t}
                      data-reached={got}
                    >
                      <span
                        className={cn(
                          "mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]",
                          got ? "bg-sage text-ivory" : "border border-walnut/25 text-walnut/40",
                        )}
                        aria-hidden="true"
                      >
                        {got ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block font-ui text-[13.5px] font-extrabold",
                            got ? "text-walnut-dark" : "text-walnut/55",
                          )}
                        >
                          {TIER_INFO[t].icon} {TIER_INFO[t].name}
                        </span>
                        <span className="block font-hand text-[14.5px] leading-snug text-walnut/60">
                          {TIER_INFO[t].how}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {tier && typeof record.best === "number" ? (
                <p
                  className="mt-2 font-ui text-[12.5px] font-bold text-walnut/75"
                  data-testid="signature-best"
                >
                  Best plate so far: <span className="text-copper">{qualityFor(record.best)}</span>
                  {upNext ? <> · next: {TIER_INFO[upNext].name}</> : <> · the top of the book</>}
                </p>
              ) : (
                <p className="mt-2 font-hand text-[15px] text-walnut/55">
                  A page waiting to be written.
                </p>
              )}
              {reached.length > 0 ? (
                <div className="mt-2 space-y-1" data-testid="signature-memories">
                  {reached.map((t) => (
                    <p key={t} className="font-hand text-[15.5px] leading-snug text-walnut-dark/80">
                      {TIER_INFO[t].icon} {memoryFor(level.recipeId, t)}
                    </p>
                  ))}
                </div>
              ) : null}
              {visit && (visit.bestCombo > 0 || visit.variants.length > 0) ? (
                <p
                  className="mt-2 rounded-xl bg-gold/12 px-2.5 py-1.5 font-ui text-[12px] font-bold text-walnut/75"
                  data-testid="signature-visit"
                >
                  This visit (not saved)
                  {visit.bestCombo > 0 ? <> · longest run Clean ×{visit.bestCombo}</> : null}
                  {visit.variants.length > 0 ? (
                    <>
                      {" "}
                      · made with{" "}
                      {visit.variants
                        .map((v) => `${VARIANTS[v].emoji} ${VARIANTS[v].name}`)
                        .join(", ")}
                    </>
                  ) : null}
                </p>
              ) : null}
            </Panel>
          </div>
        ) : null}

        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              {/* Cookbook Prepared Stamp — corrective pass: a permanent
                  "Prepared" fact once this recipe has ever been
                  completed (recipeProgress[id].done, pre-existing data),
                  never a numeric/percentage rating. */}
              {!unlocked ? (
                <span className="font-ui text-[12px] font-extrabold text-walnut/55">
                  {describeUnlockRequirement(level.unlockRequirements)}
                </span>
              ) : prepared ? (
                <Badge tone="sage">Prepared</Badge>
              ) : (
                <span className="font-ui text-[12px] text-walnut/45">Not prepared yet</span>
              )}
            </div>
            <Divider />
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Ingredients
            </p>
            <ul className="mt-2 space-y-1.5">
              {bookEntry.ingredientNames.map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 font-ui text-[13.5px] font-bold text-walnut-dark"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  {i}
                </li>
              ))}
            </ul>
            <Divider />
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
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
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Preparation
            </p>
            <ol className="mt-2 space-y-1.5">
              {bookEntry.steps.map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  className="flex items-center gap-2 font-ui text-[13.5px] font-bold text-walnut-dark"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-walnut/10 font-ui text-[11px] text-walnut/60">
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
            variant={completed ? "ghost" : "sage"}
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
