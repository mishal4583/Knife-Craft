import { useWashArt, washUrl } from "./washArt";

/**
 * "Squeaky clean!" (developer 2026-11-09): when a piece is done, four glints twinkle round it and a ribbon pops over it for a moment (the painted
 * `glints.webp` 4 x 1 sheet and `clean-ribbon.webp`; CSS stand-ins without the art). Keyed by the piece so it plays once each time. Presentation only.
 */
const GLINTS = [
  { x: 24, y: 30, s: 34, d: 0 },
  { x: 76, y: 26, s: 28, d: 80 },
  { x: 30, y: 72, s: 26, d: 160 },
  { x: 72, y: 70, s: 38, d: 40 },
] as const;

export function SinkCleanBurst({ reduced }: { reduced: boolean }) {
  const glints = useWashArt("glints");
  const ribbon = useWashArt("clean-ribbon");
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[12]"
      data-testid="wash-up-clean-burst"
      aria-hidden
    >
      {GLINTS.map((g, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: g.s,
            height: g.s,
            transform: "translate(-50%, -50%)",
            animation: reduced ? undefined : `wash-glint 620ms ease-out ${g.d}ms both`,
            ...(glints
              ? {
                  backgroundImage: `url(${washUrl("glints")})`,
                  backgroundSize: "400% 100%",
                  backgroundPosition: `${(i / 3) * 100}% 0`,
                  backgroundRepeat: "no-repeat",
                }
              : {
                  background:
                    "radial-gradient(circle, rgba(255,250,220,0.95) 0 14%, rgba(255,236,160,0.55) 30%, transparent 62%)",
                }),
          }}
        />
      ))}
      {/* the ribbon sits behind the cheer label ("Squeaky clean!", drawn by the game over it) */}
      <span
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "calc(14% - 16px)",
          width: 300,
          height: 84,
          animation: reduced ? undefined : "wash-ribbon-pop 700ms cubic-bezier(.2,1.4,.4,1) both",
          ...(ribbon
            ? { backgroundImage: `url(${washUrl("clean-ribbon")})`, backgroundSize: "100% 100%" }
            : {
                borderRadius: 18,
                background: "linear-gradient(180deg,#8fe0cf,#3fb3a0)",
                border: "2px solid #fff4d6",
                boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
              }),
        }}
      />
      <style>{`
        @keyframes wash-glint { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.3) rotate(-30deg); } 45% { opacity: 1; transform: translate(-50%,-50%) scale(1.15) rotate(8deg); } 100% { opacity: 0; transform: translate(-50%,-50%) scale(.9) rotate(20deg); } }
        @keyframes wash-ribbon-pop { 0% { opacity: 0; scale: .5; } 60% { opacity: 1; scale: 1.08; } 100% { opacity: 1; scale: 1; } }
      `}</style>
    </div>
  );
}
