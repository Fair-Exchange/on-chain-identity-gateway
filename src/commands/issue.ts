import { Command, flags } from "@oclif/command";
import { BigNumber, utils, Wallet } from "ethers";
import { GatewayToken } from "../contracts/GatewayToken";
import { BaseProvider } from '@ethersproject/providers';
import {
		privateKeyFlag,
		gatewayTokenAddressFlag,
		networkFlag,
		gasPriceFeeFlag,
		confirmationsFlag,
		generateTokenIdFlag,
		bitmaskFlag,
		tokenIdFlag,
} from "../utils/flags";
import { TxBase } from "../utils/tx";
import { mnemonicSigner, privateKeySigner } from "../utils/signer";
import { generateTokenId } from "../utils/tokenId";

export default class IssueToken extends Command {
	static description = "Issue new identity token with TokenID for Ethereum address";

	static examples = [
		`$ gateway issue 0x893F4Be53274353CD3379C87C8fd1cb4f8458F94 -i <TokenID>
		`,
	];

	static flags = {
		help: flags.help({ char: "h" }),
		privateKey: privateKeyFlag(),
		gatewayTokenAddress: gatewayTokenAddressFlag(),
		network: networkFlag(),
		gasPriceFee: gasPriceFeeFlag(),
		confirmations: confirmationsFlag(),
		generateTokenId: generateTokenIdFlag,
		bitmask: bitmaskFlag(),
		tokenID: tokenIdFlag(),
	};

	static args = [
		{
			name: "address",
			required: true,
			description: "Owner ethereum address to tokenID for",
			parse: (input: string) => utils.isAddress(input) ? input : null,
		},
		{
			name: "expiration",
			required: false,
			description: "Expiration timestamp for newly issued token",
			parse: (input: any) => Number(input),
		},
	];

	async run() {
		const { args, flags } = this.parse(IssueToken);

		let pk = flags.privateKey;
		const provider:BaseProvider = flags.network;
		let signer: Wallet
		const confirmations = flags.confirmations;
		let tx:any;

		if (utils.isValidMnemonic(pk)) {
			signer = mnemonicSigner(pk, provider)
		} else {
			signer = privateKeySigner(pk, provider)
		}

		let tokenID: BigNumber | number = flags.tokenID;
		const generateId: boolean = flags.generateTokenId;
		const bitmask: Uint8Array = flags.bitmask;
		const ownerAddress: string = args.address;
		const expiration: number = args.expiration;
		const gatewayTokenAddress: string = flags.gatewayTokenAddress;

		const gatewayToken = new GatewayToken(signer, gatewayTokenAddress);

		if (generateId && tokenID == null) {
			tokenID = generateTokenId(ownerAddress, bitmask);
		}

		let gasPrice = await flags.gasPriceFee;
		let gasLimit: BigNumber 

		if (expiration != null) {
			gasLimit = await gatewayToken.contract.estimateGas.mintWithExpiration(ownerAddress, tokenID, expiration);
		} else {
			gasLimit = await gatewayToken.contract.estimateGas.mint(ownerAddress, tokenID);
		}

		let txParams: TxBase = {
			gasLimit: gasLimit,
			gasPrice: BigNumber.from(utils.parseUnits(String(gasPrice), 'gwei') ),
		};

		this.log(`Issuing new token with TokenID:
			${tokenID} 
			for owner ${ownerAddress}
			on GatewayToken ${gatewayTokenAddress} contract`
		);

		if (confirmations > 0) {
			tx = await(await gatewayToken.mint(ownerAddress, tokenID, expiration, txParams)).wait(confirmations);
		} else {
			tx = await gatewayToken.mint(ownerAddress, tokenID, expiration, txParams);
		}

		this.log(
			`Issued new token with TokenID: ${tokenID} to ${ownerAddress} TxHash: ${(confirmations > 0) ? tx.transactionHash : tx.hash}`
		);
	}
}