import { Command } from "commander";
import { Mandate, buildCore, caip10 } from "@quillai-network/mandates-core";
import { getAddress, isAddress } from "ethers";
import { ulid } from "ulid";
import { loadMandate, saveMandate, type MandateRecord } from "./storage";
import { generateWallet, walletFromEnv } from "./wallet";
import { DEFAULT_REGISTRY_BASE_URL, validatePayloadForKind } from "./registryValidation";
import {
  createXmtpClient,
  inferActionFromMandate,
  identifierFromAddress,
  normalizePeerAddress,
  parseEnvelope,
  type MandateEnvelope,
  type XmtpEnv,
} from "./xmtpTransport";

function requireAddress(name: string, value: string) {
  if (!isAddress(value)) throw new Error(`Invalid ${name} address: ${value}`);
  return getAddress(value);
}

function parseJsonBody<T = unknown>(raw: string, flagName = "--body"): T {
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON for ${flagName}: ${msg}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mandateToRecord(m: any): MandateRecord {
  if (m && typeof m.toJSON === "function") return m.toJSON() as MandateRecord;
  if (m && typeof m === "object") return JSON.parse(JSON.stringify(m)) as MandateRecord;
  throw new Error("Unexpected Mandate object; cannot serialize");
}

async function createSwapMandateFromRegistry(opts: {
  kind: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minOut: string;
  recipient: string;
  deadline: string;
  registryBaseUrl?: string;
}) {
  const payload = {
    chainId: opts.chainId,
    tokenIn: opts.tokenIn,
    tokenOut: opts.tokenOut,
    amountIn: opts.amountIn,
    minOut: opts.minOut,
    recipient: opts.recipient,
    deadline: opts.deadline,
  };

  const core = opts.registryBaseUrl
    ? await buildCore(opts.kind, payload, opts.registryBaseUrl)
    : await buildCore(opts.kind, payload);

  return core;
}

async function main() {
  const program = new Command();

  const intro = `WachAI Mandates are signed, verifiable agreements between a server and a client.\n` +
    `- The server creates the mandate (offer) and signs first\n` +
    `- The client signs second (accept)\n` +
    `This CLI stores mandates locally so you can sign/verify by mandateId.\n`;

  program
    .name("wachai")
    .description("WachAI mandates CLI")
    .version("0.0.1");

  program.addHelpText("beforeAll", `${intro}\n`);

  program
    .command("generate-key")
    .alias("WACHAI_GENERATE_KEY")
    .description("Generate an EVM-compatible private key (save it as WACHAI_PRIVATE_KEY)")
    .action(() => {
      const w = generateWallet();
      process.stdout.write(
        [
          `WACHAI_PRIVATE_KEY=${w.privateKey}`,
          `ADDRESS=${w.address}`,
          "",
          "Save the private key somewhere safe, then export it in your shell:",
          `export WACHAI_PRIVATE_KEY=${w.privateKey}`,
          "",
        ].join("\n"),
      );
    });

  program
    .command("create-mandate")
    .description("Create (and server-sign) a mandate as the server; stores it locally for later signing/verification")
    // Define mode flags first so help/usage shows them first
    .option("--from-registry", "Registry-backed mandate (validates kind exists; best-effort validation for known kinds)")
    .option("--custom", "Custom mandate (no registry lookup; payload must be valid JSON)")
    .requiredOption("--client <address>", "Client EVM address (recipient)")
    .requiredOption("--kind <kind>", "Core kind, e.g. swap@1 (registry mode) or any string (custom mode)")
    .option("--chain-id <number>", "EVM chainId (default: 1)", "1")
    .option(
      "--deadline <iso>",
      "Mandate/core deadline (ISO8601). Default: now + 10 minutes",
    )
    .option("--intent <text>", "Human readable intent (optional)")
    .option("--registry-base-url <url>", "Override primitives registry base URL")
    .requiredOption("--body <json>", "JSON payload body. Example: '{\"chainId\":1,...}'")
    .action(async (options) => {
      const serverWallet = walletFromEnv();
      const chainId = Number(options.chainId);
      if (!Number.isFinite(chainId) || chainId <= 0) throw new Error("Invalid --chain-id");

      const modeFromRegistry = Boolean(options.fromRegistry);
      const modeCustom = Boolean(options.custom);
      if (modeFromRegistry === modeCustom) {
        throw new Error("Choose exactly one mode: --from-registry OR --custom");
      }

      const kind: string = String(options.kind);

      const clientAddr = requireAddress("client", options.client);
      const deadline =
        options.deadline ?? new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const parsed = parseJsonBody<unknown>(String(options.body), "--body");
      if (!isPlainObject(parsed)) throw new Error("--body must be a JSON object");
      const payload: Record<string, unknown> = parsed;

      // Best-effort normalization for common fields if the user omitted them in --body
      const autofilled: string[] = [];
      if (payload.recipient == null) {
        payload.recipient = clientAddr;
        autofilled.push("recipient");
      }
      if (payload.chainId == null) {
        payload.chainId = chainId;
        autofilled.push("chainId");
      }
      if (payload.deadline == null) {
        payload.deadline = deadline;
        autofilled.push("deadline");
      }
      // Keep stdout clean (it prints JSON). Notes go to stderr for clarity.
      if (autofilled.length && modeFromRegistry) {
        process.stderr.write(
          `Note: --body was missing ${autofilled.join(", ")}; defaulted for you before registry schema validation.\n`,
        );
      }

      if (modeFromRegistry) {
        const baseUrl = options.registryBaseUrl
          ? String(options.registryBaseUrl)
          : DEFAULT_REGISTRY_BASE_URL;
        await validatePayloadForKind({ kind, payload, baseUrl });
      }

      const core = modeFromRegistry
        ? (options.registryBaseUrl
            ? await buildCore(kind, payload, String(options.registryBaseUrl))
            : await buildCore(kind, payload))
        : { kind, payload };

      const mandateId = ulid();
      const intent =
        options.intent ??
        (kind === "swap@1" && typeof payload.tokenIn === "string" && typeof payload.tokenOut === "string"
          ? `Swap ${String(payload.amountIn ?? "")} of ${payload.tokenIn} for at least ${String(payload.minOut ?? "")} of ${payload.tokenOut}`
          : `Mandate: ${kind}`);

      const m = new Mandate({
        mandateId,
        version: "0.1.0",
        client: caip10(chainId, clientAddr),
        server: caip10(chainId, serverWallet.address),
        createdAt: new Date().toISOString(),
        deadline,
        intent,
        core,
        signatures: {},
      });

      // mandates-core types this parameter as HDNodeWallet; in ethers v6 a Wallet created
      // from a raw private key is not assignable due to private-field typing differences.
      // Runtime-wise, both implement the signer methods mandates-core uses.
      await m.signAsServer(serverWallet as any, "eip191");

      const record = mandateToRecord(m);
      await saveMandate(record);

      process.stdout.write(JSON.stringify(record, null, 2) + "\n");
    });

  program
    .command("sign")
    .description("Sign a mandate as the client (requires WACHAI_PRIVATE_KEY)")
    .argument("<mandate-id>", "Mandate ID")
    .action(async (mandateId: string) => {
      const clientWallet = walletFromEnv();
      const record = await loadMandate(mandateId);
      const m = new Mandate(record as any);

      await m.signAsClient(clientWallet as any, "eip191");

      const updated = mandateToRecord(m);
      await saveMandate(updated);

      process.stdout.write(JSON.stringify(updated, null, 2) + "\n");
    });

  program
    .command("verify")
    .description("Verify both server and client signatures for a stored mandate")
    .argument("<mandate-id>", "Mandate ID")
    .action(async (mandateId: string) => {
      const record = await loadMandate(mandateId);
      const m = new Mandate(record as any);
      const res = m.verifyAll();

      process.stdout.write(JSON.stringify(res, null, 2) + "\n");

      const ok = Boolean(res?.server?.ok) && Boolean(res?.client?.ok);
      process.exitCode = ok ? 0 : 1;
    });

  const xmtp = program.command("xmtp").description("Send/receive mandates over XMTP");

  xmtp
    .command("send")
    .description("Send a stored mandate to a peer address over XMTP")
    .argument("<peer-address>", "Peer EVM address")
    .argument("<mandate-id>", "Mandate ID (must exist in local storage)")
    .option("--env <env>", "XMTP env: production|dev|local (default: production)", "production")
    .option("--action <action>", "Envelope action: offer|accept|reject|counter (default: inferred)")
    .action(async (peerAddress: string, mandateId: string, options) => {
      const env = String(options.env) as XmtpEnv;
      const peer = normalizePeerAddress(peerAddress);

      const senderWallet = walletFromEnv();
      const client = await createXmtpClient({ wallet: senderWallet as any, env });

      const record = await loadMandate(mandateId);
      const action = (options.action
        ? String(options.action)
        : inferActionFromMandate(record)) as MandateEnvelope["action"];

      const envelope: MandateEnvelope = {
        type: "wachai.mandate",
        version: "0.1",
        action,
        mandate: record,
        sentAt: new Date().toISOString(),
        nonce: ulid(),
      };

      const dm = await client.conversations.createDmWithIdentifier(await identifierFromAddress(peer));
      await dm.sendText(JSON.stringify(envelope));

      process.stdout.write(
        JSON.stringify({ ok: true, to: peer, mandateId, action, env }, null, 2) + "\n",
      );
    });

  xmtp
    .command("receive")
    .description("Stream incoming XMTP messages; saves received mandates to local storage")
    .option("--env <env>", "XMTP env: production|dev|local (default: production)", "production")
    .option("--once", "Process currently available messages then exit (no streaming)", false)
    .action(async (options) => {
      const env = String(options.env) as XmtpEnv;
      const receiverWallet = walletFromEnv();
      const client = await createXmtpClient({ wallet: receiverWallet as any, env });

      const handleMessage = async (msg: any) => {
        const raw = String(msg?.content ?? msg?.content?.text ?? "");
        const envlp = parseEnvelope(raw);
        if (!envlp) return;

        await saveMandate(envlp.mandate);
        process.stdout.write(
          JSON.stringify(
            {
              ok: true,
              received: true,
              from: msg?.senderAddress,
              action: envlp.action,
              mandateId: envlp.mandate.mandateId,
              saved: true,
            },
            null,
            2,
          ) + "\n",
        );
      };

      if (options.once) {
        const convos = await client.conversations.list();
        for (const c of convos) {
          const msgs = await c.messages();
          for (const m of msgs) await handleMessage(m);
        }
        return;
      }

      process.stderr.write("Listening for XMTP messages (Ctrl+C to stop)...\n");
      for await (const msg of await client.conversations.streamAllMessages()) {
        await handleMessage(msg);
      }
    });

  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});


