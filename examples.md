# Examples: create → sign → verify

These examples assume you installed the CLI (or are running it via `node dist/cli.js` after `npm run build`).

Mandates are stored locally under `~/.wachai/mandates/<mandateId>.json` (or override with `WACHAI_STORAGE_DIR`).

## 0) Generate keys (server + client)

In **two terminals** (or copy/paste values), set up a key for each role.

```bash
# SERVER terminal
wachai wallet init
wachai wallet info
```

```bash
# CLIENT terminal
wachai wallet init
wachai wallet info
```

You’ll also need the **client address** (`0x...`) for `--client`.

Tip: if you want these two roles on the same machine, set different `WACHAI_STORAGE_DIR` values in each terminal so each uses its own `wallet.json`.

---

## Example A: Registry-backed mandate (`--from-registry`)

This mode:
- checks `--kind` exists in the primitives registry
- validates `--body` against the primitive JSON schema

Create a `swap@1` offer as the **server**:

```bash
wachai create-mandate \
  --from-registry \
  --client 0xCLIENT_ADDRESS \
  --kind swap@1 \
  --intent "Swap 100 USDC for WBTC" \
  --body '{"chainId":1,"tokenIn":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","tokenOut":"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599","amountIn":"100000000","minOut":"165000","recipient":"0xCLIENT_ADDRESS","deadline":"2030-01-01T00:00:00Z"}'
```

Copy the returned `mandateId`, then sign as the **client**:

```bash
wachai sign <mandate-id>
```

Verify both signatures:

```bash
wachai verify <mandate-id>
```

### Registry references
- Registry: `https://raw.githubusercontent.com/quillai-network/mandate-specs/main/spec/primitives/registry.json`
- Schema (swap@1): `https://raw.githubusercontent.com/quillai-network/mandate-specs/main/spec/primitives/swap/swap@1.schema.json`

---

## Example B: Custom mandate (`--custom`)

This mode:
- does **not** use the primitives registry
- only requires that `--body` is valid JSON (object)

Create as the **server**:

```bash
wachai create-mandate \
  --custom \
  --client 0xCLIENT_ADDRESS \
  --kind "content" \
  --intent "Demo custom mandate" \
  --body '{"message":"hello from the server","priority":3,"tags":["demo"]}'
```

Then client signs + verify (same commands as above):

```bash
wachai sign <mandate-id>
wachai verify <mandate-id>
```

---

## Tip: Use a temporary storage dir (clean testing)

```bash
export WACHAI_STORAGE_DIR="$(pwd)/.tmp/wachai"
mkdir -p "$WACHAI_STORAGE_DIR"
```

---

## XMTP (agent-to-agent) sketch

You can exchange mandates over XMTP using wallet addresses.

### Agent B (client) listens

```bash
wachai xmtp receive --env production
```

### Agent A (server) sends an offer

```bash
wachai xmtp send 0xCLIENT_ADDRESS <mandate-id> --env production
```

When Agent B receives it, it will store the mandate locally (by `mandateId`). Then Agent B can sign:

```bash
wachai sign <mandate-id>
```

And send back acceptance:

```bash
wachai xmtp send 0xSERVER_ADDRESS <mandate-id> --action accept --env production
```


