import {
  FAMILY_COLORS,
  cargoName,
  type CargoDoor,
  type CargoTag,
} from "@/game/business/crateCargo";
import { SLIP_PAPER, SLIP_SIZE, itemUrl, kdUrl } from "./kitchenDispatchArt";

const WORD: Record<CargoTag, string> = { delivered: "Today", needed: "Needed" };
const percent = (part: number) => `${part * 100}%`;
/** The paper's box on the clipboard picture: the list is written inside it. */
const PAPER = {
  left: percent(SLIP_PAPER.left),
  top: percent(SLIP_PAPER.top),
  width: percent(SLIP_PAPER.right - SLIP_PAPER.left),
  height: percent(SLIP_PAPER.bottom - SLIP_PAPER.top),
};

/** The same badge as on a door: a green seal (delivered today) or a gold one (needed next). */
function Badge({ tag, className }: { tag: CargoTag; className: string }) {
  return <img src={kdUrl(`tag-${tag}`)} alt="" aria-hidden="true" className={className} />;
}

/**
 * Unload the Van's delivery slip (developer 2026-11-27): what is on this van, one line a door, each marked when the restaurant is waiting for it: delivered today, or needed by the next
 * service. It is written on the painted clipboard (slip.webp), as big as the window lets it be; the lines share the paper's height, so every door shows without scrolling.
 * The round waits while it is open. It only shows: nothing is bought, moved or saved.
 */
export function DeliverySlip({
  doors,
  onClose,
}: {
  doors: readonly CargoDoor[];
  onClose: () => void;
}) {
  // what the restaurant waits for first
  const order = { delivered: 0, needed: 1 } as const;
  const rows = [...doors].sort((a, b) => (a.tag ? order[a.tag] : 2) - (b.tag ? order[b.tag] : 2));
  const tags = (["delivered", "needed"] as const).filter((t) => rows.some((d) => d.tag === t));
  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-[#321d13]/70"
      data-testid="kd-slip"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Delivery slip"
        onClick={(e) => e.stopPropagation()}
        className="relative text-[#492b19] drop-shadow-[0_14px_24px_rgba(0,0,0,.45)]"
        style={{
          width: `min(calc(100cqw - 16px), calc((100cqh - 16px) * ${SLIP_SIZE.w} / ${SLIP_SIZE.h}), 440px)`,
          aspectRatio: `${SLIP_SIZE.w} / ${SLIP_SIZE.h}`,
        }}
      >
        {/* plain paper under the picture, so the list reads even before it has loaded */}
        <div aria-hidden="true" className="absolute rounded-xl bg-[#fcefd8]" style={PAPER} />
        <img
          src={kdUrl("slip")}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="kd-slip-art"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        <div className="absolute flex flex-col" style={PAPER} data-testid="kd-slip-paper">
          <h2 className="text-center text-[17px] font-black leading-tight">🚚 Delivery slip</h2>
          <p className="flex items-center justify-center gap-3 text-[12px] font-bold text-[#8a5a2c]">
            {tags.length === 0
              ? "On this van"
              : tags.map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <Badge tag={t} className="h-4 w-4" />
                    {WORD[t]}
                  </span>
                ))}
          </p>
          <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto overscroll-contain">
            {rows.map((door) => (
              <li
                key={door.item}
                data-testid="kd-slip-row"
                data-item={door.item}
                data-tag={door.tag}
                className="flex max-h-12 min-h-[26px] flex-1 items-center gap-2 border-b border-dashed border-[#d9bd8a] last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="grid aspect-square h-[88%] shrink-0 place-items-center rounded-lg"
                  style={{ background: FAMILY_COLORS[door.family] }}
                >
                  <img src={itemUrl(door.item)} alt="" className="h-[86%] w-[86%] object-contain" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-extrabold leading-tight">
                  {cargoName(door.item)}
                </span>
                {door.tag ? (
                  <>
                    <Badge tag={door.tag} className="h-6 w-6 shrink-0" />
                    <span className="sr-only">{WORD[door.tag]}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close"
          data-testid="kd-slip-close"
          className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-lg font-black shadow-[0_3px_6px_rgba(0,0,0,.35)]"
        >
          ✕
        </button>
      </section>
    </div>
  );
}
