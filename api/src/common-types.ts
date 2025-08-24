import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

export type BBoardCircuitKeys = string;

// Clave donde guardaremos el private state asociado al contrato
export const bboardPrivateStateKey = 'bboard.private-state' as const;
export type BBoardPrivateStateKey = typeof bboardPrivateStateKey;

// Estructura derivada que consume la UI
export type BBoardDerivedState = {
  readonly owner: Uint8Array;
  readonly title: string;
  readonly isOwner: boolean;
};

// Tipo de providers con soporte de private state
export type BBoardProviders = MidnightProviders<
  BBoardCircuitKeys,
  BBoardPrivateStateKey,
  { ownerPubKey: Uint8Array }
>;