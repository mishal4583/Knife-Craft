/**
 * BUSINESS_CURRENCY — kept as an import path for Business Mode screens.
 * The game has ONE currency (US dollars) and ONE formatter; both live in
 * src/game/money.ts. Business Mode prices were calibrated in integer US
 * cents against real 2026 restaurant benchmarks (§24 of the master spec —
 * a ~$2.49/lb tomato is 249), which is exactly the wallet's own unit, so
 * Business amounts need no conversion.
 */
export { formatUsd } from "../money";
