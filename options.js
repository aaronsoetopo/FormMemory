import { addEntry, getEntries, deleteEntry } from "./lib/storage.js";

// Demo entries are the ones whose id starts with this prefix (see seed/seed.json).
const DEMO_PREFIX = "demo-";

const status = document.getElementById("status");
const loadButton = document.getElementById("load-demo");
const clearButton = document.getElementById("clear-demo");

async function run(button, work) {
  button.disabled = true;
  try {
    status.textContent = await work();
  } catch (err) {
    console.warn("[FormMemory] demo data action failed", err);
    status.textContent = "Something went wrong. See the console for details.";
  } finally {
    button.disabled = false;
  }
}

// Merges seed.json into storage. addEntry replaces entries with the same id, so loading twice
// never creates duplicates.
loadButton.addEventListener("click", () =>
  run(loadButton, async () => {
    const response = await fetch(chrome.runtime.getURL("seed/seed.json"));
    const seed = await response.json();
    for (const entry of seed) await addEntry(entry);
    return `Loaded ${seed.length} demo entries.`;
  })
);

// Removes only the demo entries; real entries are left alone.
clearButton.addEventListener("click", () =>
  run(clearButton, async () => {
    const demos = (await getEntries()).filter((e) => String(e.id).startsWith(DEMO_PREFIX));
    for (const entry of demos) await deleteEntry(entry.id);
    return demos.length ? `Removed ${demos.length} demo entries.` : "No demo entries to remove.";
  })
);
