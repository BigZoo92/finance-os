#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";

export const DESKTOP_SCOPE_RULES = [
  {
    type: "prefix",
    value: "apps/desktop/",
    reason: "desktop shell files changed",
  },
  {
    type: "exact",
    value: "apps/web/package.json",
    reason: "web build dependencies changed",
  },
  {
    type: "exact",
    value: "apps/web/vite.config.ts",
    reason: "web build config changed",
  },
  {
    type: "prefix",
    value: "apps/web/public/",
    reason: "web public assets are copied into the desktop bundle",
  },
  {
    type: "exact",
    value: "package.json",
    reason: "root CI/build commands changed",
  },
  {
    type: "exact",
    value: ".github/workflows/ci.yml",
    reason: "CI desktop lane changed",
  },
  {
    type: "exact",
    value: "scripts/check-ci.mjs",
    reason: "local CI orchestration changed",
  },
  {
    type: "exact",
    value: "scripts/codex-env-setup.sh",
    reason: "Codex environment bootstrap changed",
  },
];

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function parseFileList(output) {
  return unique(
    String(output ?? "")
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean),
  );
}

function parseStatusPaths(output) {
  return unique(
    String(output ?? "")
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .flatMap((line) => {
        const statusLine = line.slice(3).trim();
        const renamed = statusLine.split(" -> ").map(normalizePath).filter(Boolean);
        return renamed.length > 0 ? renamed : [normalizePath(statusLine)];
      }),
  );
}

function listFilesFromDiff(base, head, { symmetric = false } = {}) {
  if (!base || !head) return null;
  const range = symmetric ? `${base}...${head}` : `${base}..${head}`;
  const output = runGit(["diff", "--name-only", range], { allowFailure: true });
  if (output == null) return null;
  return parseFileList(output);
}

function listFilesFromCommit(commit) {
  if (!commit) return null;
  const output = runGit(["show", "--pretty=", "--name-only", commit], {
    allowFailure: true,
  });
  if (output == null) return null;
  return parseFileList(output);
}

function listLocalChangedFiles(baseRef = process.env.FINANCE_OS_DESKTOP_BASE_REF || "origin/main") {
  const statusOutput = runGit(["status", "--porcelain=v1", "--untracked-files=all"], {
    allowFailure: true,
  });

  if (statusOutput == null) {
    return {
      files: null,
      source: "local",
      reason: "git status failed",
    };
  }

  const worktreeFiles = parseStatusPaths(statusOutput);
  if (worktreeFiles.length > 0) {
    return {
      files: worktreeFiles,
      source: "local-worktree",
      reason: "Using current worktree changes.",
    };
  }

  const hasBaseRef = runGit(["rev-parse", "--verify", baseRef], {
    allowFailure: true,
  });
  if (!hasBaseRef) {
    return {
      files: null,
      source: "local",
      reason: `Base ref ${baseRef} is unavailable.`,
    };
  }

  const mergeBase = runGit(["merge-base", baseRef, "HEAD"], { allowFailure: true });
  const files = listFilesFromDiff(mergeBase, "HEAD");
  if (files == null) {
    return {
      files: null,
      source: "local",
      reason: `Could not diff ${baseRef} against HEAD.`,
    };
  }

  return {
    files,
    source: "local-branch-diff",
    reason: `Using committed branch diff from ${baseRef}.`,
  };
}

function listGitHubChangedFiles() {
  const eventName = String(process.env.GITHUB_EVENT_NAME || "");
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventName || !eventPath || !fs.existsSync(eventPath)) {
    return null;
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));

  if (eventName === "pull_request") {
    const baseSha = payload.pull_request?.base?.sha;
    const headSha = payload.pull_request?.head?.sha;
    const files = listFilesFromDiff(baseSha, headSha, { symmetric: true });
    if (files == null) {
      return {
        files: null,
        source: "github-pull_request",
        reason: "Could not diff pull request base/head.",
      };
    }

    return {
      files,
      source: "github-pull_request",
      reason: "Using pull request base/head diff.",
    };
  }

  if (eventName === "push") {
    const beforeSha = payload.before;
    const afterSha = payload.after || process.env.GITHUB_SHA;

    if (beforeSha && !/^0+$/.test(beforeSha)) {
      const files = listFilesFromDiff(beforeSha, afterSha);
      if (files == null) {
        return {
          files: null,
          source: "github-push",
          reason: "Could not diff push before/after SHAs.",
        };
      }

      return {
        files,
        source: "github-push",
        reason: "Using push before/after diff.",
      };
    }

    const files = listFilesFromCommit(afterSha);
    if (files == null) {
      return {
        files: null,
        source: "github-push",
        reason: "Could not inspect pushed commit.",
      };
    }

    return {
      files,
      source: "github-push",
      reason: "Using pushed commit file list.",
    };
  }

  if (eventName === "workflow_call") {
    return {
      files: null,
      source: "github-workflow_call",
      reason: "workflow_call has no reliable changed-file context; defaulting to safe desktop validation.",
    };
  }

  return null;
}

export function evaluateDesktopScope(files) {
  const normalizedFiles = unique(files.map(normalizePath));
  const matches = [];

  for (const file of normalizedFiles) {
    for (const rule of DESKTOP_SCOPE_RULES) {
      const matched =
        rule.type === "exact" ? file === rule.value : file.startsWith(rule.value);
      if (!matched) continue;

      matches.push({
        file,
        reason: rule.reason,
      });
      break;
    }
  }

  return {
    required: matches.length > 0,
    files: normalizedFiles,
    matches,
  };
}

export function detectDesktopScope(options = {}) {
  const mode = String(options.mode || "auto").toLowerCase();
  const baseRef = options.baseRef || process.env.FINANCE_OS_DESKTOP_BASE_REF || "origin/main";

  if (mode === "desktop" || mode === "force") {
    return {
      required: true,
      files: [],
      matches: [],
      source: "forced",
      reason: "Desktop scope forced explicitly.",
    };
  }

  if (mode === "core" || mode === "skip") {
    return {
      required: false,
      files: [],
      matches: [],
      source: "forced",
      reason: "Desktop scope disabled explicitly.",
    };
  }

  const githubResult = listGitHubChangedFiles();
  const fileResult = githubResult ?? listLocalChangedFiles(baseRef);

  if (!fileResult || fileResult.files == null) {
    return {
      required: true,
      files: [],
      matches: [],
      source: fileResult?.source || "unknown",
      reason:
        fileResult?.reason ||
        "Could not determine changed files; defaulting to safe desktop validation.",
    };
  }

  const evaluation = evaluateDesktopScope(fileResult.files);
  return {
    ...evaluation,
    source: fileResult.source,
    reason:
      evaluation.required
        ? evaluation.matches.map((match) => `${match.file}: ${match.reason}`).join("; ")
        : `${fileResult.reason} No desktop-triggering files detected.`,
  };
}

function parseArgs(argv) {
  const args = {
    baseRef: process.env.FINANCE_OS_DESKTOP_BASE_REF || "origin/main",
    githubOutput: null,
    json: false,
    requiredOnly: false,
    mode: process.env.FINANCE_OS_DESKTOP_SCOPE || "auto",
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--required-only") {
      args.requiredOnly = true;
      continue;
    }
    if (arg.startsWith("--github-output=")) {
      args.githubOutput = arg.slice("--github-output=".length);
      continue;
    }
    if (arg.startsWith("--base-ref=")) {
      args.baseRef = arg.slice("--base-ref=".length);
      continue;
    }
    if (arg.startsWith("--mode=")) {
      args.mode = arg.slice("--mode=".length);
    }
  }

  return args;
}

function writeGitHubOutput(filePath, result) {
  if (!filePath) return;
  const lines = [
    `required=${result.required ? "true" : "false"}`,
    `source=${result.source}`,
    "reason<<EOF",
    result.reason,
    "EOF",
  ];
  fs.appendFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

const isCli =
  process.argv[1] &&
  normalizePath(new URL(import.meta.url).pathname).endsWith(
    normalizePath(process.argv[1]),
  );

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const result = detectDesktopScope({
    baseRef: args.baseRef,
    mode: args.mode,
  });

  writeGitHubOutput(args.githubOutput, result);

  if (args.requiredOnly) {
    console.log(result.required ? "true" : "false");
  } else if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.reason);
  }
}
