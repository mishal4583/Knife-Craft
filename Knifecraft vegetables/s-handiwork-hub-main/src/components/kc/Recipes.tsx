import { useState } from "react";
import { RECIPES, RECIPE_CATEGORIES, type Recipe, type ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Stars, Badge, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";

export function RecipeBook({
  go,
  onOpen,
}: {
  go: (s: ScreenId) => void;
  onOpen: (r: Recipe) => void;
}) {
  const [cat, setCat] = useState("Salads");
  const list = RECIPES.filter((r) => r.category === cat);

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

        {/* Tabs as paper index cards */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          {RECIPE_CATEGORIES.map((c) => (
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
          {list.length === 0 ? (
            <p className="py-10 text-center font-hand text-[18px] text-walnut/45">
              this chapter is still blank…
            </p>
          ) : null}
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpen(r)}
              className="lift flex w-full items-center gap-3 rounded-[20px] border border-walnut/15 card-warm p-3 text-left"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-walnut/15 bg-cream/70 text-[26px]">
                {r.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] font-black leading-tight text-walnut-dark">
                  {r.name}
                </span>
                <span className="mt-0.5 block">
                  <Stars n={r.difficulty} size={10} />
                </span>
                <span className="mt-1 block font-hand text-[14px] leading-tight text-walnut/60">
                  {r.ingredients.join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {r.best ? (
                  <span className="block font-display text-[17px] font-black text-copper">
                    {r.best}%
                  </span>
                ) : (
                  <span className="block font-ui text-[11px] text-walnut/40">—</span>
                )}
                {r.done ? <Badge tone="sage">Done</Badge> : <Badge tone="cream">Open</Badge>}
              </span>
            </button>
          ))}
        </div>
      </div>
      <BottomNav active="recipes" go={go} />
    </div>
  );
}

export function RecipeDetail({
  recipe,
  go,
}: {
  recipe: Recipe;
  go: (s: ScreenId) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(85%_45%_at_50%_0%,rgba(216,168,78,0.3),transparent_62%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader title={recipe.name} subtitle={recipe.category} onBack={() => go("recipes")} />

        <div className="px-4">
          <div className="relative grid h-[210px] place-items-center overflow-hidden rounded-[26px] border border-walnut/15 card-warm">
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,247,232,0.9),transparent_70%)]" />
            <span className="relative text-[92px] drop-shadow-[0_14px_18px_rgba(62,40,25,0.28)]">
              {recipe.emoji}
            </span>
            <span className="absolute bottom-3 font-hand text-[16px] text-walnut/60">
              {recipe.note}
            </span>
          </div>
        </div>

        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <Stars n={recipe.difficulty} size={13} />
              {recipe.best ? (
                <span className="font-ui text-[11px] font-extrabold text-copper">
                  Best prep {recipe.best}%
                </span>
              ) : (
                <span className="font-ui text-[11px] text-walnut/45">Not prepared yet</span>
              )}
            </div>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Ingredients
            </p>
            <ul className="mt-2 space-y-1.5">
              {recipe.ingredients.map((i) => (
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
              {recipe.techniques.map((t) => (
                <Badge key={t} tone="sage">
                  {t}
                </Badge>
              ))}
            </div>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <KButton full size="lg" onClick={() => go("gameplay")}>
            Prepare
          </KButton>
        </div>
      </div>
      <BottomNav active="recipes" go={go} />
    </div>
  );
}