import { Ledger, State } from "./managed/bboard/contract/index.cjs";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type BBoardPrivateState = {
  readonly trueCount: bigint;
  readonly falseCount: bigint;
  readonly result: State;
};

export const createBBoardPrivateState = () => ({
  trueCount: 0n,
  falseCount: 0n,
  result: State.DRAW,
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
  getResult: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    State,
  ] => {
    let newResult: State;
    if (privateState.trueCount > privateState.falseCount) {
      newResult = State.APPROVED;
    } else if (privateState.trueCount < privateState.falseCount) {
      newResult = State.DISAPPROVED;
    } else {
      newResult = State.DRAW;
    }
    const newState = { ...privateState, result: newResult };
    return [newState, newResult];
  },
};
