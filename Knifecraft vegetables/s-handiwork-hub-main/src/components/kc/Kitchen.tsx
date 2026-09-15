import kitchenBg from "@/assets/kitchen-bg.jpg";
import { KButton, Coin, DustMotes } from "./common/primitives";
import type { ScreenId } from "./data";

function Hotspot({
  label,
  sub,
  style,
  onClick,
}: {
  label: string;
  sub: string;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="press absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ivory/25 bg-walnut-dark/40 px-3 py-1.5 text-left backdrop-blur-[3px] shadow-soft"
    >
      <span className="block font-display text-[13px] font-black leading-none text-ivory">
        {label}
      </span>
      <span className="block font-hand text-[13px] leading-tight text-gold/90">{sub}</span>
    </button>
  );
}

export function Kitchen({
  go,
  credits,
}: {
  go: (s: ScreenId) => void;
  credits: number;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <img
        src={kitchenBg}
        alt="The player's café kitchen: knife rack, copper pans, herbs and a sunlit window"
        width={540}
        height={960}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.42)_0%,transparent_22%,transparent_44%,rgba(62,40,25,0.55)_100%)]" />
      <DustMotes count={18} />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <button
          type="button"
          onClick={() => go("progression")}
          className="press rounded-2xl border border-ivory/25 bg-walnut-dark/45 px-3 py-2 text-left backdrop-blur-sm"
        >
          <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-gold">
            Prep Cook
          </p>
          <p className="font-display text-[15px] font-black leading-none text-ivory">Level 7</p>
          <span className="mt-1.5 block h-[4px] w-24 overflow-hidden rounded-full bg-ivory/25">
            <span
              className="block h-full rounded-full"
              style={{ width: "64%", background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))" }}
            />
          </span>
        </button>
        <Coin n={credits} />
      </div>

      {/* Environment hotspots */}
      <Hotspot label="Knife Rack" sub="my knives" style={{ left: "26%", top: "35%" }} onClick={() => go("knives")} />
      <Hotspot label="Recipe Board" sub="cookbook" style={{ left: "72%", top: "26%" }} onClick={() => go("recipes")} />
      <Hotspot label="Boards" sub="collection" style={{ left: "22%", top: "52%" }} onClick={() => go("boards")} />
      <Hotspot label="Workshop" sub="sharpen & shop" style={{ left: "76%", top: "50%" }} onClick={() => go("workshop")} />
      <Hotspot label="Journal" sub="my progress" style={{ left: "50%", top: "17%" }} onClick={() => go("journal")} />

      {/* Today's order — on the counter */}
      <div className="absolute inset-x-0 bottom-[86px] z-20 px-5">
        <div className="paper anim-up mx-auto -rotate-[0.8deg] rounded-[18px] border border-walnut/20 p-4 shadow-lift">
          <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.2em] text-copper">
            Today's Order
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-[21px] font-black leading-none text-walnut-dark">
                Garden Salad
              </p>
              <p className="font-hand text-[16px] leading-tight text-walnut/70">
                ready to prepare · +120 credits
              </p>
            </div>
            <span className="text-[30px]">🥗</span>
          </div>
          <div className="mt-3 flex gap-2">
            <KButton full onClick={() => go("gameplay")}>
              Prepare
            </KButton>
            <KButton variant="cream" onClick={() => go("daily")}>
              Details
            </KButton>
          </div>
        </div>
      </div>

      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

/* ── Bottom navigation ─────────────────────────────────── */

const NAV: { id: ScreenId; label: string; glyph: string }[] = [
  { id: "kitchen", label: "Kitchen", glyph: "🏠" },
  { id: "recipes", label: "Recipes", glyph: "📖" },
  { id: "workshop", label: "Workshop", glyph: "🔪" },
  { id: "journal", label: "Journal", glyph: "📔" },
];

export function BottomNav({ active, go }: { active: ScreenId; go: (s: ScreenId) => void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-walnut-dark/40 bg-[linear-gradient(180deg,rgba(62,40,25,0.82),rgba(45,41,36,0.95))] px-2 pb-3 pt-2 backdrop-blur-sm">
      {NAV.map((n) => {
        const on = n.id === active;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => go(n.id)}
            className="press flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5"
            style={on ? { background: "rgba(246,232,204,0.14)" } : undefined}
          >
            <span className="text-[17px]" style={{ filter: on ? "none" : "grayscale(0.5)", opacity: on ? 1 : 0.72 }}>
              {n.glyph}
            </span>
            <span
              className="font-ui text-[10px] font-extrabold tracking-wide"
              style={{ color: on ? "var(--color-gold)" : "rgba(246,232,204,0.62)" }}
            >
              {n.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}