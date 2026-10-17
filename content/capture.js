// Runs on docs.google.com/forms/*. Keeps a draft of the user's answers and saves
// one Entry when the form is submitted. Never throws: everything is try/catch + log.
(() => {
  const LOG = "[FormMemory]";
  const DEBOUNCE_MS = 300;
  const STALE_DRAFT_MS = 30 * 60 * 1000; // a draft untouched this long is dropped on a fresh form load
  const HIDDEN = "[hidden]";
  const NOT_CAPTURED = "[not captured]";
  const SENSITIVE_RE =
    /password|passcode|ssn|social security|card number|credit card|cvv|passport|driver.?s license|bank account/i;
  const CONTROLS =
    'input:not([type="hidden"]), textarea, [role="listbox"], [role="radio"], [role="checkbox"]';

  if (window.__formMemoryLoaded) return;
  window.__formMemoryLoaded = true;

  let finished = false; // true once a submit was accepted; stops further draft updates
  let debounceTimer = null;
  let storagePromise = null;

  function log(...args) {
    console.log(LOG, ...args);
  }

  function logError(where, err) {
    console.warn(LOG, where, err);
  }

  // ---------- form identity ----------

  // /forms/d/e/<id>/viewform (public) or /forms/d/<id>/viewform (owner view)
  function getFormId() {
    const match = location.pathname.match(/\/forms\/d\/(?:e\/)?([^/]+)/);
    return match ? match[1] : null;
  }

  function getFormTitle() {
    const h1 = document.querySelector('div[role="heading"][aria-level="1"]');
    const fromHeading = h1 && h1.textContent.trim();
    return fromHeading || document.title.replace(/\s*-\s*Google Forms\s*$/i, "").trim();
  }

  function getFormUrl(formId) {
    const isPublic = /\/forms\/d\/e\//.test(location.pathname);
    return `${location.origin}/forms/d/${isPublic ? "e/" : ""}${formId}/viewform`;
  }

  // ---------- reading answers from the DOM ----------

  function optionLabel(el) {
    return (el.getAttribute("aria-label") || el.getAttribute("data-value") || el.textContent || "").trim();
  }

  // "Other" options carry a free-text input; use what the user typed there.
  function resolveOther(item, el, label) {
    if (el.getAttribute("data-value") !== "__other_option__") return label;
    const input = item.querySelector('input[type="text"]');
    return (input && input.value.trim()) || label;
  }

  // Returns { key, question, type, answer, sensitive, required, invalid, empty } or null if the
  // list item is not a question (e.g. a section header).
  function readItem(item, counts) {
    const headingEl = item.querySelector('div[role="heading"]');
    if (!headingEl) return null;
    const rawHeading = headingEl.textContent.trim();
    const question = rawHeading.replace(/\s*\*$/, "").trim();
    if (!question) return null;
    if (!item.querySelector(CONTROLS) && !item.querySelector('input[type="file"]')) return null;

    counts[question] = (counts[question] || 0) + 1;
    const key = counts[question] === 1 ? question : `${question}#${counts[question]}`;
    const info = {
      key,
      question,
      type: "other",
      answer: "",
      sensitive: false,
      required: /\*$/.test(rawHeading) || !!item.querySelector('[aria-required="true"]'),
      invalid: !!item.querySelector('[aria-invalid="true"]'),
      empty: true,
    };

    // File uploads and grids are not captured.
    const isFile = !!item.querySelector('input[type="file"], [aria-label*="Add file" i]');
    const isGrid =
      !!item.querySelector('[role="grid"], table') ||
      item.querySelectorAll('[role="radiogroup"]').length > 1 ||
      item.querySelectorAll('[role="group"]').length > 1;
    if (isFile || isGrid) {
      info.answer = NOT_CAPTURED;
      return info;
    }

    const radios = item.querySelectorAll('[role="radio"]');
    const checkboxes = item.querySelectorAll('[role="checkbox"]');
    const listbox = item.querySelector('[role="listbox"]');
    const textarea = item.querySelector("textarea");
    const inputs = item.querySelectorAll('input:not([type="hidden"])');
    const hasPassword = !!item.querySelector('input[type="password"]');
    let answer = "";

    if (radios.length) {
      info.type = "choice";
      const checked = Array.from(radios).find((r) => r.getAttribute("aria-checked") === "true");
      answer = checked ? resolveOther(item, checked, optionLabel(checked)) : "";
    } else if (checkboxes.length) {
      info.type = "checkbox";
      answer = Array.from(checkboxes)
        .filter((c) => c.getAttribute("aria-checked") === "true")
        .map((c) => resolveOther(item, c, optionLabel(c)))
        .filter(Boolean);
    } else if (listbox) {
      info.type = "dropdown";
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));
      const selected = options.find((o) => o.getAttribute("aria-selected") === "true");
      // The first option is Google's "Choose" placeholder, not a real answer.
      answer = selected && options.indexOf(selected) > 0 ? optionLabel(selected) : "";
    } else if (textarea) {
      info.type = "paragraph";
      answer = textarea.value.trim();
    } else if (inputs.length === 1) {
      const input = inputs[0];
      info.type = input.type === "date" ? "date" : "text";
      answer = input.value.trim();
    } else if (inputs.length > 1) {
      // e.g. time or duration pickers: several small inputs.
      answer = Array.from(inputs).map((i) => i.value.trim()).filter(Boolean).join(":");
    }

    info.empty = Array.isArray(answer) ? answer.length === 0 : answer === "";

    // Privacy: never keep the real value of a sensitive question, not even in the draft.
    if (hasPassword || SENSITIVE_RE.test(question)) {
      info.sensitive = true;
      answer = info.empty ? "" : HIDDEN;
    }
    info.answer = answer;
    return info;
  }

  // All questions currently on the page (top-level list items only: checkbox options are
  // nested list items and must be skipped).
  function readPage() {
    const counts = {};
    const items = [];
    document.querySelectorAll('div[role="listitem"]').forEach((el) => {
      if (el.parentElement && el.parentElement.closest('div[role="listitem"]')) return;
      try {
        const info = readItem(el, counts);
        if (info) items.push(info);
      } catch (err) {
        logError("readItem failed", err);
      }
    });
    return items;
  }

  // ---------- draft (sessionStorage, so it survives Next/Back page reloads) ----------

  const draftKey = (formId) => `formmemory:draft:${formId}`;
  const pendingKey = (formId) => `formmemory:pending:${formId}`;

  function loadJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logError("loadJson failed", err);
      return null;
    }
  }

  function saveJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      logError("saveJson failed", err);
    }
  }

  function removeKey(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (err) {
      logError("removeKey failed", err);
    }
  }

  // Merge what is on screen into the draft. Questions from other pages are kept.
  function updateDraft() {
    if (finished) return;
    const formId = getFormId();
    if (!formId) return;
    const items = readPage();
    if (!items.length) return;

    const draft = loadJson(draftKey(formId)) || { formId, formTitle: "", fields: [] };
    draft.formTitle = getFormTitle() || draft.formTitle;
    draft.updatedAt = Date.now();

    items.forEach((info) => {
      const index = draft.fields.findIndex((f) => f.key === info.key);
      if (info.empty) {
        if (index !== -1) draft.fields.splice(index, 1); // user cleared the answer
        return;
      }
      const field = {
        key: info.key,
        question: info.question,
        type: info.type,
        answer: info.answer,
        sensitive: info.sensitive,
      };
      if (index === -1) draft.fields.push(field);
      else draft.fields[index] = field;
    });
    saveJson(draftKey(formId), draft);
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        updateDraft();
      } catch (err) {
        logError("updateDraft failed", err);
      }
    }, DEBOUNCE_MS);
  }

  // ---------- saving ----------

  // lib/storage.js is an ES module, so a classic content script loads it dynamically.
  function getStorage() {
    if (!storagePromise) {
      storagePromise = import(chrome.runtime.getURL("lib/storage.js")).catch((err) => {
        storagePromise = null;
        throw err;
      });
    }
    return storagePromise;
  }

  function buildEntry(draft) {
    const fields = (draft.fields || []).map(({ question, type, answer, sensitive }) => ({
      question,
      type,
      answer,
      sensitive,
    }));
    return {
      id: crypto.randomUUID(),
      formId: draft.formId,
      formTitle: draft.formTitle || getFormTitle(),
      formUrl: getFormUrl(draft.formId),
      submittedAt: new Date().toISOString(),
      fields,
      org: null,
    };
  }

  function showToast(text) {
    try {
      const toast = document.createElement("div");
      toast.id = "formmemory-toast";
      toast.textContent = text;
      toast.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
        "background:#202124;color:#fff;padding:10px 18px;border-radius:8px;" +
        "font:14px/1.2 Roboto,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);" +
        "opacity:1;transition:opacity .4s";
      document.body.appendChild(toast);
      setTimeout(() => (toast.style.opacity = "0"), 2200);
      setTimeout(() => toast.remove(), 2700);
    } catch (err) {
      logError("showToast failed", err);
    }
  }

  // The entry is parked in sessionStorage first. If the page navigates away before addEntry
  // finishes, the confirmation page picks it up (addEntry upserts by id, so no duplicates).
  async function saveEntry(entry) {
    try {
      saveJson(pendingKey(entry.formId), entry);
      const { addEntry } = await getStorage();
      await addEntry(entry);
      removeKey(pendingKey(entry.formId));
      removeKey(draftKey(entry.formId));
      log("saved entry", entry.id);
      showToast("Saved to FormMemory");
    } catch (err) {
      logError("saveEntry failed", err);
    }
  }

  // ---------- submit detection ----------

  function isSubmitButton(button) {
    return (button.textContent || "").trim().toLowerCase() === "submit";
  }

  // Google blocks the submit if a required answer is missing or invalid; don't save then.
  function pageIsSubmittable(items) {
    return !items.some((info) => info.invalid || (info.required && info.empty));
  }

  function handleSubmit() {
    const formId = getFormId();
    if (!formId || finished) return;
    const items = readPage();
    if (!pageIsSubmittable(items)) {
      log("submit ignored: required or invalid answers on this page");
      return;
    }
    updateDraft();
    const draft = loadJson(draftKey(formId));
    if (!draft || !draft.fields.length) {
      log("submit ignored: nothing captured");
      return;
    }
    finished = true;
    saveEntry(buildEntry(draft));
  }

  function onClick(event) {
    try {
      const target = event.target;
      const button = target && target.closest ? target.closest('[role="button"]') : null;
      if (!button) return;
      updateDraft(); // flush now: Next/Back/Submit may navigate before the debounce fires
      if (isSubmitButton(button)) handleSubmit();
    } catch (err) {
      logError("onClick failed", err);
    }
  }

  // ---------- confirmation page ----------

  // /formResponse is also the URL of pages 2+ of a multi-page form (Next/Back post there), so
  // only treat it as "submitted" when no questions or Next/Back/Submit buttons are on screen.
  function looksLikeConfirmation() {
    if (readPage().length) return false;
    return !Array.from(document.querySelectorAll('[role="button"]')).some((b) =>
      /^(next|back|submit)$/i.test((b.textContent || "").trim())
    );
  }

  async function handleLoad() {
    const formId = getFormId();
    if (!formId) return;

    if (/\/formResponse/.test(location.pathname)) {
      const pending = loadJson(pendingKey(formId));
      if (pending) {
        finished = true;
        await saveEntry(pending);
        return;
      }
      const draft = loadJson(draftKey(formId));
      if (draft && draft.fields.length && looksLikeConfirmation()) {
        finished = true;
        await saveEntry(buildEntry(draft));
      }
      return;
    }

    // Fresh form load: drop an old abandoned draft so its answers don't leak into a new one.
    const draft = loadJson(draftKey(formId));
    if (draft && Date.now() - (draft.updatedAt || 0) > STALE_DRAFT_MS) {
      removeKey(draftKey(formId));
    }
  }

  // ---------- start ----------

  function start() {
    try {
      getStorage().catch((err) => logError("storage preload failed", err));

      document.addEventListener("click", onClick, true);
      document.addEventListener("input", scheduleUpdate, true);
      document.addEventListener("change", scheduleUpdate, true);

      // Multi-page forms re-render questions; selections show up as aria attribute changes.
      new MutationObserver(scheduleUpdate).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-checked", "aria-selected"],
      });

      handleLoad().catch((err) => logError("handleLoad failed", err));
      scheduleUpdate();
      log("capture ready");
    } catch (err) {
      logError("start failed", err);
    }
  }

  start();
})();
