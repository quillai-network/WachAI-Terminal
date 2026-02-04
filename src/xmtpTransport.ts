import { isAddress } from "ethers";
import { getBytes } from "ethers";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MandateRecord } from "./storage";
import type { Signer } from "@xmtp/node-sdk";

export type XmtpEnv = "production" | "dev" | "local";

export type MandateEnvelope = {
  type: "wachai.mandate";
  version: "0.1";
  action: "offer" | "accept" | "reject" | "counter";
  mandate: MandateRecord;
  sentAt: string;
  nonce: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEnvelope(raw: string): MandateEnvelope | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(obj)) return null;
  if (obj.type !== "wachai.mandate" || obj.version !== "0.1") return null;
  if (!isPlainObject(obj.mandate)) return null;

  // Minimal structural checks; mandate-core verification happens elsewhere.
  const mandate = obj.mandate as any;
  if (typeof mandate.mandateId !== "string") return null;

  return obj as MandateEnvelope;
}

export function inferActionFromMandate(record: MandateRecord): MandateEnvelope["action"] {
  // Best-effort inference based on presence of signature slots
  const sigs = record.signatures ?? {};
  const hasServer = Object.prototype.hasOwnProperty.call(sigs, "server");
  const hasClient = Object.prototype.hasOwnProperty.call(sigs, "client");
  if (hasServer && hasClient) return "accept";
  return "offer";
}

export function normalizePeerAddress(peer: string) {
  if (!isAddress(peer)) throw new Error(`Invalid peer address: ${peer}`);
  return peer;
}

export async function createXmtpClient(params: {
  wallet: any;
  env: XmtpEnv;
}) {
  // XMTP V3: use the Node SDK (ESM). Legacy V2 publishing is no longer supported on production.
  const xmtp = await import("@xmtp/node-sdk");

  const storageBase = process.env.WACHAI_STORAGE_DIR ?? path.join(os.homedir(), ".wachai");
  const xmtpDir = path.join(storageBase, "xmtp");
  await mkdir(xmtpDir, { recursive: true });

  const address = String(params.wallet?.address ?? "");
  if (!isAddress(address)) {
    throw new Error("XMTP requires an ethers Wallet with a valid .address");
  }

  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => ({
      identifier: address,
      identifierKind: xmtp.IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string) => {
      const sigHex = await params.wallet.signMessage(message);
      return getBytes(sigHex);
    },
  };

  // Persist the XMTP DB under WACHAI_STORAGE_DIR for agent reuse across runs.
  const client = await xmtp.Client.create(signer, {
    env: params.env,
    dbPath: (inboxId) => path.join(xmtpDir, `xmtp-${params.env}-${inboxId}.db3`),
  });

  return client;
}

export async function identifierFromAddress(address: string) {
  const xmtp = await import("@xmtp/node-sdk");
  if (!isAddress(address)) throw new Error(`Invalid address: ${address}`);
  return {
    identifier: address,
    identifierKind: xmtp.IdentifierKind.Ethereum,
  };
}


