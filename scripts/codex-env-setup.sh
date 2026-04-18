#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PNPM_VERSION="${PNPM_VERSION:-10.15.0}"
BUN_VERSION="${BUN_VERSION:-1.2.22}"
export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_elevated() {
  if has_cmd sudo; then
    sudo "$@"
    return
  fi

  "$@"
}

install_bun() {
  if has_cmd bun; then
    echo "bun already available: $(bun --version)"
    return
  fi

  if ! has_cmd curl; then
    echo "bun missing and curl unavailable; cannot install bun automatically" >&2
    exit 1
  fi

  curl -fsSL https://bun.sh/install | bash -s -- "bun-v${BUN_VERSION}"
  export PATH="$HOME/.bun/bin:$PATH"
  echo "bun installed: $(bun --version)"
}

install_rust() {
  if has_cmd cargo; then
    echo "cargo already available: $(cargo -V)"
    return
  fi

  if ! has_cmd curl; then
    echo "cargo missing and curl unavailable; cannot install rustup automatically" >&2
    exit 1
  fi

  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
  export PATH="$HOME/.cargo/bin:$PATH"
  echo "cargo installed: $(cargo -V)"
}

install_tauri_linux_deps() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    return
  fi

  if ! has_cmd apt-get; then
    echo "apt-get not available; skipping Linux Tauri native package installation"
    return
  fi

  run_elevated apt-get update
  run_elevated apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf
}

install_tauri_cli() {
  if cargo tauri -V >/dev/null 2>&1; then
    echo "tauri CLI already available: $(cargo tauri -V)"
    return
  fi

  cargo install tauri-cli --locked --version ^2
  echo "tauri CLI installed: $(cargo tauri -V)"
}

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
install_bun
install_rust
install_tauri_linux_deps
install_tauri_cli

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

pnpm desktop:doctor

echo "Codex environment setup complete: workspace dependencies resolved."
