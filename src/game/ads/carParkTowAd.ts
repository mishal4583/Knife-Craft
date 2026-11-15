/** Unique reward id for the optional, once-daily second Car Park tow. */
export function newCarParkTowRewardId(): string {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-car-park-tow-${id}`;
}
