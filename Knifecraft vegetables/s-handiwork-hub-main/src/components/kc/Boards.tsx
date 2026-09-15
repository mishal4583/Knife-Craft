import { useState } from "react";
import { BOARDS, type Board, type ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Coin, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";

export function BoardPreview({ board, size = 92 }: { board: Board; size?: number }) {
  const [a, b, c] = board.tone;
  return (
    <div
      className="relative overflow-hidden rounded-[16px] shadow-soft"
      style={{
        width: size,
        height: size * 0.78,
        background: `linear-gradient(150deg, ${a}, ${b} 55%, ${c})`,
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage: `repeating-linear-gradient(92deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 7px)`,
        }}
      />
      <div className="absolute inset-[6px] rounded-[11px] border border-white/20" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_15%,rgba(255,255,255,0.32),transparent_65%)]" />
      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black/25" />
    </div>
  );
}

export function Boards({
  go,
  credits,
  spend,
  equipped,
  setEquipped,
}: {
  go: (s: ScreenId) => void;
  credits: number;
  spend: (n: number) => void;
  equipped: string;
  setEquipped: (id: string) => void;
}) {
  const [sel, setSel] = useState<Board>(BOARDS[1]!);
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Cutting Boards"
          subtitle="the surface changes everything"
          onBack={() => go("kitchen")}
          right={<Coin n={credits} />}
        />

        <div className="px-4">
          <Panel tone="cream" className="p-4">
            <div className="flex items-center gap-4">
              <BoardPreview board={sel} size={128} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
                  {sel.name}
                </p>
                <p className="font-ui text-[11px] font-bold uppercase tracking-wide text-copper">
                  {sel.material}
                </p>
                <p className="mt-1 font-hand text-[16px] leading-tight text-walnut/70">{sel.note}</p>
              </div>
            </div>
            <Divider />
            {sel.owned ? (
              <KButton
                full
                variant={equipped === sel.id ? "sage" : "wood"}
                onClick={() => setEquipped(sel.id)}
              >
                {equipped === sel.id ? "On the counter" : "Equip Board"}
              </KButton>
            ) : (
              <div className="space-y-2">
                <p className="text-center font-ui text-[11px] font-bold text-walnut/60">
                  {sel.requirement}
                </p>
                <KButton full variant="copper" onClick={() => spend(sel.price ?? 0)}>
                  Buy · {sel.price} credits
                </KButton>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSel(b)}
              className={cn(
                "lift flex flex-col items-center gap-2 rounded-[20px] border p-3 card-warm",
                b.id === sel.id ? "border-copper/60 ring-2 ring-gold/35" : "border-walnut/15",
              )}
            >
              <div className={cn(!b.owned && "opacity-55 grayscale-[0.35]")}>
                <BoardPreview board={b} size={104} />
              </div>
              <p className="font-display text-[13px] font-black leading-none text-walnut-dark">
                {b.name}
              </p>
              {b.owned ? (
                equipped === b.id ? (
                  <Badge tone="sage">Equipped</Badge>
                ) : (
                  <Badge tone="cream">Owned</Badge>
                )
              ) : (
                <Badge tone="locked">{b.requirement}</Badge>
              )}
            </button>
          ))}
        </div>

        <p className="px-6 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/50">
          boards age with you — the marks stay
        </p>
      </div>
      <BottomNav active="workshop" go={go} />
    </div>
  );
}