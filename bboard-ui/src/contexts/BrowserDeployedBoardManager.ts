// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import {
  type DeployedBBoardAPI,
  BBoardAPI,
  type BBoardProviders,
  type BBoardCircuitKeys,
} from '../../../api/src/index';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  BehaviorSubject,
  type Observable,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  of,
  take,
  tap,
  throwError,
  timeout,
  catchError,
  from,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import {
  type DAppConnectorAPI,
  type DAppConnectorWalletAPI,
  type ServiceUriConfig,
} from '@midnight-ntwrk/dapp-connector-api';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  type BalancedTransaction,
  type UnbalancedTransaction,
  createBalancedTx,
} from '@midnight-ntwrk/midnight-js-types';
import { type CoinInfo, Transaction, type TransactionId } from '@midnight-ntwrk/ledger';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import semver from 'semver';
import { getLedgerNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/**
 * In-progress deployment.
 */
export interface InProgressBoardDeployment {
  readonly status: 'in-progress';
}

/**
 * Deployed deployment.
 */
export interface DeployedBoardDeployment {
  readonly status: 'deployed';
  readonly api: DeployedBBoardAPI;
}

/**
 * Failed deployment.
 */
export interface FailedBoardDeployment {
  readonly status: 'failed';
  readonly error: Error;
}

export type BoardDeployment = InProgressBoardDeployment | DeployedBoardDeployment | FailedBoardDeployment;

/**
 * Provider API exposed through context.
 */
export interface DeployedBoardAPIProvider {
  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;
  readonly resolve: (contractAddress?: ContractAddress) => Observable<BoardDeployment>;

  // Lista persistida de contratos conocidos (por red)
  readonly knownBoards$: Observable<ContractAddress[]>;
  removeKnownBoard(addr: ContractAddress): void;
  clearKnownBoards(): void;

  // Título del contrato (observado desde el ledger). undefined si no disponible.
  getBoardTitle$(addr: ContractAddress): Observable<string | undefined>;
}

const storageKey = (networkId: string) => `bboard:known:${networkId}`;
const readKnown = (networkId: string): ContractAddress[] => {
  try {
    const raw = localStorage.getItem(storageKey(networkId));
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.from(new Set(arr)).filter((s) => typeof s === 'string') as ContractAddress[];
  } catch {
    return [];
  }
};
const writeKnown = (networkId: string, addrs: ContractAddress[]) => {
  try {
    localStorage.setItem(storageKey(networkId), JSON.stringify(addrs));
  } catch {
    // ignore quota errors
  }
};

export class BrowserDeployedBoardManager implements DeployedBoardAPIProvider {
  readonly #boardDeploymentsSubject: BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>;
  #initializedProviders: Promise<BBoardProviders> | undefined;

  private readonly networkId: string;
  private readonly knownSubject: BehaviorSubject<ContractAddress[]>;

  // Propiedades públicas observables
  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;
  readonly knownBoards$: Observable<ContractAddress[]>;

  constructor(private readonly logger: Logger, networkId: string) {
    this.#boardDeploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>([]);
    // Evita el error de tipos: mapea a Array<Observable<...>>
    this.boardDeployments$ = this.#boardDeploymentsSubject.asObservable().pipe(
      map((arr) => arr as Array<Observable<BoardDeployment>>),
    );

    this.networkId = networkId;
    this.knownSubject = new BehaviorSubject<ContractAddress[]>(readKnown(this.networkId));
    this.knownBoards$ = this.knownSubject.asObservable();

    // Sembrar lista inicial desde /seed-boards.json si está vacío
    void this.seedIfEmpty();
  }

  getBoardTitle$(addr: ContractAddress): Observable<string | undefined> {
    return from(this.getProviders()).pipe(
      concatMap((providers) => BBoardAPI.join(providers, addr, this.logger)),
      concatMap((api) => api.state$),
      map((st) => st.title),
      catchError(() => of(undefined)),
    );
  }

  resolve(contractAddress?: ContractAddress): Observable<BoardDeployment> {
    const deployments = this.#boardDeploymentsSubject.value;

    let deployment = deployments.find(
      (d) => d.value.status === 'deployed' && d.value.api.deployedContractAddress === contractAddress,
    );
    if (deployment) return deployment;

    deployment = new BehaviorSubject<BoardDeployment>({ status: 'in-progress' });

    if (contractAddress) {
      void this.joinDeployment(deployment, contractAddress);
    } else {
      void this.deployDeployment(deployment);
    }

    this.#boardDeploymentsSubject.next([...deployments, deployment]);
    return deployment;
  }

  removeKnownBoard(addr: ContractAddress): void {
    const next = this.knownSubject.getValue().filter((a) => a !== addr);
    this.knownSubject.next(next);
    writeKnown(this.networkId, next);
  }

  clearKnownBoards(): void {
    this.knownSubject.next([]);
    writeKnown(this.networkId, []);
  }

  private addKnownBoard(addr: ContractAddress): void {
    const set = new Set(this.knownSubject.getValue());
    if (!set.has(addr)) {
      set.add(addr);
      const next = Array.from(set);
      this.knownSubject.next(next);
      writeKnown(this.networkId, next);
    }
  }

  private getProviders(): Promise<BBoardProviders> {
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(deployment: BehaviorSubject<BoardDeployment>): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await BBoardAPI.deploy(providers, this.logger);

      // persistir address del board recién desplegado
      this.addKnownBoard(api.deployedContractAddress as ContractAddress);

      deployment.next({ status: 'deployed', api });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<BoardDeployment>,
    contractAddress: ContractAddress,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await BBoardAPI.join(providers, contractAddress, this.logger);

      // persistir address al unirse correctamente
      this.addKnownBoard(contractAddress);

      deployment.next({ status: 'deployed', api });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Si no hay nada en storage, carga hasta 5 direcciones desde /seed-boards.json
  private async seedIfEmpty(): Promise<void> {
    try {
      if (this.knownSubject.getValue().length > 0) return;

      const resp = await fetch('/seed-boards.json', { cache: 'no-store' });
      if (!resp.ok) return;

      const data = (await resp.json()) as unknown;
      const arr = Array.isArray(data) ? (data as string[]) : [];
      const sanitized = arr
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 5) as ContractAddress[];

      if (sanitized.length > 0) {
        this.knownSubject.next(sanitized);
        writeKnown(this.networkId, sanitized);
      }
    } catch {
      // Ignorar si el archivo no existe o hay error de parseo
    }
  }
}

/** @internal */
const initializeProviders = async (logger: Logger): Promise<BBoardProviders> => {
  const { wallet, uris } = await connectToWallet(logger);
  const walletState = await wallet.state();
  const zkConfigPath = window.location.origin;

  console.log(`Connecting to wallet with network ID: ${getLedgerNetworkId()}`);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'bboard-private-state',
    }),
    zkConfigProvider: new FetchZkConfigProvider<BBoardCircuitKeys>(zkConfigPath, fetch.bind(window)),
    proofProvider: httpClientProofProvider(uris.proverServerUri),
    publicDataProvider: indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
    walletProvider: {
      coinPublicKey: walletState.coinPublicKey,
      encryptionPublicKey: walletState.encryptionPublicKey,
      balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
        return wallet
          .balanceAndProveTransaction(
            ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
            newCoins,
          )
          .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
          .then(createBalancedTx);
      },
    },
    midnightProvider: {
      submitTx(tx: BalancedTransaction): Promise<TransactionId> {
        return wallet.submitTransaction(tx);
      },
    },
  };
};

/** @internal */
const connectToWallet = (logger: Logger): Promise<{ wallet: DAppConnectorWalletAPI; uris: ServiceUriConfig }> => {
  const COMPATIBLE_CONNECTOR_API_VERSION = '1.x';

  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => window.midnight?.mnLace),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Check for wallet connector API');
      }),
      filter((connectorAPI): connectorAPI is DAppConnectorAPI => !!connectorAPI),
      concatMap((connectorAPI) =>
        semver.satisfies(connectorAPI.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
          ? of(connectorAPI)
          : throwError(() => {
              logger.error(
                { expected: COMPATIBLE_CONNECTOR_API_VERSION, actual: connectorAPI.apiVersion },
                'Incompatible version of wallet connector API',
              );
              return new Error(
                `Incompatible version of Midnight Lace wallet found. Require '${COMPATIBLE_CONNECTOR_API_VERSION}', got '${connectorAPI.apiVersion}'.`,
              );
            }),
      ),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Compatible wallet connector API found. Connecting.');
      }),
      take(1),
      timeout({
        first: 1_000,
        with: () =>
          throwError(() => {
            logger.error('Could not find wallet connector API');
            return new Error('Could not find Midnight Lace wallet. Extension installed?');
          }),
      }),
      concatMap(async (connectorAPI) => {
        const isEnabled = await connectorAPI.isEnabled();
        logger.info(isEnabled, 'Wallet connector API enabled status');
        return connectorAPI;
      }),
      timeout({
        first: 5_000,
        with: () =>
          throwError(() => {
            logger.error('Wallet connector API has failed to respond');
            return new Error('Midnight Lace wallet has failed to respond. Extension enabled?');
          }),
      }),
      concatMap(async (connectorAPI) => ({ walletConnectorAPI: await connectorAPI.enable(), connectorAPI })),
      catchError((error, apis) =>
        error
          ? throwError(() => {
              logger.error('Unable to enable connector API');
              return new Error('Application is not authorized');
            })
          : apis,
      ),
      concatMap(async ({ walletConnectorAPI, connectorAPI }) => {
        const uris = await connectorAPI.serviceUriConfig();
        logger.info('Connected to wallet connector API and retrieved service configuration');
        return { wallet: walletConnectorAPI, uris };
      }),
    ),
  );
};