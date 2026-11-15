#!/usr/bin/env bash
# Run a command with the database pointed at the throwaway Neon TEST branch,
# never at production.
#
#   scripts/agent/with-test-branch.sh npx prisma migrate deploy
#   scripts/agent/with-test-branch.sh npx next dev -p 3002
#
# The branch endpoint id (e.g. ep-floral-silence-ag3825z6) is read from the
# git-ignored file .agent-test-branch. Neon branches share the role password,
# so the branch URL is the production URL with the endpoint id swapped.
# The script refuses to run if the resulting URL still names production.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROD_EP="ep-green-math-agyfus79"
HOST_FILE=".agent-test-branch"

[ -f "$HOST_FILE" ] || { echo "✘ $HOST_FILE not found. Put the test branch endpoint id in it (ep-…)." >&2; exit 1; }
BRANCH_EP="$(tr -d '[:space:]' < "$HOST_FILE")"
case "$BRANCH_EP" in
  ep-*) ;;
  *) echo "✘ $HOST_FILE must contain a Neon endpoint id starting with ep-." >&2; exit 1 ;;
esac
[ "$BRANCH_EP" != "$PROD_EP" ] || { echo "✘ $HOST_FILE names the PRODUCTION endpoint. Refusing." >&2; exit 1; }

read_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
swap() { printf '%s' "$1" | sed "s/${PROD_EP}/${BRANCH_EP}/g"; }

DATABASE_URL="$(swap "$(read_env DATABASE_URL)")"
DIRECT_URL="$(swap "$(read_env DIRECT_URL)")"

for url in "$DATABASE_URL" "$DIRECT_URL"; do
  case "$url" in
    *"$PROD_EP"*) echo "✘ Resulting URL still points at production. Refusing." >&2; exit 1 ;;
    *"$BRANCH_EP"*) ;;
    *) echo "✘ Could not build the branch URL from .env. Refusing." >&2; exit 1 ;;
  esac
done

export DATABASE_URL DIRECT_URL
export PALHAK_DB_TARGET="test-branch:${BRANCH_EP}"
echo "→ database: Neon TEST branch ${BRANCH_EP} (not production)" >&2
exec "$@"
