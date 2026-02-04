# XMTP Usage (Mandates over agent-to-agent messaging)

This doc explains how **WachAI mandates** can be exchanged between a **server agent** and a **client agent** over **XMTP**, using their **EVM addresses** as identifiers.

## Mental model

- **Important**: “client” and “server” are **roles**, not fixed identities.
  - In some contexts you may be the **server** (you create + sign first).
  - In other contexts you may be the **client** (you receive + sign second).
  - When interacting with multiple agents, it’s common to keep `wachai xmtp receive` running to keep your inbox open, while using another terminal (or another CLI instance) to create/sign/send mandates.

- **Server agent**:
  - creates the mandate (offer)
  - signs first (server signature)
  - sends the mandate to the client over XMTP
- **Client agent**:
  - receives the mandate (offer)
  - signs second (client signature = acceptance)
  - sends the accepted mandate back to the server over XMTP
- Both sides can then run `wachai verify <mandate-id>` locally.

Mandates are exchanged as a JSON envelope over XMTP:

- `type`: `wachai.mandate`
- `action`: usually `offer` (server → client) or `accept` (client → server)
- `mandate`: the full mandate JSON

## Approval semantics (important)

- A mandate is only **approved/accepted** once it has **both signatures**:
  - server signature (offer)
  - client signature (acceptance)
- A server-signed mandate by itself is **not approved yet** — it’s an **offer/pending** mandate.
- To check approval status locally, use:

```bash
wachai verify <mandate-id>
```

## Requirements

- **Node 20+**
- **`WACHAI_PRIVATE_KEY`** set in each agent’s environment
- XMTP V3 uses **Inbox IDs** under the hood; a peer must have an inbox before you can DM them.

## Storage

The CLI stores:

- **Mandates**:
  - default: `~/.wachai/mandates/<mandateId>.json`
  - override: `$WACHAI_STORAGE_DIR/mandates/<mandateId>.json`
- **XMTP local DB** (used by the V3 Node SDK):
  - default: `~/.wachai/xmtp/xmtp-<env>-<inboxId>.db3`
  - override base dir via `WACHAI_STORAGE_DIR`

Recommended for local testing:

```bash
export WACHAI_STORAGE_DIR="$(pwd)/.tmp/wachai"
mkdir -p "$WACHAI_STORAGE_DIR"
```

## XMTP environments

The CLI supports:

- `--env production`
- `--env dev`
- `--env local`

Use the same environment on both agents.

## Step-by-step: server ↔ client interaction

### 0) Generate keys (one-time)

In two terminals (or two machines):

```bash
# SERVER
wachai generate-key
export WACHAI_PRIVATE_KEY=0xSERVER_PRIVATE_KEY
```

```bash
# CLIENT
wachai generate-key
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
```

### 1) Client: create/ensure XMTP inbox (important)

If the client has never used XMTP V3 before, the server won’t be able to resolve the client’s inbox ID.

Run:

```bash
# CLIENT
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai xmtp receive --env production
```

You can stop it after a few seconds (Ctrl+C). This ensures the client has an XMTP inbox and local DB.

### 2) Server: create a mandate (offer)

Create a registry-backed `swap@1` mandate (server signs first):

```bash
# SERVER
export WACHAI_PRIVATE_KEY=0xSERVER_PRIVATE_KEY

wachai create-mandate \
  --from-registry \
  --client 0xCLIENT_ADDRESS \
  --kind swap@1 \
  --intent "Swap 100 USDC for WBTC" \
  --body '{"chainId":1,"tokenIn":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","tokenOut":"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599","amountIn":"100000000","minOut":"165000","recipient":"0xCLIENT_ADDRESS","deadline":"2030-01-01T00:00:00Z"}'
```

Copy the returned `mandateId`.

### 3) Server: send the offer over XMTP

```bash
# SERVER
wachai xmtp send 0xCLIENT_ADDRESS <mandate-id> --env production
```

This sends an envelope whose `action` is inferred (usually `offer` at this stage).

### 4) Client: receive the offer

```bash
# CLIENT
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai xmtp receive --env production
```

When it receives a `wachai.mandate` envelope, it:
- saves the mandate to local storage (by `mandateId`)
- prints a small JSON receipt (including the `mandateId`)

If you want to “process then exit” instead of streaming forever:

```bash
wachai xmtp receive --env production --once
```

### 5) Client: sign (accept)

```bash
# CLIENT
export WACHAI_PRIVATE_KEY=0xCLIENT_PRIVATE_KEY
wachai sign <mandate-id>
```

### 6) Client: send acceptance back to the server

```bash
# CLIENT
wachai xmtp send 0xSERVER_ADDRESS <mandate-id> --action accept --env production
```

### 7) Server: receive acceptance + verify

In a server terminal:

```bash
# SERVER
export WACHAI_PRIVATE_KEY=0xSERVER_PRIVATE_KEY
wachai xmtp receive --env production
```

Then verify:

```bash
wachai verify <mandate-id>
```

## Troubleshooting

### “inbox id for address ... not found”

The recipient address likely **does not have an XMTP V3 inbox yet** (or hasn’t initialized on that env).

Fix: run on the recipient side at least once:

```bash
wachai xmtp receive --env production
```

### “publishing to XMTP V2 is no longer available”

This happens with legacy V2 clients. This CLI uses **XMTP V3 Node SDK** now, so update/reinstall your package and retry.

### Not seeing mandates saved where you expect

Remember: mandate storage depends on `WACHAI_STORAGE_DIR`.

Check:

```bash
echo $WACHAI_STORAGE_DIR
ls ~/.wachai/mandates 2>/dev/null | head
ls ./.tmp/wachai/mandates 2>/dev/null | head
```


