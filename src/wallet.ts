import { HDNodeWallet, Wallet } from "ethers";

export function requirePrivateKey(): string {
  const pk = process.env.WACHAI_PRIVATE_KEY;
  if (!pk) {
    throw new Error("Missing env var WACHAI_PRIVATE_KEY");
  }
  return pk;
}

export function walletFromEnv(): Wallet {
  return new Wallet(requirePrivateKey());
}

export function generateWallet(): HDNodeWallet {
  return Wallet.createRandom();
}


