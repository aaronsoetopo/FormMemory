import { addEntry, getEntries, deleteEntry } from "./lib/storage.js";
import { getApiKey, setApiKey, testApiKey, getStoredModel, setStoredModel, fetchAvailableModels } from "./lib/gemini.js";

const DEMO_PREFIX = "demo-";

const keyInput = document.getElementById("gemini-key");
const toggleKeyBtn = document.getElementById("toggle-key-visibility");
const saveKeyBtn = document.getElementById("save-key");
const testKeyBtn = document.getElementById("test-key");
const keyStatus = document.getElementById("key-status");
const modelSelect = document.getElementById("model-select");

const loadDemoBtn = document.getElementById("load-demo");
const clearDemoBtn = document.getElementById("clear-demo");
const demoStatus = document.getElementById("demo-status");

// ---------- Groq API key & model management ----------

function updateModelDropdown(models, selected) {
  if (!models || !models.length) return;
  modelSelect.replaceChildren();
  models.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    if (id === selected) opt.selected = true;
    modelSelect.append(opt);
  });
}

async function initKey() {
  const key = await getApiKey();
  const storedModel = await getStoredModel();

  if (key) {
    keyInput.value = key;
    setKeyStatus("API key is saved.", "status-info");

    try {
      const models = await fetchAvailableModels(key);
      if (models.length) {
        updateModelDropdown(models, storedModel || models[0]);
      }
    } catch {
      // Offline or invalid key on load
    }
  }
}

function setKeyStatus(text, type = "") {
  keyStatus.className = `status-msg ${type}`;
  keyStatus.textContent = text;
}

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = keyInput.type === "password";
  keyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

modelSelect.addEventListener("change", async () => {
  await setStoredModel(modelSelect.value);
  setKeyStatus(`Active model set to: ${modelSelect.value}`, "status-info");
});

async function saveKey() {
  const val = keyInput.value.trim();
  await setApiKey(val);
  if (val) {
    setKeyStatus("API key saved.", "status-success");
    try {
      const models = await fetchAvailableModels(val);
      if (models.length) {
        updateModelDropdown(models, models[0]);
        await setStoredModel(models[0]);
      }
    } catch {
      // Ignore
    }
  } else {
    setKeyStatus("API key cleared.", "status-info");
  }
}

saveKeyBtn.addEventListener("click", saveKey);

testKeyBtn.addEventListener("click", async () => {
  const val = keyInput.value.trim();
  if (!val) {
    setKeyStatus("Please enter an API key first.", "status-error");
    return;
  }

  // Save first so testing tests the current state
  await setApiKey(val);

  testKeyBtn.disabled = true;
  setKeyStatus("Testing API key and discovering active models...", "status-info");

  try {
    const res = await testApiKey(val);
    if (res.ok) {
      if (res.models && res.models.length) {
        updateModelDropdown(res.models, res.chosenModel);
      }
      setKeyStatus(`✓ ${res.message}`, "status-success");
    } else {
      setKeyStatus(`✗ ${res.error}`, "status-error");
    }
  } catch (err) {
    setKeyStatus(`✗ Test failed: ${err.message}`, "status-error");
  } finally {
    testKeyBtn.disabled = false;
  }
});

// ---------- Demo data management ----------

function setDemoStatus(text, type = "") {
  demoStatus.className = `status-msg ${type}`;
  demoStatus.textContent = text;
}

loadDemoBtn.addEventListener("click", async () => {
  loadDemoBtn.disabled = true;
  setDemoStatus("Loading demo data...", "status-info");
  try {
    const res = await fetch(chrome.runtime.getURL("seed/seed.json"));
    const seed = await res.json();
    for (const entry of seed) {
      await addEntry(entry);
    }
    setDemoStatus(`✓ Loaded ${seed.length} demo entries.`, "status-success");
  } catch (err) {
    console.warn("[FormMemory] demo load error", err);
    setDemoStatus("Could not load demo data. See console.", "status-error");
  } finally {
    loadDemoBtn.disabled = false;
  }
});

clearDemoBtn.addEventListener("click", async () => {
  clearDemoBtn.disabled = true;
  setDemoStatus("Clearing demo data...", "status-info");
  try {
    const demos = (await getEntries()).filter((e) => String(e.id).startsWith(DEMO_PREFIX));
    for (const entry of demos) {
      await deleteEntry(entry.id);
    }
    if (demos.length) {
      setDemoStatus(`✓ Removed ${demos.length} demo entries.`, "status-success");
    } else {
      setDemoStatus("No demo entries found to remove.", "status-info");
    }
  } catch (err) {
    console.warn("[FormMemory] demo clear error", err);
    setDemoStatus("Could not clear demo data. See console.", "status-error");
  } finally {
    clearDemoBtn.disabled = false;
  }
});

initKey();
