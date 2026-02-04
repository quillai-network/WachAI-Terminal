# wachai (Mandates CLI)

A small command-line utility for creating, signing, and verifying **WachAI Mandates** using the TypeScript Mandates Core SDK.

## Install (dev)

```bash
npm install
npm run build
node dist/cli.js --help
```

## Test (before publishing)

Run an end-to-end smoke test (create mandate → client sign → verify):

```bash
npm run typecheck
npm run smoke
```

This test writes mandates into `./.tmp/wachai` via `WACHAI_STORAGE_DIR` so it won’t touch your home directory.

When published, you’ll use:

```bash
npm install -g wachai
wachai --help
```

## Environment

You only need one env var:

- **`WACHAI_PRIVATE_KEY`**: an EVM-compatible private key (0x…)

Generate one:

```bash
wachai generate-key
```

Then export it:

```bash
export WACHAI_PRIVATE_KEY=0xabc...
```

## Commands

### `wachai create-mandate ...` (server)

Creates a mandate, signs as **server**, stores it locally, and prints the mandate JSON.

There are two modes:
- **Registry-backed** (`--from-registry`): resolves `--kind` via the primitives registry and performs best-effort validation for known kinds (like `swap@1`).
- **Custom** (`--custom`): no registry lookup; your `--body` just needs to be valid JSON.

```bash
wachai create-mandate \
  --from-registry \
  --client 0xCLIENT \
  --kind swap@1 \
  --intent "Swap 100 USDC for WBTC" \
  --body '{"chainId":1,"tokenIn":"0x...","tokenOut":"0x...","amountIn":"100000000","minOut":"165000","recipient":"0x...","deadline":"2025-12-31T00:00:00Z"}'
```

Custom example:

```bash
wachai create-mandate \
  --custom \
  --client 0xCLIENT \
  --kind "content" \
  --intent "Demo custom mandate" \
  --body '{"any":"json","you":"want"}'
```

Notes:
- Mandates are stored at **`~/.wachai/mandates/<mandateId>.json`**.

### `wachai sign <mandate-id>` (client)

Loads a stored mandate, signs as **client**, stores the updated mandate, and prints it.

```bash
wachai sign 01J9X9A3T3DMD3M3CYAJW1Y0SZ
```

### `wachai verify <mandate-id>`

Loads a stored mandate and verifies **both** server and client signatures.

```bash
wachai verify 01J9X9A3T3DMD3M3CYAJW1Y0SZ
```

Returns exit code `0` only if both are valid.

## XMTP (agent-to-agent sharing)

You can send/receive mandates over **XMTP** using EVM addresses.

**Note**: a mandate is only considered **approved** once it is signed by **both** parties (server offer + client acceptance). A server-signed mandate alone is just an **offer**.

### Agent B (client) listens

```bash
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai xmtp receive --env production
```

### Agent A (server) sends an offer

```bash
export WACHAI_PRIVATE_KEY=0xSERVER_PRIVATE_KEY
wachai xmtp send 0xCLIENT_ADDRESS <mandate-id> --env production
```

When the client receives it, the mandate is **saved locally** (by `mandateId`). The client can then sign and send acceptance back:

```bash
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai sign <mandate-id>
wachai xmtp send 0xSERVER_ADDRESS <mandate-id> --action accept --env production
```

For options:

```bash
wachai xmtp --help
```

## Registry

By default, `--from-registry` uses the public primitives registry referenced by the Mandates Core SDK.
You can override the base URL:

```bash
wachai create-mandate \
  --from-registry \
  --client 0xCLIENT \
  --kind swap@1 \
  --registry-base-url https://... \
  --body '{"chainId":1,"tokenIn":"0x...","tokenOut":"0x...","amountIn":"1","minOut":"1","recipient":"0x...","deadline":"2025-12-31T00:00:00Z"}'
```


