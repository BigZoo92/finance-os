#!/usr/bin/env bash
set -euo pipefail

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

ROOT="$(git rev-parse --show-toplevel)"
SRC="$ROOT/.tmp/agent-plugin-sources"

mkdir -p "$SRC" \
  "$ROOT/.claude/skills" \
  "$ROOT/.claude/commands" \
  "$ROOT/.claude/agents" \
  "$ROOT/.agents/skills" \
  "$ROOT/.codex" \
  "$ROOT/docs/agent-harness"

clone_or_update() {
  local slug="$1"
  local url="$2"
  local dir="$SRC/$slug"

  if [ -d "$dir/.git" ]; then
    git -C "$dir" pull --ff-only
  else
    git clone --depth 1 "$url" "$dir"
  fi
}

copy_skill_dir() {
  local skill_dir="$1"
  local dest_name="$2"

  python3 - "$skill_dir" "$ROOT/.claude/skills/$dest_name" "$ROOT/.agents/skills/$dest_name" <<'PY'
from pathlib import Path
import shutil
import sys

src = Path(sys.argv[1])
destinations = [Path(sys.argv[2]), Path(sys.argv[3])]

def ignore(path, names):
    return {name for name in names if name in {".git", "node_modules"}}

for dest in destinations:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest, ignore=ignore)
PY

  python3 - "$ROOT/.agents/skills/$dest_name/SKILL.md" "$dest_name" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
name = sys.argv[2]
text = path.read_text()

if text.startswith("---"):
    parts = text.split("---", 2)
    if len(parts) >= 3:
        fm = parts[1]
        body = parts[2]
        if "name:" not in fm:
            fm = f"\nname: {name}\n" + fm
        if "description:" not in fm:
            fm = fm + f"\ndescription: Imported community skill {name}. Use only when explicitly relevant.\n"
        path.write_text("---" + fm + "---" + body)
else:
    path.write_text(
        f"---\nname: {name}\ndescription: Imported community skill {name}. Use only when explicitly relevant.\n---\n\n{text}"
    )
PY
}

import_skills_from_repo() {
  local slug="$1"
  local dir="$SRC/$slug"

  find "$dir" \
    -path "*/.git" -prune -o \
    -path "*/node_modules" -prune -o \
    -name "SKILL.md" -print | while read -r skill_md; do
      local skill_dir
      local base
      local dest_name

      skill_dir="$(dirname "$skill_md")"
      base="$(basename "$skill_dir")"
      dest_name="${slug}-${base}"

      copy_skill_dir "$skill_dir" "$dest_name"
  done
}

import_commands_from_repo() {
  local slug="$1"
  local dir="$SRC/$slug"

  find "$dir" \
    -path "*/.git" -prune -o \
    -path "*/node_modules" -prune -o \
    -path "*/commands/*.md" -print | while read -r cmd; do
      local name
      name="${slug}-$(basename "$cmd")"
      cp "$cmd" "$ROOT/.claude/commands/$name"
  done
}

import_agents_from_repo() {
  local slug="$1"
  local dir="$SRC/$slug"

  find "$dir" \
    -path "*/.git" -prune -o \
    -path "*/node_modules" -prune -o \
    -path "*/agents/*.md" -print | while read -r agent; do
      local name
      name="${slug}-$(basename "$agent")"
      cp "$agent" "$ROOT/.claude/agents/$name"
  done
}

clone_or_update "jeffallan-claude-skills" "https://github.com/Jeffallan/claude-skills.git"
clone_or_update "waza" "https://github.com/tw93/Waza.git"
clone_or_update "understand-anything" "https://github.com/Lum1104/Understand-Anything.git"
clone_or_update "claude-hud" "https://github.com/jarrodwatts/claude-hud.git"
clone_or_update "addy-agent-skills" "https://github.com/addyosmani/agent-skills.git"
clone_or_update "ecc" "https://github.com/affaan-m/ECC.git"

for slug in \
  "jeffallan-claude-skills" \
  "waza" \
  "understand-anything" \
  "claude-hud" \
  "addy-agent-skills" \
  "ecc"
do
  import_skills_from_repo "$slug"
  import_commands_from_repo "$slug"
  import_agents_from_repo "$slug"
done

if [ -d "$SRC/ecc/.agents" ]; then
  python3 - "$SRC/ecc/.agents" "$ROOT/.agents" <<'PY'
from pathlib import Path
import shutil
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])

for item in src.rglob("*"):
    rel = item.relative_to(src)
    target = dst / rel

    if item.is_dir():
        target.mkdir(parents=True, exist_ok=True)
    elif not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
PY
fi

if [ -d "$SRC/ecc/.codex" ]; then
  python3 - "$SRC/ecc/.codex" "$ROOT/.codex" <<'PY'
from pathlib import Path
import shutil
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])

for item in src.rglob("*"):
    rel = item.relative_to(src)
    target = dst / rel

    if item.is_dir():
        target.mkdir(parents=True, exist_ok=True)
    elif not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
PY
fi
cat > "$ROOT/docs/agent-harness/VENDORED_AGENT_PLUGINS.md" <<'MD'
# Vendored Agent Plugins

These Claude/Codex assets were vendored from community plugin repositories because plugin marketplace installation may be unavailable on managed devices.

Imported sources:

- Jeffallan/claude-skills
- tw93/Waza
- Lum1104/Understand-Anything
- jarrodwatts/claude-hud
- addyosmani/agent-skills
- affaan-m/ECC

Runtime locations:

- `.claude/skills` for Claude project skills
- `.claude/commands` for Claude project commands when available
- `.claude/agents` for Claude project subagents when available
- `.agents/skills` for Codex project skills
- `.codex` for Codex project configuration when available

Important:

- Hooks, MCP servers, monitors, and executable bins from external plugins are not blindly enabled.
- Review imported scripts before execution.
- Prefer project-specific instructions over generic community skills.
MD

echo "Claude skills:"
find "$ROOT/.claude/skills" -maxdepth 2 -name SKILL.md | wc -l

echo "Codex skills:"
find "$ROOT/.agents/skills" -maxdepth 2 -name SKILL.md | wc -l

echo "Claude commands:"
find "$ROOT/.claude/commands" -type f | wc -l

echo "Claude agents:"
find "$ROOT/.claude/agents" -type f | wc -l
