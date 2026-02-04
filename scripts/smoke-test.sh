#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> building"
npm run -s build >/dev/null

echo "==> generating ephemeral server/client wallets"
SERVER_JSON="$(node -e 'const { Wallet } = require("ethers"); const w = Wallet.createRandom(); console.log(JSON.stringify({ privateKey: w.privateKey, address: w.address }));')"
CLIENT_JSON="$(node -e 'const { Wallet } = require("ethers"); const w = Wallet.createRandom(); console.log(JSON.stringify({ privateKey: w.privateKey, address: w.address }));')"

SERVER_PK="$(node -p 'JSON.parse(process.argv[1]).privateKey' "$SERVER_JSON")"
SERVER_ADDR="$(node -p 'JSON.parse(process.argv[1]).address' "$SERVER_JSON")"
CLIENT_PK="$(node -p 'JSON.parse(process.argv[1]).privateKey' "$CLIENT_JSON")"
CLIENT_ADDR="$(node -p 'JSON.parse(process.argv[1]).address' "$CLIENT_JSON")"

echo "    server=$SERVER_ADDR"
echo "    client=$CLIENT_ADDR"

# Mainnet USDC / WBTC addresses (just to satisfy address validation)
TOKEN_IN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
TOKEN_OUT="0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
AMOUNT_IN="100000000"
MIN_OUT="165000"

export WACHAI_STORAGE_DIR="$ROOT/.tmp/wachai"
mkdir -p "$WACHAI_STORAGE_DIR"

echo "==> creating + server-signing mandate (offline core: --no-from-registry)"
MANDATE_JSON="$(
  WACHAI_PRIVATE_KEY="$SERVER_PK" \
    node dist/cli.js create-mandate \
      --custom \
      --client "$CLIENT_ADDR" \
      --kind "swap@1" \
      --body "{\"chainId\":1,\"tokenIn\":\"$TOKEN_IN\",\"tokenOut\":\"$TOKEN_OUT\",\"amountIn\":\"$AMOUNT_IN\",\"minOut\":\"$MIN_OUT\",\"recipient\":\"$CLIENT_ADDR\",\"deadline\":\"2030-01-01T00:00:00Z\"}"
)"

MANDATE_ID="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(m.mandateId);' <<<"$MANDATE_JSON")"
echo "    mandateId=$MANDATE_ID"

echo "==> client-signing mandate"
WACHAI_PRIVATE_KEY="$CLIENT_PK" node dist/cli.js sign "$MANDATE_ID" >/dev/null

echo "==> verifying both signatures"
node dist/cli.js verify "$MANDATE_ID" >/dev/null

echo "✅ smoke test passed"


