import { useState } from "react";
import type { ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Coin, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";
import { KNIFE_CATALOG, TECHNIQUE_EMOJI, INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { getKnifePurchaseState } from "@/game/knives/KnifeManager";
import { TECHNIQUES, INGREDIENTS } from "@/game/definitions";
import { KnifeGlyph } from "./Workshop";
import { BOARD_CATALOG } from "@/game/boards/boardDefinitions";
import { getBoardPurchaseState } from "@/game/boards/BoardManager";
import { BoardPreview } from "./Boards";
import type { SaveData } from "@/game/SaveManager";

/**
 * RACK — the one equip-only destination (Phase 15), replacing the equip
 * half of the old Workshop/Boards screens. SHOP acquires, RACK equips —
 * this screen only ever lists items the player already owns (per
 * KnifeManager/BoardManager's own ownedKnifeIds/ownedBoardIds — no
 * locked/unowned item is ever shown here) and switches equipment through
 * the existing equipKnife/equipBoard manager functions, never a second
 * equip mechanism.
 */
export function Rack({
  go,
  save,
  setEquippedKnife,
  setEquippedBoard,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  setEquippedKnife: (id: string) => void;
  setEquippedBoard: (id: string) => void;
}) {
  const ownedKnives = KNIFE_CATALOG.filter((k) => save.ownedKnifeIds.includes(k.id));
  const ownedBoards = BOARD_CATALOG.filter((b) => save.ownedBoardIds.includes(b.id));

  const [selectedKnifeId, setSelectedKnifeId] = useState<string>(save.equippedKnifeId);
  const selectedKnife =
    ownedKnives.find((k) => k.id === selectedKnifeId) ?? ownedKnives[0] ?? KNIFE_CATALOG[0]!;
  const knifeState = getKnifePurchaseState(save, selectedKnife.id);

  const [selectedBoardId, setSelectedBoardId] = useState<string>(save.equippedBoardId);
  const selectedBoard =
    ownedBoards.find((b) => b.id === selectedBoardId) ?? ownedBoards[0] ?? BOARD_CATALOG[0]!;
  const boardState = getBoardPurchaseState(selectedBoard.id, save);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Rack"
          subtitle="choose your equipment"
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        {/* Knives */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.34),transparent_70%)]" />
            <div className="relative flex flex-col items-center">
              <div className="rotate-[-6deg] drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)]">
                <KnifeGlyph knife={selectedKnife} size={200} />
              </div>
              <div className="mt-3 h-2 w-40 rounded-full bg-black/35 blur-[6px]" />
              <p className="mt-2 font-display text-[22px] font-black tracking-tight text-ivory">
                {selectedKnife.name}
              </p>
              <p className="font-hand text-[16px] text-gold/90">{selectedKnife.tagline}</p>
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
            <KButton
              full
              variant={knifeState === "equipped" ? "sage" : "wood"}
              disabled={knifeState === "equipped"}
              onClick={() => setEquippedKnife(selectedKnife.id)}
            >
              {knifeState === "equipped" ? "Equipped" : "Use This Knife"}
            </KButton>
          </Panel>
        </div>
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">My Knives</p>
          <div className="grid grid-cols-2 gap-3">
            {ownedKnives.map((k) => {
              const s = getKnifePurchaseState(save, k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelectedKnifeId(k.id)}
                  className={cn(
                    "lift flex flex-col items-center gap-1 rounded-[20px] border p-3 card-warm",
                    k.id === selectedKnife.id
                      ? "border-copper/60 ring-2 ring-gold/40"
                      : "border-walnut/15",
                  )}
                >
                  <div className="rotate-[-8deg]">
                    <KnifeGlyph knife={k} size={116} />
                  </div>
                  <p className="font-display text-[13px] font-black leading-tight text-walnut-dark">
                    {k.name}
                  </p>
                  {s === "equipped" ? (
                    <Badge tone="sage">Equipped</Badge>
                  ) : (
                    <Badge tone="cream">Owned</Badge>
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
            <KButton
              full
              variant={boardState === "equipped" ? "sage" : "wood"}
              disabled={boardState === "equipped"}
              onClick={() => setEquippedBoard(selectedBoard.id)}
            >
              {boardState === "equipped" ? "On the counter" : "Use This Board"}
            </KButton>
          </Panel>
        </div>
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">My Boards</p>
          <div className="grid grid-cols-2 gap-3">
            {ownedBoards.map((b) => {
              const s = getBoardPurchaseState(b.id, save);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBoardId(b.id)}
                  className={cn(
                    "lift flex flex-col items-center gap-2 rounded-[20px] border p-3 card-warm",
                    b.id === selectedBoard.id
                      ? "border-copper/60 ring-2 ring-gold/35"
                      : "border-walnut/15",
                  )}
                >
                  <BoardPreview board={b} size={104} />
                  <p className="font-display text-[13px] font-black leading-none text-walnut-dark">
                    {b.name}
                  </p>
                  {s === "equipped" ? (
                    <Badge tone="sage">Equipped</Badge>
                  ) : (
                    <Badge tone="cream">Owned</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="px-6 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/50">
          new to the rack? the Shop is right next door
        </p>
      </div>
      <BottomNav active="rack" go={go} />
    </div>
  );
}
