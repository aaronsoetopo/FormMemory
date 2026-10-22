import { getEntries, getDismissed, addDismissal } from "./lib/storage.js";
import { getApiKey, getStoredModel, resolveModel } from "./lib/gemini.js";

const SENSITIVE_RE =
  /password|passcode|ssn|social security|card number|credit card|cvv|passport|driver.?s license|bank account/i;

const STOP_WORDS = new Set([
  "what", "is", "your", "the", "please", "enter", "select", "choose",
  "provide", "of", "in", "for", "a", "an", "do", "you", "to", "which"
]);

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\*/g, "") // remove asterisks
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(str) {
  return normalize(str)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function calculateSimilarity(q1, q2) {
  const norm1 = normalize(q1);
  const norm2 = normalize(q2);

  if (norm1 === norm2 && norm1.length > 0) return 1.0;

  const tokens1 = getTokens(q1);
  const tokens2 = getTokens(q2);

  if (!tokens1.length || !tokens2.length) {
    return (norm1.includes(norm2) || norm2.includes(norm1)) ? 0.7 : 0.0;
  }

  const set2 = new Set(tokens2);
  const intersection = tokens1.filter((t) => set2.has(t));
  const union = new Set([...tokens1, ...tokens2]);

  const jaccard = intersection.length / union.size;
  const containment = intersection.length / Math.min(tokens1.length, tokens2.length);

  const subBoost = (norm1.includes(norm2) || norm2.includes(norm1)) ? 0.2 : 0;

  return Math.min(1.0, Math.max(jaccard, containment * 0.85) + subBoost);
}

// AI fallback matching using Groq/Gemini if local match is weak
async function aiFuzzyMatch(targetQuestion, candidateFields, apiKey) {
  try {
    const model = (await getStoredModel()) || (await resolveModel(apiKey));
    const candidatesList = candidateFields
      .slice(0, 10)
      .map((c, i) => `[${i + 1}] "${c.question}": "${Array.isArray(c.answer) ? c.answer.join(", ") : c.answer}"`)
      .join("\n");

    const prompt = `A user is filling out a form with the question: "${targetQuestion}".
From these candidate questions previously answered by the user, which candidate corresponds to this question?
Candidates:
${candidatesList}

Return JSON with format: {"matchIndex": number | null, "confidence": "high" | "low"}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You match form questions. Return JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 60,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (parsed.matchIndex && parsed.matchIndex >= 1 && parsed.matchIndex <= candidateFields.length) {
      if (parsed.confidence === "high" || parsed.confidence !== "low") {
        return candidateFields[parsed.matchIndex - 1];
      }
    }
  } catch (err) {
    console.warn("[FormMemory] AI match error", err);
  }
  return null;
}

// Computes suggestions for an array of question descriptors on a form
async function computeSuggestions(formId, questions) {
  const entries = await getEntries();
  if (!entries || !entries.length) return {};

  const dismissed = await getDismissed(formId);
  const apiKey = await getApiKey();

  // Extract all valid historical fields, newest submissions first
  const candidates = [];
  entries.forEach((entry) => {
    (entry.fields || []).forEach((f) => {
      if (f.sensitive) return;
      if (SENSITIVE_RE.test(f.question)) return;
      const ans = f.answer;
      if (!ans || ans === "[hidden]" || ans === "[not captured]") return;
      if (Array.isArray(ans) && !ans.length) return;

      candidates.push({
        question: f.question,
        answer: ans,
        type: f.type,
        submittedAt: entry.submittedAt,
      });
    });
  });

  if (!candidates.length) return {};

  const suggestions = {};

  for (const q of questions) {
    const qText = (q.text || "").trim();
    if (!qText) continue;
    if (q.sensitive || SENSITIVE_RE.test(qText)) continue;
    if (dismissed.includes(qText)) continue;

    // Rank candidates by fuzzy similarity
    let bestScore = 0;
    let bestCandidate = null;

    for (const cand of candidates) {
      const sim = calculateSimilarity(qText, cand.question);
      if (sim > bestScore) {
        bestScore = sim;
        bestCandidate = cand;
      }
    }

    // Strong local match
    if (bestScore >= 0.65 && bestCandidate) {
      suggestions[qText] = {
        answer: bestCandidate.answer,
        type: bestCandidate.type,
        sourceQuestion: bestCandidate.question,
        score: bestScore,
      };
      continue;
    }

    // Weak local match (0.35 <= score < 0.65) - try AI if configured
    if (bestScore >= 0.35 && apiKey) {
      // Top candidates for AI to evaluate
      const scoredCandidates = candidates
        .map((c) => ({ ...c, sim: calculateSimilarity(qText, c.question) }))
        .sort((a, b) => b.sim - a.sim);

      const aiMatch = await aiFuzzyMatch(qText, scoredCandidates, apiKey);
      if (aiMatch) {
        suggestions[qText] = {
          answer: aiMatch.answer,
          type: aiMatch.type,
          sourceQuestion: aiMatch.question,
          score: 0.9,
          viaAi: true,
        };
        continue;
      }
    }

    // If local match is moderately confident (score >= 0.5) even without AI
    if (bestScore >= 0.5 && bestCandidate) {
      suggestions[qText] = {
        answer: bestCandidate.answer,
        type: bestCandidate.type,
        sourceQuestion: bestCandidate.question,
        score: bestScore,
      };
    }
  }

  return suggestions;
}

// ---------- Message Router ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SUGGESTIONS") {
    computeSuggestions(message.formId, message.questions || [])
      .then((suggestions) => sendResponse({ suggestions }))
      .catch((err) => {
        console.warn("[FormMemory] get suggestions failed", err);
        sendResponse({ suggestions: {} });
      });
    return true; // async response
  }

  if (message.type === "ADD_DISMISSAL") {
    addDismissal(message.formId, message.question)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn("[FormMemory] add dismissal failed", err);
        sendResponse({ ok: false });
      });
    return true;
  }
});

// Toolbar icon click: open the history page, reusing an existing tab if there is one.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("history.html");
  const [existing] = await chrome.tabs.query({ url });

  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

// ---------- Toolbar badge: number of saved entries ----------

async function updateBadge() {
  try {
    const { length } = await getEntries();
    await chrome.action.setBadgeText({ text: length === 0 ? "" : length > 999 ? "999+" : String(length) });
    await chrome.action.setBadgeBackgroundColor({ color: "#0b5d57" });
    // White text on dark teal for contrast (setBadgeTextColor needs Chrome 110+).
    if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  } catch (err) {
    console.warn("[FormMemory] badge update failed", err);
  }
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.entries) updateBadge();
});
updateBadge();
