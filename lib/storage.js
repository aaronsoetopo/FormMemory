// Entry CRUD on chrome.storage.local. All entries live under one key.
const KEY = "entries";

async function readAll() {
  const result = await chrome.storage.local.get(KEY);
  return result[KEY] || [];
}

async function writeAll(entries) {
  await chrome.storage.local.set({ [KEY]: entries });
}

// Adds an entry (generating an id if missing) and returns it.
// If an entry with the same id already exists it is replaced, so retried saves don't duplicate.
export async function addEntry(entry) {
  const entries = await readAll();
  const saved = { ...entry, id: entry.id || crypto.randomUUID() };
  const index = entries.findIndex((e) => e.id === saved.id);
  if (index === -1) entries.push(saved);
  else entries[index] = saved;
  await writeAll(entries);
  return saved;
}

// Returns all entries, newest first (by submittedAt).
export async function getEntries() {
  const entries = await readAll();
  return entries.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export async function deleteEntry(id) {
  const entries = await readAll();
  await writeAll(entries.filter((e) => e.id !== id));
}

export async function clearAll() {
  await writeAll([]);
}

// Shallow-merges changes into the entry with this id. Returns the updated entry, or null if not found.
export async function updateEntry(id, changes) {
  const entries = await readAll();
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return null;
  entries[index] = { ...entries[index], ...changes, id };
  await writeAll(entries);
  return entries[index];
}

const DISMISSALS_KEY = "dismissedSuggestions";

// Returns array of dismissed questions for a specific formId
export async function getDismissed(formId) {
  const result = await chrome.storage.local.get(DISMISSALS_KEY);
  const all = result[DISMISSALS_KEY] || {};
  return all[formId] || [];
}

// Remembers that a question suggestion was dismissed on a specific form
export async function addDismissal(formId, question) {
  const result = await chrome.storage.local.get(DISMISSALS_KEY);
  const all = result[DISMISSALS_KEY] || {};
  const list = all[formId] || [];
  if (!list.includes(question)) {
    list.push(question);
    all[formId] = list;
    await chrome.storage.local.set({ [DISMISSALS_KEY]: all });
  }
}

