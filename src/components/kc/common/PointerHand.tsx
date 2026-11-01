import pointerHand from "@/assets/ui/pointer-hand.webp";

/**
 * The tutorial hand (developer 2026-11-01: "use this hand for hand instructions"): the 3D cartoon hand
 * with the blue cuff, index finger up (art from the developer's SPLIT hand sheet, `assets/ui/pointer-hand.webp`),
 * its fingertip at (30/64, 6/80) of the box so every caller's placement is the same as for the old glove,
 * tapping with a ripple under the fingertip (`.kc-tap-hand` / `.kc-tap-ripple` in styles.css; still under
 * reduced motion). Decorative (aria-hidden).
 */
// The cropped art's fingertip is at (0.35, 0.01) of the image.
const TIP_X = 0.35;
const IMG_SCALE = 1.35; // image height as a share of the box height

export function PointerHand({ size = 46, className }: { size?: number; className?: string }) {
  const h = Math.round((size * 80) / 64);
  const imgH = h * IMG_SCALE;
  const imgW = (imgH * 89) / 176;
  const tipX = (size * 30) / 64;
  const tipY = (h * 6) / 80;
  return (
    <span
      aria-hidden
      className={`pointer-events-none relative block ${className ?? ""}`}
      style={{ width: size, height: h }}
    >
      {/* The ripple sits under the fingertip. */}
      <span
        className="kc-tap-ripple absolute rounded-full border-[3px] border-ivory/90"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          left: tipX - size * 0.31,
          top: tipY - size * 0.31,
        }}
      />
      <img
        src={pointerHand}
        alt=""
        draggable={false}
        className="kc-tap-hand absolute max-w-none"
        width={imgW}
        height={imgH}
        style={{
          left: tipX - imgW * TIP_X,
          top: tipY - imgH * 0.01,
          filter: "drop-shadow(0 3px 4px rgba(30,20,12,0.45))",
        }}
      />
    </span>
  );
}
