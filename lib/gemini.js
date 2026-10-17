// Groq API integration with dynamic model discovery and selection.
export let MODEL = "llama-3.1-8b-instant";

const CHAT_API = "https://api.groq.com/openai/v1/chat/completions";
const MODELS_API = "https://api.groq.com/openai/v1/models";
const TIMEOUT_MS = 25000;
const STORAGE_KEY = "groqApiKey";
const LEGACY_KEY = "geminiApiKey";
const MODEL_KEY = "aiModel";

export async function getApiKey() {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY]);
  return result[STORAGE_KEY] || result[LEGACY_KEY] || "";
}

export async function setApiKey(key) {
  const val = (key || "").trim();
  await chrome.storage.local.set({ [STORAGE_KEY]: val, [LEGACY_KEY]: val });
}

export async function getStoredModel() {
  const result = await chrome.storage.local.get(MODEL_KEY);
  return result[MODEL_KEY] || "";
}

export async function setStoredModel(model) {
  MODEL = model;
  await chrome.storage.local.set({ [MODEL_KEY]: model });
}

// Fetches all chat-compatible models from the user's Groq account
export async function fetchAvailableModels(apiKey) {
  const res = await fetch(MODELS_API, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const allModels = (data.data || []).map((m) => m.id);

  // Filter to text/chat models only - exclude audio, embedding, classification, and guard models
  const chatModels = allModels.filter((id) => {
    const lower = id.toLowerCase();
    const isExcluded =
      lower.includes("whisper") ||
      lower.includes("orpheus") ||
      lower.includes("embed") ||
      lower.includes("guard") ||
      lower.includes("safeguard") ||
      lower.includes("moderation") ||
      lower.includes("tts") ||
      lower.includes("vision");
    return !isExcluded;
  });

  return chatModels;
}

// Automatically selects the best chat model from the user's available models
export async function resolveModel(apiKey) {
  const stored = await getStoredModel();
  if (stored) {
    MODEL = stored;
    return stored;
  }

  try {
    const models = await fetchAvailableModels(apiKey);
    if (models.length) {
      // Prioritize top conversational/coding models
      const priorities = [
        "llama-3.1-8b-instant",
        "llama3-8b-8192",
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama3-70b-8192",
        "qwen-2.5-32b",
        "qwen",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
      ];

      for (const p of priorities) {
        const found = models.find((m) => m.toLowerCase().includes(p));
        if (found) {
          await setStoredModel(found);
          return found;
        }
      }

      // First remaining chat model
      const picked = models[0];
      await setStoredModel(picked);
      return picked;
    }
  } catch {
    // fallback
  }

  return "llama-3.1-8b-instant";
}

// Tests a Groq API key and returns the list of available chat models
export async function testApiKey(apiKey) {
  const key = (apiKey || "").trim();
  if (!key) {
    return { ok: false, error: "Please enter an API key." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const chatModels = await fetchAvailableModels(key);
    clearTimeout(timer);

    if (!chatModels.length) {
      return { ok: false, error: "Key is valid, but no text chat models were found on this account." };
    }

    const chosenModel = await resolveModel(key);
    return {
      ok: true,
      message: `Groq API key is valid! Model: ${chosenModel}`,
      models: chatModels,
      chosenModel,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: "Connection timed out. Check your network." };
    }
    return { ok: false, error: `Groq error: ${err.message}` };
  }
}

// Selects up to 40 most relevant entries based on keyword overlap with the question.
function selectRelevantEntries(entries, question, limit = 40) {
  if (!entries || !entries.length) return [];
  if (entries.length <= limit) return entries;

  const stopWords = new Set([
    "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
    "the", "and", "for", "are", "was", "were", "did", "can", "could", "have",
    "has", "had", "does", "with", "from", "that", "this", "about", "your",
  ]);
  const tokens = (question || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const scored = entries.map((entry) => {
    let score = 0;
    const titleText = (entry.formTitle || "").toLowerCase();
    tokens.forEach((t) => {
      if (titleText.includes(t)) score += 3;
    });

    (entry.fields || []).forEach((f) => {
      if (f.sensitive) return; // skip sensitive fields
      const qText = (f.question || "").toLowerCase();
      const aText = (Array.isArray(f.answer) ? f.answer.join(" ") : String(f.answer || "")).toLowerCase();
      tokens.forEach((t) => {
        if (qText.includes(t)) score += 2;
        if (aText.includes(t)) score += 1;
      });
    });

    return { entry, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.entry.submittedAt || "").localeCompare(String(a.entry.submittedAt || ""));
  });

  return scored.slice(0, limit).map((s) => s.entry);
}

// Compact text version of entries. Strictly skips sensitive fields.
function formatEntriesCompact(entries) {
  return entries
    .map((entry) => {
      const lines = [
        `[Entry ID: ${entry.id}] Form: "${entry.formTitle || "Untitled"}" (${entry.submittedAt || "Unknown date"})`,
      ];
      (entry.fields || []).forEach((f) => {
        if (f.sensitive) return; // Never include sensitive data
        const ans = Array.isArray(f.answer) ? f.answer.join(", ") : String(f.answer ?? "");
        if (ans.trim()) {
          lines.push(`- ${f.question}: ${ans}`);
        }
      });
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Ask a question against the user's form history via Groq.
 * @param {string} question The user's question.
 * @param {Array} entries The array of stored entries.
 * @returns {Promise<{ answer: string, sourceEntryIds: string[] }>}
 */
export async function askHistory(question, entries) {
  const q = (question || "").trim();
  if (!q) {
    return { answer: "Please enter a question to ask your history.", sourceEntryIds: [] };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      answer: "No Groq API key configured. Please open the FormMemory Options page to set your Groq API key.",
      sourceEntryIds: [],
    };
  }

  if (!entries || !entries.length) {
    return {
      answer: "You don't have any saved form entries yet. Submit a form or load demo data to ask questions.",
      sourceEntryIds: [],
    };
  }

  const relevant = selectRelevantEntries(entries, q, 40);
  const compactContext = formatEntriesCompact(relevant);

  const systemInstruction =
    "Answer ONLY from the provided entries. If the answer is not there, say so. Return JSON with format: {\"answer\": \"string\", \"sourceEntryIds\": [\"string\"]}.";

  const userPrompt = `User Question: ${q}\n\nForm History Entries:\n${compactContext}`;

  const activeModel = await resolveModel(apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timer);
    const data = await res.json();

    if (!res.ok) {
      const errMessage = data.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) {
        return {
          answer: "Groq API key error: Invalid API key. Please check your key in Options.",
          sourceEntryIds: [],
        };
      }
      if (res.status === 429) {
        return {
          answer: "Groq rate limit reached. Please wait a few seconds and try again.",
          sourceEntryIds: [],
        };
      }
      return {
        answer: `Groq API error (${activeModel}): ${errMessage}`,
        sourceEntryIds: [],
      };
    }

    const rawOutput = data.choices?.[0]?.message?.content;
    if (!rawOutput) {
      return {
        answer: "No answer returned. Please try rephrasing your question.",
        sourceEntryIds: [],
      };
    }

    try {
      const parsed = JSON.parse(rawOutput);
      const availableIds = new Set(relevant.map((e) => e.id));
      const sourceEntryIds = Array.isArray(parsed.sourceEntryIds)
        ? parsed.sourceEntryIds.filter((id) => availableIds.has(id))
        : [];

      return {
        answer: parsed.answer || "No specific answer found in your saved entries.",
        sourceEntryIds,
      };
    } catch {
      return {
        answer: rawOutput.trim(),
        sourceEntryIds: [],
      };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        answer: "Request timed out while contacting Groq. Please check your internet connection.",
        sourceEntryIds: [],
      };
    }
    return {
      answer: `Network or request error: ${err.message}`,
      sourceEntryIds: [],
    };
  }
}
