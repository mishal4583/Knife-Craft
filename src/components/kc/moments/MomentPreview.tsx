import { useEffect, useRef, useState } from "react";
import { MOMENT_KIND_LABEL, type KitchenMoment } from "@/game/kitchenMoments";
import { cardBlob, cardFileName, drawMomentCard } from "./momentCard";
import { KButton } from "../common/primitives";

type Status = { tone: "ok" | "info" | "error"; text: string } | null;

/**
 * MOMENT_PREVIEW — Phase 6: the Kitchen Moment card, previewed exactly as it
 * will be saved (the preview IS the exported PNG), with Share (only where the
 * browser can share an image file — feature-detected), Save image (a plain
 * download) and Close. Nothing is posted or uploaded by itself; cancelling a
 * share is not an error; a failure keeps the preview so another action can be
 * tried. Several moments from one dish: arrows between them. Object URLs are
 * revoked when the card changes or the preview closes.
 */
export function MomentPreview({
  moments,
  onClose,
}: {
  moments: KitchenMoment[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const m = moments[Math.min(index, moments.length - 1)]!;

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    setStatus(null);
    blobRef.current = null;
    drawMomentCard(m)
      .then(cardBlob)
      .then((blob) => {
        if (!alive) return;
        if (!blob) return setFailed(true);
        blobRef.current = blob;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [m]);

  const file = () =>
    blobRef.current ? new File([blobRef.current], cardFileName(m), { type: "image/png" }) : null;
  const canShareFile = (() => {
    const f = file();
    try {
      return !!f && typeof navigator.share === "function" && !!navigator.canShare?.({ files: [f] });
    } catch {
      return false;
    }
  })();

  async function share() {
    const f = file();
    if (!f || busy) return;
    setBusy(true);
    try {
      await navigator.share({ files: [f], text: m.shareText, title: "KnifeCraft" });
      setStatus({ tone: "ok", text: "Shared!" });
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError")
        setStatus(null); // the player changed their mind
      else
        setStatus({ tone: "info", text: "Sharing isn't available here — Save the image instead." });
    } finally {
      setBusy(false);
    }
  }

  function saveImage() {
    if (!url) return;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = cardFileName(m);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ tone: "ok", text: "Saved to your downloads." });
    } catch {
      setStatus({ tone: "error", text: "Couldn't save the image here." });
    }
  }

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center bg-walnut-dark/75 px-3 backdrop-blur-[3px]"
      data-testid="moment-preview"
      data-kind={m.kind}
      role="dialog"
      aria-label={`Kitchen Moment: ${MOMENT_KIND_LABEL[m.kind].title}`}
    >
      <div className="anim-pop flex max-h-[calc(100%-16px)] w-full max-w-[380px] flex-col overflow-y-auto rounded-[24px] border border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] p-3 text-center shadow-lift">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
          📸 Kitchen Moment{moments.length > 1 ? ` · ${index + 1} of ${moments.length}` : ""}
        </p>
        <div className="relative mx-auto mt-2 aspect-[4/5] w-full max-h-[52vh] overflow-hidden rounded-[16px] bg-walnut-dark">
          {url ? (
            <img
              src={url}
              alt={`${MOMENT_KIND_LABEL[m.kind].title}: ${m.heading}`}
              className="h-full w-full object-contain"
              data-testid="moment-card"
            />
          ) : (
            <p
              className="grid h-full place-items-center font-hand text-[17px] text-ivory/80"
              data-testid="moment-card-status"
            >
              {failed ? "Couldn't draw this card — your game is fine." : "Drawing your card…"}
            </p>
          )}
          {moments.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous moment"
                className="absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-walnut-dark/60 text-[20px] text-ivory"
                onClick={() => setIndex((i) => (i - 1 + moments.length) % moments.length)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next moment"
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-walnut-dark/60 text-[20px] text-ivory"
                onClick={() => setIndex((i) => (i + 1) % moments.length)}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
        {status ? (
          <p
            className={
              "mt-2 font-ui text-[12.5px] font-bold " +
              (status.tone === "ok"
                ? "text-olive"
                : status.tone === "error"
                  ? "text-copper"
                  : "text-walnut/70")
            }
            data-testid="moment-status"
          >
            {status.text}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {canShareFile ? (
            <KButton variant="copper" disabled={!url || busy} onClick={() => void share()}>
              Share
            </KButton>
          ) : null}
          <KButton
            variant={canShareFile ? "cream" : "copper"}
            className={canShareFile ? "" : "col-span-2"}
            disabled={!url}
            onClick={saveImage}
          >
            Save image
          </KButton>
        </div>
        <div className="mt-2">
          <KButton full variant="ghost" onClick={onClose}>
            Close
          </KButton>
        </div>
      </div>
    </div>
  );
}
