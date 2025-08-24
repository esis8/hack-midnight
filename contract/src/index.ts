export * from "./managed/bboard/contract/index.cjs";
export { witnesses } from "./witnesses";
export type { Witnesses } from "./witnesses";

// Estado privado: guardamos la pubkey del owner
export interface BBoardPrivateState {
  ownerPubKey: Uint8Array;
}

export function createBBoardPrivateState(ownerPubKey: Uint8Array): BBoardPrivateState {
  return { ownerPubKey };
}