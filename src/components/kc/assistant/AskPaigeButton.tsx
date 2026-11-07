import { cn } from "@/lib/utils";
import { useAssistant } from "./AssistantContext";
import { PaigeAvatar, PaigePiece } from "./PaigeArt";

/**
 * "Ask Paige": her round face on a copper porthole, in the Kitchen's and the Market's top bar. It opens her notebook (every tip she has
 * given, to read again, and the Tips On / Off switch). Nothing shows until she is hired.
 */
export function AskPaigeButton({ className }: { className?: string }) {
  const paige = useAssistant();
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
