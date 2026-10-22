# FormMemory audit

Scope: read-only review of the repo at commit `16a6e4e` (working tree has an uncommitted `PROJECT_BRIEF.md`). Nothing was run, loaded in a browser, or changed. Line numbers refer to the files as read.

## 1. File map

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest. Background module worker, two content scripts on `docs.google.com/forms/*`, `options_page`, empty `action`. |
| `background.js` | Service worker. Suggestion matching (local fuzzy score, Groq fallback), message router (`GET_SUGGESTIONS`, `ADD_DISMISSAL`), toolbar click opens the history tab, badge count. |
| `content/capture.js` | Reads answers from the Google Forms DOM, keeps a draft in `sessionStorage`, saves an entry on submit or on the confirmation page. Loads `lib/storage.js` by dynamic `import()`. |
| `content/suggest.js` | Scans questions, asks the background for suggestions, renders a Shadow-DOM "Last time:" chip with Use and Dismiss. Contains the fill logic. |
| `lib/storage.js` | Entry CRUD and dismissal list on `chrome.storage.local`. |
| `lib/gemini.js` | Misnamed: it is the Groq client. API key and model get/set, model discovery, key test, `askHistory`. |
| `history.html/.js/.css` | Main UI: list, detail, search, copy, export, delete, "Ask your history", welcome banner. |
| `options.html/.js` | API key and model settings, demo data load and clear. |
| `seed/seed.json` | 221 lines of demo entries (ids prefixed `demo-`). |
| `README.md`, `PROJECT_BRIEF.md`, `CLAUDE.md` | Docs and instructions. |

**Brief mismatches:**
- `PROJECT_BRIEF.md` expects `styles/tokens.css`, and the repo has no `styles/` directory.
- It refers to `roadmap-v2.md`, which is not in the repo.
- Neither is committed, so the file layout and data model it points to cannot be checked.

## 2. Storage

All keys are in `chrome.storage.local` unless noted.

| Key | Shape | Read / written by |
|---|---|---|
| `entries` | `Entry[]` where `Entry = { id: string(uuid or "demo-…"), formId: string, formTitle: string, formUrl: string, submittedAt: ISO string, fields: Field[], org: null }` and `Field = { question: string, type: "text"\|"paragraph"\|"choice"\|"checkbox"\|"dropdown"\|"date"\|"other", answer: string\|string[], sensitive: boolean }`. A masked `answer` is `"[hidden]"`, an uncaptured one is `"[not captured]"`. | `lib/storage.js` only (R/W). Also read by `background.js` (badge, suggestions), `history.js`, `options.js`. Watched via `storage.onChanged` in `background.js` and `history.js`. |
| `dismissedSuggestions` | `{ [formId]: string[] }` (question texts) | `lib/storage.js` (R/W). |
| `groqApiKey` | string | `lib/gemini.js` (R/W). |
| `geminiApiKey` | string, a legacy key written with the same value | `lib/gemini.js` (R/W, always mirrors `groqApiKey`). |
| `aiModel` | string | `lib/gemini.js` (R/W). |
| `welcomeDismissed` | boolean | `history.js` directly, bypassing `lib/storage.js`. |
| `sessionStorage` `formmemory:draft:<formId>` | `{ formId, formTitle, fields: [{key, question, type, answer, sensitive}], updatedAt: number }` | `capture.js` (page-origin storage, not the extension's). |
| `sessionStorage` `formmemory:pending:<formId>` | a full `Entry` awaiting save | `capture.js`. |

**Observations:**
- There is **no `schemaVersion`** anywhere, so there is no migration path and no backup. The brief requires both for any stored-shape change.
- `entries` is one array that is read, modified and rewritten in full on every operation (see §5).
- `history.js:448,459` and `lib/gemini.js` call `chrome.storage.local` directly, which violates "all storage access goes through `lib/storage.js`".
- `sessionStorage` drafts live in the `docs.google.com` origin, so page scripts on that origin can read them. They never contain sensitive values (masked before save) but do contain everything else the user typed.

## 3. Network, permissions, host permissions

**Network calls (all to Groq):**
- `background.js:68` POST `https://api.groq.com/openai/v1/chat/completions` (suggestion fuzzy match). It sends the target question plus up to 10 candidate questions **and their stored answers**.
- `lib/gemini.js:33` GET `https://api.groq.com/openai/v1/models` (model discovery).
- `lib/gemini.js:243` POST chat completions (`askHistory`). It runs from `history.js`, so **the Groq call happens in the history page, not in `background.js`** (brief violation). It sends up to 40 entries of form titles, questions and answers.
- `options.js` fetches `seed/seed.json` locally via `chrome.runtime.getURL`, which is not external.
- `options.html:170` and the history page link out to `console.groq.com/keys` (a plain link, no fetch).

**Permissions:**

| Declared | Used? |
|---|---|
| `storage` | Yes. |
| `host_permissions: https://docs.google.com/forms/*` | Used by the content scripts' `matches`. Content scripts do not need `host_permissions` to run, and no extension-context fetch targets docs.google.com, so this is **likely unnecessary**. |
| *(missing)* `https://api.groq.com/*` | Fetches to Groq from the extension pages/worker rely on Groq's CORS headers. It works today but is fragile. Declaring the host is the safer practice. |
| `tabs` (not declared) | `background.js:223` calls `tabs.query({ url })` on the extension's own page. I believe URL matching of its own pages works without the permission, but I did not test it. If it fails, the toolbar click opens a duplicate tab each time. |
| `web_accessible_resources: lib/storage.js, lib/gemini.js` for `docs.google.com/*` | Needed for `import()` of `storage.js` from the content script. **`lib/gemini.js` is exposed for no reason**, and any page on `docs.google.com` can load it. See §4. |

## 4. Secrets

- **Storage:** the Groq key is stored in plaintext in `chrome.storage.local` (`groqApiKey`, duplicated as `geminiApiKey`). Local storage is not encrypted. That is acceptable for the brief's local-first model but should be stated. The duplicate legacy key doubles the exposure and is never cleaned up.
- **Logging:** I found no `console.*` call that includes the key. `fetchAvailableModels` error text uses Groq's message, not the key. `err.message` from a failed fetch is surfaced in `askHistory` (`Network or request error: …`) and `options.js`. These are unlikely to contain the key, but the request is built with the key in a header so a bad proxy error could echo it. Low risk.
- **Export:** `exportJson` (`history.js:336`) exports only `state.entries`, so the key is not exported. Good.
- **Web-accessible `lib/gemini.js`:** it contains no key, but it exports `getApiKey()`. A page script on `docs.google.com` can load the file's source, but `chrome.storage` is not available in the page's own context, so I don't see a direct way to read the key from it. The exposure is unnecessary and adds attack surface, so remove it (fix 1). I have not tested this.
- **Key sent to the page?** No. The suggestion path runs in the worker, and the key never reaches content scripts.
- **Options page:** `type="password"`, `autocomplete="off"`. The saved key is written back into the input on load (`options.js:36`), so Show reveals it to anyone at the keyboard. Could show a masked placeholder instead.
- **Privacy leak path (not the key):** answers from the user's history are sent to Groq without a preview step. The brief says to "show the user what will be sent when drafting". Suggestion fuzzy-matching sends candidate answers silently, and "Ask" sends 40 entries with no confirmation.
- **Sensitive filtering is only by question wording** (`SENSITIVE_RE`), duplicated in three files. "Student ID", "SIN", "NRIC", "tax ID", "IBAN", "date of birth" and similar are not masked, which contradicts "never store ID numbers". It also only checks for `type=password` as a type signal.

## 5. Fragile spots

### Google Forms selectors likely to break
- `div[role="listitem"]`, `div[role="heading"]` (`[aria-level="1"]` for the title). Google changes markup periodically.
- `[role="radio"]`, `[role="checkbox"]`, `[role="listbox"]`, `[role="option"]`, `data-value="__other_option__"`, `aria-checked`, `aria-selected`.
- Dropdown: "first option is the Choose placeholder" is assumed by index (`capture.js:118`).
- Required detection uses a trailing `*` in the heading text and `aria-required`.
- Submit detection: `button.textContent.trim().toLowerCase() === "submit"` (`capture.js:300`) fails for any localized form. Confirmation detection looks for the English `next|back|submit` labels.
- `/formResponse` path assumptions. A grid is detected through `role="group"` count, which also fires on some multi-checkbox questions.
- Question text is the identity key. Duplicated or edited questions collide (`#2` suffix is positional).
- Suggestion chip is appended to `heading.parentElement`, which may be an unexpected container.

### Unhandled errors
- `askHistory` does `await res.json()` before checking `res.ok` (`gemini.js:261`), so a non-JSON error body throws and falls into a generic message.
- `aiFuzzyMatch` (`background.js:68`) has **no timeout and no `AbortController`**. A hung request blocks `computeSuggestions` and the content script's callback.
- `JSON.parse(content)` in `aiFuzzyMatch` is inside `try`, fine. `parsed.confidence === "high" || parsed.confidence !== "low"` is always true unless `"low"`, which makes the check redundant.
- `fetchAvailableModels` has no timeout. `testApiKey` creates an `AbortController` but never passes the signal to the fetch, so the timeout does nothing.
- `chrome.runtime.sendMessage` in `suggest.js` is not guarded for "Extension context invalidated" after an extension reload (the callback path checks `lastError`, the dismissal path is in `try`). The `MutationObserver`s keep firing in orphaned content scripts after reload.
- `options.js` `saveKey` and test buttons have no try/catch around `setApiKey`.
- `deleteAll`, `removeEntry` have minimal feedback on failure (console only).
- `capture.js` `saveEntry` swallows errors after logging, so a failed save shows no message to the user and the draft remains. The "pending" copy is kept, which is good.

### Race conditions
- **Read-modify-write on `entries`**: `addEntry`, `deleteEntry`, `updateEntry` each read the whole array then write it. Two tabs submitting at once, or a submit during "Load demo data", can lose an entry. No lock, no `storage.onChanged` merge.
- `options.js` loads demo data with one `addEntry` per entry, in sequence. That is N full rewrites and is slow with large histories.
- **Capture:** `finished = true` is set before `saveEntry` resolves, and `handleSubmit` runs on a click, not on actual submission success. A click on Submit that fails server-side (network error) still saves an entry. The "required/invalid" check reads the DOM at click time, before Google validates.
- The `pending` entry on `/formResponse` and a draft-based save can both fire for one submission. Dedup relies on `addEntry` upserting by id, but `buildEntry` generates a **new `crypto.randomUUID()`** when saving from the draft path, so a pending-then-draft double save can create two entries.
- `MutationObserver` on `capture.js` observes the entire body with attribute filters. It debounces at 300 ms but fires on every DOM change in the page, including its own toast.
- **Suggest:** `isScanning` is reset in `finally` right after `sendMessage` is *issued* (the response is a callback), so it does not actually guard overlapping scans. Overlap is limited only by `data-fm-suggested`, which is set when a chip renders, not when requested. Two scans before the first response can send duplicate requests and, with the AI fallback, duplicate Groq calls.
- `itemMap` is keyed by question text, so two questions with the same text collapse to the last one.
- `renderSuggestionChip` sets the item flag, then returns early if there is no heading, leaving the item flagged with no chip.
- **Service worker lifetime:** `computeSuggestions` can run several sequential Groq calls (one per weak question, 25 s of potential latency each with no timeout). MV3 workers can be suspended mid-flight.
- `resolveModel` mutates a module-level `MODEL` and can write storage from multiple callers concurrently.

### Other
- `computeSuggestions` is O(questions × candidates), and for weak matches re-scores and re-sorts all candidates per question. Fine for hundreds of entries, slow for thousands.
- Each `GET_SUGGESTIONS` reads all entries from storage. No cache.
- `setNativeValue` picks the prototype setter correctly, but the `focus()`/`blur()` pair can trigger Google validation messages as a side effect.
- **No Undo** after "Use" fills a field. The brief says every fill has an Undo. The chip is removed after 700 ms.

## 6. Edge compatibility

Nothing here is Chrome-only in a way that breaks Edge, but several items need testing:
- The manifest has no `minimum_chrome_version`, while the brief requires 123. Edge follows the Chromium version, so add `"minimum_chrome_version": "123"` for both.
- `chrome.action.setBadgeTextColor` is feature-checked. Good.
- `type: "module"` service worker is fine in Edge. Dynamic `import()` from a content script via `web_accessible_resources` works in Edge.
- The `README.md` only documents `chrome://extensions`. Edge uses `edge://extensions`.
- `options_page` opens in a tab in both. `chrome.*` promise APIs are available in Edge, and `browser.*` is not needed.
- The "Delete all"/`confirm` flow uses custom UI, not `window.confirm`, so there is no prompt-suppression issue.
- `history.js` uses `<a download>` + blob URLs, which work in Edge.
- **Not verified:** whether Edge's Enhanced Security Mode or its Google Forms rendering differs from Chrome's. I did not run anything in either browser.

## 7. Duplicated logic worth a shared helper

| Duplicated | Where | Suggested home |
|---|---|---|
| `SENSITIVE_RE` (identical regex ×3) | `background.js:4`, `capture.js:9`, `suggest.js:5` | One `lib/sensitive.js` (and extend it). Content scripts would need to load it as a module or via the same dynamic import trick. |
| `getFormId()` regex | `capture.js:32`, `suggest.js:22` | Shared content helper. |
| Question-text cleanup (`replace(/\s*\*$/, "")`) and "top-level listitem" filter | `capture.js:67,148`, `suggest.js:366,352` | `lib/forms-dom.js`: `getQuestionItems()`, `getQuestionText(item)`. This would centralise the fragile selectors too. |
| Option matching (`val === t \|\| val.includes(t) \|\| t.includes(val)`) | `suggest.js` radio, checkbox, dropdown | One `matchesOption()` helper. The `includes` rule can pick the wrong option ("No" matches "Not sure"). |
| Answer-to-string (`Array.isArray(x) ? x.join(", ") : String(x ?? "")`) | `background.js`, `gemini.js` ×2, `history.js`, `suggest.js` | `lib/format.js` `answerText()`. |
| Groq `fetch` + headers + error handling | `background.js:68`, `gemini.js:33,243` | One `groqRequest()` with timeout, abort, status mapping. |
| Normalise/tokenise + two different stop-word lists | `background.js`, `gemini.js` | One text-match module. |
| `log`/`logError` wrappers | `capture.js`, `suggest.js` | Small shared logger. |
| Direct `chrome.storage.local` use for non-entry keys | `history.js`, `gemini.js` | Add `getSetting`/`setSetting` to `lib/storage.js`. |
| `DEMO_PREFIX` and `isDemo` | `history.js`, `options.js` | `lib/storage.js`. |
| Status message helpers (`setKeyStatus`, `setDemoStatus`) | `options.js` | Merge into one. |

## 8. Other brief violations (for completeness)

- **No `styles/tokens.css`.** `history.css` has ~28 and `options.html` ~22 hardcoded hex colours (options.html defines its own tokens inline). `suggest.js` injects a Shadow-DOM style with hardcoded greens, and `capture.js` a toast with hardcoded colours. `background.js:239` hardcodes the badge colour.
- **Emoji / glyphs:** options status text uses "✓" and "✗" characters. Icons should be inline SVG. Inline `style=` on the model `<select>` in `options.html:175`.
- **AI call location:** `askHistory` runs in the history page and the options page also calls Groq directly, so Groq is not "only in `background.js`".
- **No pre-send preview** of data going to Groq.
- **No Undo** after a fill.
- **Dark/light and density** for the injected chip and toast are not theme-aware (fixed light colours).
- **Keyboard/focus:** the injected chip buttons have no explicit focus style.
- **Naming:** `lib/gemini.js`, `#gemini-key`, `geminiApiKey`, and the "Gemini" comment in `history.js:346` are left over from the earlier provider.
- **`updateEntry`** is exported but unused.
- **Version:** manifest says `0.1.0`, the brief says v1.0.
- **`hackathon-v0`** tag and demo seed ship in the production package.

## 9. Top 10 fixes, ranked by impact over effort

1. **Stop exposing `lib/gemini.js` and trim `web_accessible_resources`** to `lib/storage.js` only. One-line manifest change and it removes a pointless attack surface. *(High / trivial)*
2. **Add timeouts (`AbortController`) to every Groq `fetch`**, including `aiFuzzyMatch`, `fetchAvailableModels` and `testApiKey` (where the signal is created but unused). This fixes hung suggestion scans and worker stalls. *(High / small)*
3. **Fix the duplicate-entry race in capture**: reuse the pending entry's id (or derive the id from `formId` + draft `updatedAt`) so the draft and `/formResponse` paths cannot both create entries. *(High / small)*
4. **Serialise `entries` writes** in `lib/storage.js` (a simple promise queue, or re-read inside the write) so two tabs or demo-load cannot drop data. Add `schemaVersion` and a backup copy at the same time. *(High / medium)*
5. **Move all Groq calls into `background.js`** (message `ASK_HISTORY` / `TEST_KEY`), build the pre-send preview, and add a shared `groqRequest()`. This satisfies the brief's biggest privacy rule. *(High / medium)*
6. **Extend and centralise `SENSITIVE_RE`** (ID numbers, SIN/NRIC, IBAN, DOB, tax ID) in one module used by all three scripts. This closes the "ID numbers" gap. *(High / small)*
7. **Make the suggest scan idempotent**: mark items as requested before sending, key the map by item rather than question text, and drop the useless `isScanning` flag. This prevents duplicate Groq calls and chip collisions. *(Medium / small)*
8. **Add Undo to "Use"** (store the prior value, restore it) and keep the chip until the user confirms. *(Medium / small)*
9. **Create `styles/tokens.css`** and move `history.css`, `options.html`, the chip and the toast onto it, with light/dark/density support and visible focus rings. *(Medium / medium)*
10. **Harden Forms DOM access**: extract `lib/forms-dom.js` (listitem, heading, option matching), use exact-then-contains option matching, and don't rely on the English "Submit" label (use the confirmation page and `aria` hints instead). Also add `minimum_chrome_version: "123"` and the Edge install steps to the README. *(Medium / medium)*

## What could not be verified

- Nothing was executed. I did not load the extension in Chrome or Edge, so selector breakage, the `import()` flow and the Edge behaviour are judged from code only.
- I could not read `roadmap-v2.md` (absent), so the intended file layout and data model are unchecked.
- I did not check `seed/seed.json` beyond its first entries, or compute exact hardcoded-colour counts per file beyond a regex tally.
