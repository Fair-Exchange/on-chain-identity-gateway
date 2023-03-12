import { Commitment, PublicKey } from "@solana/web3.js";

export const REGISTER = "./register.csv";

// Should equal the contents of solana/program/program-id.md
export const PROGRAM_ID: PublicKey = new PublicKey(
  "gatQYMRPQ6aRJy4wp2JU6hiC2q6kcsQrKvD9Fp1ACmc"
);
export const SOLANA_COMMITMENT: Commitment = "confirmed";