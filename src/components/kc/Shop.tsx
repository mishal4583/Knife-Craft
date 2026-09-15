import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Coin, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { KNIFE_CATALOG, TECHNIQUE_EMOJI, INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { getKnifePurchaseState, type BuyKnifeResult } from "@/game/knives/KnifeManager";
import { TECHNIQUES, INGREDIENTS } from "@/game/definitions";
import { KnifeGlyph } from "./Workshop";
import { BOARD_CATALOG } from "@/game/boards/boardDefinitions";
import { getBoardPurchaseState, type BuyBoardResult } from "@/game/boards/BoardManager";
import { BoardPreview } from "./Boards";
import type { SaveData } from "@/game/SaveManager";

/**
 * SHOP — the one purchase destination (Phase 15), merging the buy half of
 * the old Workshop/Boards screens into a single Knives + Cutting Boards
 * screen. Reuses KnifeManager/BoardManager's existing purchase logic
 * exactly (getKnifePurchaseState/buyKnife, getBoardPurchaseState/
 * buyBoard) — no new purchase system. SHOP acquires, RACK equips: an
 * already-owned item shows as Owned/Equipped here with no action, never
 * an equip button — switching equipment lives on the Rack.
 */
export function Shop({
  go,
  save,
  buyKnife,
  buyBoard,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  buyKnife: (id: string) => BuyKnifeResult;
  buyBoard: (id: string) => BuyBoardResult;
}) {
  const [selectedKnifeId, setSelectedKnifeId] = useState<string>(save.equippedKnifeId);
  const selectedKnife = KNIFE_CATALOG.find((k) => k.id === selectedKnifeId) ?? KNIFE_CATALOG[0]!;
  const [knifeMessage, setKnifeMessage] = useState<string | null>(null);
  const knifeState = getKnifePurchaseState(save, selectedKnife.id);

  function handleBuyKnife() {
    const result = buyKnife(selectedKnife.id);
    if (!result.ok) {
      if (result.reason === "insufficientFunds")
        setKnifeMessage("Not quite enough Café Coins yet.");
      else if (result.reason === "notUnlocked")
        setKnifeMessage(`Unlocks at Level ${selectedKnife.unlockLevel}.`);
      return;
    }
    setKnifeMessage(null);
  }

  const [selectedBoardId, setSelectedBoardId] = useState<string>(save.equippedBoardId);
  const selectedBoard = BOARD_CATALOG.find((b) => b.id === selectedBoardId) ?? BOARD_CATALOG[0]!;
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const boardState = getBoardPurchaseState(selectedBoard.id, save);

  function handleBuyBoard() {
    const result = buyBoard(selectedBoard.id);
    if (!result.ok) {
      if (result.reason === "insufficientFunds")
        setBoardMessage("Not quite enough Café Coins yet.");
      else if (result.reason === "notUnlocked")
        setBoardMessage(`Unlocks at Level ${selectedBoard.unlockLevel}.`);
      return;
    }
    setBoardMessage(null);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Shop"
          subtitle="buy knives & boards"
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        {/* Knives */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.34),transparent_70%)]" />
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "rotate-[-6deg] drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)]",
                  knifeState === "locked" && "opacity-50 grayscale",
                )}
              >
                <KnifeGlyph knife={selectedKnife} size={200} />
              </div>
              <div className="mt-3 h-2 w-40 rounded-full bg-black/35 blur-[6px]" />
              <p className="mt-2 font-display text-[22px] font-black tracking-tight text-ivory">
                {selectedKnife.name}
              </p>
              <p className="font-hand text-[16px] text-gold/90">{selectedKnife.tagline}</p>
              <p className="mt-2 max-w-[280px] text-center font-ui text-[12px] leading-relaxed text-ivory/75">
                {selectedKnife.description}
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                Best for
              </p>
              <p className="font-ui text-[10px] capitalize text-walnut/60">
                {selectedKnife.weight} · {selectedKnife.style}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedKnife.preferredTechniques.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-walnut/15 bg-cream/70 px-2.5 py-[3px] font-ui text-[11px] font-bold text-walnut-dark"
                >
                  {TECHNIQUE_EMOJI[t]} {TECHNIQUES[t].name}
                </span>
              ))}
              {selectedKnife.preferredIngredients.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-walnut/15 bg-cream/70 px-2.5 py-[3px] font-ui text-[11px] font-bold text-walnut-dark"
                >
                  {INGREDIENT_EMOJI[i]} {INGREDIENTS[i].name}
                </span>
              ))}
            </div>
            <Divider />
            {knifeMessage ? (
              <p className="mb-2 text-center font-hand text-[14px] text-copper">{knifeMessage}</p>
            ) : null}
            {knifeState === "locked" ? (
              <KButton full variant="ghost" disabled>
                Unlocks at Level {selectedKnife.unlockLevel}
              </KButton>
            ) : knifeState === "owned" || knifeState === "equipped" ? (
              <KButton full variant="sage" disabled>
                {knifeState === "equipped" ? "Equipped" : "Owned"}
              </KButton>
            ) : (
              <KButton full variant="copper" onClick={handleBuyKnife}>
                Buy · {selectedKnife.price}
              </KButton>
            )}
          </Panel>
        </div>
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">Knives</p>
          <div className="grid grid-cols-2 gap-3">
            {KNIFE_CATALOG.map((k) => {
              const s = getKnifePurchaseState(save, k.id);
              const locked = s === "locked";
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setSelectedKnifeId(k.id);
                    setKnifeMessage(null);
                  }}
                  className={cn(
                    "lift flex flex-col items-center gap-1 rounded-[20px] border p-3 card-warm",
                    k.id === selectedKnife.id
                      ? "border-copper/60 ring-2 ring-gold/40"
                      : "border-walnut/15",
                  )}
                >
                  <div className={cn("rotate-[-8deg]", locked && "opacity-40 grayscale")}>
                    <KnifeGlyph knife={k} size={116} />
                  </div>
                  <p className="font-display text-[13px] font-black leading-tight text-walnut-dark">
                    {k.name}
                  </p>
                  {s === "equipped" ? (
                    <Badge tone="sage">Equipped</Badge>
                  ) : s === "owned" ? (
                    <Badge tone="cream">Owned</Badge>
                  ) : locked ? (
                    <Badge tone="locked">Lv {k.unlockLevel}</Badge>
                  ) : (
                    <Badge tone="copper">◈ {k.price}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Divider />

        {/* Boards */}
        <div className="px-4 pt-2">
          <Panel tone="cream" className="p-4">
            <div className="flex items-center gap-4">
              <BoardPreview board={selectedBoard} size={128} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
                  {selectedBoard.name}
                </p>
                <p className="font-ui text-[11px] font-bold uppercase tracking-wide text-copper">
                  {selectedBoard.material}
                </p>
                <p className="mt-1 font-hand text-[16px] leading-tight text-walnut/70">
                  {selectedBoard.description}
                </p>
              </div>
            </div>
            <Divider />
            {boardMessage ? (
              <p className="mb-2 text-center font-hand text-[14px] text-copper">{boardMessage}</p>
            ) : null}
            {boardState === "locked" ? (
              <KButton full variant="ghost" disabled>
                Unlocks at Level {selectedBoard.unlockLevel}
              </KButton>
            ) : boardState === "owned" || boardState === "equipped" ? (
              <KButton full variant="sage" disabled>
                {boardState === "equipped" ? "Equipped" : "Owned"}
              </KButton>
            ) : (
              <KButton full variant="copper" onClick={handleBuyBoard}>
                Buy · {selectedBoard.price}
              </KButton>
            )}
          </Panel>
        </div>
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Cutting Boards
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BOARD_CATALOG.map((b) => {
              const s = getBoardPurchaseState(b.id, save);
              const locked = s === "locked";
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBoardId(b.id);
                    setBoardMessage(null);
                  }}
                  className={cn(
                    "lift flex flex-col items-center gap-2 rounded-[20px] border p-3 card-warm",
                    b.id === selectedBoard.id
                      ? "border-copper/60 ring-2 ring-gold/35"
                      : "border-walnut/15",
                  )}
                >
                  <div className={cn(locked && "opacity-55 grayscale-[0.35]")}>
                    <BoardPreview board={b} size={104} />
                  </div>
                  <p className="font-display text-[13px] font-black leading-none text-walnut-dark">
                    {b.name}
                  </p>
                  {s === "equipped" ? (
                    <Badge tone="sage">Equipped</Badge>
                  ) : s === "owned" ? (
                    <Badge tone="cream">Owned</Badge>
                  ) : locked ? (
                    <Badge tone="locked">Lv {b.unlockLevel}</Badge>
                  ) : (
                    <Badge tone="copper">◈ {b.price}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="px-6 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/50">
          bought something new? find it on the Rack
        </p>
      </div>
      <BottomNav active="shop" go={go} />
    </div>
  );
}
