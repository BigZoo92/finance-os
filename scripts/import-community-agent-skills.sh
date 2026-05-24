#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SRC="$ROOT/.tmp/agent-sources"

mkdir -p "$SRC" "$ROOT/.claude/skills" "$ROOT/.agents/skills" "$ROOT/docs/agent-harness"

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

copy_skills_from_repo() {
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

      for target_root in "$ROOT/.claude/skills" "$ROOT/.agents/skills"; do
        rm -rf "$target_root/$dest_name"
        mkdir -p "$target_root/$dest_name"
        rsync -a --exclude ".git" "$skill_dir/" "$target_root/$dest_name/"
      done

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
    done
}

clone_or_update "claude-code-best-practice" "https://github.com/shanraisshan/claude-code-best-practice.git"
clone_or_update "jeffallan-claude-skills" "https://github.com/Jeffallan/claude-skills.git"
clone_or_update "waza" "https://github.com/tw93/Waza.git"
clone_or_update "understand-anything" "https://github.com/Lum1104/Understand-Anything.git"
clone_or_update "addy-agent-skills" "https://github.com/addyosmani/agent-skills.git"
clone_or_update "ecc" "https://github.com/affaan-m/ECC.git"
clone_or_update "mattpocock-skills" "https://github.com/mattpocock/skills.git"

for slug in \
  "claude-code-best-practice" \
  "jeffallan-claude-skills" \
  "waza" \
  "understand-anything" \
  "addy-agent-skills" \
  "ecc" \
  "mattpocock-skills"
do
  copy_skills_from_repo "$slug"
done

cat > "$ROOT/docs/agent-harness/AGENT_SKILL_SOURCES.md" <<'MD'
# Agent Skill Sources

Imported community agent/skill sources:

- shanraisshan/claude-code-best-practice
- ksimback/tech-debt-skill
- Jeffallan/claude-skills
- tw93/Waza
- Lum1104/Understand-Anything
- tirth8205/code-review-graph
- jarrodwatts/claude-hud
- letta-ai/claude-subconscious
- getagentseal/codeburn
- addyosmani/agent-skills
- affaan-m/ECC
- mattpocock/skills

Runtime locations:

- Claude Code project skills: `.claude/skills`
- Codex project skills: `.agents/skills`
- Codex project config: `.codex`
- Project instructions: `CLAUDE.md` and `AGENTS.md`

Security note: imported skills may contain scripts, hooks, or broad tool permissions. Review before trusting the workspace.
MD

echo "Imported Claude skills:"
find "$ROOT/.claude/skills" -maxdepth 2 -name SKILL.md | wc -l

echo "Imported Codex skills:"
find "$ROOT/.agents/skills" -maxdepth 2 -name SKILL.md | wc -l
