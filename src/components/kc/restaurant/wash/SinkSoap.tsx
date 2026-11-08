import { useWashArt, washUrl } from "./washArt";

/**
 * The dish-soap pump (developer 2026-11-09): it stands by the tap; when a new piece comes into the sink it is pressed once and a blob of soap drops
 * toward the dish (painted `soap-pump.webp` and `soap-blobs.webp`, 3 x 1). Only with the art; keyed by the piece so it plays once each. Decoration:
 * the real soap use is the game's existing supply rule (nothing here touches it). Reduced Motion: the pump just stands there.
 */
export function SinkSoap({ reduced }: { reduced: boolean }) {
  const pump = useWashArt("soap-pump");
  const blobs = useWashArt("soap-blobs");
  if (!pump) return null;
  return (
    <div
      className="pointer-events-none absolute z-[6]"
      style={{ left: "3.5%", top: "20.4%", width: "10.5%", height: "10.4%" }}
      aria-hidden
      data-testid="wash-up-soap"
    >
      <img
        src={washUrl("soap-pump")}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ animation: reduced ? undefined : "wash-pump-press 900ms ease-in-out both" }}
      />
      {blobs && !reduced ? (
        <span
          className="absolute"
          style={{
            left: "-30%",
            top: "34%",
            width: "70%",
            height: "28%",
            backgroundImage: `url(${washUrl("soap-blobs")})`,
            backgroundSize: "300% 100%",
            backgroundPosition: "0% 0",
            backgroundRepeat: "no-repeat",
            animation: "wash-soap-drop 900ms ease-in 250ms both",
          }}
        />
      ) : null}
      <style>{`
        @keyframes wash-pump-press { 0%,100% { transform: translateY(0); } 25% { transform: translateY(4px); } 50% { transform: translateY(0); } }
        @keyframes wash-soap-drop { 0% { opacity: 0; transform: translate(0,0) scale(.6); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(150%, 520%) scale(1); } }
      `}</style>
    </div>
  );
}
