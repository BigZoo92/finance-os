#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

corepack enable
corepack prepare pnpm@10.15.0 --activate

# Match repo CI install semantics exactly. From the workspace root, `-w` is redundant.
pnpm install --frozen-lockfile

# Fail early if the Codex environment missed workspace dependencies.
if [ -f scripts/verify-workspace-install.mjs ]; then
  node scripts/verify-workspace-install.mjs
else
  echo "verify-workspace-install.mjs not present on this branch yet; skipping workspace verification"
fi

echo "Codex environment setup complete: workspace dependencies resolved."
