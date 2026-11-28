import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./AssistantContext";
import { warmNotebookArt } from "./notebookArt";
import { PaigeAvatar, PaigePiece } from "./PaigeArt";

/**
 * "Ask Paige": her round face on a copper porthole, in the Kitchen's and the Market's top bar. It opens her notebook (her checklist of jobs
 * and the Tips On / Off switch). Nothing shows until she is hired.
 */
export function AskPaigeButton({ className }: { className?: string }) {
  const paige = useAssistant();
  // the notebook's painted pieces, fetched a moment after her button shows, so the first tap opens it painted
  const hired = !!paige?.hired;
  useEffect(() => {
    if (!hired) return;
    const t = window.setTimeout(warmNotebookArt, 1500);
    return () => window.clearTimeout(t);
  }, [hired]);
  if (!paige?.hired) return null;
  return (
    <button
      type="button"
      data-testid="ask-paige"
      aria-label="Ask Paige"
      onClick={paige.openNotebook}
      className={cn("press relative grid h-12 w-12 shrink-0 place-items-center", className)}
    >
      <PaigePiece name="ui-help" className="absolute inset-0 h-full w-full object-contain" />
      <span className="relative grid h-[30px] w-[30px] place-items-center overflow-hidden rounded-full">
        <PaigeAvatar face="kind" className="h-[34px] w-[34px] max-w-none object-cover" />
      </span>
    </button>
  );
}
