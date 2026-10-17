import { getEntries } from "./lib/storage.js";

async function init() {
  const entries = await getEntries();
  document.getElementById("count").textContent = `${entries.length} saved entries`;
}

init();
