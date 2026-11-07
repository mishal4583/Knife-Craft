import { cn } from "@/lib/utils";
import { KButton } from "../common/primitives";
import { ASSISTANT_NAME, notebookEntries, type AssistantBeat } from "@/game/restaurant/assistant";
import type { SaveData } from "@/game/SaveManager";
import { PaigePiece } from "./PaigeArt";

/**
 * PAIGE'S NOTEBOOK (developer 2026-11-07, plan decision D7): every tip she has given, newest first, each with "Show again", and the
 * "Tips: On / Off" switch. Off stops her popping up by herself; the notebook always works. Presentation only: the app saves the switch.
 */
export function PaigeNotebook({
  save,
  tipsOff,
  onTips,
  onReplay,
  onClose,
}: {
  save: SaveData;
  tipsOff: boolean;
  onTips: (on: boolean) => void;
  onReplay: (beat: AssistantBeat) => void;
  onClose: () => void;
}) {
  const entries = [...notebookEntries(save)].reverse();
  return (
    <div
      data-testid="paige-notebook"
      className="anim-up absolute inset-0 z-[60] flex items-end justify-center bg-[rgba(30,20,12,0.6)] px-3 pb-[78px] land:items-center land:pb-3 land:pl-[calc(var(--kc-rail)+12px)]"
    >
      <div
        role="dialog"
        aria-label={`${ASSISTANT_NAME}'s notebook`}
        className="paper flex max-h-[78%] w-full max-w-[420px] flex-col rounded-3xl p-3.5 shadow-lift"
      >
        <div className="flex items-center gap-2.5">
          <PaigePiece name="ui-notebook-open" className="h-10 w-auto" />
          <p className="min-w-0 flex-1 font-display text-[20px] font-black leading-tight text-walnut-dark">
            {ASSISTANT_NAME}&apos;s notebook
          </p>
          <PaigePiece name="ui-pencil" className="h-9 w-auto rotate-[8deg]" />
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-[#fff6cf] px-3 py-2">
          <PaigePiece name="ui-bulb" className="h-8 w-auto" />
          <span className="min-w-0 flex-1 font-ui text-[13.5px] font-extrabold text-walnut-dark">
            Tips: {tipsOff ? "Off" : "On"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!tipsOff}
            aria-label="Tips"
            data-testid="paige-tips-switch"
            onClick={() => onTips(tipsOff)}
            className={cn(
              "press relative h-12 w-[72px] shrink-0 rounded-full border-2 transition-colors",
              tipsOff ? "border-walnut/30 bg-walnut/15" : "border-olive/60 bg-sage/70",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-ivory shadow-soft transition-all",
                tipsOff ? "left-1" : "left-[calc(100%-2.5rem)]",
              )}
            />
          </button>
        </div>

        <ul className="mt-2.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto" data-testid="paige-tips">
          {entries.length === 0 ? (
            <li className="rounded-2xl bg-white/50 px-3 py-3 font-hand text-[16px] leading-snug text-walnut/75">
              Nothing here yet. I&apos;ll write my tips down as we go!
            </li>
          ) : (
            entries.map((e) => (
              <li
                key={e.id}
                data-tip={e.id}
                className="flex items-center gap-2 rounded-2xl bg-[#fff3b0]/80 px-2.5 py-1.5"
              >
                <PaigePiece name="ui-check" className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1 font-hand text-[16px] leading-snug text-walnut-dark">
                  {e.text}
                </span>
                <button
                  type="button"
                  aria-label={`Show again: ${e.text}`}
                  data-testid="paige-replay"
                  onClick={() => onReplay(e.beat)}
                  className="press grid h-12 w-12 shrink-0 place-items-center"
                >
                  <PaigePiece name="chevron-small" className="h-9 w-9 object-contain" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-3">
          <KButton variant="copper" full className="min-h-12" onClick={onClose}>
            Close
          </KButton>
        </div>
      </div>
    </div>
  );
}
