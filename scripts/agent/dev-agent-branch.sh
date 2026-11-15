#!/usr/bin/env bash
# Dev server for testing the AI agent safely: http://localhost:3002, database =
# the Neon TEST branch (see with-test-branch.sh), never production.
#
# By default the "AI model" is the scripted mock that tests/agent.spec.ts starts
# on port 4010, so no API key is needed and no money is spent.
# To talk to the real model instead (reads ANTHROPIC_API_KEY from .env):
#   AGENT_REAL_MODEL=1 scripts/agent/dev-agent-branch.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

export NEXTAUTH_URL="http://localhost:3002"
# The test suite sends far more requests than a person would.
export AGENT_RATE_PER_MINUTE="${AGENT_RATE_PER_MINUTE:-500}"
export AGENT_RATE_PER_DAY="${AGENT_RATE_PER_DAY:-100000}"
if [ "${AGENT_REAL_MODEL:-0}" != "1" ]; then
  export ANTHROPIC_API_KEY="mock-key-not-real"
  export AGENT_API_BASE_URL="http://127.0.0.1:4010"
  echo "→ AI model: scripted mock on :4010" >&2
else
  unset AGENT_API_BASE_URL || true
  echo "→ AI model: REAL (ANTHROPIC_API_KEY from env files)" >&2
fi
exec scripts/agent/with-test-branch.sh npx next dev -p 3002
