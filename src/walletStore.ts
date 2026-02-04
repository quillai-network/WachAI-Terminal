import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Wallet } from "ethers";

export type WalletFile = {
  address: string;
  privateKey: string; // 0x...
  createdAt: string;
};

export function defaultWalletPath() {
  const base = process.env.WACHAI_WALLET_PATH;
  if (base) return base;

  const storageBase = process.env.WACHAI_STORAGE_DIR ?? path.join(os.homedir(), ".wachai");
  return path.join(storageBase, "wallet.json");
}

export async function loadWalletFile(p = defaultWalletPath()): Promise<WalletFile> {
  const raw = await readFile(p, "utf8");
  const parsed = JSON.parse(raw) as WalletFile;
  if (!parsed?.privateKey || !parsed?.address) {
    throw new Error(`Invalid wallet file: ${p}`);
  }
  return parsed;
}

export async function saveWalletFile(w: WalletFile, p = defaultWalletPath()) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(w, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  // Best-effort: ensure correct perms even if file already existed.
  try {
    await chmod(p, 0o600);
  } catch {
    // ignore on platforms/filesystems that don't support chmod as expected
  }
}

export async function ensureWalletPermissions(p = defaultWalletPath()) {
  // Best-effort warning hook for permissive files.
  try {
    const s = await stat(p);
    // eslint-disable-next-line no-bitwise
    const mode = s.mode & 0o777;
    return { mode };
  } catch {
    return null;
  }
}

export async function createAndStoreWallet(p = defaultWalletPath()) {
  const w = Wallet.createRandom();
  const file: WalletFile = {
    address: w.address,
    privateKey: w.privateKey,
    createdAt: new Date().toISOString(),
  };
  await saveWalletFile(file, p);
  return { wallet: w, path: p };
}

export async function importAndStorePrivateKey(privateKey: string, p = defaultWalletPath()) {
  const w = new Wallet(privateKey);
  const file: WalletFile = {
    address: w.address,
    privateKey: w.privateKey,
    createdAt: new Date().toISOString(),
  };
  await saveWalletFile(file, p);
  return { wallet: w, path: p };
}


