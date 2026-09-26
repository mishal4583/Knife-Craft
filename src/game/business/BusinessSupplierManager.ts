/**
 * BUSINESS_SUPPLIER_MANAGER — Economy V3 Phase 7. The two supplier-
 * contract actions, mirroring RefrigeratorManager.purchaseRefrigerator's
 * own shape: pure functions taking a `SaveData` snapshot and returning
 * either a new save or a typed failure reason.
 *
 * Signing a contract is free (no ledger entry — mirrors Campaign's own
 * `selectSupplier`, "does not move money"). Cancelling early charges the
 * contract's own `cancellationFee`, a real wallet mutation — App.tsx's
 * wrapper records that through the ledger exactly like every other real
 * purchase.
 */
import type { SaveData } from "../SaveManager";
import { getSupplier } from "../economy/supplierDefinitions";
import {
  getContractTerms,
  isContractActive,
  type ActiveSupplierContract,
} from "./businessSupplierContract";

export type SignContractResult =
  | { ok: true; save: SaveData; supplierId: string; contractEndDay: number }
  | { ok: false; reason: "unknownSupplier" | "contractAlreadyActive" };

/** Atomic: either the new contract is recorded, or nothing changes at all. Rejects signing a new contract while one is already active — the player must explicitly cancel first (never a silent overwrite). */
export function signContract(save: SaveData, supplierId: string): SignContractResult {
  if (!getSupplier(supplierId)) return { ok: false, reason: "unknownSupplier" };
  const terms = getContractTerms(supplierId);
  if (!terms) return { ok: false, reason: "unknownSupplier" };
  if (isContractActive(save.business.supplierContract, save.business.calendar.businessDay)) {
    return { ok: false, reason: "contractAlreadyActive" };
  }
  const contractStartDay = save.business.calendar.businessDay;
  const contractEndDay = contractStartDay + terms.contractLength;
  const contract: ActiveSupplierContract = {
    ...terms,
    supplierId,
    contractStartDay,
    contractEndDay,
  };
  return {
    ok: true,
    save: { ...save, business: { ...save.business, supplierContract: contract } },
    supplierId,
    contractEndDay,
  };
}

export type CancelContractResult =
  | { ok: true; save: SaveData; fee: number }
  | { ok: false; reason: "noActiveContract" | "insufficientFunds" };

/** Atomic: either the fee is deducted AND the contract clears, or nothing changes at all — never a partial cancellation. */
export function cancelContract(save: SaveData): CancelContractResult {
  const contract = save.business.supplierContract;
  if (!contract || !isContractActive(contract, save.business.calendar.businessDay)) {
    return { ok: false, reason: "noActiveContract" };
  }
  const fee = contract.cancellationFee;
  if (save.credits < fee) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - fee,
      business: { ...save.business, supplierContract: null },
    },
    fee,
  };
}
