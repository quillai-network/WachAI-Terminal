import { HDNodeWallet, Wallet } from "ethers";
import { loadWalletFile } from "./walletStore";

let warnedDeprecatedEnv = false;

export function requirePrivateKey(): string {
  const pk = process.env.WACHAI_PRIVATE_KEY;
  if (!pk) {
    throw new Error("Missing WACHAI_PRIVATE_KEY and no wallet.json configured");
  }
  return pk;
}

export async function walletFromConfig(): Promise<Wallet> {
  const pk = process.env.WACHAI_PRIVATE_KEY;
  if (pk) {
    if (!warnedDeprecatedEnv) {
      warnedDeprecatedEnv = true;
      process.stderr.write(
        "Warning: WACHAI_PRIVATE_KEY is deprecated. Use `wachai wallet init` (wallet.json) instead.\n",
      );
    }
    return new Wallet(pk);
  }
  const wf = await loadWalletFile();
  return new Wallet(wf.privateKey);
}

export function generateWallet(): HDNodeWallet {
  return Wallet.createRandom();
}


