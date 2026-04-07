#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const SYNC_PAIRS = [
  ["generated", resolve(ROOT, ".claude/skills/generated"), resolve(ROOT, ".agents/skills/generated")],
  ["gitnexus", resolve(ROOT, ".claude/skills/gitnexus"), resolve(ROOT, ".agents/skills/gitnexus")],
];

for (const [label, src, dest] of SYNC_PAIRS) {
  if (!existsSync(src)) {
    console.log(`⏭ ${label}: source ${src} not found, skipping`);
    continue;
  }

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });

  const count = readdirSync(dest).filter((entry) =>
    existsSync(join(dest, entry, "SKILL.md"))
  ).length;

  console.log(`✓ ${label}: synced ${count} skills → ${dest}`);
}