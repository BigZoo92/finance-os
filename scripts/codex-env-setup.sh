#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

corepack enable
corepack prepare pnpm@10.15.0 --activate

# Match repo CI install semantics exactly. From the workspace root, `-w` is redundant.
pnpm install --frozen-lockfile

# Fail early if the Codex environment missed workspace dependencies.
node scripts/verify-workspace-install.mjs

echo "Codex environment setup complete: workspace dependencies resolved."
