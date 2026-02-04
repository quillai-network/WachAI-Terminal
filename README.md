# WachAI Terminal (`wachai`)

When agents move past simple conversations and start doing **commerce**, they need **deterministic agreements** they can both rely on:
- what was offered,
- what was accepted,
- and cryptographic proof that both parties agreed.

**WachAI mandates** are those deterministic agreement objects.  
**WachAI Terminal** is a command-line utility to **create**, **sign**, **verify**, and **share** mandates over **XMTP**.

## Install

### Global (when published)

```bash
npm install -g wachai
wachai --help
```

### From source (dev)

```bash
npm install
npm run build
node dist/cli.js --help
```

## Keys (required)

This CLI uses a single environment variable:

- **`WACHAI_PRIVATE_KEY`**: an EVM-compatible private key (`0x...`)

Generate one:

```bash
wachai generate-key
```

Then export it:

```bash
export WACHAI_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

Keep it safe:
- don’t commit it
- don’t paste it into screenshots/logs
- prefer a dedicated key for testing

## Storage

Mandates are stored locally so you can reference them by `mandateId`:

- default: `~/.wachai/mandates/<mandateId>.json`
- override: set `WACHAI_STORAGE_DIR` (recommended for testing)

```bash
export WACHAI_STORAGE_DIR="$(pwd)/.tmp/wachai"
mkdir -p "$WACHAI_STORAGE_DIR"
```

## Core flow: create → sign → verify

### Create mandate (server role)

The creator is the **server role** (signs first). A mandate is only **approved** once it has **both** signatures (server offer + client acceptance).

`create-mandate` has two modes:
- **`--from-registry`**: resolves `--kind` via the public primitives registry and validates `--body` against that primitive’s JSON schema.
- **`--custom`**: no registry lookup; `--body` must be valid JSON (object).

Registry-backed example (`swap@1`):

```bash
wachai create-mandate \
  --from-registry \
  --client 0xCLIENT_ADDRESS \
  --kind swap@1 \
  --intent "Swap 100 USDC for WBTC" \
  --body '{"chainId":1,"tokenIn":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","tokenOut":"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599","amountIn":"100000000","minOut":"165000","recipient":"0xCLIENT_ADDRESS","deadline":"2030-01-01T00:00:00Z"}'
```

Custom example:

```bash
wachai create-mandate \
  --custom \
  --client 0xCLIENT_ADDRESS \
  --kind "content" \
  --intent "Demo custom mandate" \
  --body '{"message":"hello","priority":3}'
```

### Sign mandate (client role)

The signer is the **client role** (signs second):

```bash
wachai sign <mandate-id>
```

### Verify mandate

Verifies both signatures (exit code `0` only if both are valid):

```bash
wachai verify <mandate-id>
```

## XMTP: share mandates between agents

You can exchange mandates over **XMTP** using EVM addresses.

Practical workflow when running two agents:
- keep one terminal open running `wachai xmtp receive` (your “inbox”)
- use another terminal to create/sign/send mandates

### Agent B (receiver/client) — keep inbox open

```bash
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai xmtp receive --env production
```

### Agent A (sender/server) — send a mandate by receiver address

You need:
- the receiver’s **public address** (`0x...`)
- a local `mandateId` you created via `create-mandate`

```bash
export WACHAI_PRIVATE_KEY=0xSERVER_PRIVATE_KEY
wachai xmtp send 0xCLIENT_ADDRESS <mandate-id> --env production
```

When the receiver gets it, it’s saved locally by `mandateId`. They can then:

```bash
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai sign <mandate-id>
wachai xmtp send 0xSERVER_ADDRESS <mandate-id> --action accept --env production
```

More details: see `XMTPUsage.md`.

## Test (before publishing)

End-to-end smoke test (create → sign → verify):

```bash
npm run typecheck
npm run smoke
```


