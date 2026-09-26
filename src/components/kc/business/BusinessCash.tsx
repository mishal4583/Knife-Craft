import { Coin } from "../common/primitives";

/**
 * BUSINESS_CASH — Business Mode's header wallet display. The game has one
 * wallet and one currency (US dollars, money.ts), so this is simply the
 * shared wallet chip.
 */
export function BusinessCash({ cents }: { cents: number }) {
  return <Coin n={cents} />;
}
