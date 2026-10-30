import { useState } from "react";
import { useUnlockText } from "../navLevel";
import type { SaveData } from "@/game/SaveManager";
import { Badge, KButton, Panel } from "../common/primitives";
import { ShortfallOffer } from "../ads/ShortfallOffer";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { STAFF_CATALOG } from "@/game/economy/staffDefinitions";
import { getStaffPurchaseState, type BuyStaffResult } from "@/game/economy/StaffManager";
import { StaffCard, StaffPay, StaffPortrait, StaffStatus } from "./StaffCard";
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
  const u = useUnlockText();
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
      return setMessage(`${name} unlocks ${u.when(unlockLevel)}.`);
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
              <StaffCard
                key={st.id}
                data-helper={st.id}
                tone={state === "owned" ? "hired" : state === "locked" ? "locked" : "plain"}
                portrait={
                  <StaffPortrait
                    file={portrait.file}
                    name={st.name}
                    emoji={portrait.icon}
                    data-helper-portrait={st.id}
                    className="h-full w-full"
                  />
                }
                status={
                  state === "owned" ? (
                    <StaffStatus tone="hired">✓ Hired</StaffStatus>
                  ) : state === "locked" ? (
                    <StaffStatus tone="locked">{u.badge(st.unlockLevel)}</StaffStatus>
                  ) : null
                }
                title={st.name}
                info={<InfoTip label={`About the ${st.name}`}>{st.description}</InfoTip>}
                glance={portrait.effect}
                pay={<StaffPay now={formatUsd(st.price)} later="🔁 one time · no wages" />}
                action={
                  state === "owned" ? (
                    <Badge tone="sage">✓ Yours for good</Badge>
                  ) : state === "locked" ? (
                    <Badge tone="locked">{u.level(st.unlockLevel)}</Badge>
                  ) : (
                    <KButton
                      full
                      size="sm"
                      variant="copper"
                      className="min-h-12 px-2 text-[12px]"
                      onClick={() => hire(st.id, st.name, st.price, st.unlockLevel)}
                    >
                      Hire · {formatUsd(st.price)}
                    </KButton>
                  )
                }
              />
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
