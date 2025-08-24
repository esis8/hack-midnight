// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Provides types and utilities for working with bulletin board contracts.
 *
 * @packageDocumentation
 */

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
}

/**
 * Provides an implementation of {@link DeployedBBoardAPI} by adapting a deployed bulletin board
 * contract.
 *
 * @remarks
 * The `BBoardPrivateState` is managed at the DApp level by a private state provider. As such, this
 * private state is shared between all instances of {@link BBoardAPI}, and their underlying deployed
 * contracts. The private state defines a `'secretKey'` property that effectively identifies the current
 * user, and is used to determine if the current user is the poster of the message as the observable
 * contract state changes.
 *
 * In the future, Midnight.js will provide a private state provider that supports private state storage
 * keyed by contract address. This will remove the current workaround of sharing private state across
 * the deployed bulletin board contracts, and allows for a unique secret key to be generated for each bulletin
 * board that the user interacts with.
 */
// TODO: Update BBoardAPI to use contract level private state storage.
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
        // Combine public (ledger) state with...
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
        // ...private state...
        //    since the private state of the bulletin board application never changes, we can query the
        //    private state once and always use the same value with `combineLatest`. In applications
        //    where the private state is expected to change, we would need to make this an `Observable`.
        privateState$,
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        const hashedSecretKey = pureCircuits.publicKey(
          privateState.secretKey,
          convert_bigint_to_Uint8Array(32, ledgerState.instance),
        );

        return {
          state: ledgerState.state,
          message: ledgerState.message.value,
          instance: ledgerState.instance,
          isOwner: toHex(ledgerState.poster) === toHex(hashedSecretKey),
        };
      },
    );
    this.private$ = privateState$.pipe(
      tap((privateState) =>
        logger?.trace({
          privateStateLoaded: {
            // secretKey: toHex(privateState.secretKey),
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

  /**
   * Attempts to post a given message to the bulletin board.
   *
   * @param message The message to post.
   *
   * @remarks
   * This method can fail during local circuit execution if the bulletin board is currently occupied.
   */
  async post(message: string): Promise<void> {
    this.logger?.info(`postingMessage: ${message}`);

    const txData = await this.deployedContract.callTx.post(message);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'post',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async debugCounts(): Promise<[bigint, bigint]> {
    this.logger?.info('debugCounts');
    const result = await this.deployedContract.callTx.debugInfo();
    this.logger?.trace({
      debugCounts: {
        trueCount: result.private.result[0],
        falseCount: result.private.result[1],
      },
    });
    return result.private.result;
  }

  async vote(value: boolean): Promise<void> {
    this.logger?.info(`vote: ${value}`);

    const txData = await this.deployedContract.callTx.vote(value);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'vote',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Attempts to take down any currently posted message on the bulletin board.
   *
   * @remarks
   * This method can fail during local circuit execution if the bulletin board is currently vacant,
   * or if the currently posted message isn't owned by the poster computed from the current private
   * state.
   */
  async takeDown(): Promise<void> {
    this.logger?.info('takingDownMessage');

    const txData = await this.deployedContract.callTx.takeDown();

    this.logger?.trace({
      transactionAdded: {
        circuit: 'takeDown',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Deploys a new bulletin board contract to the network.
   *
   * @param providers The bulletin board providers.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link BBoardAPI} instance that manages the newly deployed
   * {@link DeployedBBoardContract}; or rejects with a deployment error.
   */
  static async deploy(providers: BBoardProviders, logger?: Logger): Promise<BBoardAPI> {
    logger?.info('deployContract');

    // EXERCISE 5: FILL IN THE CORRECT ARGUMENTS TO deployContract
    const deployedBBoardContract = await deployContract<typeof bboardContractInstance>(providers, {
      privateStateId: bboardPrivateStateKey,
      contract: bboardContractInstance,
      initialPrivateState: await BBoardAPI.getPrivateState(providers),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedBBoardContract.deployTxData.public,
      },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  /**
   * Finds an already deployed bulletin board contract on the network, and joins it.
   *
   * @param providers The bulletin board providers.
   * @param contractAddress The contract address of the deployed bulletin board contract to search for and join.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link BBoardAPI} instance that manages the joined
   * {@link DeployedBBoardContract}; or rejects with an error.
   */
  static async join(providers: BBoardProviders, contractAddress: ContractAddress, logger?: Logger): Promise<BBoardAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedBBoardContract = await findDeployedContract<BBoardContract>(providers, {
      contractAddress,
      contract: bboardContractInstance,
      privateStateId: bboardPrivateStateKey,
      initialPrivateState: await BBoardAPI.getPrivateState(providers),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedBBoardContract.deployTxData.public,
      },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  private static async getPrivateState(providers: BBoardProviders): Promise<BBoardPrivateState> {
    const existingPrivateState = await providers.privateStateProvider.get(bboardPrivateStateKey);
    return existingPrivateState ?? createBBoardPrivateState(utils.randomBytes(32));
  }
}

/**
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';
