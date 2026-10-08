import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Badge, KButton, Panel } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { STAFF_CATALOG } from "@/game/economy/staffDefinitions";
import { getStaffPurchaseState, type BuyStaffResult } from "@/game/economy/StaffManager";
import { notEnoughMoneyText } from "@/game/economy/wallet";

/** A face per helper — visual only. */
const HELPER_ICON: Record<string, string> = {
  "prep-assistant": "🧑‍🍳",
  "kitchen-assistant": "🙋",
  "quality-chef": "👨‍🍳",
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

  function hire(id: string, name: string, price: number, unlockLevel: number) {
    const result = buyStaff(id);
    if (result.ok) return setMessage(`${name} hired — helping in every recipe from now on.`);
    if (result.reason === "insufficientFunds")
      return setMessage(notEnoughMoneyText(price, save.credits));
    if (result.reason === "notUnlocked")
      return setMessage(`${name} unlocks at Level ${unlockLevel}.`);
    setMessage(`${name} couldn't be hired right now.`);
  }

  return (
    <Panel className="p-4">
      <div data-testid="kitchen-helpers">
        <Eyebrow>🔪 Kitchen helpers</Eyebrow>
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/65">
          One-time hires for your kitchen: they help in every recipe, campaign included. No daily
          wages.
        </p>
        {message ? (
          <p className="mt-1 font-hand text-[17px] text-copper" aria-live="polite">
            {message}
          </p>
        ) : null}
        <div className="mt-2 space-y-2">
          {STAFF_CATALOG.map((st) => {
            const state = getStaffPurchaseState(save, st.id);
            return (
              <article
                key={st.id}
                data-helper={st.id}
                className={cn(
                  "flex items-center gap-3 rounded-[18px] border border-walnut/12 bg-ivory/70 px-3 py-2",
                  state === "locked" && "opacity-70",
                )}
              >
                <span className="text-[28px] leading-none" aria-hidden>
                  {HELPER_ICON[st.id] ?? "🧑‍🍳"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-[14.5px] font-extrabold text-walnut-dark">{st.name}</p>
                  <p className="font-hand text-[15px] leading-tight text-walnut/65">
                    {st.description}
                  </p>
                  <p className="font-ui text-[12.5px] font-bold text-walnut/60">
                    {formatUsd(st.price)} · one time
                  </p>
                </div>
                {state === "owned" ? (
                  <Badge tone="sage">Hired</Badge>
                ) : state === "locked" ? (
                  <Badge tone="locked">Level {st.unlockLevel}</Badge>
                ) : (
                  <KButton
                    size="sm"
                    variant="copper"
                    className="h-12 shrink-0 px-3 text-[13.5px]"
                    onClick={() => hire(st.id, st.name, st.price, st.unlockLevel)}
                  >
                    Hire · {formatUsd(st.price)}
                  </KButton>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
