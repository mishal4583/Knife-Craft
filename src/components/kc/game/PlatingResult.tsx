import { useEffect } from "react";
import { KButton, Steam } from "../common/primitives";

/** Presentation + animation hooks only; real plating animation is engine-side. */
export function PlatingResult({
  dishName,
  quality,
  onPlatingStart,
  onPlatingComplete,
  onContinue,
}: {
  dishName: string;
  quality: number;
  onPlatingStart: () => void;
  onPlatingComplete: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    onPlatingStart();
    const t = window.setTimeout(onPlatingComplete, 900);
    return () => window.clearTimeout(t);
  }, [onPlatingStart, onPlatingComplete]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <p className="anim-up font-hand text-[22px] text-ivory/90">plating…</p>
      <div
        data-plating-stage
        className="anim-pop relative mt-4 grid h-[210px] w-[210px] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#fffdf7,#efe6d5_62%,#cdc2ae)] shadow-[0_24px_44px_rgba(62,40,25,0.5)]"
      >
        <div className="absolute inset-5 rounded-full border border-walnut/12" />
        <Steam className="bottom-[62%] left-[46%]" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="anim-pop absolute h-[54px] w-[15px] rounded-full border border-[#8e2f1f]/40"
            style={{
              background: "radial-gradient(60% 60% at 50% 40%, #ef7a5f, #c9563d 70%, #a83f2c)",
              transform: `rotate(${-30 + i * 15}deg) translateY(-14px)`,
              animationDelay: `${180 + i * 110}ms`,
            }}
          />
        ))}
        <span className="absolute bottom-[26%] left-[28%] text-[20px]">🌿</span>
      </div>
      <p className="mt-5 font-display text-[20px] font-black text-ivory">{dishName}</p>
      <p className="font-hand text-[18px] text-gold">preparation quality {quality}%</p>
      <div className="mt-5 w-[70%]">
        <KButton full variant="cream" onClick={onContinue}>
          Continue
        </KButton>
      </div>
    </div>
  );
}
