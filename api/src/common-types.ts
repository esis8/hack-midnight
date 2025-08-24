import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

export type BBoardCircuitKeys = never;

export type BBoardProviders = MidnightProviders<BBoardCircuitKeys, never, never>;

export type BBoardDerivedState = {
  readonly owner: Uint8Array;
  readonly title: string;
  readonly isOwner: boolean;
};