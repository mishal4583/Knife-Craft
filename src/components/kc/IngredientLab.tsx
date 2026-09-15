import { useEffect, useMemo, useState } from "react";
import type { ScreenId } from "./data";
import { INGREDIENTS, TECHNIQUES, type IngredientId, type TechniqueId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { buildLabLevel, ingredientLabRoster } from "@/game/ingredientLab";
import { Preparation } from "./game/Preparation";
import { ScreenHeader, KButton, Panel, Badge } from "./common/primitives";
import { CardShell } from "./common/Cards";
import { BottomNav } from "./Kitchen";

/**
 * INGREDIENT_LAB — Phase 18A. A dev/QA screen (reachable only from
 * Settings, only while QA_MODE is on — see Journal.tsx's own Settings
 * component) for visually inspecting and cut-testing every ingredient in
 * the production `INGREDIENTS` registry, using the REAL rendering/cutting
 * pipeline (GameBridge → PreparationScene → CutGeometry/CutEvaluator →
 * the real texture/paint modules) — the exact same `<Preparation>`
 * component a real level uses, just fed a synthesized one-step
 * `LevelDefinition` (see game/ingredientLab.ts) instead of a campaign
 * level, and an `onComplete` that returns 0 without ever touching
 * SaveManager/LevelManager — so a lab session cannot affect player
 * progression, coins, recipe mastery, or unlocks no matter what the
 * player does inside it.
 *
 * Two internal views (gallery/detail) rather than two ScreenIds, since
 * neither needs App.tsx's own save-mutation plumbing — this screen never
 * calls back into `go` for anything except leaving the Lab entirely.
 */
export function IngredientLab({ go }: { go: (s: ScreenId) => void }) {
  const roster = useMemo(() => ingredientLabRoster(), []);
  const [openId, setOpenId] = useState<IngredientId | null>(null);

  useEffect(() => {
    // §12 — the completeness check, read straight off the registry every
    // time this screen mounts: if the roster ever changes, this updates
    // itself, since it is never a second hand-maintained count.

    console.log(`Ingredient Lab: ${roster.length} ingredients available`);
  }, [roster]);

  if (openId) {
    return (
      <IngredientLabDetail
        // Keyed by ingredient so switching ingredients remounts this
        // subtree cleanly — `techniqueId`/`resetNonce` re-initialise from
        // scratch with no post-mount effect, so an ingredient switch is
        // ONE <Preparation> remount (one Phaser.Game), not two. See
        // GameBridge.destroy() for why minimising remounts matters.
        key={openId}
        roster={roster}
        ingredientId={openId}
        onSelectIngredient={setOpenId}
        onBack={() => setOpenId(null)}
      />
    );
  }
  return <IngredientLabGallery roster={roster} onOpen={setOpenId} go={go} />;
}

/* ── Gallery ─────────────────────────────────────────────── */

function IngredientLabGallery({
  roster,
  onOpen,
  go,
}: {
  roster: IngredientId[];
  onOpen: (id: IngredientId) => void;
  go: (s: ScreenId) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [shape, setShape] = useState<string>("All");

  // Derived, never hand-maintained — reading straight off each ingredient's
  // own `category`/`shape` field, so a future ingredient's new category or
  // shape shows up here automatically.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const id of roster) set.add(INGREDIENTS[id].category);
    return ["All", ...Array.from(set).sort()];
  }, [roster]);
  const shapes = useMemo(() => {
    const set = new Set<string>();
    for (const id of roster) set.add(INGREDIENTS[id].shape);
    return ["All", ...Array.from(set).sort()];
  }, [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((id) => {
      const ing = INGREDIENTS[id];
      if (category !== "All" && ing.category !== category) return false;
      if (shape !== "All" && ing.shape !== shape) return false;
      if (q && !ing.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roster, query, category, shape]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Ingredient Lab"
          subtitle={`${roster.length} ingredients available · QA tool, not part of the game`}
          onBack={() => go("settings")}
        />

        <div className="space-y-3 px-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredient name…"
            className="w-full rounded-2xl border border-walnut/20 bg-ivory/85 px-4 py-2.5 font-ui text-[13px] font-bold text-walnut-dark placeholder:text-walnut/40 focus:outline-none focus:ring-2 focus:ring-copper/40"
          />

          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shapes.map((s) => (
              <FilterChip key={s} active={shape === s} onClick={() => setShape(s)} tone="shape">
                {s}
              </FilterChip>
            ))}
          </div>

          <p className="font-ui text-[11px] font-bold text-walnut/50">
            Showing {filtered.length} of {roster.length}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((id) => {
              const ing = INGREDIENTS[id];
              return (
                <CardShell key={id} onClick={() => onOpen(id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[26px] leading-none">{INGREDIENT_EMOJI[id]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[14px] font-black leading-tight text-walnut-dark">
                        {ing.name}
                      </p>
                      <p className="truncate font-ui text-[10px] font-bold text-walnut/55">
                        {ing.category}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ing.techniques.map((t) => (
                      <Badge key={t} tone="cream">
                        {TECHNIQUES[t].name}
                      </Badge>
                    ))}
                  </div>
                </CardShell>
              );
            })}
            {filtered.length === 0 ? (
              <p className="col-span-2 py-8 text-center font-hand text-[16px] text-walnut/50">
                No ingredient matches that search.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <BottomNav active="settings" go={go} />
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
  tone = "category",
}: {
  children: string;
  active: boolean;
  onClick: () => void;
  tone?: "category" | "shape";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "press rounded-full border px-3 py-1 font-ui text-[10px] font-extrabold uppercase tracking-[0.08em] " +
        (active
          ? tone === "shape"
            ? "border-olive/50 bg-sage/35 text-olive"
            : "border-copper/50 bg-copper/20 text-copper"
          : "border-walnut/20 bg-ivory/70 text-walnut/60")
      }
    >
      {children}
    </button>
  );
}

/* ── Detail (real render + real cutting, via the real Preparation flow) ── */

function IngredientLabDetail({
  roster,
  ingredientId,
  onSelectIngredient,
  onBack,
}: {
  roster: IngredientId[];
  ingredientId: IngredientId;
  onSelectIngredient: (id: IngredientId) => void;
  onBack: () => void;
}) {
  const ingredient = INGREDIENTS[ingredientId];
  const qaInfo = useMemo(() => ingredientQaInfo(ingredientId), [ingredientId]);
  // This component is keyed by `ingredientId` (see IngredientLab), so it
  // remounts on every ingredient switch — `techniqueId` therefore always
  // initialises to the new ingredient's first technique with no post-mount
  // re-sync effect (which used to cost a second <Preparation> remount, and
  // so a second Phaser.Game, per switch). §4 "the first state should show
  // the whole ingredient" still holds: the engine's "prep" phase for a
  // freshly-mounted step IS that state.
  const [techniqueId, setTechniqueId] = useState<TechniqueId>(ingredient.techniques[0]!);
  const [resetNonce, setResetNonce] = useState(0);

  const index = roster.indexOf(ingredientId);
  const prevId = roster[(index - 1 + roster.length) % roster.length]!;
  const nextId = roster[(index + 1) % roster.length]!;

  const level = useMemo(
    () => buildLabLevel(ingredientId, techniqueId),
    [ingredientId, techniqueId],
  );

  // Remounting <Preparation> (fresh GameBridge + fresh Phaser scene) is
  // "reset to whole" by construction — no reach into Preparation's own
  // internals, and no risk of leaking state between tests. Covers both
  // §7 buttons: switching technique or clicking Reset both just change
  // this key.
  const prepKey = `${ingredientId}-${techniqueId}-${resetNonce}`;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-cream">
      {/* Top bar — kept OUTSIDE Preparation's own render area, so it never covers the ingredient (§13). */}
      <div className="z-50 flex shrink-0 items-center gap-2 border-b border-walnut-dark/30 bg-walnut-dark px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="press shrink-0 rounded-full border border-ivory/25 bg-ivory/10 px-3 py-1.5 font-ui text-[11px] font-extrabold text-ivory"
        >
          ← Lab
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-display text-[15px] font-black leading-tight text-ivory">
            {INGREDIENT_EMOJI[ingredientId]} {ingredient.name}
          </p>
          <p className="truncate font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-gold/90">
            {qaInfo
              .slice(1) // "Ingredient" is already the title above
              .map((row) => `${row.label}: ${row.value}`)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectIngredient(prevId)}
          aria-label="Previous ingredient"
          className="press shrink-0 rounded-full border border-ivory/25 bg-ivory/10 px-3 py-1.5 font-ui text-[13px] font-extrabold text-ivory"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onSelectIngredient(nextId)}
          aria-label="Next ingredient"
          className="press shrink-0 rounded-full border border-ivory/25 bg-ivory/10 px-3 py-1.5 font-ui text-[13px] font-extrabold text-ivory"
        >
          ›
        </button>
      </div>

      {/* The REAL production render + cutting pipeline — same component a real level uses. */}
      <div className="relative min-h-0 flex-1">
        <Preparation
          key={prepKey}
          level={level}
          onExit={onBack}
          onComplete={() => 0}
          credits={0}
          previousBest={0}
        />
      </div>

      {/* Bottom bar — technique switcher + reset, also outside the ingredient's own render area. */}
      <div className="z-50 flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-walnut-dark/30 bg-walnut-dark px-3 py-2">
        {ingredient.techniques.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTechniqueId(t);
              setResetNonce((n) => n + 1);
            }}
            className={
              "press rounded-full border px-3 py-1.5 font-ui text-[11px] font-extrabold " +
              (t === techniqueId
                ? "border-gold/60 bg-gold/25 text-gold"
                : "border-ivory/25 bg-ivory/10 text-ivory/80")
            }
          >
            {TECHNIQUES[t].name}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-ivory/20" aria-hidden />
        <KButton size="sm" variant="ghost" onClick={() => setResetNonce((n) => n + 1)}>
          Reset Ingredient
        </KButton>
        <KButton size="sm" variant="ghost" onClick={() => setResetNonce((n) => n + 1)}>
          Reset Test
        </KButton>
      </div>
    </div>
  );
}

/** Small QA-info readout — debug only, not shown to normal players (the whole screen is QA_MODE-gated at its one entry point in Settings). Exported so a future QA panel elsewhere could reuse the same field list without re-deriving it. */
export function ingredientQaInfo(id: IngredientId): { label: string; value: string }[] {
  const ing = INGREDIENTS[id];
  return [
    { label: "Ingredient", value: ing.name },
    { label: "Category", value: ing.category },
    { label: "Shape", value: ing.shape },
    { label: "Difficulty", value: String(ing.difficulty) },
    { label: "Techniques", value: ing.techniques.map((t) => TECHNIQUES[t].name).join(", ") },
    {
      label: "Band (top/bottom/side)",
      value: `${ing.bandTopClear} / ${ing.bandBotFrac} / ${ing.bandSideFrac}`,
    },
  ];
}
