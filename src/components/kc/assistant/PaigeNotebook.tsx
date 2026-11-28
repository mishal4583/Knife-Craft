import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ASSISTANT_NAME } from "@/game/restaurant/assistant";
import { paigeChecklist, type PaigeTask } from "@/game/restaurant/paigeTasks";
import type { SaveData } from "@/game/SaveManager";
import { useLandscape } from "../game/layoutMode";
import { PaigePiece, paigeUrl } from "./PaigeArt";
import { Slice3, Slice9 } from "./NotebookSlices";
import { nbImage, nbUrl, useNotebookArt, type NbArt } from "./notebookArt";
import "./notebook.css";

/**
 * PAIGE'S NOTEBOOK (developer 2026-11-28, from their mock-up): a CHECKLIST of real jobs (game/restaurant/paigeTasks.ts). "Recently Completed"
 * holds today's ticks, which go when the day closes; "Next to Do" holds what waits now. Each arrow opens the place where the job is done.
 * "Tips: On / Off" stops her popping up by herself; the notebook always works. Presentation only: the app saves the switch and moves screens.
 * It wears Codex's painted pieces (notebookArt.ts) once they are all here; until then it is drawn plainly (notebook.css). Every word is
 * still written by the code.
 */
export function PaigeNotebook({
  save,
  tipsOff,
  onTips,
  onGo,
  onClose,
}: {
  save: SaveData;
  tipsOff: boolean;
  onTips: (on: boolean) => void;
  onGo: (task: PaigeTask) => void;
  onClose: () => void;
}) {
  const { done, todo } = paigeChecklist(save);
  const art = useNotebookArt();
  const wide = useLandscape();
  /** A whole painted piece on one element, only when the notebook is painted. */
  const paint = (name: NbArt) => (art ? { backgroundImage: nbImage(name) } : undefined);
  const host =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-game-content]");

  const screen = (
    <div
      data-testid="paige-notebook"
      data-art={art ? "1" : "0"}
      className={cn("pn-scrim anim-up", art && "pn-art")}
    >
      <div role="dialog" aria-label={`${ASSISTANT_NAME}'s notebook`} className="pn-book">
        <header className="pn-head">
          <span className="pn-portrait" aria-hidden="true">
            <img src={paigeUrl("cutout-clipboard")} alt="" draggable={false} />
          </span>
          <span className="pn-banner">
            {art ? (
              // the painted plaque carries its own leaves and chef's hat
              <img src={nbUrl("title-banner")} alt="" aria-hidden="true" draggable={false} />
            ) : (
              <>
                <span className="pn-leaf pn-leaf-left" aria-hidden="true" />
                <span className="pn-leaf pn-leaf-right" aria-hidden="true" />
                <span className="pn-hat" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </>
            )}
            <h2 className="pn-title">{ASSISTANT_NAME}&apos;s Notebook</h2>
          </span>
          <button
            type="button"
            aria-label="Close the notebook"
            data-testid="paige-notebook-x"
            onClick={onClose}
            className="pn-x press"
            style={paint("close-x")}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="pn-page">
          {art ? <Slice9 piece={wide ? "page-wide" : "page-upright"} corner={26} /> : null}
          <span className="pn-rings" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} style={paint("ring")} />
            ))}
          </span>

          <div className="pn-tips">
            {art ? <Slice3 piece="tips-pill" /> : null}
            <PaigePiece name="ui-bulb" className="h-8 w-auto" />
            <span className="pn-tips-text">Tips: {tipsOff ? "Off" : "On"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={!tipsOff}
              aria-label="Tips"
              data-testid="paige-tips-switch"
              onClick={() => onTips(tipsOff)}
              className="pn-switch press"
              style={paint(tipsOff ? "switch-off" : "switch-on")}
            >
              <span />
            </button>
          </div>

          <div className="pn-scroll">
            <section className="pn-group pn-group-done" data-testid="paige-done">
              <h3 className="pn-ribbon">
                {art ? (
                  <>
                    <Slice3 piece="ribbon-done" />
                    <img src={nbUrl("sparks-left")} alt="" className="pn-spark pn-spark-left" />
                    <img src={nbUrl("sparks-right")} alt="" className="pn-spark pn-spark-right" />
                  </>
                ) : null}
                <span className="pn-medal" aria-hidden="true">
                  ✓
                </span>
                Recently Completed
              </h3>
              <div className="pn-panel">
                {art ? <Slice9 piece="panel-done" corner={26} /> : null}
                <ul>
                  {done.length === 0 ? (
                    <li className="pn-empty">Finished jobs get a tick here.</li>
                  ) : (
                    done.map((t) => <Row key={t.id} task={t} done art={art} onGo={onGo} />)
                  )}
                </ul>
              </div>
            </section>

            <section className="pn-group pn-group-todo" data-testid="paige-todo">
              <h3 className="pn-ribbon">
                {art ? <Slice3 piece="ribbon-todo" /> : null}
                <span className="pn-medal" aria-hidden="true">
                  📋
                </span>
                Next to Do
              </h3>
              <div className="pn-panel">
                {art ? <Slice9 piece="panel-todo" corner={30} /> : null}
                <ul>
                  {todo.map((t) => (
                    <Row key={t.id} task={t} art={art} onGo={onGo} />
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <button
            type="button"
            data-testid="paige-close"
            onClick={onClose}
            className="pn-close press"
          >
            {art ? <Slice3 piece="button-close" /> : null}
            Close
          </button>
        </div>
      </div>
    </div>
  );
  return host ? createPortal(screen, host) : screen;
}

function Row({
  task,
  done = false,
  art,
  onGo,
}: {
  task: PaigeTask;
  done?: boolean;
  art: boolean;
  onGo: (task: PaigeTask) => void;
}) {
  return (
    <li className="pn-row" data-task={task.id} data-done={done}>
      {art ? <Slice9 piece="row" corner={22} /> : null}
      <span
        className={cn("pn-box", done && "pn-box-done")}
        role="img"
        aria-label={done ? "Done" : "To do"}
        style={art ? { backgroundImage: nbImage(done ? "box-ticked" : "box-empty") } : undefined}
      >
        {done ? "✓" : null}
      </span>
      <span className="pn-text">{task.text}</span>
      <button
        type="button"
        data-testid="paige-task-go"
        aria-label={`Go: ${task.text}`}
        onClick={() => onGo(task)}
        className="pn-go press"
      >
        <span aria-hidden="true" style={art ? { backgroundImage: nbImage("arrow") } : undefined}>
          ›
        </span>
      </button>
    </li>
  );
}
