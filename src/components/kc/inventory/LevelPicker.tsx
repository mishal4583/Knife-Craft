import { useEffect, useRef } from "react";

export type PickerTile = {
  /** The level the tile plays. */
  id: number;
  open: boolean;
  /** The round being played now. */
  current: boolean;
  title: string;
  /** A short second line under the title. */
  sub?: string | undefined;
  /** The picture of an open tile (a locked one shows a lock). */
  picture?: string | undefined;
};

/**
 * The level picker of the free-play mini-games (developer 2026-11-26): a sheet over the game with every level as a tile. An open one plays; a locked one says what opens it. The grid fills
 * whatever width it has (three columns on a small phone, many on a wide window) and starts at the round being played. The round waits behind it.
 */
export function LevelPicker({
  title,
  line,
  tiles,
  testId,
  onPick,
  onClose,
}: {
  title: string;
  /** One short line under the title, such as how many are open. */
  line: string;
  tiles: readonly PickerTile[];
  testId: string;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
    currentRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#321d13]/70 p-2 min-[400px]:p-4"
      data-testid={testId}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[24px] border-2 border-[#e6c579] bg-[#fff4dc] text-[#492b19] shadow-2xl"
      >
        <div className="flex items-center gap-3 px-4 pb-1 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black leading-tight">{title}</h2>
            <p className="text-[12.5px] font-bold text-[#8a5a2c]" data-testid={`${testId}-line`}>
              {line}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid={`${testId}-close`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-lg font-black"
          >
            ✕
          </button>
        </div>
        <ul className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
          {tiles.map((t) => (
            <li key={t.id} className="flex">
              <button
                ref={t.current ? currentRef : undefined}
                type="button"
                disabled={!t.open}
                onClick={() => onPick(t.id)}
                data-testid={`${testId}-tile-${t.id}`}
                data-open={t.open || undefined}
                aria-current={t.current || undefined}
                aria-label={`${t.title}${t.sub ? `, ${t.sub}` : ""}${t.open ? "" : ", locked"}`}
                className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-1.5 text-center ${
                  t.current
                    ? "border-[#3f7a2e] bg-[#eaf6dc] shadow-[0_0_0_2px_rgba(63,122,46,.35)]"
                    : t.open
                      ? "border-[#d7a95c] bg-[#fffaf0] active:scale-95"
                      : "cursor-default border-[#dccdb0] bg-[#efe3cb] text-[#8a7357]"
                }`}
              >
                {t.picture ? (
                  t.open ? (
                    <img
                      src={t.picture}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      draggable={false}
                      className="h-[62px] w-[62px] object-contain"
                    />
                  ) : (
                    <span aria-hidden="true" className="grid h-[62px] place-items-center text-2xl">
                      🔒
                    </span>
                  )
                ) : null}
                <span
                  className={`block max-w-full font-black leading-tight ${t.picture ? "text-[12px]" : "text-[18px]"}`}
                >
                  {t.picture || t.open ? null : <span aria-hidden="true">🔒 </span>}
                  {t.title}
                </span>
                {t.sub ? (
                  <span className="block text-[11px] font-bold leading-tight opacity-80">
                    {t.sub}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
