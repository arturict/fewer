import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { scanWorkspace } from "../scripts/scan-workspace.mjs";

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "fewer-scan-"));
  const repository = join(root, "honest-product");
  mkdirSync(repository);
  execFileSync("git", ["init", "--quiet", repository], { windowsHide: true });
  writeFileSync(join(repository, "README.md"), "# Honest product\n", "utf8");
  mkdirSync(join(repository, "tests"));
  writeFileSync(join(repository, "tests", "smoke.test.js"), "// test signal\n", "utf8");
  writeFileSync(join(repository, "work-in-progress.txt"), "local change\n", "utf8");
  return { root, repository };
}

test("the default workspace snapshot omits absolute paths and remotes", () => {
  const { root, repository } = createRepository();
  execFileSync("git", ["-C", repository, "remote", "add", "origin", "git@example.invalid:private/repo.git"], {
    windowsHide: true,
  });
  const snapshot = scanWorkspace([root], { maxDepth: 2 });
  assert.equal(snapshot.projects.length, 1);
  assert.equal(snapshot.projects[0].name, "honest-product");
  assert.equal(snapshot.projects[0].changedFiles, 3);
  assert.equal(snapshot.projects[0].signals.readme, true);
  assert.equal(snapshot.projects[0].signals.tests, true);
  assert.equal("path" in snapshot.projects[0], false);
  assert.doesNotMatch(JSON.stringify(snapshot), /example\.invalid/);
  assert.match(snapshot.privacy, /excluded/);
});

test("absolute paths are included only behind the explicit flag", () => {
  const { root, repository } = createRepository();
  const snapshot = scanWorkspace([root], { maxDepth: 2, includePaths: true });
  assert.equal(snapshot.projects[0].path, repository);
  assert.match(snapshot.privacy, /explicitly included/);
});

test("scan depth is enforced", () => {
  const root = mkdtempSync(join(tmpdir(), "fewer-depth-"));
  const nested = join(root, "one", "two", "repo");
  mkdirSync(nested, { recursive: true });
  execFileSync("git", ["init", "--quiet", nested], { windowsHide: true });
  assert.equal(scanWorkspace([root], { maxDepth: 2 }).projects.length, 0);
  assert.equal(scanWorkspace([root], { maxDepth: 3 }).projects.length, 1);
});

test("a workspace package test script is detected without executing it", () => {
  const root = mkdtempSync(join(tmpdir(), "fewer-workspace-test-"));
  const repository = join(root, "product");
  const mobile = join(repository, "mobile");
  mkdirSync(mobile, { recursive: true });
  execFileSync("git", ["init", "--quiet", repository], { windowsHide: true });
  writeFileSync(
    join(mobile, "package.json"),
    JSON.stringify({ private: true, scripts: { test: "node --test" } }),
    "utf8",
  );
  const snapshot = scanWorkspace([repository], { maxDepth: 0 });
  assert.equal(snapshot.projects[0].signals.tests, true);
});
