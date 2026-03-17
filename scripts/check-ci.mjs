#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpmCommand = "pnpm";

const steps = [
  {
    name: "Install dependencies",
    args: ["install", "--frozen-lockfile"],
  },
  {
    name: "Lint",
    args: ["-r", "--if-present", "lint"],
  },
  {
    name: "Typecheck",
    args: ["-r", "--if-present", "typecheck"],
  },
  {
    name: "Test",
    args: ["-r", "--if-present", "test"],
  },
  {
    name: "Build",
    args: ["-r", "--if-present", "build"],
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.name}`);
  console.log(`${pnpmCommand} ${step.args.join(" ")}`);

  const result = spawnSync(pnpmCommand, step.args, {
    stdio: "inherit",
    shell: isWindows,
    env: {
      ...process.env,
      CI: "true",
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

console.log("\ncheck:ci completed successfully.");
