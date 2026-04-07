#!/usr/bin/env node
/**
 * Sync GitNexus generated skills from .claude to .agents
 * Source: .claude/skills/generated/ + .claude/skills/gitnexus/
 * Target: .agents/skills/generated/ + .agents/skills/gitnexus/
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const SYNC_PAIRS = [
  ["generated", ".claude/skills/generated", ".agents/skills/generated"],
  ["gitnexus", ".claude/skills/gitnexus", ".agents/skills/gitnexus"],
];

for (const [label, src, dest] of SYNC_PAIRS) {
  if (!existsSync(src)) {
    console.log(`⏭  ${label}: source ${src} not found, skipping`);
    continue;
  }

  // Clean destination, then copy
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });

  const count = readdirSync(dest).filter((e) =>
    existsSync(join(dest, e, "SKILL.md"))
  ).length;
  console.log(`✓  ${label}: synced ${count} skills → ${dest}`);
}
