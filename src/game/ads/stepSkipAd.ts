/** A fresh id for one "skip this step" ad (never sent as a placement: the placement is the fixed `skip_step`). */
export function newStepSkipRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-step-skip-${uuid}`;
}
