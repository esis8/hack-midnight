

import contractModule from '../../contract/src/managed/bboard/contract/index.cjs';
const { Contract, ledger, pureCircuits, STATE } = contractModule;

import { type ContractAddress, convert_bigint_to_Uint8Array } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type BBoardDerivedState,
  type BBoardContract,
  type BBoardProviders,
  type DeployedBBoardContract,
  bboardPrivateStateKey,
} from './common-types.js';
import { type BBoardPrivateState, createBBoardPrivateState, witnesses } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable, shareReplay } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

/** @internal */
const bboardContractInstance: BBoardContract = new Contract(witnesses);

// Sal constante para ownership (Bytes<32>)
const OWNER_SALT: Uint8Array = (() => {
  const u8 = new Uint8Array(32);
  const bytes = new TextEncoder().encode('bboard:owner');
  u8.set(bytes.slice(0, 32));
  return u8;
})();

/**
 * An API for a deployed bulletin board.
 */
export interface DeployedBBoardAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;
  readonly private$: Observable<BBoardPrivateState>;

  post: (message: string) => Promise<void>;
  takeDown: () => Promise<void>;
  vote(value: boolean): Promise<void>;
  debugCounts(): Promise<[bigint, bigint]>;

  setTitleOnce(title: string): Promise<void>;
}

/**
 * Provides an implementation of {@link DeployedBBoardAPI} by adapting a deployed bulletin board
 * contract.
 */
export class BBoardAPI implements DeployedBBoardAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedBBoardContract,
    providers: BBoardProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;

    const privateState$ = from(
      providers.privateStateProvider.get(bboardPrivateStateKey) as Promise<BBoardPrivateState>,
    ).pipe(shareReplay(1));

    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  state: ledgerState.state === STATE.occupied ? 'occupied' : 'vacant',
                  poster: toHex(ledgerState.poster),
                },
              },
            }),
          ),
        ),
        privateState$,
      ],
      (ledgerState, privateState) => {
        const posterHash = pureCircuits.publicKey(
          privateState.secretKey,
          convert_bigint_to_Uint8Array(32, ledgerState.instance),
        );

        return {
          state: ledgerState.state,
          message: ledgerState.message.value,
          title: ledgerState.title.value,
          instance: ledgerState.instance,
          isOwner: toHex(ledgerState.poster) === toHex(posterHash),
        } as BBoardDerivedState;
      },
    );

    this.private$ = privateState$.pipe(
      tap((privateState) =>
        logger?.trace({
          privateStateLoaded: {
            trueCount: privateState.trueCount,
            falseCount: privateState.falseCount,
          },
        }),
      ),
    );
  }

  /**
   * Gets the address of the current deployed contract.
   */
  readonly deployedContractAddress: ContractAddress;

  /**
   * Gets an observable stream of state changes based on the current public (ledger),
   * and private state data.
   */
  readonly state$: Observable<BBoardDerivedState>;
  readonly private$: Observable<BBoardPrivateState>;

  async post(message: string): Promise<void> {
    this.logger?.info(`postingMessage: ${message}`);
    const txData = await this.deployedContract.callTx.post(message);
    this.logger?.trace({
      transactionAdded: { circuit: 'post', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  async debugCounts(): Promise<[bigint, bigint]> {
    this.logger?.info('debugCounts');
    const result = await this.deployedContract.callTx.debugInfo();
    this.logger?.trace({
      debugCounts: { trueCount: result.private.result[0], falseCount: result.private.result[1] },
    });
    return result.private.result;
  }

  async vote(value: boolean): Promise<void> {
    this.logger?.info(`vote: ${value}`);
    const txData = await this.deployedContract.callTx.vote(value);
    this.logger?.trace({
      transactionAdded: { circuit: 'vote', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  async takeDown(): Promise<void> {
    this.logger?.info('takingDownMessage');
    const txData = await this.deployedContract.callTx.takeDown();
    this.logger?.trace({
      transactionAdded: { circuit: 'takeDown', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  async setTitleOnce(title: string): Promise<void> {
    this.logger?.info(`setTitleOnce: ${title}`);
    const txData = await this.deployedContract.callTx.setTitleOnce(title);
    this.logger?.trace({
      transactionAdded: { circuit: 'setTitleOnce', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  /**
   * Deploys a new bulletin board contract to the network.
   *
   * Nota: el owner queda fijado al deployer (hash con sal constante).
   */
 static async deploy(providers: BBoardProviders, logger?: Logger): Promise<BBoardAPI> {
    logger?.info('deployContract');

    const deployedBBoardContract = await deployContract<typeof bboardContractInstance>(providers, {
      privateStateId: bboardPrivateStateKey,
      contract: bboardContractInstance,
      initialPrivateState: await BBoardAPI.getPrivateState(providers),
    });

    logger?.trace({ contractDeployed: { finalizedDeployTxData: deployedBBoardContract.deployTxData.public } });
    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  static async join(providers: BBoardProviders, contractAddress: ContractAddress, logger?: Logger): Promise<BBoardAPI> {
    logger?.info({ joinContract: { contractAddress } });

    const deployedBBoardContract = await findDeployedContract<BBoardContract>(providers, {
      contractAddress,
      contract: bboardContractInstance,
      privateStateId: bboardPrivateStateKey,
      initialPrivateState: await BBoardAPI.getPrivateState(providers),
    });

    logger?.trace({ contractJoined: { finalizedDeployTxData: deployedBBoardContract.deployTxData.public } });
    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  private static async getPrivateState(providers: BBoardProviders): Promise<BBoardPrivateState> {
    const existingPrivateState = await providers.privateStateProvider.get(bboardPrivateStateKey);
    return existingPrivateState ?? createBBoardPrivateState(utils.randomBytes(32));
  }
}

/**
 * A namespace that represents the exports from the 'utils' sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';