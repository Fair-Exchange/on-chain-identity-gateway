import { Command, flags } from "@oclif/command";
import { GatewayToken } from "../contracts/GatewayToken";
import { BaseProvider } from '@ethersproject/providers';
import {
		privateKeyFlag,
		gatewayTokenAddressFlag,
		networkFlag,
		gasPriceFeeFlag,
		confirmationsFlag,
} from "../utils/flags";
import { TxBase } from "../utils/tx";
import { BigNumber, utils, Wallet } from "ethers";
import { mnemonicSigner, privateKeySigner } from "../utils/signer";

export default class UnfreezeToken extends Command {
	static description = "Unfreeze existing identity token using TokenID";

	static examples = [
		`$ gateway unfreeze 10
		`,
	];

	static flags = {
		help: flags.help({ char: "h" }),
		privateKey: privateKeyFlag(),
		gatewayTokenAddress: gatewayTokenAddressFlag(),
		network: networkFlag(),
		gasPriceFee: gasPriceFeeFlag(),
		confirmations: confirmationsFlag(),
	};

	static args = [
		{
			name: "tokenID",
			required: true,
			description: "Token ID number to unfreeze",
			parse: (input: any) => Number(input),
		},
	];

	async run() {
		const { args, flags } = this.parse(UnfreezeToken);

		let pk = flags.privateKey;
		const provider:BaseProvider = flags.network;
		let signer: Wallet
		const confirmations = flags.confirmations;

		if (utils.isValidMnemonic(pk)) {
			signer = mnemonicSigner(pk, provider)
		} else {
			signer = privateKeySigner(pk, provider)
		}
		
		const tokenID: number = args.tokenID;
		const gatewayTokenAddress: string = flags.gatewayTokenAddress;

		this.log(`Unfreezing existing token with TokenID:
			${tokenID} 
			on GatewayToken ${gatewayTokenAddress} contract`);
		
		const gatewayToken = new GatewayToken(signer, gatewayTokenAddress);

		let gasPrice = await flags.gasPriceFee;
		let gasLimit = await gatewayToken.contract.estimateGas.unfreeze(tokenID);

		let txParams: TxBase = {
			gasLimit: gasLimit,
			gasPrice: BigNumber.from(utils.parseUnits(String(gasPrice), 'gwei') ),
		};

		let tx: any;
		if (confirmations > 0) {
			tx = await(await gatewayToken.unfreeze(tokenID, txParams)).wait(confirmations);
		} else {
			tx = await gatewayToken.unfreeze(tokenID, txParams);
		}

		this.log(
			`Unfreezed existing token with TokenID: ${tokenID} TxHash: ${(confirmations > 0) ? tx.transactionHash : tx.hash}`
		);
	}
}