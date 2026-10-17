import { getEntries, deleteEntry, clearAll } from "./lib/storage.js";
import { askHistory } from "./lib/gemini.js";

const DEMO_PREFIX = "demo-";

const state = {
  entries: [],
  query: "",
  selectedId: null,
  isAsking: false,
};

const els = {
  count: document.getElementById("count"),
  exportBtn: document.getElementById("export"),
  deleteAllSlot: document.getElementById("delete-all-slot"),
  search: document.getElementById("search"),
  layout: document.getElementById("layout"),
  list: document.getElementById("list"),
  detail: document.getElementById("detail"),
  empty: document.getElementById("empty"),
  emptyMessage: document.getElementById("empty-message"),
  emptyHint: document.getElementById("empty-hint"),

  // Ask section elements
  askForm: document.getElementById("ask-form"),
  askInput: document.getElementById("ask-input"),
  askBtn: document.getElementById("ask-btn"),
  askResult: document.getElementById("ask-result"),
  askAnswerText: document.getElementById("ask-answer-text"),
  askSources: document.getElementById("ask-sources"),
  askSourceLinks: document.getElementById("ask-source-links"),
  askCloseBtn: document.getElementById("ask-close-btn"),
};

// ---------- small helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const isDemo = (entry) => String(entry.id).startsWith(DEMO_PREFIX);
const answerText = (answer) => (Array.isArray(answer) ? answer.join(", ") : String(answer ?? ""));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const entryCount = (n) => (n === 1 ? "1 entry" : `${n} entries`);

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "Unknown date" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "Unknown date" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Appends text to parent, wrapping every match of the search query in <mark>.
function appendHighlighted(parent, text, query) {
  const q = query.trim();
  if (!q) {
    parent.append(text);
    return;
  }
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let pos = 0;
  while (pos < text.length) {
    const hit = lower.indexOf(needle, pos);
    if (hit === -1) break;
    parent.append(text.slice(pos, hit));
    parent.append(el("mark", "", text.slice(hit, hit + needle.length)));
    pos = hit + needle.length;
  }
  parent.append(text.slice(pos));
}

// A button that asks for confirmation inline before running onConfirm.
function twoStepButton({ label, confirmQuestion, confirmLabel, onConfirm }) {
  const slot = el("span", "confirm");

  function showInitial() {
    slot.replaceChildren();
    const button = el("button", "btn btn-danger", label);
    button.type = "button";
    button.addEventListener("click", showConfirm);
    slot.append(button);
  }

  function showConfirm() {
    slot.replaceChildren();
    const yes = el("button", "btn btn-danger-solid", confirmLabel);
    const no = el("button", "btn", "Cancel");
    yes.type = no.type = "button";
    yes.addEventListener("click", onConfirm);
    no.addEventListener("click", showInitial);
    slot.append(el("span", "confirm-text", confirmQuestion), yes, no);
    no.focus();
  }

  showInitial();
  return slot;
}

// ---------- search filtering & data ----------

function matchesQuery(entry, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (String(entry.formTitle || "").toLowerCase().includes(q)) return true;
  return (entry.fields || []).some(
    (f) =>
      f.question.toLowerCase().includes(q) ||
      answerText(f.answer).toLowerCase().includes(q)
  );
}

function visibleEntries() {
  return state.entries.filter((e) => matchesQuery(e, state.query));
}

async function load() {
  try {
    state.entries = await getEntries();
    render();
  } catch (err) {
    console.warn("[FormMemory] could not load entries", err);
    els.count.textContent = "Could not load entries.";
  }
}

// Selects an entry by ID, clearing search if it's currently hidden by the query.
function selectEntry(id) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;

  if (state.query && !matchesQuery(entry, state.query)) {
    state.query = "";
    els.search.value = "";
  }
  state.selectedId = id;
  render();

  // Scroll detail card into view smoothly
  els.detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- render ----------

function render() {
  const total = state.entries.length;
  const visible = visibleEntries();

  els.count.textContent = state.query.trim()
    ? `${visible.length} of ${entryCount(total)} match`
    : entryCount(total);
  els.exportBtn.disabled = total === 0;
  els.deleteAllSlot.hidden = total === 0;

  if (!visible.some((e) => e.id === state.selectedId)) {
    state.selectedId = visible.length ? visible[0].id : null;
  }

  if (visible.length === 0) {
    els.layout.hidden = true;
    els.empty.hidden = false;
    if (total === 0) {
      els.emptyMessage.textContent = "Open any Google Form and submit it, and your answers will show up here.";
      els.emptyHint.replaceChildren("Want to look around first? Load demo data from ");
      const link = el("a", "", "Options");
      link.href = "options.html";
      els.emptyHint.append(link, ".");
    } else {
      els.emptyMessage.textContent = `No entries match “${state.query.trim()}”.`;
      els.emptyHint.textContent = "Try a different word, or clear the search box.";
    }
    return;
  }

  els.layout.hidden = false;
  els.empty.hidden = true;
  renderList(visible);
  renderDetail(visible.find((e) => e.id === state.selectedId));
}

function renderList(visible) {
  // visible is already newest first, so groups come out ordered by their newest entry.
  const groups = new Map();
  visible.forEach((entry) => {
    const title = entry.formTitle || "Untitled form";
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(entry);
  });

  const scrollTop = els.list.scrollTop;
  els.list.replaceChildren();
  groups.forEach((entries, title) => {
    const group = el("div", "group");
    const heading = el("h2", "group-title");
    heading.append(el("span", "", title), el("span", "", String(entries.length)));
    group.append(heading);

    entries.forEach((entry) => {
      const button = el("button", "entry");
      button.type = "button";
      button.setAttribute("aria-current", String(entry.id === state.selectedId));
      const date = el("span", "entry-date", formatDate(entry.submittedAt));
      if (isDemo(entry)) date.append(el("span", "tag", "Demo"));
      button.append(date, el("span", "entry-meta", plural(entry.fields.length, "answer")));
      button.addEventListener("click", () => {
        state.selectedId = entry.id;
        render();
      });
      group.append(button);
    });
    els.list.append(group);
  });
  els.list.scrollTop = scrollTop;
}

function renderDetail(entry) {
  els.detail.replaceChildren();
  if (!entry) return;

  const head = el("div", "detail-head");
  const info = el("div");
  const title = el("h2", "detail-title");
  appendHighlighted(title, entry.formTitle || "Untitled form", state.query);
  if (isDemo(entry)) title.append(el("span", "tag", "Demo"));

  const meta = el("p", "detail-meta");
  meta.append(`Submitted ${formatDateTime(entry.submittedAt)} · ${plural(entry.fields.length, "answer")}`);
  if (entry.formUrl) {
    const link = el("a", "", "Open form");
    link.href = entry.formUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    meta.append(" · ", link);
  }
  info.append(title, meta);

  head.append(
    info,
    twoStepButton({
      label: "Delete",
      confirmQuestion: "Delete this entry?",
      confirmLabel: "Yes, delete",
      onConfirm: () => removeEntry(entry.id),
    })
  );
  els.detail.append(head);

  (entry.fields || []).forEach((field) => els.detail.append(renderAnswer(field)));
}

function renderAnswer(field) {
  const row = el("div", "answer");
  const question = el("h3", "question");
  appendHighlighted(question, field.question, state.query);
  row.append(question);

  const body = el("div", "answer-body");
  if (field.sensitive) {
    body.classList.add("answer-hidden");
    body.append(answerText(field.answer), el("span", "tag", "Private"));
  } else if (Array.isArray(field.answer)) {
    body.className = "answer-body chips";
    field.answer.forEach((item) => {
      const chip = el("span", "chip");
      appendHighlighted(chip, String(item), state.query);
      body.append(chip);
    });
  } else {
    appendHighlighted(body, answerText(field.answer), state.query);
  }
  row.append(body);

  const copy = el("button", "btn", "Copy");
  copy.type = "button";
  if (field.sensitive) {
    copy.disabled = true;
    copy.title = "Hidden answers are never stored, so there is nothing to copy.";
  } else {
    copy.addEventListener("click", () => copyText(answerText(field.answer), copy));
  }
  row.append(copy);
  return row;
}

// ---------- actions ----------

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch (err) {
    console.warn("[FormMemory] copy failed", err);
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = "Copy"), 1500);
}

async function removeEntry(id) {
  try {
    const visible = visibleEntries();
    const index = visible.findIndex((e) => e.id === id);
    const next = visible[index + 1] || visible[index - 1];
    await deleteEntry(id);
    state.selectedId = next ? next.id : null;
    await load();
  } catch (err) {
    console.warn("[FormMemory] delete failed", err);
  }
}

async function deleteAll() {
  try {
    await clearAll();
    state.selectedId = null;
    await load();
  } catch (err) {
    console.warn("[FormMemory] delete all failed", err);
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `formmemory-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Ask your history (Gemini) ----------

async function handleAsk(question) {
  const q = (question || "").trim();
  if (!q) return;

  state.isAsking = true;
  els.askBtn.disabled = true;
  els.askResult.hidden = false;
  els.askAnswerText.className = "ask-answer-text loading-pulse";
  els.askAnswerText.textContent = "Thinking… searching relevant form entries with Groq";
  els.askSources.hidden = true;
  els.askSourceLinks.replaceChildren();

  try {
    const result = await askHistory(q, state.entries);

    els.askAnswerText.className = "ask-answer-text";
    els.askAnswerText.textContent = result.answer;

    if (result.sourceEntryIds && result.sourceEntryIds.length) {
      els.askSources.hidden = false;
      result.sourceEntryIds.forEach((id) => {
        const entry = state.entries.find((e) => e.id === id);
        const label = entry ? `${entry.formTitle} (${formatDate(entry.submittedAt)})` : `Entry ${id.slice(0, 8)}`;
        const btn = el("button", "source-btn", label);
        btn.type = "button";
        btn.title = "View this entry in detail";
        btn.addEventListener("click", () => selectEntry(id));
        els.askSourceLinks.append(btn);
      });
    } else {
      els.askSources.hidden = true;
    }
  } catch (err) {
    console.warn("[FormMemory] Ask error", err);
    els.askAnswerText.className = "ask-answer-text";
    els.askAnswerText.textContent = `Could not get answer: ${err.message}`;
    els.askSources.hidden = true;
  } finally {
    state.isAsking = false;
    els.askBtn.disabled = false;
  }
}

els.askForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAsk(els.askInput.value);
});

els.askCloseBtn.addEventListener("click", () => {
  els.askResult.hidden = true;
  els.askAnswerText.textContent = "";
  els.askSourceLinks.replaceChildren();
});

document.querySelectorAll(".example-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    els.askInput.value = chip.textContent.trim();
    handleAsk(els.askInput.value);
  });
});

// ---------- wiring ----------

els.deleteAllSlot.append(
  twoStepButton({
    label: "Delete all",
    confirmQuestion: "Delete every entry?",
    confirmLabel: "Yes, delete all",
    onConfirm: deleteAll,
  })
);

els.exportBtn.addEventListener("click", exportJson);

// Instant keyword search as user types
els.search.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});

// "/" jumps to search box, unless already typing in an input
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    document.activeElement !== els.search &&
    document.activeElement !== els.askInput
  ) {
    event.preventDefault();
    els.search.focus();
  }
});

// Pick up entries saved (or demo data loaded) while this page is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.entries) load();
});

load();
