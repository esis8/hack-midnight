import contractModule from '../../contract/src/managed/bboard/contract/index.cjs';
const { Contract, ledger } = contractModule;

// Se elimina la importación de StateValue
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import { type BBoardDerivedState, type BBoardProviders } from './common-types.js';
import { deployContract, findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { map, tap, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { witnesses } from '../../contract/src/index.js';

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

    const walletPubKey = providers.walletProvider.coinPublicKey; // string hex

    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((contractState) => {
          // Forzamos aridad 2 para ledgers sellados; si admite 1, JS ignora el extra.
          const ledgerAny = ledger as any;
          return ledgerAny(contractState.data, undefined);
        }),
        tap((ls) =>
          logger?.trace({
            ledgerStateChanged: {
              owner: toHex(ls.owner.bytes),
              title: String(ls.title),
            },
          }),
        ),
        map((ls) => ({
          owner: ls.owner.bytes as Uint8Array,
          title: String(ls.title),
          isOwner: toHex(ls.owner.bytes) === walletPubKey,
        })),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;

  static async deploy(providers: BBoardProviders, newTitle: string, logger?: Logger): Promise<BBoardAPI> {
    logger?.info({ deployContract: { newTitle } });

    const deployedBBoardContract = (await deployContract<typeof bboardContractInstance>(
      providers as any,
      {
        contract: bboardContractInstance,
        constructorArgs: [textEncoder.encode(newTitle)],
      } as any,
    )) as DeployedBBoardContract;

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedBBoardContract.deployTxData.public,
      },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  /**
   * Se une a un contrato ya desplegado.
   */
  static async join(providers: BBoardProviders, contractAddress: ContractAddress, logger?: Logger): Promise<BBoardAPI> {
    logger?.info({ joinContract: { contractAddress } });

    const deployedBBoardContract = (await findDeployedContract<typeof bboardContractInstance>(
      providers as any,
      {
        contractAddress,
        contract: bboardContractInstance,
      } as any,
    )) as DeployedBBoardContract;

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedBBoardContract.deployTxData.public,
      },
    });

    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';