import contractModule from '../../contract/src/managed/bboard/contract/index.cjs';
const { Contract, ledger } = contractModule;

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type BBoardDerivedState,
  type BBoardProviders,
  bboardPrivateStateKey,
} from './common-types.js';
import {
  deployContract,
  findDeployedContract,
  type FoundContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { map, tap, catchError, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { witnesses, createBBoardPrivateState } from '../../contract/src/index.js';

const textEncoder = new TextEncoder();

const bboardContractInstance = new Contract(witnesses);
type DeployedBBoardContract = FoundContract<typeof bboardContractInstance>;

export interface DeployedBBoardAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;
}

export class BBoardAPI implements DeployedBBoardAPI {
  private constructor(
    public readonly deployedContract: DeployedBBoardContract,
    providers: BBoardProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;

    const walletPubKey = providers.walletProvider.coinPublicKey; // hex string

    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        // Algunos bindings requieren 2 args (public, private). Pasamos undefined para el privado.
        map((contractState) => (ledger as any)(contractState.data, undefined)),
        tap((ls) =>
          logger?.trace({
            ledgerStateChanged: {
              owner: toHex(((ls as any).owner?.bytes ?? (ls as any).owner) as Uint8Array),
              title: String((ls as any).title),
            },
          }),
        ),
        map((ls) => {
          const ownerBytes: Uint8Array = ((ls as any).owner?.bytes ?? (ls as any).owner) as Uint8Array;
          return {
            owner: ownerBytes,
            title: String((ls as any).title),
            isOwner: toHex(ownerBytes) === walletPubKey,
          };
        }),
        catchError((err) => {
          console.error('[BBoardAPI] state$ error:', err);
          throw err;
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;

  private static hexToBytes(hex: string): Uint8Array {
    const s = hex.startsWith('0x') ? hex.slice(2) : hex;
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  private static async getPrivateState(providers: BBoardProviders) {
    const existing = await providers.privateStateProvider.get(bboardPrivateStateKey);
    if (existing) return existing;
    const ownerPubKeyBytes = BBoardAPI.hexToBytes(providers.walletProvider.coinPublicKey);
    return createBBoardPrivateState(ownerPubKeyBytes);
  }

  static async deploy(providers: BBoardProviders, newTitle: string, logger?: Logger): Promise<BBoardAPI> {
    logger?.info?.({ deployContract: { newTitle } });

    const deployedBBoardContract = (await deployContract<typeof bboardContractInstance>(
      providers as any,
      {
        contract: bboardContractInstance,
        constructorArgs: [textEncoder.encode(newTitle)],
        privateStateId: bboardPrivateStateKey,
        initialPrivateState: await BBoardAPI.getPrivateState(providers),
      } as any,
    )) as DeployedBBoardContract;

    logger?.trace?.({
      contractDeployed: { finalizedDeployTxData: deployedBBoardContract.deployTxData.public },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  static async join(providers: BBoardProviders, contractAddress: ContractAddress, logger?: Logger): Promise<BBoardAPI> {
    logger?.info?.({ joinContract: { contractAddress } });

    const deployedBBoardContract = (await findDeployedContract<typeof bboardContractInstance>(
      providers as any,
      {
        contractAddress,
        contract: bboardContractInstance,
        privateStateId: bboardPrivateStateKey,
        initialPrivateState: await BBoardAPI.getPrivateState(providers),
      } as any,
    )) as DeployedBBoardContract;

    logger?.trace?.({
      contractJoined: { finalizedDeployTxData: deployedBBoardContract.deployTxData.public },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';