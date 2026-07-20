import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PROJECTS,
  STATUS,
  applyCut,
  closeProject,
  createDefaultState,
  createProject,
  exportPortfolio,
  normalizeProject,
  parseImport,
  portfolioCounts,
  recordProof,
  upsertProject,
} from "../src/domain.js";

const NOW = new Date("2026-07-20T10:00:00.000Z");

test("the sample starts with decisions, not a fake completed state", () => {
  const state = createDefaultState(NOW);
  assert.equal(state.projects.length, 4);
  assert.deepEqual(portfolioCounts(state), {
    active: 0,
    maintenance: 0,
    candidate: 4,
    parked: 0,
    closed: 0,
  });
});

test("a cut enforces one active slot, at most one maintenance slot, and dated parking", () => {
  const original = createDefaultState(NOW);
  const next = applyCut(
    original,
    {
      activeId: "sample-invoice-thread",
      maintenanceId: "sample-pocket-atlas",
      weeklyHours: 14,
    },
    { now: NOW },
  );

  assert.equal(next.weeklyHours, 14);
  assert.equal(next.sample, false);
  assert.deepEqual(portfolioCounts(next), {
    active: 1,
    maintenance: 1,
    candidate: 0,
    parked: 2,
    closed: 0,
  });
  for (const project of next.projects.filter((entry) => entry.status === STATUS.PARKED)) {
    assert.equal(project.revisitOn, "2026-08-03");
    assert.match(project.revisitTrigger, /Invoice Thread/);
  }
  assert.deepEqual(portfolioCounts(original), {
    active: 0,
    maintenance: 0,
    candidate: 4,
    parked: 0,
    closed: 0,
  });
});

test("the same project cannot occupy both attention slots", () => {
  const state = createDefaultState(NOW);
  assert.throws(
    () =>
      applyCut(
        state,
        {
          activeId: "sample-pocket-atlas",
          maintenanceId: "sample-pocket-atlas",
          weeklyHours: 12,
        },
        { now: NOW },
      ),
    /must be different/,
  );
});

test("rerunning the cut refreshes every parked project's date and return trigger", () => {
  const first = applyCut(
    createDefaultState(NOW),
    { activeId: "sample-invoice-thread", maintenanceId: "", weeklyHours: 14 },
    { now: NOW },
  );
  const second = applyCut(
    first,
    { activeId: "sample-pocket-atlas", maintenanceId: "sample-study-loop", weeklyHours: 14 },
    { now: new Date("2026-08-01T10:00:00.000Z") },
  );

  for (const project of second.projects.filter((entry) => entry.status === STATUS.PARKED)) {
    assert.equal(project.revisitOn, "2026-08-15");
    assert.match(project.revisitTrigger, /Pocket Atlas/);
    assert.doesNotMatch(project.revisitTrigger, /Invoice Thread/);
  }
});

test("closing requires a retained lesson and removes an active project cleanly", () => {
  const active = applyCut(
    createDefaultState(NOW),
    { activeId: "sample-pocket-atlas", maintenanceId: "", weeklyHours: 12 },
    { now: NOW },
  );
  assert.throws(() => closeProject(active, "sample-pocket-atlas", "  ", { now: NOW }), /required/);
  const closed = closeProject(
    active,
    "sample-pocket-atlas",
    "Private maps matter; the generic discovery feed did not.",
    { now: NOW },
  );
  assert.equal(portfolioCounts(closed).active, 0);
  assert.equal(portfolioCounts(closed).closed, 1);
  assert.match(
    closed.projects.find((project) => project.id === "sample-pocket-atlas").lesson,
    /Private maps/,
  );
});

test("shipping a proof keeps a bounded history and demands a new observable proof", () => {
  const active = applyCut(
    createDefaultState(NOW),
    { activeId: "sample-study-loop", maintenanceId: "", weeklyHours: 10 },
    { now: NOW },
  );
  const next = recordProof(active, "sample-study-loop", { now: NOW });
  const project = next.projects.find((entry) => entry.id === "sample-study-loop");
  assert.equal(project.proofHistory.length, 1);
  assert.match(project.proofHistory[0].proof, /learner completes/);
  assert.equal(project.nextProof, "Define the next observable proof.");
});

test("workspace snapshots become editable local project cards", () => {
  const imported = parseImport(
    {
      schemaVersion: 1,
      source: "fewer-workspace-scan",
      generatedAt: NOW.toISOString(),
      projects: [
        {
          name: "quiet-repo",
          branch: "feature/proof",
          changedFiles: 3,
          signals: { readme: true, ci: true, tests: true },
        },
      ],
    },
    { now: NOW },
  );
  assert.equal(imported.projects.length, 1);
  assert.match(imported.projects[0].nextProof, /3 local changes/);
  assert.match(imported.projects[0].evidence, /tests detected/);
  assert.equal(imported.sample, false);
});

test("imports reject unknown envelopes and oversized portfolios", () => {
  assert.throws(() => parseImport({ projects: [] }), /neither a Fewer portfolio/);
  assert.throws(
    () =>
      parseImport({
        kind: "fewer-portfolio",
        projects: Array.from({ length: MAX_PROJECTS + 1 }, (_, index) => ({ name: String(index) })),
      }),
    /at most/,
  );
});

test("user strings stay plain data and are bounded", () => {
  const malicious = '<img src=x onerror="globalThis.pwned=true">';
  const project = normalizeProject(
    {
      id: "xss-case",
      name: malicious,
      why: malicious,
      nextProof: malicious,
    },
    { now: NOW },
  );
  assert.equal(project.name, malicious);
  assert.equal(globalThis.pwned, undefined);
  assert.ok(project.why.length <= 320);
});

test("impossible calendar dates are rejected instead of normalized", () => {
  const project = normalizeProject(
    {
      id: "date-case",
      name: "Date case",
      why: "Keep dates honest.",
      nextProof: "A malformed date stays absent.",
      deadline: "2026-02-31",
      revisitOn: "2026-13-01",
    },
    { now: NOW },
  );
  assert.equal(project.deadline, "");
  assert.equal(project.revisitOn, "");
});

test("upsert preserves a project's decision status", () => {
  const active = applyCut(
    createDefaultState(NOW),
    { activeId: "sample-pocket-atlas", maintenanceId: "", weeklyHours: 12 },
    { now: NOW },
  );
  const updated = upsertProject(
    active,
    {
      id: "sample-pocket-atlas",
      name: "Pocket Atlas",
      why: "A sharper reason to exist.",
      nextProof: "A sharper visible proof.",
      evidence: "",
      weeklyHours: 8,
      signal: 3,
      momentum: 3,
      deadline: "",
    },
    { now: NOW },
  );
  const project = updated.projects.find((entry) => entry.id === "sample-pocket-atlas");
  assert.equal(project.status, STATUS.ACTIVE);
  assert.equal(project.signal, 3);
});

test("a portfolio export round-trips without turning the sample flag back on", () => {
  const state = createDefaultState(NOW);
  const imported = parseImport(exportPortfolio(state), { now: NOW });
  assert.equal(imported.projects.length, state.projects.length);
  assert.equal(imported.sample, false);
});

test("creating a project clamps numeric fields without inventing product claims", () => {
  const project = createProject(
    {
      name: "Small bet",
      why: "Solve one narrow problem.",
      nextProof: "One person completes the core flow.",
      weeklyHours: 999,
      signal: 20,
      momentum: -4,
    },
    { now: NOW, id: "small-bet" },
  );
  assert.equal(project.weeklyHours, 80);
  assert.equal(project.signal, 3);
  assert.equal(project.momentum, 0);
  assert.equal(project.evidence, "");
});
