import assert from "node:assert/strict";
import test from "node:test";

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { assertSafeBuildOutput, buildApp, RUNTIME_FILES } from "../scripts/build.mjs";
import { createFewerServer } from "../scripts/serve.mjs";

async function withServer(run) {
  const server = createFewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}

test("the local server serves the app with defensive browser headers", async () => {
  await withServer(async (origin) => {
    const response = await fetch(origin);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(response.headers.get("content-security-policy"), /object-src 'none'/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("permissions-policy"), /camera=\(\)/);
    assert.match(await response.text(), /Fewer — finish one thing/);
  });
});

test("the local server exposes only runtime assets", async () => {
  await withServer(async (origin) => {
    for (const path of ["/.git/config", "/package.json", "/README.md", "/../LICENSE"]) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 404, path);
    }
    assert.equal((await fetch(`${origin}/src/domain.js`)).status, 200);
  });
});

test("the local server rejects state-changing HTTP methods", async () => {
  await withServer(async (origin) => {
    const response = await fetch(origin, { method: "POST", body: "ignored" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  });
});

test("the deployment build contains only the runtime allowlist", () => {
  const output = mkdtempSync(join(tmpdir(), "fewer-build-"));
  try {
    buildApp(output);
    const files = [];
    const collect = (directory, prefix = "") => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const name = `${prefix}${entry.name}`;
        if (entry.isDirectory()) collect(join(directory, entry.name), `${name}/`);
        else files.push(name);
      }
    };
    collect(output);
    assert.deepEqual(files.sort(), [...RUNTIME_FILES].sort());
    for (const privatePath of [".git", "README.md", "docs", "package.json"]) {
      assert.equal(files.includes(privatePath), false, privatePath);
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("the deployment builder refuses destructive output targets", () => {
  assert.throws(() => assertSafeBuildOutput(resolve(".")), /source repository/);
  assert.throws(() => assertSafeBuildOutput(resolve("..")), /ancestors/);

  const output = mkdtempSync(join(tmpdir(), "fewer-build-nonempty-"));
  const sentinel = join(output, "keep.txt");
  writeFileSync(sentinel, "keep");
  try {
    assert.throws(() => buildApp(output), /non-empty custom build directory/);
    assert.equal(readFileSync(sentinel, "utf8"), "keep");
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
