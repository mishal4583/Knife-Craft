import { useState } from "react";
import { KNIVES, BOARDS, DECOR_ITEMS, DECOR_CATEGORIES, type ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Badge, Coin } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { KnifeGlyph } from "./Workshop";
import { BoardPreview } from "./Boards";
import { cn } from "@/lib/utils";

function Shelf({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-4">
      <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">{label}</p>
      <div className="relative rounded-[20px] border border-walnut-dark/40 wood p-3 pb-4 shadow-soft">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">{children}</div>
        <div className="mt-2 h-[6px] rounded-full bg-[linear-gradient(180deg,rgba(255,247,232,0.22),rgba(0,0,0,0.35))]" />
      </div>
    </section>
  );
}

function PriceTag({ price, owned }: { price?: number; owned?: boolean }) {
  if (owned) return <Badge tone="sage">Owned</Badge>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-copper/40 bg-gold/25 px-2 py-[2px] font-ui text-[10px] font-extrabold text-walnut-dark">
      ◈ {price}
    </span>
  );
}

export function Shop({
  go,
  credits,
  spend,
}: {
  go: (s: ScreenId) => void;
  credits: number;
  spend: (n: number) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="The Market"
          subtitle="pick up something lovely"
          onBack={() => go("kitchen")}
          right={<Coin n={credits} />}
        />

        <Shelf label="Knives">
          {KNIVES.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => !k.owned && spend(k.price ?? 0)}
              className="press w-[140px] shrink-0 rounded-[16px] border border-walnut/15 card-warm p-2 text-center"
            >
              <span className={cn("flex justify-center", !k.owned && "opacity-70")}>
                <span className="rotate-[-8deg] block">
                  <KnifeGlyph size={104} tone={k.id} />
                </span>
              </span>
              <span className="block font-display text-[12px] font-black text-walnut-dark">
                {k.name}
              </span>
              <span className="mt-1 block">
                <PriceTag price={k.price ?? 180} owned={k.owned} />
              </span>
            </button>
          ))}
        </Shelf>

        <Shelf label="Boards">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => (b.owned ? go("boards") : spend(b.price ?? 0))}
              className="press w-[124px] shrink-0 rounded-[16px] border border-walnut/15 card-warm p-2 text-center"
            >
              <span className="flex justify-center">
                <BoardPreview board={b} size={100} />
              </span>
              <span className="mt-1.5 block font-display text-[12px] font-black text-walnut-dark">
                {b.name}
              </span>
              <span className="mt-1 block">
                <PriceTag price={b.price ?? 120} owned={b.owned} />
              </span>
            </button>
          ))}
        </Shelf>

        <Shelf label="Kitchen Decor">
          {DECOR_ITEMS.slice(0, 6).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => go("decor")}
              className="press w-[104px] shrink-0 rounded-[16px] border border-walnut/15 card-warm p-2 text-center"
            >
              <span className="block py-2 text-[30px]">{d.glyph}</span>
              <span className="block font-display text-[11px] font-black leading-tight text-walnut-dark">
                {d.name}
              </span>
              <span className="mt-1 block">
                <PriceTag price={d.price} owned={d.owned} />
              </span>
            </button>
          ))}
        </Shelf>

        <Shelf label="Special Items">
          {[
            { n: "Chef's Apron", g: "🥻", p: 300 },
            { n: "Brass Whetstone", g: "🪨", p: 420 },
            { n: "Café Radio", g: "📻", p: 260 },
          ].map((s) => (
            <div
              key={s.n}
              className="w-[120px] shrink-0 rounded-[16px] border border-walnut/15 card-warm p-2 text-center"
            >
              <span className="block py-2 text-[30px]">{s.g}</span>
              <span className="block font-display text-[11px] font-black text-walnut-dark">{s.n}</span>
              <span className="mt-1 block">
                <PriceTag price={s.p} />
              </span>
            </div>
          ))}
        </Shelf>

        <div className="px-4 pt-4">
          <KButton full variant="cream" onClick={() => go("decor")}>
            Decorate the Kitchen
          </KButton>
        </div>
      </div>
      <BottomNav active="workshop" go={go} />
    </div>
  );
}

/* ── Kitchen customization ─────────────────────────────── */

export function Customize({ go, credits }: { go: (s: ScreenId) => void; credits: number }) {
  const [cat, setCat] = useState("Plants");
  const [picked, setPicked] = useState("d1");
  const items = DECOR_ITEMS.filter((d) => d.cat === cat);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative flex h-full flex-col pb-24">
        <ScreenHeader
          title="Decorate"
          subtitle="make the room yours"
          onBack={() => go("shop")}
          right={<Coin n={credits} />}
        />

        {/* Live preview */}
        <div className="px-4">
          <div className="relative h-[240px] overflow-hidden rounded-[24px] border border-walnut-dark/40 wood shadow-lift">
            <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_10%,rgba(255,247,232,0.4),transparent_65%)]" />
            <div className="absolute inset-x-6 top-8 h-[8px] rounded-full bg-walnut-dark/60" />
            <span className="absolute left-10 top-[52px] text-[28px]">🪴</span>
            <span className="absolute right-12 top-[46px] text-[26px]">🕰️</span>
            <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[46px] drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]">
              {DECOR_ITEMS.find((d) => d.id === picked)?.glyph ?? "🌿"}
            </span>
            <span className="absolute inset-x-0 bottom-2 text-center font-hand text-[15px] text-ivory/70">
              preview · {DECOR_ITEMS.find((d) => d.id === picked)?.name}
            </span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          {DECOR_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "press shrink-0 rounded-full border px-3 py-1.5 font-ui text-[11px] font-extrabold",
                c === cat
                  ? "border-copper/50 bg-gold/30 text-walnut-dark"
                  : "border-walnut/15 bg-ivory/70 text-walnut/60",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4">
          {items.length === 0 ? (
            <Panel className="p-6 text-center">
              <p className="font-hand text-[17px] text-walnut/55">
                nothing on this shelf yet — check the market
              </p>
            </Panel>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {items.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setPicked(d.id)}
                  className={cn(
                    "lift rounded-[18px] border card-warm p-2 text-center",
                    picked === d.id ? "border-copper/60 ring-2 ring-gold/35" : "border-walnut/15",
                  )}
                >
                  <span className="block py-1.5 text-[26px]">{d.glyph}</span>
                  <span className="block font-display text-[10px] font-black leading-tight text-walnut-dark">
                    {d.name}
                  </span>
                  <span className="mt-1 block">
                    <PriceTag price={d.price} owned={d.owned} />
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="py-4">
            <KButton full onClick={() => go("kitchen")}>
              Place in Kitchen
            </KButton>
          </div>
        </div>
      </div>
      <BottomNav active="workshop" go={go} />
    </div>
  );
}