// Prints the proof of one Unload the Van board (crateDispatch.ts crateProofFor) as JSON, for tools/e2e/kitchendispatch.mjs K14: the builder's shuffles, and the winnable board's way-out order.
// Run: npx tsx tools/e2e/van-proof.mts <level> <seed>
import { crateProofFor, solveBoard } from "../../src/game/business/crateDispatch.ts";

const [level, seed] = process.argv.slice(2).map(Number) as [number, number];
const proof = crateProofFor(level, seed);
console.log(
  JSON.stringify({
    trapped: proof.board.trapped,
    moves: proof.moves,
    order: solveBoard(proof.base).waves.flat(),
  }),
);
