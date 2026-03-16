#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listWorkspacePackages() {
  const packageDirs = [rootDir];
  for (const parent of ["apps", "packages"]) {
    const parentDir = path.join(rootDir, parent);
    if (!fs.existsSync(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageDir = path.join(parentDir, entry.name);
      const packageJsonPath = path.join(packageDir, "package.json");
      if (fs.existsSync(packageJsonPath)) packageDirs.push(packageDir);
    }
  }
  return packageDirs.map((dir) => ({
    dir,
    packageJsonPath: path.join(dir, "package.json"),
    manifest: readJson(path.join(dir, "package.json")),
  }));
}

const packages = listWorkspacePackages();
const workspaceNames = new Set(
  packages
    .map((pkg) => String(pkg.manifest.name || "").trim())
    .filter(Boolean)
);

function hasInstalledPackage(fromDir, spec) {
  let currentDir = fromDir;
  const segments = spec.split("/");

  while (true) {
    const candidate = path.join(currentDir, "node_modules", ...segments);
    if (fs.existsSync(candidate)) return true;

    if (currentDir === rootDir) break;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return false;
}

const fields = ["dependencies", "devDependencies", "optionalDependencies"];
const failures = [];

for (const pkg of packages) {
  for (const field of fields) {
    const deps = pkg.manifest[field] || {};
    for (const [name, version] of Object.entries(deps)) {
      const range = String(version || "");
      if (range.startsWith("workspace:")) {
        if (!workspaceNames.has(name)) {
          failures.push(
            `${pkg.manifest.name || pkg.dir}: missing workspace package declaration for ${name}`
          );
        }
        continue;
      }

      if (!hasInstalledPackage(pkg.dir, name)) {
        failures.push(
          `${pkg.manifest.name || pkg.dir}: cannot find installed package ${name} from ${field}`
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Workspace dependency resolution failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Workspace dependency resolution passed for ${packages.length} package scopes.`
);
