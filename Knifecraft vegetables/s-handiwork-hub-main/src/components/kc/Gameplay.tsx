import { useRef, useState } from "react";
import kitchenBg from "@/assets/kitchen-bg.jpg";
import tomatoImg from "@/assets/tomato.png";
import { KButton, Panel, Stars, DustMotes, Steam, Divider } from "./common/primitives";
import { cn } from "@/lib/utils";

type Phase = "play" | "report" | "plating" | "complete";
type Cut = { x1: number; y1: number; x2: number; y2: number; score: number };

const GUIDES = [30, 44, 58, 72]; // % of board width

const FEEDBACK = [
  { min: 92, label: "Beautiful", tone: "sage" },
  { min: 82, label: "Clean Slice", tone: "sage" },
  { min: 70, label: "Nice Cut", tone: "copper" },
  { min: 0, label: "Almost There", tone: "copper" },
] as const;

function verdict(score: number) {
  return FEEDBACK.find((f) => score >= f.min)!;
}

export function Gameplay({
  onExit,
  firstTime,
}: {
  onExit: () => void;
  firstTime: boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("play");
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [toast, setToast] = useState<{ label: string; tone: string; id: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [hintGone, setHintGone] = useState(!firstTime);

  const done = cuts.length >= GUIDES.length;
  const avg = cuts.length ? Math.round(cuts.reduce((a, c) => a + c.score, 0) / cuts.length) : 0;

  function toLocal(e: React.PointerEvent) {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }

  function onDown(e: React.PointerEvent) {
    if (paused || done) return;
    const p = toLocal(e);
    dragStart.current = p;
    setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    setHintGone(true);
  }

  function onMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start) return;
    const p = toLocal(e);
    setDrag({ x1: start.x, y1: start.y, x2: p.x, y2: p.y });
  }

  function onUp() {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || !drag) {
      setDrag(null);
      return;
    }
    const len = Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1);
    if (len < 12) {
      setDrag(null);
      return;
    }
    const target = GUIDES[cuts.length] ?? 50;
    const midX = (drag.x1 + drag.x2) / 2;
    const offset = Math.abs(midX - target);
    const tilt = Math.abs(drag.x2 - drag.x1);
    const score = Math.max(48, Math.round(100 - offset * 2.4 - tilt * 1.1));
    const v = verdict(score);
    setCuts((c) => [...c, { ...drag, score }]);
    setToast({ label: v.label, tone: v.tone, id: Date.now() });
    setDrag(null);
    window.setTimeout(() => setToast(null), 1100);
    if (cuts.length + 1 >= GUIDES.length) {
      window.setTimeout(() => setPhase("report"), 900);
    }
  }

  function reset() {
    setCuts([]);
    setPhase("play");
    setPaused(false);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      {/* Kitchen backdrop */}
      <img
        src={kitchenBg}
        alt="Warm café kitchen with copper pans, herbs and morning light"
        width={540}
        height={960}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_20%_8%,rgba(255,247,232,0.5),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.32)_0%,transparent_26%,transparent_52%,rgba(62,40,25,0.38)_100%)]" />
      <DustMotes />

      {/* ── Top HUD ─────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div
          className="paper max-w-[62%] -rotate-[1.4deg] rounded-[10px] border border-walnut/20 px-3 py-2 shadow-soft"
          style={{ clipPath: "polygon(0 2%, 100% 0, 99% 100%, 1% 98%)" }}
        >
          <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-copper">
            Today's Order
          </p>
          <p className="font-display text-[15px] font-black leading-tight text-walnut-dark">
            Garden Salad
          </p>
          {cuts.length === 0 ? (
            <p className="font-hand text-[14px] leading-tight text-walnut/80">
              tomato · cucumber · onion
            </p>
          ) : (
            <p className="font-hand text-[14px] leading-tight text-walnut/80">
              tomato — {cuts.length}/{GUIDES.length} slices
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaused(true)}
          aria-label="Pause"
          className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ivory/40 bg-walnut-dark/45 text-ivory backdrop-blur-sm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* subtle prep progress */}
      <div className="absolute inset-x-0 top-[74px] z-20 flex justify-center gap-1.5">
        {GUIDES.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] w-6 rounded-full transition-colors duration-500",
              i < cuts.length ? "bg-gold" : "bg-ivory/35",
            )}
          />
        ))}
      </div>

      {/* ── Cutting stage (hero, ~80%) ───────────── */}
      <div
        ref={boardRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="absolute inset-x-0 top-[13%] z-10 h-[74%] touch-none"
        style={{ cursor: "crosshair" }}
      >
        {/* board */}
        <div className="absolute left-1/2 top-1/2 h-[74%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[46px] wood shadow-[0_28px_50px_rgba(62,40,25,0.45)]">
          <div className="absolute inset-[10px] rounded-[38px] border border-ivory/12" />
          <div className="absolute inset-0 rounded-[46px] bg-[radial-gradient(80%_60%_at_25%_10%,rgba(255,247,232,0.22),transparent_60%)]" />
        </div>

        {/* guides + cuts */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {GUIDES.map((g, i) => {
            const state = i < cuts.length ? "done" : i === cuts.length ? "active" : "idle";
            return (
              <line
                key={g}
                x1={g}
                y1={26}
                x2={g}
                y2={74}
                stroke="var(--color-ivory)"
                strokeWidth={state === "active" ? 0.5 : 0.35}
                strokeLinecap="round"
                strokeDasharray="2 2.4"
                opacity={state === "done" ? 0.08 : state === "active" ? 0.72 : 0.22}
                className={state === "active" ? "anim-shimmer" : undefined}
                style={{ transition: "opacity 600ms ease" }}
              />
            );
          })}
          {cuts.map((c, i) => (
            <line
              key={i}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke="var(--color-gold)"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity="0.35"
            />
          ))}
          {drag ? (
            <line
              x1={drag.x1}
              y1={drag.y1}
              x2={drag.x2}
              y2={drag.y2}
              stroke="var(--color-ivory)"
              strokeWidth="0.7"
              strokeLinecap="round"
              opacity="0.95"
            />
          ) : null}
        </svg>

        {/* tomato */}
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2",
            cuts.length === 0 && "anim-breathe",
          )}
        >
          <img
            src={tomatoImg}
            alt="Fresh tomato on the cutting board"
            width={420}
            height={420}
            className="w-full drop-shadow-[0_18px_22px_rgba(62,40,25,0.4)]"
            style={{
              clipPath:
                cuts.length > 0
                  ? `inset(0 ${Math.max(0, 60 - cuts.length * 15)}% 0 0 round 50%)`
                  : undefined,
              transition: "clip-path 500ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>

        {/* slices fall to the right */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-y-1/2 gap-[6px]">
          {cuts.map((c, i) => (
            <span
              key={i}
              className="anim-pop block h-[52px] w-[13px] rounded-full border border-[#8e2f1f]/40 shadow-[0_6px_10px_rgba(62,40,25,0.35)]"
              style={{
                background: "radial-gradient(60% 60% at 50% 40%, #ef7a5f, #c9563d 70%, #a83f2c)",
                transform: `translateY(${(i % 2 ? 1 : -1) * 4}px) rotate(${(i % 2 ? 1 : -1) * 5}deg)`,
                animationDelay: `${i * 40}ms`,
                opacity: 0.4 + c.score / 260,
              }}
            />
          ))}
        </div>
      </div>

      {/* feedback */}
      {toast ? (
        <div
          key={toast.id}
          className="anim-pop pointer-events-none absolute left-1/2 top-[24%] z-30 -translate-x-1/2"
        >
          <span
            className={cn(
              "rounded-full border px-4 py-1.5 font-display text-[15px] font-black tracking-tight shadow-soft",
              toast.tone === "sage"
                ? "border-olive/40 bg-sage/90 text-ivory"
                : "border-copper/40 bg-gold/90 text-walnut-dark",
            )}
          >
            {toast.label}
          </span>
        </div>
      ) : null}

      {/* gesture hint */}
      {!hintGone ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[7%] z-20 flex flex-col items-center gap-2">
          <svg width="86" height="34" viewBox="0 0 86 34" fill="none" aria-hidden>
            <path
              d="M6 26C22 6 60 6 78 24"
              stroke="var(--color-ivory)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 5"
              opacity="0.7"
            />
            <circle cx="78" cy="24" r="5" fill="var(--color-ivory)" opacity="0.85" />
          </svg>
          <span className="font-hand text-[19px] text-ivory/90 drop-shadow-[0_2px_4px_rgba(62,40,25,0.6)]">
            swipe to cut
          </span>
        </div>
      ) : null}

      {/* ── Pause overlay ────────────────────────── */}
      {paused ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-walnut-dark/40 backdrop-blur-[3px]">
          <Panel className="anim-pop w-[74%] p-5 text-center" tone="cream">
            <p className="font-display text-[22px] font-black tracking-tight text-walnut-dark">
              Paused
            </p>
            <p className="mt-1 font-hand text-[16px] text-walnut/70">the kitchen will wait</p>
            <div className="mt-4 space-y-2">
              <KButton full onClick={() => setPaused(false)}>
                Resume
              </KButton>
              <KButton full variant="cream" onClick={reset}>
                Restart Prep
              </KButton>
              <KButton full variant="ghost" onClick={onExit}>
                Exit to Kitchen
              </KButton>
            </div>
          </Panel>
        </div>
      ) : null}

      {/* ── Knife report ─────────────────────────── */}
      {phase === "report" ? (
        <ReportSheet
          cuts={cuts}
          avg={avg}
          onAgain={reset}
          onContinue={() => setPhase("plating")}
        />
      ) : null}

      {phase === "plating" ? <Plating onDone={() => setPhase("complete")} /> : null}

      {phase === "complete" ? (
        <OrderComplete avg={avg} onNext={onExit} onAgain={reset} />
      ) : null}
    </div>
  );
}

/* ── Knife report ──────────────────────────────────────── */

function ReportSheet({
  cuts,
  avg,
  onAgain,
  onContinue,
}: {
  cuts: Cut[];
  avg: number;
  onAgain: () => void;
  onContinue: () => void;
}) {
  const accuracy = Math.min(99, avg + 2);
  const spacing = Math.max(40, avg - 1);
  const rhythm = Math.max(40, avg - 2);
  const best = 96;
  const stars = Math.max(1, Math.round(avg / 20));

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-walnut-dark/45 backdrop-blur-[3px]">
      <div className="anim-up paper m-3 w-[calc(100%-24px)] rounded-[26px] border border-walnut/20 p-5 shadow-lift">
        <p className="text-center font-ui text-[10px] font-extrabold uppercase tracking-[0.22em] text-copper">
          Tomato Prep
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Stars n={stars} size={16} />
        </div>
        <p className="mt-1 text-center font-display text-[42px] font-black leading-none text-walnut-dark">
          {avg}%
        </p>
        <p className="text-center font-hand text-[18px] text-olive">{verdict(avg).label} cut</p>

        <Divider />

        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="space-y-2">
            <Row label="Accuracy" v={accuracy} />
            <Row label="Spacing" v={spacing} />
            <Row label="Rhythm" v={rhythm} />
            <Row label="Best" v={best} muted />
          </div>
          <Replay cuts={cuts} />
        </div>

        <Divider />

        <div className="flex items-center justify-between font-ui text-[11px] font-bold text-walnut/70">
          <span>Your best: {best}%</span>
          <span className="rounded-full bg-sage/25 px-2 py-[2px] text-olive">
            +{Math.max(1, avg - 70)} improvement
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <KButton variant="cream" full onClick={onAgain}>
            Prep Again
          </KButton>
          <KButton full onClick={onContinue}>
            Continue
          </KButton>
        </div>
      </div>
    </div>
  );
}

function Row({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-[62px] font-ui text-[11px] font-bold uppercase tracking-wide",
          muted ? "text-walnut/45" : "text-walnut/75",
        )}
      >
        {label}
      </span>
      <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-walnut/12">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${v}%`,
            background: muted
              ? "color-mix(in oklab, var(--color-walnut) 35%, transparent)"
              : "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
          }}
        />
      </span>
      <span className="w-8 text-right font-ui text-[11px] font-extrabold text-walnut-dark">{v}%</span>
    </div>
  );
}

function Replay({ cuts }: { cuts: Cut[] }) {
  return (
    <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-walnut/20 wood">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {GUIDES.map((g) => (
          <line
            key={g}
            x1={g}
            y1={18}
            x2={g}
            y2={82}
            stroke="var(--color-gold)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.7"
          />
        ))}
        {cuts.map((c, i) => (
          <line
            key={i}
            x1={c.x1}
            y1={Math.max(14, Math.min(86, c.y1))}
            x2={c.x2}
            y2={Math.max(14, Math.min(86, c.y2))}
            stroke="var(--color-sage)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="300"
            style={{ animation: `kc-draw 700ms ${i * 120}ms var(--ease-cozy) both` }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-walnut-dark/55 py-[3px] font-ui text-[8px] font-bold uppercase tracking-wide text-ivory/85">
        <span className="flex items-center gap-1">
          <i className="block h-[2px] w-3 bg-gold" />
          ideal
        </span>
        <span className="flex items-center gap-1">
          <i className="block h-[2px] w-3 bg-sage" />
          yours
        </span>
      </div>
    </div>
  );
}

/* ── Plating ───────────────────────────────────────────── */

function Plating({ onDone }: { onDone: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <p className="anim-up font-hand text-[22px] text-ivory/90">plating…</p>
      <div className="anim-pop relative mt-4 grid h-[210px] w-[210px] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#fffdf7,#efe6d5_62%,#cdc2ae)] shadow-[0_24px_44px_rgba(62,40,25,0.5)]">
        <div className="absolute inset-5 rounded-full border border-walnut/12" />
        <Steam className="bottom-[62%] left-[46%]" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="anim-pop absolute h-[54px] w-[15px] rounded-full border border-[#8e2f1f]/40"
            style={{
              background: "radial-gradient(60% 60% at 50% 40%, #ef7a5f, #c9563d 70%, #a83f2c)",
              transform: `rotate(${-30 + i * 15}deg) translateY(-14px)`,
              animationDelay: `${180 + i * 110}ms`,
            }}
          />
        ))}
        <span className="absolute bottom-[26%] left-[28%] text-[20px]">🌿</span>
        <span className="anim-shimmer absolute right-[26%] top-[24%] text-[14px] text-gold">✦</span>
      </div>
      <div className="mt-6 w-[70%]">
        <KButton full variant="cream" onClick={onDone}>
          Looks Delicious
        </KButton>
      </div>
    </div>
  );
}

/* ── Order complete ────────────────────────────────────── */

function OrderComplete({
  avg,
  onNext,
  onAgain,
}: {
  avg: number;
  onNext: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[80%] p-6 text-center">
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.24em] text-copper">
          Order Complete
        </p>
        <p className="mt-1 font-display text-[24px] font-black tracking-tight text-walnut-dark">
          Garden Salad
        </p>
        <div className="mt-3 flex justify-center">
          <Stars n={Math.max(1, Math.round(avg / 20))} size={18} />
        </div>
        <p className="mt-3 font-hand text-[17px] leading-snug text-walnut/80">
          “Beautiful preparation. The slices caught the light.”
        </p>
        <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.18em] text-walnut/45">
          — Chef's note
        </p>
        <div className="mt-5 space-y-2">
          <KButton full onClick={onNext}>
            Next Order
          </KButton>
          <KButton full variant="ghost" onClick={onAgain}>
            Prep Again
          </KButton>
        </div>
      </Panel>
    </div>
  );
}