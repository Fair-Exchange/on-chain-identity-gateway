// import { GatekeeperService } from '@identity.com/gateway-solana-client';
import { GatekeeperService } from '@identity.com/gateway-solana-client';
import { Command, Flags } from '@oclif/core';
import { Keypair, PublicKey } from '@solana/web3.js';
import fsPromises from 'node:fs/promises';
import { Wallet } from '@project-serum/anchor';
import { ExtendedCluster } from '@identity.com/gateway-solana-client/dist/lib/connection';

export default class Expire extends Command {
  static description = 'Expires a gateway pass';

  static examples = [
    `$ gateway pass expire --subject [address] --network [address] --gatekeeper [address] --funder [path to keypair] --cluster [cluster type]
`,
  ];

  static flags = {
    subject: Flags.string({
      char: 's',
      description: 'Pubkey to which a pass shall be issued',
      required: true,
    }),
    network: Flags.string({
      char: 'n',
      description: "String representing the network's address",
      required: true,
    }),
    gatekeeper: Flags.string({
      char: 'g',
      description: "String representing the gatekeeper's address",
      required: true,
    }),
    funder: Flags.string({
      char: 'f',
      description: 'Path to a solana keypair',
      required: true,
    }),
    cluster: Flags.string({
      char: 'c',
      description: 'The cluster you wish to use',
      required: true,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Expire);

    const subject = new PublicKey(flags.subject);
    const network = new PublicKey(flags.network);
    const gatekeeper = new PublicKey(flags.gatekeeper);
    const cluster =
      flags.cluster === 'localnet' ||
      flags.cluster === 'devnet' ||
      flags.cluster === 'mainnet' ||
      flags.cluster === 'civicnet' ||
      flags.cluster === 'testnet'
        ? flags.cluster
        : 'localnet';
    const localSecretKey = flags.funder
      ? await fsPromises.readFile(`${__dirname}/${flags.funder}`)
      : await fsPromises.readFile(
          `${__dirname}/../../../keypairs/gatekeeper-authority.json`
        );

    const privateKey = Uint8Array.from(JSON.parse(localSecretKey.toString()));
    const authorityKeypair = Keypair.fromSecretKey(privateKey);

    const authorityWallet = new Wallet(authorityKeypair);

    const gatekeeperService = await GatekeeperService.build(
      network,
      gatekeeper,
      { wallet: authorityWallet, clusterType: cluster as ExtendedCluster }
    );

    const account = await GatekeeperService.createPassAddress(subject, network);
    const expiredPassSignature = await gatekeeperService
      .expirePass(account, authorityKeypair.publicKey)
      .rpc();
    this.log(`Pass Expire TX Signature: ${expiredPassSignature}`);
  }
}
