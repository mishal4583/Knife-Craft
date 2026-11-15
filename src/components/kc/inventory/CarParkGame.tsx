import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AudioManager } from "@/game/AudioManager";
import {
  carParkDue,
  carParkStateOf,
  carParkTowAdAvailable,
  CAR_PARK_STRIKES,
  canLeave,
  isLotCleared,
  leave,
  lotFor,
  starsFor,
  towVehicle,
  type CarParkAction,
  type CarParkLot,
  type CarParkVehicle,
} from "@/game/business/carPark";
import type { SaveData } from "@/game/SaveManager";

type Phase = "playing" | "paused" | "failed" | "won";
const art = (name: string) => `${import.meta.env.BASE_URL}business/carpark/${name}.webp`;
function VehicleArt({ vehicle, className }: { vehicle: CarParkVehicle; className: string }) {
  const [failed, setFailed] = useState(false);
  const kind = vehicle.length >= 4 ? "bus" : vehicle.length === 3 ? "van" : "car";
  const asset = `${kind}-${vehicle.color}`;
  if (failed)
    return (
      <div
        className={`${className} grid place-items-center rounded-[24%] border-2 border-[#75421f] bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg`}
      >
        <span className="text-[min(9vw,34px)]">{vehicle.neighbor ? "🚙" : "🚗"}</span>
      </div>
    );
  const rotation = -90;
  return (
    <div className={`${className} relative grid place-items-center`}>
      <img
        src={art(asset)}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className="h-full w-full select-none object-fill drop-shadow-[0_2px_2px_rgba(0,0,0,.45)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute text-[clamp(14px,4vw,22px)] font-black leading-none text-white drop-shadow-[0_1px_2px_#3c2515]"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        ➜
      </span>
    </div>
  );
}

/** Where a vehicle sits in the lot, in pixels (every cell is a square). */
function vehicleBox(v: CarParkVehicle, cell: number) {
  return {
    left: v.x * cell,
    top: v.y * cell,
    width: (v.axis === "h" ? v.length : 1) * cell,
    height: (v.axis === "v" ? v.length : 1) * cell,
  };
}

/** The picture is drawn once, pointing up; a sideways vehicle is the same picture turned a quarter, and one that drives down is turned round. */
function Oriented({ v, cell }: { v: CarParkVehicle; cell: number }) {
  if (v.axis === "h")
    return (
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: cell,
          height: v.length * cell,
          transform: `translate(-50%,-50%) rotate(${v.dir > 0 ? 90 : -90}deg)`,
        }}
      >
        <VehicleArt vehicle={v} className="h-full w-full" />
      </div>
    );
  return (
    <div className="h-full w-full" style={{ transform: v.dir > 0 ? "rotate(180deg)" : undefined }}>
      <VehicleArt vehicle={v} className="h-full w-full" />
    </div>
  );
}

export function CarParkGame({
  save,
  playerLevel,
  reducedMotion,
  hasPrepCook,
  onAction,
  onExit,
  towAdAvailable = false,
  onTowAd,
}: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  hasPrepCook: boolean;
  onAction: (action: CarParkAction) => { ok: boolean };
  onExit: () => void;
  towAdAvailable?: boolean;
  onTowAd?: () => Promise<"ok" | "no">;
}) {
  const initial = useMemo(() => lotFor(save, playerLevel), [save, playerLevel]);
  const [lot, setLot] = useState<CarParkLot>(initial);
  const [phase, setPhase] = useState<Phase>("playing");
  const [honks, setHonks] = useState(0);
  const [towMode, setTowMode] = useState(false);
  const [freeTowUsed, setFreeTowUsed] = useState(false);
  const [bonusTowAvailable, setBonusTowAvailable] = useState(false);
  const [bonusTowUsed, setBonusTowUsed] = useState(false);
  const [hintId, setHintId] = useState<string | null>(null);
  const [bumpId, setBumpId] = useState<string | null>(null);
  const [showHowto, setShowHowto] = useState(!carParkStateOf(save).howto);
  const [showWhy, setShowWhy] = useState(false);
  /** Vehicles that are driving off the lot right now (they are already gone from the lot itself). */
  const [leaving, setLeaving] = useState<CarParkVehicle[]>([]);
  const [honkId, setHonkId] = useState<string | null>(null);
  const stage = useRef<HTMLElement | null>(null);
  /** The size of one square cell, in pixels: the biggest the lot can be inside the stage (78 % of its width, the rest is the two buildings). */
  const [cell, setCell] = useState(0);
  const idleTimer = useRef<number | null>(null);
  const sentResult = useRef(false);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const canTow = !freeTowUsed || (bonusTowAvailable && !bonusTowUsed);
  const towUsed = freeTowUsed || bonusTowUsed;

  useEffect(() => {
    onActionRef.current({ kind: "start" });
  }, []);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth * 0.78;
      const h = el.clientHeight;
      setCell(Math.max(0, Math.floor(Math.min(w / initial.cols, h / initial.rows))));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [initial.cols, initial.rows]);
  useEffect(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    if (phase !== "playing" || hintId) return;
    idleTimer.current = window.setTimeout(
      () => setHintId(lot.vehicles.find((v) => canLeave(lot, v.id))?.id ?? null),
      4000,
    );
    return () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, [phase, lot, hintId]);

  function touchActivity() {
    setHintId(null);
  }
  function hitVehicle(id: string) {
    if (phase !== "playing") return;
    touchActivity();
    if (towMode && canTow) {
      const next = towVehicle(lot, id);
      driveOff(id);
      setLot(next);
      if (freeTowUsed) setBonusTowUsed(true);
      else setFreeTowUsed(true);
      setTowMode(false);
      AudioManager.playSfx("delivery");
      if (isLotCleared(next)) win(honks, true);
      return;
    }
    if (canLeave(lot, id)) {
      const next = leave(lot, id);
      driveOff(id);
      setLot(next);
      AudioManager.playSfx("sortPlace");
      if (isLotCleared(next)) win(honks, towUsed);
    } else {
      setBumpId(id);
      setHonkId(id);
      window.setTimeout(() => setBumpId((v) => (v === id ? null : v)), reducedMotion ? 20 : 320);
      window.setTimeout(() => setHonkId((v) => (v === id ? null : v)), 650);
      const next = honks + 1;
      setHonks(next);
      AudioManager.playSfx("carHorn");
      if (next >= 3) {
        setPhase("failed");
        onAction({ kind: "failed", honks: next });
      }
    }
  }
  function driveOff(id: string) {
    if (reducedMotion) return;
    const v = lot.vehicles.find((x) => x.id === id);
    if (!v) return;
    setLeaving((old) => [...old, v]);
    window.setTimeout(() => setLeaving((old) => old.filter((x) => x.id !== id)), 460);
  }
  function win(misses: number, towed: boolean) {
    if (sentResult.current) return;
    sentResult.current = true;
    const stars = starsFor(misses, towed);
    onAction({ kind: "finish", honks: misses, towUsed: towed, stars });
    setPhase("won");
  }
  function retry() {
    sentResult.current = false;
    setLot(initial);
    setHonks(0);
    setTowMode(false);
    setFreeTowUsed(false);
    setBonusTowAvailable(false);
    setBonusTowUsed(false);
    setPhase("playing");
    setHintId(null);
    setLeaving([]);
    setHonkId(null);
  }
  function closeHowto() {
    setShowHowto(false);
    onAction({ kind: "howto" });
  }
  function autoClear() {
    onAction({ kind: "auto" });
    onExit();
  }
  const hearts = [0, 1, 2].map((n) => n < CAR_PARK_STRIKES - honks);

  return (
    <main
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#46372c] text-[#442716]"
      data-testid="car-park-game"
    >
      <img
        src={art("car-park-backdrop")}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#2e2113]/25 via-transparent to-[#2e2113]/35" />
      <header className="relative z-10 flex items-center justify-between gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="rounded-2xl border border-[#e6bd69] bg-[#fff3d8]/95 px-3 py-2 shadow-lg">
          <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a6533]">
            🚗 Car Park
          </div>
          <div className="text-sm font-extrabold">Keep the neighbour smiling</div>
        </div>
        <button
          onClick={() => setPhase(phase === "paused" ? "playing" : "paused")}
          aria-label="Pause"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#e7c379] bg-[#fff3d8] text-xl shadow-lg"
        >
          Ⅱ
        </button>
      </header>

      <div className="relative z-10 mx-auto mt-2 flex w-[78%] items-center justify-between rounded-2xl border border-[#e4c683] bg-[#fff5df]/95 px-2 py-1 shadow-lg">
        <div className="flex items-center gap-2">
          <img
            src={art(`neighbour-${honks === 0 ? "happy" : honks === 1 ? "worried" : "annoyed"}`)}
            alt="Neighbour"
            className="h-10 w-10 rounded-full"
          />
          <span className="text-xs font-black">Patience</span>
        </div>
        <div className="flex gap-1" aria-label={`${3 - honks} patience hearts left`}>
          {hearts.map((full, i) => (
            <img key={i} src={art(`heart-${full ? "full" : "empty"}`)} alt="" className="h-7 w-7" />
          ))}
        </div>
        <div className="text-xs font-bold">{lot.vehicles.length} left</div>
      </div>

      <section
        ref={stage}
        className="relative z-10 min-h-0 flex-1"
        aria-label="Shared car park puzzle"
      >
        {cell > 0 ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border-2 border-[#d7b674]/80 bg-[#5d554a]/55 shadow-[0_12px_35px_rgba(0,0,0,.45)]"
            style={{ width: cell * lot.cols, height: cell * lot.rows }}
          >
            {lot.vehicles.map((v) => {
              const selected = towMode || hintId === v.id;
              return (
                <button
                  key={v.id}
                  aria-label={`${v.neighbor ? "Neighbour" : "Restaurant guest"} ${v.color} ${v.length}-space vehicle, ${canLeave(lot, v.id) ? "can move" : "blocked"}`}
                  onClick={() => hitVehicle(v.id)}
                  className={`absolute z-10 touch-manipulation ${bumpId === v.id && !reducedMotion ? "animate-[carparkBump_.16s_ease-in-out_2]" : ""}`}
                  style={{
                    ...vehicleBox(v, cell),
                    padding: Math.max(1, Math.round(cell * 0.04)),
                    ...(selected
                      ? reducedMotion
                        ? { filter: "drop-shadow(0 0 8px rgba(255, 229, 143, .9))" }
                        : { animation: "carparkPulse .9s ease-in-out infinite" }
                      : {}),
                  }}
                >
                  <Oriented v={v} cell={cell} />
                  {honkId === v.id ? (
                    <img
                      src={art("honk")}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[70%] max-w-[64px] -translate-x-1/2 -translate-y-1/2"
                    />
                  ) : null}
                </button>
              );
            })}
            {leaving.map((v) => (
              <div
                key={`leaving-${v.id}`}
                aria-hidden="true"
                className="pointer-events-none absolute z-0"
                style={{
                  ...vehicleBox(v, cell),
                  padding: Math.max(1, Math.round(cell * 0.04)),
                  animation: "carparkDrive .44s ease-in forwards",
                  ["--dx" as string]: `${v.axis === "h" ? v.dir * (lot.cols + 1) * cell : 0}px`,
                  ["--dy" as string]: `${v.axis === "v" ? v.dir * (lot.rows + 1) * cell : 0}px`,
                }}
              >
                <Oriented v={v} cell={cell} />
              </div>
            ))}
            {hintId && phase === "playing" ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 text-center">
                <span className="rounded-full bg-[#fff3d9] px-3 py-1 text-xs font-bold shadow">
                  ✨ Tap the glowing car
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <footer className="relative z-10 mx-3 mb-[max(12px,env(safe-area-inset-bottom))] rounded-2xl border border-[#dfbe7e] bg-[#fff2d7]/95 p-2 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={async () => {
              touchActivity();
              if (canTow) {
                setTowMode((v) => !v);
                return;
              }
              if (towAdAvailable && carParkTowAdAvailable(save) && onTowAd) {
                const result = await onTowAd();
                if (result === "ok") {
                  setBonusTowAvailable(true);
                  setTowMode(true);
                }
              }
            }}
            disabled={
              phase !== "playing" ||
              (!canTow && !(towAdAvailable && carParkTowAdAvailable(save) && onTowAd))
            }
            className={`min-h-12 rounded-xl border px-3 py-2 text-xs font-black shadow ${towMode ? "border-red-700 bg-red-700 text-white" : "border-[#b67d3c] bg-[#f4d49a]"}`}
          >
            🚚{" "}
            {towMode
              ? "Choose a vehicle"
              : canTow
                ? `${freeTowUsed ? "Bonus tow" : "Tow"} · costs 1★`
                : towAdAvailable && carParkTowAdAvailable(save)
                  ? "Watch for extra tow"
                  : "Tow used today"}
          </button>
          <span className="rounded-xl border border-[#c49a61]/50 px-3 py-2 text-xs font-bold">
            {honks === 0 ? "✨ Clean run" : `${honks}/3 honks`}
          </span>
        </div>
        <p className="mt-1 text-center text-[11px] font-semibold text-[#68492d]">
          Tap a clear vehicle to drive it out · blocked taps honk
        </p>
        {phase === "playing" &&
        hasPrepCook &&
        playerLevel >= 30 &&
        carParkDue(save, playerLevel) ? (
          <button
            onClick={autoClear}
            className="mt-1 min-h-12 w-full rounded-xl border border-[#d4b87c] bg-[#fff3dd] px-3 py-2 text-xs font-bold shadow"
          >
            👨‍🍳 Prep Cook clears the lot (no stars)
          </button>
        ) : null}
      </footer>

      {showHowto ? (
        <Overlay title="Clear the car park" icon="🚗">
          <p>Cars drive out along their arrow. A blocked car honks.</p>
          <p>Three honks and you start over. A tow costs a star.</p>
          <button
            className="mt-4 w-full rounded-xl bg-[#7b4a23] px-4 py-3 font-black text-white"
            onClick={closeHowto}
          >
            Let’s go!
          </button>
        </Overlay>
      ) : null}
      {phase === "paused" ? (
        <Overlay title="Take a breather" icon="⏸️">
          <button
            className="w-full rounded-xl bg-[#397c46] px-4 py-3 font-black text-white"
            onClick={() => setPhase("playing")}
          >
            Resume
          </button>
          <button
            className="mt-2 w-full rounded-xl border border-[#b68b58] px-4 py-3 font-bold"
            onClick={retry}
          >
            Restart this lot
          </button>
          <button className="mt-2 w-full rounded-xl px-4 py-3 font-bold" onClick={onExit}>
            Leave
          </button>
        </Overlay>
      ) : null}
      {phase === "failed" ? (
        <Overlay
          title="The neighbour called a tow truck!"
          icon="📣"
          picture={art("neighbour-angry")}
        >
          <p>Three honks. Take a breath and try the same lot again.</p>
          <button
            className="mt-4 w-full rounded-xl bg-[#397c46] px-4 py-3 font-black text-white"
            onClick={retry}
          >
            Try again
          </button>
          <button
            className="mt-2 w-full rounded-xl border border-[#b68b58] px-4 py-3 font-bold"
            onClick={onExit}
          >
            Leave
          </button>
        </Overlay>
      ) : null}
      {phase === "won" ? (
        <Overlay title="The lot is clear!" icon="🎉">
          <div className="text-3xl">{"⭐".repeat(starsFor(honks, towUsed))}</div>
          <p>
            {honks === 0 && !towUsed
              ? "No honks. The neighbour is happy!"
              : `${honks} honk${honks === 1 ? "" : "s"}${towUsed ? " · tow used" : ""}`}
          </p>
          {honks || towUsed ? (
            <button
              onClick={() => setShowWhy((v) => !v)}
              className="mt-1 text-sm font-bold text-[#98612d]"
            >
              Why not 3 stars? ⌄
            </button>
          ) : null}
          {showWhy ? (
            <p className="text-sm">Three stars need a clean lot with no honks and no tow.</p>
          ) : null}
          <button
            className="mt-4 w-full rounded-xl bg-[#397c46] px-4 py-3 font-black text-white"
            onClick={onExit}
          >
            Back to the kitchen
          </button>
        </Overlay>
      ) : null}
    </main>
  );
}

function Overlay({
  title,
  icon,
  picture,
  children,
}: {
  title: string;
  icon: string;
  picture?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#21160f]/60 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] border-2 border-[#dfbd78] bg-[#fff2d7] p-5 text-center shadow-2xl">
        {picture ? (
          <img src={picture} alt="" draggable={false} className="mx-auto h-20 w-20 rounded-full" />
        ) : (
          <div className="text-4xl">{icon}</div>
        )}
        <h2 className="mt-2 font-serif text-2xl font-black">{title}</h2>
        <div className="mt-3 space-y-2 text-sm font-semibold text-[#68492d]">{children}</div>
      </div>
    </div>
  );
}
