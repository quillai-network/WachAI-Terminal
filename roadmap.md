# WachAI Mandates CLI — Roadmap

This roadmap outlines what we can build next on top of the current TypeScript CLI, and how to support **agent-to-agent mandate exchange** (including **XMTP**).

## Current state (what works today)

- **Keygen**: `wachai generate-key` prints an EVM private key (user stores it as `WACHAI_PRIVATE_KEY`).
- **Create mandate (server)**: `wachai create-mandate` creates a mandate, **server-signs first**, stores locally, prints JSON.
  - Two modes:
    - `--from-registry` (registry-backed via `buildCore`)
    - `--custom` (no registry lookup; JSON payload)
- **Sign (client)**: `wachai sign <mandate-id>` loads stored mandate and **client-signs second**.
- **Verify**: `wachai verify <mandate-id>` verifies both signatures.
- **Storage**: local JSON files (default `~/.wachai/mandates`, override via `WACHAI_STORAGE_DIR`).
- **Pre-publish test**: `npm run smoke` and `npm pack` flow (`test.md`).

## Roadmap themes

- **Better DX**: clearer UX, robust errors, stable IO formats (JSON vs text), piping-friendly output.
- **Safer key handling**: reduce risk of leaking keys, enable better key sources.
- **Interoperability**: share/receive mandates over messaging transports (XMTP first).
- **Protocol correctness**: richer validation and schema alignment with registry specs.

---

## Phase 1 — CLI polish + stability (1–2 days)

- **Output modes**
  - `--json` (default for machine output) vs `--pretty` (human)
  - `--quiet` to suppress non-essential logs (important for piping)
- **Explicit role helpers**
  - `wachai whoami` (prints address derived from `WACHAI_PRIVATE_KEY`)
  - `wachai inspect <mandate-id>` (prints normalized summary + raw JSON)
- **Better storage commands**
  - `wachai list` (list locally stored mandateIds)
  - `wachai export <mandate-id>` (prints raw JSON)
  - `wachai import --file mandate.json` (save received mandate)
- **Versioning**
  - ensure `package.json` version is used for CLI version output
  - embed mandate/core SDK version into metadata (optional)

## Phase 2 — Validation + safety (2–4 days)

- **Registry-mode schema validation**
  - fetch JSON schema for `kind` from registry and validate payload (AJV)
  - show actionable errors (missing fields, type mismatch, additionalProperties)
  - optional “semantic” validation beyond schema:
    - EVM address checks for fields like `tokenIn`, `tokenOut`, `recipient`
    - numeric-string checks (`amountIn`, `minOut`) and bounds
    - cross-field checks (e.g., `tokenIn !== tokenOut`, deadline not in past)
- **Custom-mode safeguards**
  - enforce payload is a JSON object
  - validate `mandateId`, `createdAt`, `deadline` format
- **Signing schemes**
  - configurable signing scheme flag (default `eip191`)
  - future: support typed data (EIP-712) if mandates-core adds it
- **Key security**
  - allow `WACHAI_PRIVATE_KEY_FILE`
  - allow `--ledger` / `--trezor` later (or any EIP-1193 provider)
  - warn if `WACHAI_PRIVATE_KEY` is missing `0x` prefix or wrong length

## Phase 3 — Transport: Share/receive mandates over XMTP (agent-to-agent) (3–7 days)

### What “XMTP support” means
Two agents can exchange mandates directly:
- Server agent **creates + server-signs** a mandate, then **sends it** to the client over XMTP.
- Client agent **receives**, validates, **client-signs**, then **sends back** the accepted mandate.
- Server agent **receives acceptance**, verifies both signatures, and proceeds with execution.

### Status
- A minimal `wachai xmtp send` / `wachai xmtp receive` implementation is now in the CLI.

### Proposed CLI commands
- **`wachai xmtp init`**
  - initializes XMTP identity for the wallet in `WACHAI_PRIVATE_KEY`
  - stores XMTP keys in `WACHAI_STORAGE_DIR` (encrypted optional)
- **`wachai xmtp send <peerAddress> <mandate-id>`**
  - loads local mandate JSON
  - sends as a typed message to `peerAddress`
- **`wachai xmtp receive`**
  - tails new messages (like `follow`)
  - on mandate message: saves to local storage, prints the `mandateId`
- **`wachai xmtp request <peerAddress> --kind ... --body ...`** (optional)
  - client asks server to propose a mandate

### Message format (important for interoperability)
Use a small, versioned envelope so future clients/agents can parse reliably:

```json
{
  "type": "wachai.mandate",
  "version": "0.1",
  "action": "offer" | "accept" | "reject" | "counter",
  "mandate": { "...": "full mandate json" },
  "sentAt": "2026-02-03T12:34:56Z",
  "nonce": "ulid-or-rand"
}
```

Notes:
- **Always send full mandate JSON** (not just `mandateId`) because peers may not share storage.
- `action` indicates stage:
  - `offer`: server-signed mandate (client signature missing)
  - `accept`: server + client signatures present
- `nonce` prevents accidental duplicate handling and helps with idempotency.

### Validation on receive (recommended)
When receiving `offer`/`accept`:
- parse JSON + ensure envelope fields exist
- instantiate `Mandate` and run `verifyAll()`
- enforce role expectations:
  - `offer` should have valid server sig and **no** client sig (or client sig invalid/absent)
  - `accept` should have both valid
- store locally and print a clear summary (who, kind, deadline, intent)

### Security considerations
- XMTP messages are encrypted at the transport layer, but you still should:
  - treat mandates as sensitive (they may include addresses/amounts/deadlines)
  - verify signatures before acting
  - consider replay protection (store `nonce` per peer + mandateId)
  - optionally pin `server`/`client` expectations (don’t accept mandates from unknown senders)

### Tech choices
- Likely dependency: `@xmtp/xmtp-js` (and a v3 client if/when standard)
- Persist XMTP identity keys under `WACHAI_STORAGE_DIR/xmtp/`
- Add `--env <production|dev>` for XMTP network selection

## Phase 4 — “Two agents talking” workflow (app-level protocol) (1–2 weeks)

XMTP is the transport; we still need an **agent protocol** so two bots can coordinate:

- **Handshake**
  - exchange capabilities: supported `kind`s, max sizes, chains supported
- **Negotiation**
  - allow `counter` flow (modify minOut, deadline, recipient, fees, etc.)
- **Execution reporting**
  - send status updates (`executing`, `submitted`, `confirmed`, `failed`)
  - include tx hashes and receipts where relevant

## Phase 5 — Packaging + CI (ongoing)

- GitHub Actions
  - `typecheck`, `smoke`, lint (if added), `npm pack` validation
- Release automation
  - semantic versioning + changelog
  - publish to npm on tag

---

## Open questions (to decide before XMTP work)

- **Mandate exchange authority**: should the XMTP sender address have to match `mandate.server`/`mandate.client`?
- **Storage model**: keep file-per-id, or add an index DB (sqlite) for listing/searching?
- **Registry constraints**: should registry mode *require* schemas to validate payload strictly, or keep “best-effort”?
- **Multi-chain**: is `chainId` always required, and should we infer it from addresses / defaults?


