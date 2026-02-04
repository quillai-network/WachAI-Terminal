import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type MandateRecord = {
  mandateId: string;
  version: string;
  client: string;
  server: string;
  createdAt: string;
  deadline: string;
  intent: string;
  core: { kind: string; payload: unknown };
  signatures: Record<string, unknown>;
};

function mandatesDir() {
  // Override for tests/CI or custom setups (e.g. portable installs)
  // If unset, we default to ~/.wachai/mandates
  const base = process.env.WACHAI_STORAGE_DIR ?? path.join(os.homedir(), ".wachai");
  return path.join(base, "mandates");
}

function mandatePath(mandateId: string) {
  return path.join(mandatesDir(), `${mandateId}.json`);
}

export async function saveMandate(record: MandateRecord) {
  await mkdir(mandatesDir(), { recursive: true });
  await writeFile(mandatePath(record.mandateId), JSON.stringify(record, null, 2) + "\n", "utf8");
}

export async function loadMandate(mandateId: string): Promise<MandateRecord> {
  const p = mandatePath(mandateId);
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw) as MandateRecord;
}


