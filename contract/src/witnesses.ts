// Implementa el witness declarado en bboard.compact:
//   witness localOwnerPubKey(): ZswapCoinPublicKey;

export const witnesses = {
  // El runtime provee { privateState } al witness
  localOwnerPubKey: ({
    privateState,
  }: {
    privateState: { ownerPubKey: Uint8Array };
  }): [{ ownerPubKey: Uint8Array }, Uint8Array] => {
    // No mutamos el estado, solo lo devolvemos junto con el valor testigo
    return [privateState, privateState.ownerPubKey];
  },
};

export type Witnesses = typeof witnesses;