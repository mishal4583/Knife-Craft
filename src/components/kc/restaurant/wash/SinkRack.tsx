import { SupplyIcon } from "../../common/SupplyIcon";
import { useWashArt, washUrl } from "./washArt";

/**
 * The drying rack (developer 2026-11-09): each finished kind stands in a slot of a painted rack (`rack-back.webp` + `rack-front.webp`, W16 / W17: eight
 * wire dividers about 100 art px apart); without the art the finished kinds are ✓ chips on a dark plaque (the old rack). Presentation only.
 */

export type RackKind = { id: string; icon: string; washed: number };

/** The eight slot centres of the painted rack, as shares of its width. */
const SLOT_X = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.93] as const;

export function SinkRack({
  kinds,
  cleaned,
  total,
}: {
  kinds: readonly RackKind[];
  cleaned: number;
  total: number;
}) {
  const back = useWashArt("rack-back");
  const front = useWashArt("rack-front");
  const cup = useWashArt("cutlery-cup");
  const done = kinds.filter((k) => k.washed > 0);
  if (back && front) {
    const shown = done.slice(0, SLOT_X.length - 1);
    const more = done.length - shown.length;
    return (
      <div className="relative h-full w-full" data-testid="wash-up-rack">
        <img
          src={washUrl("rack-back")}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
        {shown.map((k, i) => (
          <span
            key={`${k.id}-${k.washed}`}
            className="anim-pop absolute top-[18%] flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${SLOT_X[i]! * 100}%` }}
            data-rack={k.id}
            data-rack-n={k.washed}
          >
            <span className="text-[34px] leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
              <SupplyIcon id={k.id as never} fallback={k.icon} />
            </span>
            <span className="font-ui text-[12px] font-black leading-none text-ivory [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              ×{k.washed} ✓
            </span>
          </span>
        ))}
        {more > 0 ? (
          <span
            className="absolute top-[34%] -translate-x-1/2 rounded-full bg-[#2a170c]/80 px-2 py-0.5 font-ui text-[12px] font-black text-ivory"
            style={{ left: `${SLOT_X[SLOT_X.length - 1]! * 100}%` }}
          >
            +{more}
          </span>
        ) : null}
        {cup ? (
          <img
            src={washUrl("cutlery-cup")}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute right-[1%] top-[2%] h-[44%] w-auto object-contain"
          />
        ) : null}
        <img
          src={washUrl("rack-front")}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52.4%] w-full object-fill"
        />
        <span className="absolute bottom-[8%] right-3 rounded-full bg-[#2a170c]/80 px-2.5 py-0.5 font-ui text-[12px] font-extrabold text-[#ffe2a8]">
          🧺 {cleaned} / {total}
        </span>
      </div>
    );
  }
  return (
    <div
      className="flex h-full flex-wrap content-start items-start gap-1.5 overflow-hidden rounded-2xl border border-[#e6b866]/40 bg-[#2a170c]/70 px-2.5 py-2"
      data-testid="wash-up-rack"
    >
      <span className="font-ui text-[12px] font-extrabold uppercase tracking-wide text-[#ffe2a8]">
        🧺 Rack · {cleaned} / {total}
      </span>
      {done.map((k) => (
        <span
          key={`${k.id}-${k.washed}`}
          className="anim-pop rounded-full border border-olive/40 bg-sage/25 px-2 py-0.5 font-ui text-[13px] font-extrabold text-ivory"
          data-rack={k.id}
          data-rack-n={k.washed}
        >
          {k.icon} ×{k.washed} ✓
        </span>
      ))}
      {cleaned === 0 ? (
        <span className="font-ui text-[12px] font-bold text-ivory/60">empty</span>
      ) : null}
    </div>
  );
}
