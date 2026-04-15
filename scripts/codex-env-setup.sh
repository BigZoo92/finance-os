#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

corepack enable
corepack prepare pnpm@10.15.0 --activate

# `gitnexus` pulls `onnxruntime-node`, whose Linux postinstall fetches optional CUDA assets
# from non-registry hosts. Codex containers do not need those GPU binaries, and the fetch can
# fail even when the rest of the workspace install is healthy.
ONNXRUNTIME_NODE_INSTALL=skip \
ONNXRUNTIME_NODE_INSTALL_CUDA=skip \
pnpm install --frozen-lockfile

# Fail early if the Codex environment missed workspace dependencies.
if [ -f scripts/verify-workspace-install.mjs ]; then
  node scripts/verify-workspace-install.mjs
else
  echo "verify-workspace-install.mjs not present on this branch yet; skipping workspace verification"
fi

echo "Codex environment setup complete: workspace dependencies resolved."
