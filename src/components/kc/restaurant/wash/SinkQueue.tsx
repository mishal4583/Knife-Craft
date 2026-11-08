import { cn } from "@/lib/utils";
import { SupplyIcon } from "../../common/SupplyIcon";
import { SLOT_X, type KindView, type StripView } from "@/game/restaurant/sinkQueue";
import { useWashArt, washUrl } from "./washArt";

/**
 * The sink's "Up next" strip and its full list (developer 2026-11-09). The strip is ONE row: the kind being washed now (big, glowing) and the next four
 * kinds, then "+N" and a ▾; tapping it opens the full list in a bottom sheet (the old 3-column chips). Presentation only (rules: restaurant/sinkQueue.ts).
 * The tray art (`queue-tray.webp`, six slots at x 13 / 29 / 43 / 57 / 71 / 85 % of its width) is used when it exists; a CSS tray otherwise.
 */

function Slot({ view, x, current }: { view: KindView; x: number; current?: boolean }) {
  const size = current ? 56 : 48;
  const ring = useWashArt("slot-states");
  return (
    <span
      className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${x * 100}%` }}
      data-wash-slot={view.id}
      data-wash-slot-state={view.state}
    >
      <span
        className={cn(
          "relative grid place-items-center rounded-full border-2 bg-[#2a170c]/80 text-[22px]",
          current
            ? "border-[#ffd35a] shadow-[0_0_14px_rgba(255,211,90,0.75)]"
            : "border-[#e6b866]/70",
        )}
        style={{ width: size, height: size }}
      >
        <span aria-hidden className="leading-none">
          <SupplyIcon id={view.id as never} fallback={view.icon} />
        </span>
        {ring ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-8%]"
            style={{
              backgroundImage: `url(${washUrl("slot-states")})`,
              backgroundSize: "300% 100%",
              backgroundPosition: current ? "50% 0" : "0 0",
              backgroundRepeat: "no-repeat",
            }}
          />
        ) : null}
      </span>
      <span className="mt-0.5 font-ui text-[11px] font-black leading-none text-ivory [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        {view.washed > 0 ? `${view.washed}/${view.n}` : `×${view.n}`}
      </span>
    </span>
  );
}

export function SinkQueueStrip({ strip, onOpen }: { strip: StripView; onOpen: () => void }) {
  const tray = useWashArt("queue-tray");
  const { current, next, more } = strip;
  return (
    <button
      type="button"
      data-testid="wash-up-queue"
      aria-label={`Up next: ${[current, ...next]
        .filter(Boolean)
        .map((v) => `${v!.label} ×${v!.left}`)
        .join(", ")}${more > 0 ? `, and ${more} more kinds` : ""}. Show the full list`}
      onClick={onOpen}
      className="press relative block h-full w-full"
    >
      {tray ? (
        <img
          src={washUrl("queue-tray")}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[1%] inset-y-[6%] rounded-[22px] border-2 border-[#b8873f] bg-[linear-gradient(180deg,#5b3a22,#3a2417)] shadow-[inset_0_3px_8px_rgba(0,0,0,0.5)]"
        />
      )}
      {current ? <Slot view={current} x={SLOT_X[0]} current /> : null}
      {next.map((v, i) => (
        <Slot key={v.id} view={v} x={SLOT_X[i + 1]!} />
      ))}
      <span
        className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 border-[#e6b866]/70 bg-[#2a170c]/80 px-3 font-ui text-[13px] font-black text-ivory"
        style={{ left: `${SLOT_X[5]! * 100}%`, minHeight: 48 }}
        data-testid="wash-up-more"
      >
        {more > 0 ? `+${more}` : "All"} <span aria-hidden>▾</span>
      </span>
    </button>
  );
}

/** The full list of what is in the sink: the old 3-column chips, in a bottom sheet. */
export function SinkQueueSheet({
  views,
  onClose,
}: {
  views: readonly KindView[];
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30" data-testid="wash-up-sheet">
      <button
        type="button"
        aria-label="Close the list"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-[26px] border-t-2 border-[#d6b16c] bg-[linear-gradient(165deg,#fff8e9,#f1dfbd)] p-3 pb-4 text-walnut-dark shadow-lift">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[19px] font-black">In the sink</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the list"
            data-testid="wash-up-sheet-close"
            className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/15 bg-ivory font-ui text-[18px] font-black shadow-soft"
          >
            ▾
          </button>
        </div>
        <ol
          aria-label="What's in the sink"
          className="mt-2 grid grid-cols-3 gap-1.5"
          data-testid="wash-up-lines"
        >
          {views.map((v) => (
            <li
              key={v.id}
              data-wash-line={v.id}
              data-wash-state={v.state}
              aria-current={v.state === "current" ? "step" : undefined}
              className={cn(
                "min-w-0 rounded-xl border px-1.5 py-1.5 text-center font-ui text-[12px] font-bold transition-colors",
                v.state === "done"
                  ? "border-olive/40 bg-[#718568] text-ivory"
                  : v.state === "current"
                    ? "border-[#b47b32] bg-[#f3d99c] text-walnut-dark"
                    : "border-walnut/15 bg-ivory/50 text-walnut/70",
              )}
            >
              <span aria-hidden>
                {v.state === "done" ? "✓" : <SupplyIcon id={v.id as never} fallback={v.icon} />}
              </span>
              <span className="block truncate">{v.label}</span>
              <span className="block text-[12px] font-black">
                {v.state === "done" || v.washed === 0 ? `×${v.n}` : `${v.washed}/${v.n}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
