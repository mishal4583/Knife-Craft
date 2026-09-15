import { MILESTONES, ACHIEVEMENTS, KNIVES, BOARDS, RECIPES, type ScreenId } from "./data";
import { KButton, Panel, ScreenHeader, Stars, Badge, Coin, Divider, Steam } from "./common/primitives";
import { BottomNav } from "./Kitchen";
import { cn } from "@/lib/utils";

/* ── Chef's Journey (progression) ──────────────────────── */

export function Progression({ go }: { go: (s: ScreenId) => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_45%_at_50%_0%,rgba(125,146,112,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Chef's Journey"
          subtitle="a craft, learned slowly"
          onBack={() => go("journal")}
        />

        <div className="px-4">
          <Panel tone="dark" className="relative overflow-hidden p-5 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(216,168,78,0.28),transparent_65%)]" />
            <div className="relative">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.24em] text-gold">
                Current Rank
              </p>
              <p className="font-display text-[28px] font-black leading-none text-ivory">
                Prep Cook
              </p>
              <p className="mt-1 font-hand text-[17px] text-ivory/70">Level 7</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="font-ui text-[10px] font-bold text-ivory/60">7</span>
                <span className="relative h-[9px] flex-1 overflow-hidden rounded-full bg-ivory/15">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: "64%",
                      background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
                    }}
                  />
                </span>
                <span className="font-ui text-[10px] font-bold text-ivory/60">8</span>
              </div>
              <p className="mt-2 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ivory/70">
                Next · Line Cook
              </p>
            </div>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Milestones
            </p>
            <ul className="mt-3 space-y-2.5">
              {MILESTONES.map((m) => (
                <li key={m.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]",
                      m.done
                        ? "border-olive/40 bg-sage/30 text-olive"
                        : "border-walnut/20 bg-walnut/8 text-walnut/45",
                    )}
                  >
                    {m.done ? "✓" : "🔒"}
                  </span>
                  <span
                    className={cn(
                      "flex-1 font-ui text-[13px] font-bold",
                      m.done ? "text-walnut-dark" : "text-walnut/50",
                    )}
                  >
                    {m.label}
                  </span>
                  {!m.done ? <Badge tone="locked">{m.at}</Badge> : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <p className="px-8 pb-2 pt-5 text-center font-hand text-[16px] text-walnut/50">
          “Skill is just attention, repeated.”
        </p>
      </div>
      <BottomNav active="journal" go={go} />
    </div>
  );
}

/* ── Chef Journal hub ──────────────────────────────────── */

export function JournalHome({ go, credits }: { go: (s: ScreenId) => void; credits: number }) {
  const knives = KNIVES.filter((k) => k.owned).length;
  const boards = BOARDS.filter((b) => b.owned).length;
  const recipes = RECIPES.filter((r) => r.done).length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 wood" />
      <div className="absolute inset-2 rounded-[26px] paper shadow-lift" />
      <div className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-walnut/10" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Chef's Journal"
          subtitle="everything I've learned so far"
          onBack={() => go("kitchen")}
          right={<Coin n={credits} />}
        />

        <div className="grid grid-cols-3 gap-2 px-4">
          <Stat label="Knives" v={`${knives}/7`} />
          <Stat label="Boards" v={`${boards}/8`} />
          <Stat label="Recipes" v={`${recipes}/7`} />
        </div>

        <div className="space-y-2.5 px-4 pt-4">
          <JournalRow glyph="🔪" title="My Knives" sub="the rack" onClick={() => go("knives")} />
          <JournalRow glyph="🪵" title="My Boards" sub="collection" onClick={() => go("boards")} />
          <JournalRow glyph="📖" title="My Recipes" sub="cookbook" onClick={() => go("recipes")} />
          <JournalRow
            glyph="🌱"
            title="Chef Rank"
            sub="prep cook · level 7"
            onClick={() => go("progression")}
          />
          <JournalRow glyph="🛒" title="Market" sub="knives, boards, decor" onClick={() => go("shop")} />
          <JournalRow glyph="⚙️" title="Settings" sub="sound & more" onClick={() => go("settings")} />
        </div>

        <div className="px-4 pt-4">
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Best Preparations
            </p>
            <ul className="mt-2.5 space-y-2">
              {RECIPES.filter((r) => r.best)
                .sort((a, b) => (b.best ?? 0) - (a.best ?? 0))
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="text-[16px]">{r.emoji}</span>
                    <span className="flex-1 font-ui text-[12px] font-bold text-walnut-dark">
                      {r.name}
                    </span>
                    <span className="font-display text-[15px] font-black text-copper">
                      {r.best}%
                    </span>
                  </li>
                ))}
            </ul>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Signature Cuts
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Rounds", "Half-moons", "Chiffonade", "Fine dice"].map((s) => (
                <Badge key={s} tone="sage">
                  {s}
                </Badge>
              ))}
            </div>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Achievements
            </p>
            <ul className="mt-2 space-y-2">
              {ACHIEVEMENTS.map((a) => (
                <li key={a.name} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                      a.done
                        ? "border-olive/40 bg-sage/30 text-olive"
                        : "border-walnut/20 text-walnut/40",
                    )}
                  >
                    {a.done ? "✓" : "·"}
                  </span>
                  <span>
                    <span
                      className={cn(
                        "block font-ui text-[12px] font-extrabold",
                        a.done ? "text-walnut-dark" : "text-walnut/50",
                      )}
                    >
                      {a.name}
                    </span>
                    <span className="block font-hand text-[14px] leading-tight text-walnut/55">
                      {a.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <BottomNav active="journal" go={go} />
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-2xl border border-walnut/15 card-warm px-2 py-2.5 text-center">
      <p className="font-display text-[17px] font-black leading-none text-walnut-dark">{v}</p>
      <p className="mt-1 font-ui text-[9px] font-extrabold uppercase tracking-[0.14em] text-walnut/55">
        {label}
      </p>
    </div>
  );
}

function JournalRow({
  glyph,
  title,
  sub,
  onClick,
}: {
  glyph: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lift flex w-full items-center gap-3 rounded-[18px] border border-walnut/15 card-warm px-3 py-2.5 text-left"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-walnut/12 bg-cream/70 text-[18px]">
        {glyph}
      </span>
      <span className="flex-1">
        <span className="block font-display text-[15px] font-black leading-none text-walnut-dark">
          {title}
        </span>
        <span className="block font-hand text-[14px] leading-tight text-walnut/60">{sub}</span>
      </span>
      <span className="font-ui text-[16px] text-walnut/35">›</span>
    </button>
  );
}

/* ── Daily order ───────────────────────────────────────── */

export function DailyOrder({ go }: { go: (s: ScreenId) => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_10%,rgba(216,168,78,0.32),transparent_62%)]" />
      <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader title="Today's Special" subtitle="one order, no hurry" onBack={() => go("kitchen")} />

        <div className="flex flex-1 flex-col justify-center px-4">
          <div className="paper anim-up relative -rotate-[1deg] rounded-[22px] border border-walnut/20 p-6 shadow-lift">
            <Steam className="left-[46%] top-8" />
            <p className="text-center text-[64px] leading-none">🥗</p>
            <p className="mt-3 text-center font-display text-[26px] font-black leading-none text-walnut-dark">
              Fresh Garden Salad
            </p>
            <p className="mt-1 text-center font-hand text-[17px] text-walnut/65">
              tomato, cucumber, red onion
            </p>
            <Divider />
            <div className="space-y-2 font-ui text-[12px] font-bold text-walnut/75">
              <div className="flex justify-between">
                <span>Reward</span>
                <span className="text-copper">+120 Kitchen Credits</span>
              </div>
              <div className="flex justify-between">
                <span>Experience</span>
                <span className="text-olive">+ Chef XP</span>
              </div>
              <div className="flex justify-between">
                <span>Best preparation</span>
                <span className="text-walnut-dark">98%</span>
              </div>
            </div>
            <Divider />
            <div className="flex justify-center">
              <Stars n={4} size={15} />
            </div>
            <div className="mt-4">
              <KButton full size="lg" onClick={() => go("gameplay")}>
                Accept Order
              </KButton>
            </div>
          </div>
          <p className="pt-4 text-center font-hand text-[15px] text-walnut/45">
            the order waits as long as you need
          </p>
        </div>
      </div>
      <BottomNav active="kitchen" go={go} />
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────── */

export function Settings({ go }: { go: (s: ScreenId) => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader title="Settings" subtitle="keep it simple" onBack={() => go("journal")} />
        <div className="space-y-3 px-4">
          <Panel className="divide-y divide-walnut/10 p-1">
            <Toggle label="Sound" on />
            <Toggle label="Music" on />
            <Toggle label="Reduced motion" />
            <Row label="Language" value="English" />
            <Row label="Accessibility" value="Larger cut guides" />
          </Panel>
          <Panel className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
              Credits
            </p>
            <p className="mt-1.5 font-hand text-[16px] leading-snug text-walnut/70">
              KnifeCraft — a small kitchen made by a small team. Music by the morning radio.
            </p>
          </Panel>
          <KButton full variant="ghost">
            Reset Progress
          </KButton>
        </div>
      </div>
      <BottomNav active="journal" go={go} />
    </div>
  );
}

function Toggle({ label, on }: { label: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="font-ui text-[13px] font-bold text-walnut-dark">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors",
          on ? "border-olive/40 bg-sage/70" : "border-walnut/20 bg-walnut/12",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-ivory shadow-soft transition-all duration-300",
            on ? "left-[23px]" : "left-[2px]",
          )}
        />
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="font-ui text-[13px] font-bold text-walnut-dark">{label}</span>
      <span className="font-ui text-[12px] font-bold text-walnut/55">{value} ›</span>
    </div>
  );
}