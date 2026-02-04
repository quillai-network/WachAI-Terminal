# As-published CLI test (pre-publish)

This verifies the exact experience users will get from an npm install, without actually publishing.

## Prereqs

- Node.js installed
- From this repo root: `npm install` has been run at least once

## 1) Build the bundle

```bash
npm run build
```

## 2) Create a tarball (what npm would publish)

```bash
npm pack
```

This will produce a file like `wachai-0.0.1.tgz`.

## 3) Install the tarball globally

```bash
npm i -g ./wachai-0.0.1.tgz
```

## 4) Confirm the binary runs

```bash
wachai --help
```

## 5) Optional: end-to-end run (create → sign → verify)

Generate two keys (server + client) and export them in two shells (or copy/paste as needed).

**Server (creates + signs first):**

```bash
wachai wallet init
wachai wallet info
```

**Client (signs second):**

```bash
wachai wallet init
wachai wallet info
```

Create a mandate as the server (custom mode), including an `--intent`:

```bash
# in the SERVER shell
wachai create-mandate \
  --custom \
  --client 0xCLIENT_ADDRESS \
  --kind swap@1 \
  --intent "Swap 100 USDC for WBTC" \
  --body '{"chainId":1,"tokenIn":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","tokenOut":"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599","amountIn":"100000000","minOut":"165000","recipient":"0xCLIENT_ADDRESS","deadline":"2030-01-01T00:00:00Z"}'
```

Copy the returned `mandateId`, then sign as the client:

```bash
# in the CLIENT shell
wachai sign <mandate-id>
```

Finally, verify:

```bash
wachai verify <mandate-id>
```

## Cleanup

Uninstall the global install:

```bash
npm rm -g wachai
```


