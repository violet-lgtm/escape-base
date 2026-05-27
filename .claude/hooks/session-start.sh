#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
#
# The web container is ephemeral and starts with no node_modules (it's
# gitignored), so install the pnpm workspace dependencies before the session
# begins. That way tests, typecheck, formatting and the build are ready to run
# immediately.

# Only needed in the remote web container; local sessions already have deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# --frozen-lockfile is reproducible and idempotent, and stays cache-friendly:
# pnpm hardlinks from its global store rather than reinstalling from scratch.
pnpm install --frozen-lockfile
