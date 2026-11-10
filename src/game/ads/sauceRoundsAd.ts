/** A fresh id for one Sauce Station "3 more rounds" ad (never sent as a placement: the placement is the fixed `sauce_rounds`). */
export function newSauceRoundsRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-sauce-rounds-${uuid}`;
}
