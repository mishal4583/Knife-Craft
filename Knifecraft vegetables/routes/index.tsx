import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gameplay } from "@/components/kc/Gameplay";
import { Kitchen } from "@/components/kc/Kitchen";
import { Workshop } from "@/components/kc/Workshop";
import { Boards } from "@/components/kc/Boards";
import { RecipeBook, RecipeDetail } from "@/components/kc/Recipes";
import { Progression, JournalHome, DailyOrder, Settings } from "@/components/kc/Journal";
import { Shop, Customize } from "@/components/kc/Shop";
import { RECIPES, type Recipe, type ScreenId } from "@/components/kc/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KnifeCraft — Cozy Café Prep Game" },
      {
        name: "description",
        content:
          "Slice, plate and perfect your craft in a warm neighborhood café kitchen. A cozy prep-chef arcade prototype.",
      },
      { property: "og:title", content: "KnifeCraft — Cozy Café Prep Game" },
      {
        property: "og:description",
        content: "A cozy prep-chef game: pick an ingredient, swipe, slice, plate.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [screen, setScreen] = useState<ScreenId>("gameplay");
  const [credits, setCredits] = useState(1240);
  const [knife, setKnife] = useState("chef");
  const [board, setBoard] = useState("walnut");
  const [recipe, setRecipe] = useState<Recipe>(RECIPES[0]!);
  const [visited, setVisited] = useState(false);

  const go = (s: ScreenId) => {
    if (s === "gameplay") setVisited(true);
    setScreen(s);
  };
  const spend = (n: number) => setCredits((c) => Math.max(0, c - n));

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(120%_80%_at_50%_0%,#3E2819,#231710_70%)] px-3 py-4 md:grid md:place-items-center md:py-8">
      <h1 className="sr-only">KnifeCraft — cozy café prep-chef game prototype</h1>

      {/* Desktop preview frame */}
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-6 md:flex-row md:items-center md:justify-center">
        <div className="hidden max-w-[260px] text-right md:block">
          <p className="font-hand text-[26px] leading-tight text-[color:var(--color-gold)]">
            KnifeCraft
          </p>
          <p className="mt-2 font-ui text-[12px] leading-relaxed text-[color:var(--color-cream)]/60">
            A cozy prep-chef arcade for YouTube Playables. Portrait-first, one thumb, no timers.
            Swipe across the tomato to begin.
          </p>
        </div>

        <div className="relative">
          <div
            className="relative mx-auto overflow-hidden rounded-[38px] border-[6px] border-[#241811] shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
            style={{
              width: "min(100vw - 24px, 380px)",
              aspectRatio: "540 / 960",
              maxHeight: "calc(100vh - 48px)",
            }}
          >
            {screen === "gameplay" ? (
              <Gameplay firstTime={!visited} onExit={() => go("kitchen")} />
            ) : null}
            {screen === "kitchen" ? <Kitchen go={go} credits={credits} /> : null}
            {screen === "workshop" ? (
              <Workshop
                go={go}
                credits={credits}
                spend={spend}
                equipped={knife}
                setEquipped={setKnife}
              />
            ) : null}
            {screen === "knives" ? (
              <Workshop
                go={go}
                credits={credits}
                spend={spend}
                equipped={knife}
                setEquipped={setKnife}
              />
            ) : null}
            {screen === "boards" ? (
              <Boards
                go={go}
                credits={credits}
                spend={spend}
                equipped={board}
                setEquipped={setBoard}
              />
            ) : null}
            {screen === "recipes" ? (
              <RecipeBook
                go={go}
                onOpen={(r) => {
                  setRecipe(r);
                  setScreen("recipe-detail");
                }}
              />
            ) : null}
            {screen === "recipe-detail" ? <RecipeDetail recipe={recipe} go={go} /> : null}
            {screen === "progression" ? <Progression go={go} /> : null}
            {screen === "journal" ? <JournalHome go={go} credits={credits} /> : null}
            {screen === "daily" ? <DailyOrder go={go} /> : null}
            {screen === "shop" ? <Shop go={go} credits={credits} spend={spend} /> : null}
            {screen === "decor" ? <Customize go={go} credits={credits} /> : null}
            {screen === "settings" ? <Settings go={go} /> : null}
          </div>
        </div>

        <div className="hidden max-w-[200px] md:block">
          <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-[color:var(--color-gold)]/80">
            Screens
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                ["gameplay", "Prep"],
                ["kitchen", "Kitchen"],
                ["daily", "Daily"],
                ["recipes", "Recipes"],
                ["workshop", "Workshop"],
                ["boards", "Boards"],
                ["progression", "Journey"],
                ["journal", "Journal"],
                ["shop", "Market"],
                ["decor", "Decorate"],
                ["settings", "Settings"],
              ] as [ScreenId, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className="rounded-full border border-[color:var(--color-cream)]/20 px-2.5 py-1 font-ui text-[10px] font-bold text-[color:var(--color-cream)]/70 transition-colors hover:border-[color:var(--color-gold)]/60 hover:text-[color:var(--color-gold)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
