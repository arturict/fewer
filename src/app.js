import {
  STATUS,
  applyCut,
  closeProject,
  createDefaultState,
  daysFromToday,
  exportPortfolio,
  parseImport,
  portfolioCounts,
  recordProof,
  upsertProject,
} from "./domain.js";
import { MAX_STORED_CHARS, clearState, loadState, saveState } from "./storage.js";

const STATUS_LABELS = Object.freeze({
  [STATUS.ACTIVE]: "Active",
  [STATUS.MAINTENANCE]: "Maintenance",
  [STATUS.CANDIDATE]: "Undecided",
  [STATUS.PARKED]: "Parked",
  [STATUS.CLOSED]: "Closed",
});

const SIGNAL_LABELS = ["No signal", "Anecdotal signal", "Repeated signal", "Committed user"];
const MOMENTUM_LABELS = ["Cold", "Some work", "Working core", "Shipping now"];
const IMPORT_BYTE_LIMIT = MAX_STORED_CHARS * 3;

const dom = {
  addButton: document.querySelector("#add-button"),
  importButton: document.querySelector("#import-button"),
  importInput: document.querySelector("#import-input"),
  exportButton: document.querySelector("#export-button"),
  runCutButton: document.querySelector("#run-cut-button"),
  resetDemoButton: document.querySelector("#reset-demo-button"),
  howItWorksButton: document.querySelector("#how-it-works-button"),
  whyDialog: document.querySelector("#why-dialog"),
  closeWhyButton: document.querySelector("#close-why-button"),
  projectDialog: document.querySelector("#project-dialog"),
  projectForm: document.querySelector("#project-form"),
  projectDialogTitle: document.querySelector("#project-dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  closeForm: document.querySelector("#close-form"),
  resetDialog: document.querySelector("#reset-dialog"),
  resetForm: document.querySelector("#reset-form"),
  closeProjectName: document.querySelector("#close-project-name"),
  closeProjectId: document.querySelector("#close-project-id"),
  closeLesson: document.querySelector("#close-lesson"),
  cutDialog: document.querySelector("#cut-dialog"),
  cutContent: document.querySelector("#cut-content"),
  cardTemplate: document.querySelector("#project-card-template"),
  activeEmpty: document.querySelector("#active-empty"),
  activeProject: document.querySelector("#active-project"),
  activeName: document.querySelector("#active-name"),
  activeWhy: document.querySelector("#active-why"),
  activeProof: document.querySelector("#active-proof"),
  activeHours: document.querySelector("#active-hours"),
  proofShippedButton: document.querySelector("#proof-shipped-button"),
  editActiveButton: document.querySelector("#edit-active-button"),
  portfolioSummary: document.querySelector("#portfolio-summary"),
  closedCount: document.querySelector("#closed-count"),
  toast: document.querySelector("#toast"),
};

const loaded = loadState();
let state = loaded.state;
let cutSession = null;
let toastTimer = null;

function element(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function showToast(message) {
  globalThis.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = globalThis.setTimeout(() => {
    dom.toast.classList.remove("is-visible");
  }, 3200);
}

function persist(nextState, message) {
  state = nextState;
  saveState(state);
  render();
  if (message) showToast(message);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function deadlineText(project) {
  if (project.status === STATUS.PARKED && project.revisitOn) {
    return `Revisit ${formatDate(project.revisitOn)}`;
  }
  const remaining = daysFromToday(project.deadline);
  if (remaining === null) return "No deadline";
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`;
  if (remaining === 0) return "Due today";
  return `${remaining}d left`;
}

function appendChip(container, text) {
  if (!text) return;
  container.append(element("span", "evidence-chip", text));
}

function renderCard(project) {
  const fragment = dom.cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".project-card");
  const editButton = card.querySelector(".card-menu");
  const closeButton = card.querySelector(".card-close");
  const proofLabel = card.querySelector(".card-proof > span");
  const proofText = card.querySelector(".card-proof p");

  card.dataset.projectId = project.id;
  card.querySelector(".card-status").textContent = STATUS_LABELS[project.status];
  card.querySelector(".card-name").textContent = project.name;
  card.querySelector(".card-why").textContent = project.why;
  card.querySelector(".card-date").textContent = deadlineText(project);

  if (project.status === STATUS.PARKED) {
    proofLabel.textContent = "Return when";
    proofText.textContent = project.revisitTrigger || "A specific return trigger is defined.";
  } else if (project.status === STATUS.CLOSED) {
    proofLabel.textContent = "Kept from the work";
    proofText.textContent = project.lesson;
  } else {
    proofLabel.textContent = "Next proof";
    proofText.textContent = project.nextProof;
  }

  const evidence = card.querySelector(".card-evidence");
  appendChip(evidence, SIGNAL_LABELS[project.signal]);
  appendChip(evidence, MOMENTUM_LABELS[project.momentum]);
  appendChip(evidence, project.evidence);

  if (project.status === STATUS.CLOSED) {
    editButton.remove();
    closeButton.remove();
  } else {
    editButton.setAttribute("aria-label", `Edit ${project.name}`);
    closeButton.setAttribute("aria-label", `Close ${project.name}`);
    editButton.addEventListener("click", () => openProjectDialog(project));
    closeButton.addEventListener("click", () => openCloseDialog(project));
  }
  return fragment;
}

function renderLane(status, listId, emptyId) {
  const list = document.querySelector(`#${listId}`);
  const empty = document.querySelector(`#${emptyId}`);
  const projects = state.projects.filter((project) => project.status === status);
  list.replaceChildren(...projects.map(renderCard));
  empty.hidden = projects.length > 0;
}

function renderActive() {
  const active = state.projects.find((project) => project.status === STATUS.ACTIVE);
  dom.activeEmpty.hidden = Boolean(active);
  dom.activeProject.hidden = !active;
  if (!active) return;
  dom.activeName.textContent = active.name;
  dom.activeWhy.textContent = active.why;
  dom.activeProof.textContent = active.nextProof;
  dom.activeHours.textContent = `${state.weeklyHours}h available · ${active.weeklyHours}h requested`;
}

function render() {
  const counts = portfolioCounts(state);
  renderActive();
  renderLane(STATUS.MAINTENANCE, "maintenance-list", "maintenance-empty");
  renderLane(STATUS.CANDIDATE, "candidate-list", "candidate-empty");
  renderLane(STATUS.PARKED, "parked-list", "parked-empty");
  renderLane(STATUS.CLOSED, "closed-list", "closed-empty");
  dom.closedCount.textContent = String(counts.closed);

  const openCount = state.projects.length - counts.closed;
  const decisionCount = counts.candidate;
  dom.portfolioSummary.textContent =
    decisionCount > 0
      ? `${decisionCount} of ${openCount} open projects still need a decision.`
      : `${openCount} open projects, with one active attention budget.`;
  dom.runCutButton.disabled = openCount === 0;
}

function projectFormField(id) {
  return document.querySelector(`#project-${id}`);
}

function openProjectDialog(project = null) {
  dom.projectForm.reset();
  dom.projectDialogTitle.textContent = project ? "Edit project" : "Add a project";
  projectFormField("id").value = project?.id || "";
  projectFormField("name").value = project?.name || "";
  projectFormField("why").value = project?.why || "";
  projectFormField("proof").value = project?.nextProof || "";
  projectFormField("hours").value = String(project?.weeklyHours || 8);
  projectFormField("deadline").value = project?.deadline || "";
  projectFormField("signal").value = String(project?.signal || 0);
  projectFormField("momentum").value = String(project?.momentum || 0);
  projectFormField("evidence").value = project?.evidence || "";
  dom.projectDialog.showModal();
  projectFormField("name").focus();
}

function openCloseDialog(project) {
  dom.closeProjectName.textContent = project.name;
  dom.closeProjectId.value = project.id;
  dom.closeLesson.value = project.lesson || "";
  dom.closeDialog.showModal();
  dom.closeLesson.focus();
}

dom.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    dom.projectDialog.close();
    return;
  }
  if (!dom.projectForm.reportValidity()) return;
  const form = new FormData(dom.projectForm);
  try {
    persist(
      upsertProject(state, {
        id: String(form.get("id") || ""),
        name: String(form.get("name") || ""),
        why: String(form.get("why") || ""),
        nextProof: String(form.get("nextProof") || ""),
        weeklyHours: form.get("weeklyHours"),
        deadline: String(form.get("deadline") || ""),
        signal: form.get("signal"),
        momentum: form.get("momentum"),
        evidence: String(form.get("evidence") || ""),
      }),
      form.get("id") ? "Project updated." : "Project added to the undecided lane.",
    );
    dom.projectDialog.close();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Project could not be saved.");
  }
});

dom.closeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    dom.closeDialog.close();
    return;
  }
  if (!dom.closeForm.reportValidity()) return;
  try {
    persist(
      closeProject(state, dom.closeProjectId.value, dom.closeLesson.value),
      "Project closed. The lesson stays.",
    );
    dom.closeDialog.close();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Project could not be closed.");
  }
});

function cutCloseButton() {
  const button = element("button", "dialog-close", "×");
  button.type = "button";
  button.setAttribute("aria-label", "Close the cut");
  button.addEventListener("click", () => dom.cutDialog.close());
  return button;
}

function renderCutStart() {
  const shell = element("div", "cut-start");
  const copy = element("div");
  copy.append(
    element("p", "eyebrow", "The cut"),
    element("h2", "", "What earns your attention?"),
  );
  const description = element(
    "p",
    "dialog-copy",
    "You will compare every open project head to head. Fewer shows the evidence; you choose the winner.",
  );
  copy.append(description);

  const field = element("label");
  field.append(element("span", "", "Hours you can actually give in the next seven days"));
  const input = element("input");
  input.type = "number";
  input.min = "1";
  input.max = "120";
  input.value = String(cutSession.weeklyHours);
  input.id = "cut-hours";
  field.append(input);
  copy.append(field);

  const actions = element("div", "dialog-actions");
  const cancel = element("button", "button button-quiet", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", () => dom.cutDialog.close());
  const begin = element("button", "button button-dark", "Begin comparison →");
  begin.type = "button";
  begin.addEventListener("click", () => {
    const hours = Number.parseInt(input.value, 10);
    if (!Number.isFinite(hours) || hours < 1 || hours > 120) {
      showToast("Choose between 1 and 120 honest hours.");
      return;
    }
    cutSession.weeklyHours = hours;
    cutSession.champion = cutSession.projects[0];
    cutSession.queue = cutSession.projects.slice(1);
    cutSession.phase = cutSession.queue.length ? "duel" : "result";
    renderCut();
  });
  actions.append(cancel, begin);
  copy.append(actions);

  const note = element("aside", "cut-note");
  note.append(
    element("p", "eyebrow", `${cutSession.projects.length} open projects`),
    element(
      "p",
      "dialog-copy",
      "The winner gets the active slot. You may protect one maintenance obligation. Every other project receives a dated return trigger.",
    ),
  );
  shell.append(copy, note);
  dom.cutContent.replaceChildren(shell);
}

function signalCell(label, value) {
  const cell = element("div", "duel-signal");
  cell.append(element("span", "", label), element("strong", "", value));
  return cell;
}

function duelCard(project, onChoose) {
  const card = element("article", "duel-card");
  card.append(element("p", "eyebrow", STATUS_LABELS[project.status]), element("h3", "", project.name));
  card.append(element("p", "", project.why));
  const signals = element("div", "duel-signals");
  signals.append(
    signalCell("Signal", SIGNAL_LABELS[project.signal]),
    signalCell("Momentum", MOMENTUM_LABELS[project.momentum]),
    signalCell("Time ask", `${project.weeklyHours}h / week`),
    signalCell("Deadline", project.deadline ? formatDate(project.deadline) : "None"),
  );
  card.append(signals);
  const proof = element("div", "card-proof");
  proof.append(element("span", "", "Next proof"), element("p", "", project.nextProof));
  card.append(proof);
  const choose = element("button", "button button-dark", `Fund ${project.name}`);
  choose.type = "button";
  choose.addEventListener("click", onChoose);
  card.append(choose);
  return card;
}

function chooseDuel(winner, loser) {
  cutSession.champion = winner;
  cutSession.losers.push(loser);
  cutSession.queue.shift();
  cutSession.round += 1;
  cutSession.phase = cutSession.queue.length ? "duel" : "result";
  renderCut();
}

function renderDuel() {
  const challenger = cutSession.queue[0];
  const heading = element("div", "duel-progress");
  heading.append(
    element("span", "", `Decision ${cutSession.round + 1} of ${cutSession.projects.length - 1}`),
    cutCloseButton(),
  );
  const grid = element("div", "duel-grid");
  grid.append(
    duelCard(cutSession.champion, () => chooseDuel(cutSession.champion, challenger)),
    element("span", "duel-or", "or"),
    duelCard(challenger, () => chooseDuel(challenger, cutSession.champion)),
  );
  dom.cutContent.replaceChildren(heading, grid);
}

function renderCutResult() {
  const shell = element("div", "cut-result");
  const heading = element("div", "dialog-heading");
  const title = element("div");
  title.append(element("p", "eyebrow", "Your active bet"), element("h2", "", cutSession.champion.name));
  heading.append(title, cutCloseButton());
  shell.append(heading);
  shell.append(
    element(
      "p",
      "dialog-copy",
      `${cutSession.weeklyHours} honest hours are reserved for this portfolio. Choose at most one maintenance obligation; it is not a second growth project.`,
    ),
  );

  const options = element("div", "maintenance-options");
  const none = element("button", "maintenance-option");
  none.type = "button";
  none.setAttribute("aria-pressed", String(!cutSession.maintenanceId));
  none.append(element("strong", "", "No maintenance slot"), element("span", "", "Protect the active bet."));
  none.addEventListener("click", () => {
    cutSession.maintenanceId = "";
    renderCut();
  });
  options.append(none);
  for (const project of cutSession.projects.filter((entry) => entry.id !== cutSession.champion.id)) {
    const option = element("button", "maintenance-option");
    option.type = "button";
    option.setAttribute("aria-pressed", String(cutSession.maintenanceId === project.id));
    option.append(
      element("strong", "", project.name),
      element("span", "", `${project.weeklyHours}h requested · keep healthy, do not expand`),
    );
    option.addEventListener("click", () => {
      cutSession.maintenanceId = project.id;
      renderCut();
    });
    options.append(option);
  }
  shell.append(options);

  const actions = element("div", "dialog-actions");
  const back = element("button", "button button-quiet", "Start over");
  back.type = "button";
  back.addEventListener("click", () => {
    cutSession.phase = "start";
    cutSession.champion = null;
    cutSession.queue = [];
    cutSession.losers = [];
    cutSession.round = 0;
    renderCut();
  });
  const confirm = element("button", "button button-accent", "Confirm the cut →");
  confirm.type = "button";
  confirm.addEventListener("click", () => {
    try {
      persist(
        applyCut(state, {
          activeId: cutSession.champion.id,
          maintenanceId: cutSession.maintenanceId,
          weeklyHours: cutSession.weeklyHours,
        }),
        `${cutSession.champion.name} now has the active slot.`,
      );
      dom.cutDialog.close();
      document.querySelector(".focus-shell").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The cut could not be saved.");
    }
  });
  actions.append(back, confirm);
  shell.append(actions);
  dom.cutContent.replaceChildren(shell);
}

function renderCut() {
  if (!cutSession) return;
  if (cutSession.phase === "start") renderCutStart();
  if (cutSession.phase === "duel") renderDuel();
  if (cutSession.phase === "result") renderCutResult();
}

function openCut() {
  const projects = state.projects.filter((project) => project.status !== STATUS.CLOSED);
  if (!projects.length) {
    showToast("Add an open project before running the cut.");
    return;
  }
  cutSession = {
    phase: "start",
    projects,
    weeklyHours: state.weeklyHours,
    champion: null,
    queue: [],
    losers: [],
    round: 0,
    maintenanceId: state.projects.find((project) => project.status === STATUS.MAINTENANCE)?.id || "",
  };
  renderCut();
  dom.cutDialog.showModal();
}

dom.addButton.addEventListener("click", () => openProjectDialog());
dom.runCutButton.addEventListener("click", openCut);
dom.howItWorksButton.addEventListener("click", () => dom.whyDialog.showModal());
dom.closeWhyButton.addEventListener("click", () => dom.whyDialog.close());
dom.editActiveButton.addEventListener("click", () => {
  const active = state.projects.find((project) => project.status === STATUS.ACTIVE);
  if (active) openProjectDialog(active);
});
dom.proofShippedButton.addEventListener("click", () => {
  const active = state.projects.find((project) => project.status === STATUS.ACTIVE);
  if (!active) return;
  try {
    persist(recordProof(state, active.id), "Proof recorded. Define the next observable proof.");
    openProjectDialog(state.projects.find((project) => project.id === active.id));
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Proof could not be recorded.");
  }
});

dom.importButton.addEventListener("click", () => dom.importInput.click());
dom.importInput.addEventListener("change", async () => {
  const [file] = dom.importInput.files || [];
  dom.importInput.value = "";
  if (!file) return;
  if (file.size > IMPORT_BYTE_LIMIT) {
    showToast("Import files must be smaller than 4.5 MB.");
    return;
  }
  try {
    const importedText = await file.text();
    if (importedText.length > MAX_STORED_CHARS) {
      showToast("Imported data must contain no more than 1.5 million characters.");
      return;
    }
    const imported = parseImport(importedText);
    persist(imported, `Imported ${imported.projects.length} projects locally.`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Import failed.");
  }
});

dom.exportButton.addEventListener("click", () => {
  const blob = new Blob([exportPortfolio(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fewer-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Portable portfolio exported.");
});

dom.resetDemoButton.addEventListener("click", () => {
  dom.resetDialog.showModal();
});

dom.resetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    dom.resetDialog.close();
    return;
  }
  clearState();
  persist(createDefaultState(), "Sample portfolio restored.");
  dom.resetDialog.close();
});

render();
if (loaded.recovered) {
  showToast("Saved data was unreadable, so Fewer opened a safe sample instead.");
}
