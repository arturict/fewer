import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".next",
  ".turbo",
  ".venv",
  "AppData",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

function parseArguments(args) {
  const roots = [];
  let output = "";
  let maxDepth = 2;
  let includePaths = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--output") {
      output = args[index + 1] || "";
      index += 1;
    } else if (argument === "--max-depth") {
      maxDepth = Number.parseInt(args[index + 1] || "", 10);
      index += 1;
    } else if (argument === "--include-paths") {
      includePaths = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      roots.push(argument);
    }
  }

  if (!roots.length) {
    throw new Error(
      "Usage: node scripts/scan-workspace.mjs <folder...> [--max-depth 2] [--output snapshot.json] [--include-paths]",
    );
  }
  if (!Number.isFinite(maxDepth) || maxDepth < 0 || maxDepth > 6) {
    throw new Error("--max-depth must be between 0 and 6.");
  }
  return { roots, output, maxDepth, includePaths };
}

function isGitRepository(path) {
  try {
    const entries = readdirSync(path, { withFileTypes: true });
    return entries.some((entry) => entry.name === ".git");
  } catch {
    return false;
  }
}

function discoverRepositories(root, maxDepth, found = new Set(), depth = 0) {
  const resolvedRoot = resolve(root);
  let stats;
  try {
    stats = statSync(resolvedRoot);
  } catch {
    throw new Error(`Cannot read ${resolvedRoot}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${resolvedRoot}`);
  }
  if (isGitRepository(resolvedRoot)) {
    found.add(resolvedRoot);
    return found;
  }
  if (depth >= maxDepth) return found;

  let entries = [];
  try {
    entries = readdirSync(resolvedRoot, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    discoverRepositories(resolve(resolvedRoot, entry.name), maxDepth, found, depth + 1);
    if (found.size >= 100) break;
  }
  return found;
}

function git(repository, args, fallback = "") {
  try {
    return execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function hasAny(repository, names) {
  let entries = [];
  try {
    entries = readdirSync(repository, { withFileTypes: true }).map((entry) => entry.name.toLowerCase());
  } catch {
    return false;
  }
  return names.some((name) => entries.includes(name.toLowerCase()));
}

const TEST_SIGNALS = [
  "__tests__",
  "jest.config.js",
  "playwright.config.ts",
  "test",
  "tests",
  "vitest.config.js",
  "vitest.config.ts",
];

function packageHasTestScript(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Object.keys(parsed.scripts || {}).some((name) => name === "test" || name.startsWith("test:"));
  } catch {
    return false;
  }
}

function hasTestSignal(repository) {
  if (hasAny(repository, TEST_SIGNALS) || packageHasTestScript(resolve(repository, "package.json"))) {
    return true;
  }
  let entries = [];
  try {
    entries = readdirSync(repository, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        !entry.name.startsWith(".") &&
        !IGNORED_DIRECTORIES.has(entry.name),
    )
    .slice(0, 40)
    .some((entry) => {
      const child = resolve(repository, entry.name);
      return hasAny(child, TEST_SIGNALS) || packageHasTestScript(resolve(child, "package.json"));
    });
}

function inspectRepository(repository, includePaths = false) {
  const status = git(repository, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const changedFiles = status ? status.split(/\r?\n/).filter(Boolean).length : 0;
  const project = {
    name: basename(repository),
    branch: git(repository, ["branch", "--show-current"], "detached"),
    lastCommitAt: git(repository, ["log", "-1", "--format=%cI"]),
    changedFiles,
    signals: {
      readme: hasAny(repository, ["README.md", "README", "README.txt"]),
      ci: hasAny(repository, [".github", ".gitlab-ci.yml", "azure-pipelines.yml"]),
      tests: hasTestSignal(repository),
    },
  };
  if (includePaths) project.path = repository;
  return project;
}

export function scanWorkspace(roots, options = {}) {
  const repositories = new Set();
  for (const root of roots) {
    discoverRepositories(root, options.maxDepth ?? 2, repositories);
  }
  return {
    schemaVersion: 1,
    source: "fewer-workspace-scan",
    generatedAt: new Date().toISOString(),
    privacy: options.includePaths
      ? "Absolute paths were explicitly included."
      : "Absolute paths and remotes were excluded.",
    projects: [...repositories]
      .sort((left, right) => left.localeCompare(right))
      .map((repository) => inspectRepository(repository, Boolean(options.includePaths))),
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const snapshot = scanWorkspace(options.roots, options);
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (options.output) {
    writeFileSync(resolve(options.output), serialized, { encoding: "utf8", flag: "w" });
    console.error(`Wrote ${snapshot.projects.length} projects to ${resolve(options.output)}`);
  } else {
    process.stdout.write(serialized);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
