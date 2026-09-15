import { useState } from "react";
import { KNIVES, type Knife, type ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Stars, StatBar, Badge, Modal, Coin, Divider } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";

export function KnifeGlyph({ size = 120, tone = "steel" }: { size?: number; tone?: string }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 240 100" aria-hidden>
      <defs>
        <linearGradient id={`blade-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3F1EC" />
          <stop offset="55%" stopColor="#CFCCC4" />
          <stop offset="100%" stopColor="#9C988F" />
        </linearGradient>
        <linearGradient id="handle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8A5B36" />
          <stop offset="100%" stopColor="#4B2D19" />
        </linearGradient>
      </defs>
      <path
        d="M12 62 C60 30 118 22 152 30 L152 62 Z"
        fill={`url(#blade-${tone})`}
        stroke="#8b877f"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M12 62 C60 46 118 44 152 48" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.55" />
      <rect x="150" y="28" width="10" height="36" rx="3" fill="#B87333" />
      <path d="M160 30 h58 a10 10 0 0 1 10 10 v14 a10 10 0 0 1 -10 10 h-58 z" fill="url(#handle)" />
      <circle cx="180" cy="47" r="3" fill="#D8A84E" opacity="0.8" />
      <circle cx="206" cy="47" r="3" fill="#D8A84E" opacity="0.8" />
    </svg>
  );
}

export function Workshop({
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
  const [selected, setSelected] = useState<Knife>(KNIVES[0]!);
  const [upgrading, setUpgrading] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Knife Workshop"
          subtitle="every blade has a temperament"
          onBack={() => go("kitchen")}
          right={<Coin n={credits} />}
        />

        {/* Featured display */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 shadow-lift">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.34),transparent_70%)]" />
            <div className="relative flex flex-col items-center">
              <div className="rotate-[-6deg] drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)]">
                <KnifeGlyph size={200} tone={selected.id} />
              </div>
              <div className="mt-3 h-2 w-40 rounded-full bg-black/35 blur-[6px]" />
              <p className="mt-2 font-display text-[22px] font-black tracking-tight text-ivory">
                {selected.name}
              </p>
              <p className="font-hand text-[16px] text-gold/90">{selected.tagline}</p>
              <div className="mt-1">
                <Stars n={selected.stars} size={13} />
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {selected.traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-ivory/25 bg-ivory/10 px-2.5 py-[3px] font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-ivory/85"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                Level {selected.level}
              </p>
              <p className="font-ui text-[10px] text-walnut/60">
                {selected.blade} · {selected.handle}
              </p>
            </div>
            <div className="mt-3 space-y-2.5">
              <StatBar label="Sharpness" value={selected.sharpness} />
              <StatBar label="Weight" value={selected.weight} tone="sage" />
              <StatBar label="Control" value={selected.control} />
            </div>
            <Divider />
            <div className="flex gap-2">
              <KButton variant="cream" full onClick={() => setUpgrading(true)}>
                Sharpen
              </KButton>
              {selected.owned ? (
                <KButton
                  full
                  variant={equipped === selected.id ? "sage" : "wood"}
                  onClick={() => setEquipped(selected.id)}
                >
                  {equipped === selected.id ? "Equipped" : "Equip"}
                </KButton>
              ) : (
                <KButton full variant="copper" onClick={() => spend(selected.price ?? 0)}>
                  Buy · {selected.price}
                </KButton>
              )}
            </div>
          </Panel>
        </div>

        {/* Collection strip */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">The Rack</p>
          <div className="grid grid-cols-2 gap-3">
            {KNIVES.map((k) => (
              <KnifeCard
                key={k.id}
                knife={k}
                active={k.id === selected.id}
                equipped={k.id === equipped}
                onClick={() => setSelected(k)}
              />
            ))}
          </div>
        </div>

        <p className="px-6 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/50">
          upgrades change how a cut <em>feels</em>, never how hard it is
        </p>
      </div>

      <Modal open={upgrading} onClose={() => setUpgrading(false)}>
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.22em] text-copper">
          Sharpen
        </p>
        <p className="font-display text-[24px] font-black tracking-tight text-walnut-dark">
          {selected.name}
        </p>
        <p className="font-hand text-[17px] text-walnut/70">
          Level {selected.level} → Level {selected.level + 1}
        </p>
        <Divider />
        <div className="space-y-1.5 font-ui text-[12px] font-bold text-walnut/80">
          {["Sharpness", "Control", "Slice Feel"].map((s) => (
            <div key={s} className="flex items-center justify-between">
              <span>{s}</span>
              <span className="text-olive">+1</span>
            </div>
          ))}
        </div>
        <Divider />
        <div className="flex items-center justify-between">
          <span className="font-ui text-[11px] uppercase tracking-wide text-walnut/60">Cost</span>
          <Coin n={120} />
        </div>
        <div className="mt-4 flex gap-2">
          <KButton variant="ghost" full onClick={() => setUpgrading(false)}>
            Not now
          </KButton>
          <KButton
            variant="copper"
            full
            onClick={() => {
              spend(120);
              setUpgrading(false);
            }}
          >
            Upgrade
          </KButton>
        </div>
      </Modal>

      <BottomNav active="workshop" go={go} />
    </div>
  );
}

export function KnifeCard({
  knife,
  active,
  equipped,
  onClick,
}: {
  knife: Knife;
  active?: boolean;
  equipped?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "lift relative overflow-hidden rounded-[20px] border p-3 text-left card-warm",
        active ? "border-copper/60 ring-2 ring-gold/40" : "border-walnut/15",
        !knife.owned && "opacity-90",
      )}
    >
      <div className={cn("flex justify-center", !knife.owned && "opacity-40 grayscale")}>
        <div className="rotate-[-8deg]">
          <KnifeGlyph size={116} tone={knife.id} />
        </div>
      </div>
      <p className="mt-1 font-display text-[13px] font-black leading-tight text-walnut-dark">
        {knife.name}
      </p>
      <div className="mt-0.5">
        <Stars n={knife.stars} size={10} />
      </div>
      <div className="mt-1.5">
        {knife.owned ? (
          equipped ? (
            <Badge tone="sage">Equipped</Badge>
          ) : (
            <Badge tone="cream">Lv {knife.level}</Badge>
          )
        ) : (
          <Badge tone="locked">Chef Level {knife.unlockLevel}</Badge>
        )}
      </div>
    </button>
  );
}