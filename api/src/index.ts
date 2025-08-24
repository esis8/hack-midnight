// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

/**
 * Public API for the bulletin board (publish-once) client.
 */

import contractModule from '../../contract/src/managed/bboard/contract/index.cjs';
const { Contract, ledger } = contractModule;

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
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

/** @internal */
const bboardContractInstance: BBoardContract = new Contract(witnesses);

/**
 * An API for a deployed bulletin board.
 */
export interface DeployedBBoardAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;
  readonly private$: Observable<BBoardPrivateState>;

  vote(value: boolean): Promise<void>;
  debugCounts(): Promise<[bigint, bigint]>;

  setPublishOne(title: string, message: string): Promise<void>;
}

/**
 * Provides an implementation of {@link DeployedBBoardAPI} by adapting a deployed bulletin board
 * contract (publish-once: title+message).
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

    const ledger$ = providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
      map((contractState) => ledger(contractState.data)),
      tap((ledgerState) =>
        logger?.trace({
          ledgerStateChanged: {
            ledgerState: {
              // Log keys present in ledger
              instance: ledgerState.instance,
              title: ledgerState.title.value,
              message: ledgerState.message.value,
            },
          },
        }),
      ),
    );

    this.state$ = combineLatest([ledger$, privateState$]).pipe(
      map(([ledgerState]) => {
        return {
          instance: ledgerState.instance,
          message: ledgerState.message.value,
          title: ledgerState.title.value,
        } as BBoardDerivedState;
      }),
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

  async setPublishOne(title: string, message: string): Promise<void> {
    this.logger?.info(`setPublishOne: title="${title}"`);
    const txData = await this.deployedContract.callTx.setPublishOne(title, message);
    this.logger?.trace({
      transactionAdded: { circuit: 'setPublishOne', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  /**
   * Deploys a new bulletin board contract to the network.
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
 * Re-exports
 */
export * as utils from './utils/index.js';
export * from './common-types.js';