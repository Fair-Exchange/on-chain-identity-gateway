import {GatewayV2} from '../target/types/gateway_v2';
import {AnchorProvider, Program} from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import {
    ConfirmOptions,
    PublicKey,
} from '@solana/web3.js';

import {Wallet} from './lib/types';

import {EnumMapper, findProgramAddress} from './lib/utils';
import {DEFAULT_PASS_SEED, SOLANA_MAINNET} from './lib/constants';
import {ServiceBuilder, AbstractService, NonSigningWallet} from "./utils/AbstractService";
import {CustomClusterUrlConfig, ExtendedCluster, getConnectionByCluster} from "./lib/connection";
import {PassAccount, PassState, PassStateMapping} from "./lib/wrappers";

export class GatekeeperService extends AbstractService {
    private constructor(_program: Program<GatewayV2>,
                        _dataAccount: PublicKey,
                        private _network: PublicKey,
                        _cluster: ExtendedCluster = SOLANA_MAINNET,
                        _wallet: Wallet = new NonSigningWallet(),
                        _opts: ConfirmOptions = AnchorProvider.defaultOptions()) {
        super(_program, _dataAccount, _cluster, _wallet, _opts);
    }

    static async build(
        dataAccount: PublicKey,
        network: PublicKey,
        wallet: Wallet,
        cluster: ExtendedCluster = SOLANA_MAINNET,
        customConfig?: CustomClusterUrlConfig,
        opts: ConfirmOptions = AnchorProvider.defaultOptions()
    ): Promise<GatekeeperService> {
        const _connection = getConnectionByCluster(
            cluster,
            opts.preflightCommitment,
            customConfig
        );

        const provider = new AnchorProvider(_connection, wallet, opts);

        const program = await AbstractService.fetchProgram(provider);

        return new GatekeeperService(
            program,
            dataAccount,
            network,
            cluster,
            wallet,
            provider.opts
        );
    }

    static async buildFromAnchor(
        program: Program<GatewayV2>,
        dataAccount: PublicKey,
        network: PublicKey,
        cluster: ExtendedCluster,
        provider: AnchorProvider = program.provider as AnchorProvider,
        wallet: Wallet = provider.wallet
    ): Promise<GatekeeperService> {
        return new GatekeeperService(
            program,
            dataAccount,
            network,
            cluster,
            wallet,
            provider.opts
        );
    }

    static async createPassAddress(
        authority: PublicKey
    ): Promise<[PublicKey, number]> {
        return findProgramAddress(DEFAULT_PASS_SEED, authority);
    }

    issue(
        authority: PublicKey = this.getWallet().publicKey
    ): ServiceBuilder {
        const instructionPromise = this.getProgram().methods
            .issuePass()
            .accounts({
                pass: this.getDataAccount(),
                systemProgram: anchor.web3.SystemProgram.programId,
                authority,
                network: this._network,
            })
            .instruction();

        return new ServiceBuilder(this, {
            instructionPromise,
            didAccountSizeDeltaCallback: () => {
                throw new Error('Dynamic Alloc not supported');
            },
            // TODO: Implement this...
            allowsDynamicAlloc: false,
            authority,
        });
    }

    setState(
        state: PassState,
        authority: PublicKey = this.getWallet().publicKey
    ): ServiceBuilder {
        const instructionPromise = this.getProgram().methods
            .setPassState(EnumMapper.to(state, PassStateMapping))
            .accounts({
                pass: this.getDataAccount(),
                systemProgram: anchor.web3.SystemProgram.programId,
                authority,
            })
            .instruction();

        return new ServiceBuilder(this, {
            instructionPromise,
            didAccountSizeDeltaCallback: () => {
                throw new Error('Dynamic Alloc not supported');
            },
            // TODO: Implement this...
            allowsDynamicAlloc: false,
            authority,
        });
    }

    async getPassAccount(
        account: PublicKey = this.getDataAccount()
    ): Promise<PassAccount | null> {
        return this.getProgram().account.pass
            .fetchNullable(account)
            .then(PassAccount.from);
    }
}