export const SCHEMA_VERSION = 1;
export const MAX_PROJECTS = 40;

export const STATUS = Object.freeze({
  ACTIVE: "active",
  MAINTENANCE: "maintenance",
  CANDIDATE: "candidate",
  PARKED: "parked",
  CLOSED: "closed",
});

const STATUS_VALUES = new Set(Object.values(STATUS));
const LIMITS = Object.freeze({
  name: 80,
  why: 320,
  nextProof: 240,
  evidence: 180,
  revisitTrigger: 240,
  lesson: 320,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value, field, { required = false } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new Error(`${field} is required.`);
  }
  return text.slice(0, LIMITS[field] ?? 240);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function isoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
  safeDate.setUTCDate(safeDate.getUTCDate() + days);
  return safeDate.toISOString().slice(0, 10);
}

export function normalizeProject(input, options = {}) {
  if (!isRecord(input)) {
    throw new Error("Each project must be an object.");
  }

  const now = isoDate(options.now);
  const status = STATUS_VALUES.has(input.status) ? input.status : STATUS.CANDIDATE;
  const proofHistory = Array.isArray(input.proofHistory)
    ? input.proofHistory
        .filter(isRecord)
        .slice(-10)
        .map((entry) => ({
          proof: boundedText(entry.proof, "nextProof"),
          shippedAt: isoDate(entry.shippedAt),
        }))
    : [];

  return {
    id: boundedText(input.id, "id") || makeId(),
    name: boundedText(input.name, "name", { required: true }),
    why: boundedText(input.why, "why", { required: true }),
    nextProof: boundedText(input.nextProof, "nextProof", { required: true }),
    evidence: boundedText(input.evidence, "evidence"),
    weeklyHours: boundedInteger(input.weeklyHours, 8, 1, 80),
    deadline: dateOnly(input.deadline),
    signal: boundedInteger(input.signal, 0, 0, 3),
    momentum: boundedInteger(input.momentum, 0, 0, 3),
    status,
    revisitOn: dateOnly(input.revisitOn),
    revisitTrigger: boundedText(input.revisitTrigger, "revisitTrigger"),
    lesson: boundedText(input.lesson, "lesson"),
    createdAt: isoDate(input.createdAt || now),
    updatedAt: isoDate(input.updatedAt || now),
    decidedAt: input.decidedAt ? isoDate(input.decidedAt) : "",
    proofHistory,
  };
}

export function createProject(input, options = {}) {
  return normalizeProject(
    {
      ...input,
      id: options.id || input.id || makeId(),
      status: STATUS.CANDIDATE,
      createdAt: options.now,
      updatedAt: options.now,
    },
    options,
  );
}

function sampleProjects(now) {
  return [
    {
      id: "sample-pocket-atlas",
      name: "Pocket Atlas",
      why: "Give people new to a city a private map of places they would genuinely return to.",
      nextProof: "Five newcomers save a place and find it again without help.",
      evidence: "5 interviews booked",
      weeklyHours: 12,
      deadline: addDays(now, 18),
      signal: 2,
      momentum: 2,
      status: STATUS.CANDIDATE,
    },
    {
      id: "sample-invoice-thread",
      name: "Invoice Thread",
      why: "Help independent studios turn scattered client approvals into a clean invoice trail.",
      nextProof: "One studio sends a real invoice from an approval thread.",
      evidence: "1 committed pilot",
      weeklyHours: 10,
      deadline: addDays(now, 28),
      signal: 3,
      momentum: 1,
      status: STATUS.CANDIDATE,
    },
    {
      id: "sample-study-loop",
      name: "Study Loop",
      why: "Make revision plans respond to what a learner cannot recall, not what a syllabus lists.",
      nextProof: "A learner completes a recall loop and improves on the second pass.",
      evidence: "prototype works",
      weeklyHours: 8,
      deadline: "",
      signal: 1,
      momentum: 2,
      status: STATUS.CANDIDATE,
    },
    {
      id: "sample-tiny-weather",
      name: "Tiny Weather",
      why: "Show the one weather decision that changes a family's morning, without another feed.",
      nextProof: "Three households use the morning card for seven consecutive days.",
      evidence: "no user signal yet",
      weeklyHours: 6,
      deadline: "",
      signal: 0,
      momentum: 1,
      status: STATUS.CANDIDATE,
    },
  ].map((project) => normalizeProject(project, { now }));
}

export function createDefaultState(now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "fewer-portfolio",
    sample: true,
    weeklyHours: 16,
    updatedAt: isoDate(now),
    projects: sampleProjects(now),
  };
}

function assertPortfolioShape(value) {
  if (!isRecord(value)) {
    throw new Error("The import must contain a JSON object.");
  }
  if (!Array.isArray(value.projects)) {
    throw new Error("The import must contain a projects array.");
  }
  if (value.projects.length > MAX_PROJECTS) {
    throw new Error(`Fewer accepts at most ${MAX_PROJECTS} projects per portfolio.`);
  }
}

export function normalizeState(value, options = {}) {
  assertPortfolioShape(value);
  const now = isoDate(options.now);
  const projects = value.projects.map((project) => normalizeProject(project, { now }));

  const ids = new Set();
  for (const project of projects) {
    if (ids.has(project.id)) {
      project.id = makeId();
    }
    ids.add(project.id);
  }

  let seenActive = false;
  let seenMaintenance = false;
  for (const project of projects) {
    if (project.status === STATUS.ACTIVE) {
      if (seenActive) project.status = STATUS.CANDIDATE;
      seenActive = true;
    }
    if (project.status === STATUS.MAINTENANCE) {
      if (seenMaintenance) project.status = STATUS.PARKED;
      seenMaintenance = true;
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "fewer-portfolio",
    sample: Boolean(value.sample),
    weeklyHours: boundedInteger(value.weeklyHours, 16, 1, 120),
    updatedAt: isoDate(value.updatedAt || now),
    projects,
  };
}

function projectFromWorkspaceEntry(entry, now) {
  if (!isRecord(entry)) {
    throw new Error("A workspace project entry is invalid.");
  }
  const name = boundedText(entry.name, "name", { required: true });
  const changedFiles = boundedInteger(entry.changedFiles, 0, 0, 100000);
  const signals = isRecord(entry.signals) ? entry.signals : {};
  const signalText = [
    entry.branch ? `branch ${boundedText(entry.branch, "evidence")}` : "",
    changedFiles ? `${changedFiles} changed file${changedFiles === 1 ? "" : "s"}` : "clean tree",
    signals.tests ? "tests detected" : "tests not detected",
  ]
    .filter(Boolean)
    .join(" · ");

  let nextProof = "Name the next user-visible result this repository should produce.";
  if (changedFiles > 0) {
    nextProof = `Turn the ${changedFiles} local change${changedFiles === 1 ? "" : "s"} into one reviewed, tested decision.`;
  } else if (!signals.tests) {
    nextProof = "Add one regression test around the product's most important user path.";
  }

  return createProject(
    {
      name,
      why: "Imported local repository. Replace this line with the user problem worth solving.",
      nextProof,
      evidence: signalText,
      weeklyHours: changedFiles > 0 ? 10 : 6,
      signal: 0,
      momentum: changedFiles > 0 ? 2 : 1,
    },
    { now },
  );
}

export function parseImport(input, options = {}) {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
  }
  assertPortfolioShape(value);

  if (value.kind === "fewer-portfolio") {
    return normalizeState({ ...value, sample: false }, options);
  }
  if (value.source === "fewer-workspace-scan" && value.schemaVersion === SCHEMA_VERSION) {
    const now = options.now || new Date();
    return normalizeState(
      {
        kind: "fewer-portfolio",
        schemaVersion: SCHEMA_VERSION,
        sample: false,
        weeklyHours: 16,
        updatedAt: now,
        projects: value.projects.map((entry) => projectFromWorkspaceEntry(entry, now)),
      },
      { now },
    );
  }
  throw new Error("This is neither a Fewer portfolio nor a Fewer workspace snapshot.");
}

export function applyCut(state, decision, options = {}) {
  const normalized = normalizeState(state, options);
  const now = isoDate(options.now);
  const active = normalized.projects.find((project) => project.id === decision.activeId);
  if (!active || active.status === STATUS.CLOSED) {
    throw new Error("Choose an available project for the active slot.");
  }
  if (decision.maintenanceId === decision.activeId) {
    throw new Error("The active and maintenance slots must be different projects.");
  }
  const maintenance = decision.maintenanceId
    ? normalized.projects.find((project) => project.id === decision.maintenanceId)
    : null;
  if (decision.maintenanceId && (!maintenance || maintenance.status === STATUS.CLOSED)) {
    throw new Error("Choose an available project for maintenance.");
  }

  normalized.weeklyHours = boundedInteger(decision.weeklyHours, normalized.weeklyHours, 1, 120);
  for (const project of normalized.projects) {
    if (project.status === STATUS.CLOSED) continue;
    project.updatedAt = now;
    project.decidedAt = now;
    if (project.id === active.id) {
      project.status = STATUS.ACTIVE;
      project.revisitOn = "";
      project.revisitTrigger = "";
    } else if (maintenance && project.id === maintenance.id) {
      project.status = STATUS.MAINTENANCE;
      project.revisitOn = "";
      project.revisitTrigger = "";
    } else {
      project.status = STATUS.PARKED;
      project.revisitOn = addDays(now, 14);
      project.revisitTrigger = `Review after ${active.name}'s next proof ships.`;
    }
  }
  normalized.sample = false;
  normalized.updatedAt = now;
  return normalized;
}

export function closeProject(state, projectId, lesson, options = {}) {
  const normalized = normalizeState(state, options);
  const project = normalized.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error("Project not found.");
  project.status = STATUS.CLOSED;
  project.lesson = boundedText(lesson, "lesson", { required: true });
  project.updatedAt = isoDate(options.now);
  project.decidedAt = project.updatedAt;
  normalized.sample = false;
  normalized.updatedAt = project.updatedAt;
  return normalized;
}

export function recordProof(state, projectId, options = {}) {
  const normalized = normalizeState(state, options);
  const project = normalized.projects.find((entry) => entry.id === projectId);
  if (!project || project.status !== STATUS.ACTIVE) {
    throw new Error("Only the active project's proof can be shipped.");
  }
  const shippedAt = isoDate(options.now);
  project.proofHistory = [...project.proofHistory, { proof: project.nextProof, shippedAt }].slice(-10);
  project.nextProof = "Define the next observable proof.";
  project.updatedAt = shippedAt;
  normalized.sample = false;
  normalized.updatedAt = shippedAt;
  return normalized;
}

export function upsertProject(state, input, options = {}) {
  const normalized = normalizeState(state, options);
  const index = input.id
    ? normalized.projects.findIndex((project) => project.id === input.id)
    : -1;
  if (index >= 0) {
    normalized.projects[index] = normalizeProject(
      {
        ...normalized.projects[index],
        ...input,
        updatedAt: options.now,
      },
      options,
    );
  } else {
    if (normalized.projects.length >= MAX_PROJECTS) {
      throw new Error(`Fewer accepts at most ${MAX_PROJECTS} projects.`);
    }
    normalized.projects.push(createProject(input, options));
  }
  normalized.sample = false;
  normalized.updatedAt = isoDate(options.now);
  return normalized;
}

export function portfolioCounts(state) {
  return Object.values(STATUS).reduce(
    (counts, status) => ({
      ...counts,
      [status]: state.projects.filter((project) => project.status === status).length,
    }),
    {},
  );
}

export function daysFromToday(date, now = new Date()) {
  if (!dateOnly(date)) return null;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00Z`);
  return Math.ceil((target.valueOf() - start.valueOf()) / 86_400_000);
}

export function exportPortfolio(state) {
  const normalized = normalizeState(state);
  return JSON.stringify(
    {
      ...normalized,
      sample: false,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}
