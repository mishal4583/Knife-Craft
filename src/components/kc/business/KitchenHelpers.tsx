import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Badge, KButton, Panel } from "../common/primitives";
import { ShortfallOffer } from "../ads/ShortfallOffer";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { STAFF_CATALOG } from "@/game/economy/staffDefinitions";
import { getStaffPurchaseState, type BuyStaffResult } from "@/game/economy/StaffManager";
import { notEnoughMoneyText } from "@/game/economy/wallet";

/** Reuse the matching staff portraits; these helpers are permanent hires. */
const HELPER_PORTRAIT: Record<string, { file: string; icon: string; effect: string }> = {
  "prep-assistant": {
    file: "prep-cook",
    icon: "🧑‍🍳",
    effect: "♻️ Less ingredient waste",
  },
  "kitchen-assistant": {
    file: "line-cook",
    icon: "🙋",
    effect: "🍳 Helps with batch prep",
  },
  "quality-chef": {
    file: "head-chef",
    icon: "👨‍🍳",
    effect: "✨ More consistent plates",
  },
};

/**
 * BUSINESS · STAFF — the kitchen helpers (Economy V2 Phase 7): one-time
 * hires that help every campaign dish, with no wages. Moved here from the
 * Market's old Staff tab so all staff lives in Business. Same catalog
 * (staffDefinitions.ts), same unlock levels and prices, same purchase
 * action — App.buyStaff → StaffManager.buyStaff, one ledger entry — only
 * the screen changed.
 */
export function KitchenHelpers({
  save,
  buyStaff,
}: {
  save: SaveData;
  buyStaff: (id: string) => BuyStaffResult;
}) {
  const [message, setMessage] = useState<string | null>(null);
  /** The hire a "Not enough money" line is about (its small-gap ad top-up shows under it). */
  const [short, setShort] = useState<{ price: number; name: string } | null>(null);

  function hire(id: string, name: string, price: number, unlockLevel: number) {
    const result = buyStaff(id);
    setShort(null);
    if (result.ok) return setMessage(`✓ ${name} hired!`);
    if (result.reason === "insufficientFunds") {
      setShort({ price, name });
      return setMessage(notEnoughMoneyText(price, save.credits));
    }
    if (result.reason === "notUnlocked")
      return setMessage(`${name} unlocks at Level ${unlockLevel}.`);
    setMessage(`${name} couldn't be hired right now.`);
  }

  return (
    <Panel className="p-4">
      <div data-testid="kitchen-helpers">
        <Eyebrow>🔪 Kitchen helpers</Eyebrow>
        <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/65">
          🔁 One-time hire · 🍳 helps every recipe · no wages
        </p>
        {message ? (
          <p className="mt-1 font-hand text-[16px] text-copper" aria-live="polite">
            {message}
          </p>
        ) : null}
        {short ? <ShortfallOffer price={short.price} item={short.name} /> : null}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {STAFF_CATALOG.map((st) => {
            const state = getStaffPurchaseState(save, st.id);
            const portrait = HELPER_PORTRAIT[st.id] ?? {
              file: "prep-cook",
              icon: "🧑‍🍳",
              effect: "🍽️ Supports kitchen service",
            };
            return (
              <article
                key={st.id}
                data-helper={st.id}
                className={cn(
                  "flex min-w-0 flex-col gap-2 rounded-[18px] border border-walnut/12 bg-ivory/70 p-2 card-warm min-[700px]:grid min-[700px]:grid-cols-[70px_minmax(0,1fr)]",
                  state === "locked" && "opacity-70",
                )}
              >
                <div className="relative h-[92px] overflow-hidden rounded-[13px] border border-walnut/15 bg-walnut/10 min-[700px]:h-auto min-[700px]:min-h-[108px]">
                  <img
                    src={`${import.meta.env.BASE_URL}business/staff-portraits/${portrait.file}.webp`}
                    alt={`${st.name} portrait`}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    data-helper-portrait={st.id}
                    className="h-full w-full select-none object-cover"
                  />
                  <span
                    className="absolute bottom-1 left-1 rounded-full border border-ivory/65 bg-ivory/90 px-1 py-0.5 text-[12px] leading-none shadow-soft"
                    aria-hidden
                  >
                    {portrait.icon}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start gap-1">
                    <p className="min-w-0 font-display text-[13px] font-black leading-tight text-walnut-dark">
                      {st.name}
                    </p>
                    <InfoTip label={`About the ${st.name}`}>{st.description}</InfoTip>
                  </div>
                  <p className="mt-1 line-clamp-2 font-ui text-[10.5px] leading-snug text-walnut/65">
                    {portrait.effect}
                  </p>
                  <p className="mt-auto pt-1 font-ui text-[11px] font-extrabold text-copper">
                    {formatUsd(st.price)} · one time
                  </p>
                  <div className="pt-1.5">
                    {state === "owned" ? (
                      <Badge tone="sage">✓ Hired</Badge>
                    ) : state === "locked" ? (
                      <Badge tone="locked">Level {st.unlockLevel}</Badge>
                    ) : (
                      <KButton
                        full
                        size="sm"
                        variant="copper"
                        className="min-h-11 px-2 text-[11px]"
                        onClick={() => hire(st.id, st.name, st.price, st.unlockLevel)}
                      >
                        Hire · {formatUsd(st.price)}
                      </KButton>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
