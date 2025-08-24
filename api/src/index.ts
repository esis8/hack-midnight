// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0
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

  // Title/ownership management
  claimOwnershipAndSetTitle(title: string): Promise<void>;
  setTitle(title: string): Promise<void>;
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
                  owner: toHex(ledgerState.owner),
                },
              },
            }),
          ),
        ),
        privateState$,
      ],
      (ledgerState, privateState) => {
        const hashedSecretKey = pureCircuits.publicKey(
          privateState.secretKey,
          convert_bigint_to_Uint8Array(32, ledgerState.instance),
        );

        const ownerHex = toHex(ledgerState.owner);

        return {
          state: ledgerState.state,
          message: ledgerState.message.value,
          title: ledgerState.title.value,
          instance: ledgerState.instance,
          ownerHex,
          isBoardOwner: ownerHex === toHex(hashedSecretKey),
          isOwner: toHex(ledgerState.poster) === toHex(hashedSecretKey),
        };
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

  async claimOwnershipAndSetTitle(title: string): Promise<void> {
    this.logger?.info(`claimOwnershipAndSetTitle: ${title}`);
    const txData = await this.deployedContract.callTx.claimOwnershipAndSetTitle(title);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'claimOwnershipAndSetTitle',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async setTitle(title: string): Promise<void> {
    this.logger?.info(`setTitle: ${title}`);
    const txData = await this.deployedContract.callTx.setTitle(title);
    this.logger?.trace({
      transactionAdded: { circuit: 'setTitle', txHash: txData.public.txHash, blockHeight: txData.public.blockHeight },
    });
  }

  /**
   * Deploys a new bulletin board contract to the network.
   *
   * Note: El owner se reclamará cuando el deployer use 'claimOwnershipAndSetTitle' por primera vez.
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
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';