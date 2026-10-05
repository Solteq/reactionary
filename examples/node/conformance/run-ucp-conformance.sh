#!/usr/bin/env bash
# Runs the official UCP conformance suite against the reactionary UCP server.
#
# Everything Python lives inside a Docker image (see Dockerfile); the host only
# needs Docker, Node and the workspace's .env with commercetools credentials.
#
# Usage:
#   examples/node/conformance/run-ucp-conformance.sh [--refresh] [pytest args]
#
#   --refresh   re-clone the latest conformance suite into the image
#   pytest args are passed through, e.g. checkout_lifecycle_test.py -k totals
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PORT="${UCP_CONFORMANCE_PORT:-8787}"
IMAGE=reactionary-ucp-conformance
REPORT="$ROOT/tmp/ucp-conformance-report.txt"

REFRESH=0
PYTEST_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--refresh" ]; then
    REFRESH="$(date +%s)"
  else
    PYTEST_ARGS+=("$arg")
  fi
done

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }

echo "Building conformance image..."
docker build --quiet --build-arg "REFRESH=$REFRESH" -t "$IMAGE" "$SCRIPT_DIR"

# Start the UCP express server against commercetools only, listening on all
# interfaces and advertising a discovery endpoint the container can reach.
export ENABLED_COMMERCETOOLS=true
export ENABLED_FAKE=false ENABLED_MAGENTO=false ENABLED_MEDUSA=false
export ENABLED_ALGOLIA=false ENABLED_MEILISEARCH=false ENABLED_UNOMI=false
export UCP_HOST=0.0.0.0
export UCP_PORT="$PORT"
export UCP_ENDPOINT="http://host.docker.internal:$PORT/ucp"
export UCP_PAYMENT_HANDLERS_JSON='{"dev.reactionary.manual":[{"version":"2026-08-25","id":"manual"}],"com.stripe":[{"version":"2026-08-25","id":"stripe"}]}'

echo "Starting UCP server on port $PORT..."
cd "$ROOT/examples/node"
node --loader @swc-node/register/esm src/ucp-express-server.ts &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/.well-known/ucp" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/.well-known/ucp" >/dev/null \
  || { echo "UCP server did not become ready on port $PORT" >&2; exit 1; }

mkdir -p "$ROOT/tmp"
echo "Running conformance suite (report: $REPORT)..."
set +e
docker run --rm \
  -e SERVER_URL="http://host.docker.internal:$PORT" \
  "$IMAGE" ${PYTEST_ARGS[@]+"${PYTEST_ARGS[@]}"} | tee "$REPORT"
EXIT_CODE=${PIPESTATUS[0]}
set -e

echo "Conformance run finished with exit code $EXIT_CODE"
exit "$EXIT_CODE"
