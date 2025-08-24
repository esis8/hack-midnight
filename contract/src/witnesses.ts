import { Ledger } from "./managed/bboard/contract/index.cjs";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type BBoardPrivateState = {
  readonly trueCount: bigint;
  readonly falseCount: bigint;
};

export const createBBoardPrivateState = () => ({
  trueCount: 0n,
  falseCount: 0n,
});

export const witnesses = {
  countBoolean: (
    { privateState }: WitnessContext<Ledger, BBoardPrivateState>,
    value: boolean,
  ): [BBoardPrivateState, bigint] => {
    // Actualiza el contador correspondiente
    const newState = value
      ? { ...privateState, trueCount: privateState.trueCount + 1n }
      : { ...privateState, falseCount: privateState.falseCount + 1n };
    // Devuelve el nuevo estado y el contador actualizado
    return [newState, value ? newState.trueCount : newState.falseCount];
  },
  getVotes: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    [bigint, bigint],
  ] => [privateState, [privateState.trueCount, privateState.falseCount]],
};
