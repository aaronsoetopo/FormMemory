// Runs on docs.google.com/forms/*. Suggests answers from the user's past history.
// NEVER auto-fills; the user must click [Use]. All styling is encapsulated in Shadow DOM.
(() => {
  const LOG = "[FormMemory:Suggest]";
  const SENSITIVE_RE =
    /password|passcode|ssn|social security|card number|credit card|cvv|passport|driver.?s license|bank account/i;

  if (window.__formMemorySuggestLoaded) return;
  window.__formMemorySuggestLoaded = true;

  let isScanning = false;
  let scanTimer = null;

  function log(...args) {
    console.log(LOG, ...args);
  }

  function logError(where, err) {
    console.warn(LOG, where, err);
  }

  function getFormId() {
    const match = location.pathname.match(/\/forms\/d\/(?:e\/)?([^/]+)/);
    return match ? match[1] : null;
  }

  // Native value setter ensures framework internal models (React, Closure) detect the change
  function setNativeValue(element, value) {
    if (!element) return false;
    element.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.blur();
    return true;
  }

  // Fills a radio group
  function fillRadio(item, targetAnswer) {
    const radios = Array.from(item.querySelectorAll('[role="radio"]'));
    if (!radios.length) return false;

    const target = String(targetAnswer).trim().toLowerCase();
    const match = radios.find((r) => {
      const val = (r.getAttribute("data-value") || r.getAttribute("aria-label") || r.textContent || "")
        .trim()
        .toLowerCase();
      return val === target || val.includes(target) || target.includes(val);
    });

    if (match) {
      match.scrollIntoView({ behavior: "smooth", block: "nearest" });
      match.click();
      match.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  // Fills a checkbox group
  function fillCheckbox(item, targetAnswer) {
    const checkboxes = Array.from(item.querySelectorAll('[role="checkbox"]'));
    if (!checkboxes.length) return false;

    const targets = Array.isArray(targetAnswer)
      ? targetAnswer.map((s) => String(s).trim().toLowerCase())
      : String(targetAnswer).split(",").map((s) => s.trim().toLowerCase());

    let clicked = false;
    checkboxes.forEach((cb) => {
      const val = (cb.getAttribute("data-value") || cb.getAttribute("aria-label") || cb.textContent || "")
        .trim()
        .toLowerCase();
      const shouldCheck = targets.some((t) => t && (val === t || val.includes(t) || t.includes(val)));
      const isChecked = cb.getAttribute("aria-checked") === "true";

      if (shouldCheck && !isChecked) {
        cb.click();
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        clicked = true;
      }
    });

    return clicked;
  }

  // Fills a dropdown listbox
  async function fillDropdown(item, targetAnswer) {
    const listbox = item.querySelector('[role="listbox"]');
    if (!listbox) return false;

    const target = String(targetAnswer).trim().toLowerCase();

    // Check if options are already in DOM or if listbox needs to be clicked
    let options = Array.from(listbox.querySelectorAll('[role="option"]'));
    const foundDirectly = options.some(
      (o) => (o.getAttribute("data-value") || o.textContent || "").trim().toLowerCase() === target
    );

    if (!foundDirectly) {
      listbox.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const allOptions = Array.from(document.querySelectorAll('[role="option"]'));
    const match = allOptions.find((o) => {
      const val = (o.getAttribute("data-value") || o.getAttribute("aria-label") || o.textContent || "")
        .trim()
        .toLowerCase();
      return val === target || val.includes(target) || target.includes(val);
    });

    if (match) {
      match.click();
      return true;
    }
    return false;
  }

  // Applies the suggested answer to the target question's inputs
  async function applySuggestion(item, suggestion) {
    const ans = suggestion.answer;
    if (ans === undefined || ans === null) return false;

    // 1. Textarea
    const textarea = item.querySelector("textarea");
    if (textarea) {
      return setNativeValue(textarea, Array.isArray(ans) ? ans.join("\n") : String(ans));
    }

    // 2. Radio
    const radios = item.querySelectorAll('[role="radio"]');
    if (radios.length) {
      return fillRadio(item, ans);
    }

    // 3. Checkbox
    const checkboxes = item.querySelectorAll('[role="checkbox"]');
    if (checkboxes.length) {
      return fillCheckbox(item, ans);
    }

    // 4. Dropdown listbox
    const listbox = item.querySelector('[role="listbox"]');
    if (listbox) {
      return await fillDropdown(item, ans);
    }

    // 5. Date input
    const dateInput = item.querySelector('input[type="date"]');
    if (dateInput) {
      const raw = String(ans).trim();
      const m = raw.match(/\d{4}-\d{2}-\d{2}/);
      return setNativeValue(dateInput, m ? m[0] : raw);
    }

    // 6. Generic single text/email input
    const textInput = item.querySelector('input:not([type="hidden"])');
    if (textInput) {
      return setNativeValue(textInput, Array.isArray(ans) ? ans.join(", ") : String(ans));
    }

    return false;
  }

  // Renders a shadow-DOM suggestion chip next to a question heading
  function renderSuggestionChip(item, questionText, suggestion, formId) {
    if (item.dataset.fmSuggested) return;
    item.dataset.fmSuggested = "true";

    const heading = item.querySelector('div[role="heading"]');
    if (!heading) return;

    const host = document.createElement("div");
    host.className = "fm-suggest-host";
    const shadow = host.attachShadow({ mode: "open" });

    const displayAnswer = Array.isArray(suggestion.answer)
      ? suggestion.answer.join(", ")
      : String(suggestion.answer ?? "");

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-block;
        margin: 6px 0 8px 4px;
        vertical-align: middle;
        font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        line-height: 1.3;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #e6f4ea;
        border: 1px solid #ceead6;
        border-radius: 16px;
        padding: 3px 8px 3px 12px;
        color: #137333;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .label {
        color: #1e4620;
        font-weight: 500;
      }
      .val {
        font-weight: 600;
        color: #0d652d;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
      }
      .actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 2px;
      }
      button {
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        border-radius: 12px;
        padding: 2px 8px;
        cursor: pointer;
        border: none;
        transition: background 0.15s ease, opacity 0.15s ease;
      }
      .btn-use {
        background: #137333;
        color: #ffffff;
      }
      .btn-use:hover {
        background: #0d5a27;
      }
      .btn-dismiss {
        background: transparent;
        color: #5f6368;
      }
      .btn-dismiss:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #202124;
      }
      .applied {
        background: #0d652d !important;
        color: #fff !important;
      }
    `;

    const container = document.createElement("div");
    container.className = "chip";

    const labelSpan = document.createElement("span");
    labelSpan.className = "label";
    labelSpan.textContent = "Last time:";

    const valSpan = document.createElement("span");
    valSpan.className = "val";
    valSpan.textContent = displayAnswer;
    valSpan.title = displayAnswer;

    const actions = document.createElement("div");
    actions.className = "actions";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn-use";
    useBtn.textContent = "Use";

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "btn-dismiss";
    dismissBtn.textContent = "Dismiss";

    actions.append(useBtn, dismissBtn);
    container.append(labelSpan, valSpan, actions);
    shadow.append(style, container);

    // Event listener: Use
    useBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      useBtn.disabled = true;
      useBtn.className = "btn-use applied";
      useBtn.textContent = "Applied";

      try {
        await applySuggestion(item, suggestion);
      } catch (err) {
        logError("failed to apply suggestion", err);
      }

      setTimeout(() => {
        host.remove();
      }, 700);
    });

    // Event listener: Dismiss
    dismissBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        chrome.runtime.sendMessage({
          type: "ADD_DISMISSAL",
          formId,
          question: questionText,
        });
      } catch (err) {
        logError("failed to record dismissal", err);
      }
      host.remove();
    });

    // Insert next to question heading
    if (heading.parentElement) {
      heading.parentElement.appendChild(host);
    } else {
      item.insertBefore(host, item.firstChild);
    }
  }

  // Scans the active page for questions and requests suggestions from background worker
  async function scanQuestions() {
    if (isScanning) return;
    const formId = getFormId();
    if (!formId) return;

    // Do not suggest on confirmation or response pages
    if (/\/formResponse/.test(location.pathname)) return;

    isScanning = true;
    try {
      const items = Array.from(document.querySelectorAll('div[role="listitem"]')).filter((el) => {
        // Skip nested listitems (e.g. checkbox options)
        if (el.parentElement && el.parentElement.closest('div[role="listitem"]')) return false;
        return !el.dataset.fmSuggested;
      });

      if (!items.length) return;

      const questionDescriptors = [];
      const itemMap = new Map();

      items.forEach((item) => {
        const heading = item.querySelector('div[role="heading"]');
        if (!heading) return;

        const rawText = heading.textContent.trim();
        const cleanQuestion = rawText.replace(/\s*\*$/, "").trim();
        if (!cleanQuestion) return;

        // Privacy: Never suggest for sensitive questions or password inputs
        const hasPassword = !!item.querySelector('input[type="password"]');
        const isSensitive = hasPassword || SENSITIVE_RE.test(cleanQuestion);
        if (isSensitive) return;

        questionDescriptors.push({ text: cleanQuestion, sensitive: false });
        itemMap.set(cleanQuestion, item);
      });

      if (!questionDescriptors.length) return;

      // Request matching suggestions from background worker
      chrome.runtime.sendMessage(
        {
          type: "GET_SUGGESTIONS",
          formId,
          questions: questionDescriptors,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            log("runtime message error", chrome.runtime.lastError.message);
            return;
          }

          const suggestions = response?.suggestions || {};
          Object.entries(suggestions).forEach(([qText, suggestion]) => {
            const item = itemMap.get(qText);
            if (item && suggestion && suggestion.answer !== undefined) {
              renderSuggestionChip(item, qText, suggestion, formId);
            }
          });
        }
      );
    } catch (err) {
      logError("scanQuestions failed", err);
    } finally {
      isScanning = false;
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanQuestions();
    }, 400);
  }

  function init() {
    try {
      scheduleScan();

      // Multi-page observer (re-runs when Next/Back pages are rendered)
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes.length > 0) {
            scheduleScan();
            break;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      log("suggestion listener initialized");
    } catch (err) {
      logError("init failed", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
