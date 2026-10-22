# FormMemory v1.0 Roadmap (post-hackathon upgrade)

**Written:** Thu Oct 22, 2026
**Starting point:** the hackathon build (capture, history page, "Ask your history", suggestion chips, P6 polish pass)
**Targets:** Google Chrome **and** Microsoft Edge (Chromium, Manifest V3)
**AI provider:** Groq, with your own API key (replaces Gemini)
**Look:** Slate & Amber, real light and dark themes
**Tools:** Antigravity for most work, Claude Code for audits, refactors, reviews, and git
**Pace:** weekends, as much as fits. Every phase is a stopping point you can ship from.

---

## 0. TL;DR

1. There are **9 phases (0-8)**. Do them in order. After each phase, tag the repo and use the extension yourself for a few days before moving on.
2. **If you only get one weekend:** do Phase 0 (Groq + data foundation) and Phase 1 (Slate & Amber redesign). That alone makes it look and feel like a real product.
3. **After Phase 3** you have a strong daily-driver (pin/tags, export, quick search, draft recovery, in-page drawer, answer library). Everything after is bonus polish and power features.
4. **Phase 7 (optional sync, no backend)** sits right before the store release. Skip it freely.
5. **Phase 8** is the Chrome Web Store and Edge Add-ons launch. It comes last on purpose.
6. **V2:** support for other form sites (your feature 14).
7. Three habits: **one mission per task**, **test in Chrome and Edge in light and dark after every prompt**, **commit after every working step**.

---

## 1. Decisions locked in

| Topic | Decision |
|---|---|
| Palette | **Slate & Amber** (cool slate neutrals, one amber accent). Tokens in section 5, contrast checked. |
| Browsers | Chrome and Edge. Same codebase, tested in both every phase. |
| AI | **Groq** (OpenAI-compatible API), user pastes their own key. No backend. |
| Features | All of your list in V1 **except #14** (other form sites, goes to V2). |
| Sync (#15) | **Optional**, no backend, Phase 7, placed **before** the store release. |
| Store launch | Phase 8, last. Chrome Web Store and Edge Add-ons. |
| Tools | Antigravity (most work). Claude Code (you have Claude Pro) for audits, refactors, reviews, commits. |
| Time | Weekends, as much as you can. Phases are sized in ~2-3 hour sessions. |

### Changes I made on your behalf (tell me if you disagree)
1. **Feature #2 is an in-page drawer, not Chrome's side panel.** I could not verify that Edge supports `chrome.sidePanel`, and a drawer injected into the form page works the same in every Chromium browser. You can add a real side panel later as an extra.
2. **Glasser "Org snapshot" is not in v1.** It was a hackathon sponsor feature and you did not list it. It can come back in V2.
3. **Gemini is removed**, replaced by Groq in Phase 0.
4. **Minimum browser version 123**, because the theme tokens use the CSS `light-dark()` function (verify the support floor on caniuse before relying on it).

---

## 2. What I verified, and what you must check

**Verified from sources while writing this:**
- Groq's chat endpoint is OpenAI-compatible: `POST https://api.groq.com/openai/v1/chat/completions`. A models list exists at `GET /openai/v1/models`. JSON mode exists (labelled beta), and Groq's structured outputs are stricter than OpenAI's.
- Edge runs Chromium extensions with minimal code changes. Registering and submitting to Edge Add-ons is free, and Partner Center accepts a personal GitHub login.
- The Chrome Web Store charges a one-time **$5** developer registration fee.
- `chrome.sidePanel` exists from Chrome 114 (`open()` from 116). Edge support is **not** verified, which is why the drawer is in-page.
- All contrast numbers in section 5 were computed, not estimated.

**Not verified. Check when you reach the phase:**
- Current Groq model names, rate limits, and which models support JSON mode (Groq console docs).
- `chrome.storage.local` size quota (I recall about 10 MB) and `chrome.storage.sync` quotas.
- Chrome Web Store listing limits, screenshot sizes, privacy-policy and data-disclosure rules, and review times.
- Whether your chosen keyboard shortcut collides with a built-in one in Edge.
- How Edge handles extension sync.

---

## 3. Scope

Size: **S** about 1 h, **M** about 2-3 h, **L** about 3-6 h including testing.

| # | Feature | Phase | Size | Notes |
|---|---|---|---|---|
| - | Groq migration | 0 | M | Replaces Gemini |
| - | Schema v2 + safe migration | 0 | M | Foundation for everything else |
| - | Slate & Amber redesign, light/dark/system, density toggle | 1 | L | Tokens, history, options, in-page UI |
| 4 | Pin, tags, folders | 2 | L | |
| 13 | Export and import (JSON, CSV, Markdown) | 2 | M | |
| 11 | Auto-delete | 2 | S | Pinned entries exempt |
| 10 | Pause capture, per-form controls, never-save list | 2 | M | |
| 1 | Draft recovery | 3 | M | You click Restore, never automatic |
| 3 | Quick search (popup + keyboard shortcut) | 3 | M | |
| 2 | In-page drawer | 3 | L | |
| 5 | Answer library | 3 | M | |
| 7 | Undo after "Use" | 4 | S | |
| 6 | Consistency checker | 4 | M | |
| 8 | AI draft helper | 4 | M | Shows exactly what is sent |
| 9 | Application tracker | 4 | L | |
| 12 | Passphrase lock | 5 | L | Hardest item. First to cut if time is tight. |
| 17 | Accessibility pass | 6 | M | Also built in from Phase 1 |
| - | QA in Chrome + Edge, performance | 6 | M | |
| 15 | Optional sync, no backend | 7 | L | **Optional** |
| 16 | Store launch kit | 8 | L | Chrome Web Store + Edge Add-ons |
| 14 | Other form sites | V2 | L | Not in v1 |

**Suggested sessions** (about 3 h each): S1 Phase 0, S2-S3 Phase 1, S4 Phase 2, S5-S6 Phase 3, S7-S8 Phase 4, S9-S10 Phase 5, S11 Phase 6, S12-S13 Phase 7 (optional), S14-S15 Phase 8. At one or two sessions per weekend, expect roughly two months. Ship privately after each phase tag.

**Git tags:** `hackathon-v0` (now) → `v0.1` (Groq + schema v2) → `v0.2` (design) → `v0.3` (data) → `v0.4` (everyday) → `v0.5` (smart) → `v0.6` (security) → `v0.9` (QA) → `v0.95` (optional sync, only if built) → `v1.0` (store). Every phase below ends with a "Wrap up this phase (git)" block that tags it.

---

## 4. Architecture (read before coding)

### 4.1 File layout v2

```
manifest.json
background.js            service worker: shortcuts, alarms, AI proxy, migrations
content/
  capture.js             reads answers, saves on submit, saves drafts
  fill.js                shared fill engine (set a value, return undo)
  suggest.js             suggestion chips + consistency flags
  recover.js             draft-restore banner
  drawer.js              in-page drawer (shadow DOM)
lib/
  storage.js             the ONLY module that touches chrome.storage
  sensitive.js           shared sensitive-field patterns
  match.js               fuzzy question matching (suggest, library, consistency, search)
  diff.js                small word-level diff (no dependency)
  ai.js                  Groq client
  export.js              JSON/CSV/Markdown export + import validation
  crypto.js              passphrase lock (Phase 5)
styles/tokens.css, base.css
fonts/                   bundled woff2 + license files
js/theme.js              applies theme + density from settings
history.html/js/css      full history, library, tracker, drafts
popup.html/js/css        quick search
options.html/js/css      settings
welcome.html/js/css      first-run onboarding
dev/styleguide.html      visual test page (excluded from the store zip)
seed/seed.json
icons/
PROJECT_BRIEF.md  CLAUDE.md  README.md  CHANGELOG.md  AUDIT.md
```

Note: content scripts cannot use ES module imports. Shared files (`sensitive.js`, `match.js`, `diff.js`, `fill.js`) are listed in the manifest's content-script `js` array in order and share a small global namespace, `FM`. Extension pages can use `<script type="module">`.

### 4.2 Storage schema v2

```
meta:      { schemaVersion: 2 }
entries:   Entry[]
drafts:    { [formId]: Draft }
folders:   Folder[]
library:   LibraryItem[]          (answers you pinned as "standard")
settings:  Settings
secrets:   { groqKey }            (never exported, never logged)

Entry {
  id, formId, formTitle, formUrl, submittedAt, updatedAt,
  fields: [{ question, type, answer, sensitive }],
  pinned: boolean, tags: string[], folderId: string|null,
  status: null|"applied"|"interviewing"|"offer"|"rejected"|"archived",
  deadline: string|null (ISO date), notes: string
}
Draft { formId, formTitle, formUrl, startedAt, updatedAt, fields }   (sensitive values never stored)
Folder { id, name, createdAt }
LibraryItem { id, label, questionKey, value, updatedAt }
Settings {
  theme: "system"|"light"|"dark", density: "comfortable"|"compact",
  aiModel, capturePaused, neverSaveKeywords: string[], blockedForms: string[],
  autoDeleteDays (0 = off), autoDeleteKeepPinned (true),
  suggestionsEnabled, drawerEnabled, lockEnabled, autoLockMinutes
}
```

Rules: bump `schemaVersion` on every shape change, and ship a **non-destructive** migration with a backup copy first. `chrome.storage.local` rewrites the whole array on each change. That is fine for hundreds of entries. If you ever hold thousands, move entries to IndexedDB (Phase 6 measures this).

### 4.3 AI layer (Groq)
- All network calls happen in `background.js`. Pages and content scripts send a message and get back a result. The key never enters a content script.
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`, header `Authorization: Bearer <key>`.
- Ask for JSON with `response_format: {"type":"json_object"}` **and** say "reply in JSON" in the prompt. Parse defensively (strip code fences, `try/catch`).
- The model is a setting, with a dropdown filled from `GET /openai/v1/models` using the user's key. Never hardcode a model as the only option, because models get renamed or retired.
- Friendly errors: 401 (key rejected), 429 (rate limited, honor `retry-after`), timeout (20 s), 400 (model may not support JSON mode).
- Privacy text must stay accurate: "Only the entries relevant to your question are sent to Groq's API." Do not make claims about Groq's retention.

### 4.4 Cross-browser rules (Chrome + Edge)
- Use the `chrome.*` namespace with promises. It works in both.
- No dependency on `chrome.sidePanel` or any flagged API.
- No `eval`, no remote code, no remote scripts. Bundle fonts locally.
- Test every phase in both: `chrome://extensions` and `edge://extensions` (Developer mode, Load unpacked).
- Shortcuts are rebindable at `chrome://extensions/shortcuts`. Edge has its own shortcuts page, so verify there.

### 4.5 Theming
- `styles/tokens.css` is the single source of color. No hardcoded colors anywhere else.
- `js/theme.js` sets `data-theme` (light/dark, or removes it for "system") and `data-density` on `<html>`.
- In-page UI (chips, drawer, toast) lives in a shadow DOM, so it needs its own copy of the tokens under `:host`.

---

## 5. Design system: Slate & Amber

### 5.1 Principles (what makes it not look AI-generic)
- **One accent.** Amber is for primary actions, the selected state, focus, and one or two highlights per screen. If everything is amber, nothing is.
- **Slate does the work.** Hierarchy comes from text weight, size, and spacing, not from boxes inside boxes.
- **Borders over shadows.** 1px hairlines and flat surfaces. Almost no drop shadows.
- **A real type pair.** A serif for headings only, a clean sans for everything else, mono for dates and IDs.
- **No gradients, no glass, no emoji as icons.** One inline-SVG icon set at a consistent stroke width.
- **Designed states.** Every list has an empty state, a loading skeleton, and an error state with a next action.
- **Calm density.** Generous whitespace in "comfortable", tighter in "compact".

### 5.2 `styles/tokens.css` (save exactly; contrast was checked)

```css
:root {
  color-scheme: light dark;

  /* Slate neutrals */
  --bg:            light-dark(#F6F7F9, #0F141B);
  --surface:       light-dark(#FFFFFF, #161C25);
  --surface-2:     light-dark(#EEF1F5, #1E2631);
  --text:          light-dark(#1B2430, #E7EBF0);
  --text-muted:    light-dark(#54606F, #9AA6B5);
  --border:        light-dark(#D5DBE3, #2A3442);   /* decorative dividers */
  --border-strong: light-dark(#7C8898, #6B7889);   /* input outlines, UI edges */

  /* Amber accent */
  --accent:        light-dark(#F59E0B, #F5B13D);   /* fills: primary button, selected bar */
  --accent-hover:  light-dark(#FBBF24, #FFC85A);
  --on-accent:     light-dark(#1B2430, #1B1405);   /* text on accent fills */
  --accent-text:   light-dark(#9A4A07, #F5B13D);   /* amber used AS TEXT or thin icons */
  --accent-subtle: light-dark(#FDF1D8, #2A2316);   /* selected row tint */
  --focus-ring:    light-dark(#B45309, #F5B13D);

  /* Status */
  --success: light-dark(#2F7D5B, #5CC59A);
  --danger:  light-dark(#B3261E, #F2877F);
  --info:    light-dark(#3B5B85, #7FA6D9);

  /* Shape, space, motion */
  --radius-s: 6px;
  --radius-m: 10px;
  --space: 4px;                       /* multiples of 4 only */
  --row-pad: calc(var(--space) * 3);  /* density hook */
  --ease: cubic-bezier(.2, .0, .2, 1);
  --dur: 140ms;
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
:root[data-density="compact"] { --row-pad: calc(var(--space) * 2); }

@media (prefers-reduced-motion: reduce) { :root { --dur: 0ms; } }
```

### 5.3 Contrast results (computed with the WCAG formula)

Text needs 4.5:1, UI edges and focus indicators need 3:1.

| Pair | Light | Dark |
|---|---|---|
| Text on bg | 14.60 | 15.44 |
| Text on surface | 15.65 | 14.30 |
| Muted text on surface | 6.40 | 6.92 |
| Muted text on surface-2 | 5.65 | 6.17 |
| Text on accent fill (button label) | 7.29 | 9.78 |
| Text on accent hover | 9.38 | 11.89 |
| Accent-as-text on surface | 6.26 (`#9A4A07`) | 9.16 |
| Accent-as-text on bg | 5.84 | 9.89 |
| Accent-as-text on selected-row tint | 5.59 | 8.32 |
| Text on selected-row tint | 13.98 | 12.99 |
| Focus ring on surface / bg | 5.02 / 4.68 | 9.16 / 9.89 |
| Input outline (`border-strong`) on surface / bg | 3.60 / 3.36 | 3.81 / 4.11 |
| Success / danger / info on surface | 4.99 / 6.54 / 6.95 | 8.08 / 6.97 / 6.81 |

**Three rules that come from these numbers:**
1. **Amber fill vs white is only 2.15:1** (light mode). So never rely on the fill alone to show a button's edge. Primary buttons carry a **1px border in `--accent-text`** (6.26 against white) and a dark label.
2. **Never use `--accent` (the fill color) as text on light backgrounds.** Use `--accent-text`. Never put white text on amber.
3. Success green on the light page background is 4.66, which passes with little margin. Do not use it for tiny text.

### 5.4 Type
- **Headings:** Source Serif 4, used sparingly (page and entry titles).
- **Body/UI:** IBM Plex Sans.
- **Meta (dates, IDs, counts):** IBM Plex Mono.
- All three are open-licensed (OFL). Bundle the `woff2` files in `fonts/` with their license files, and keep a system-font fallback stack. No requests to Google Fonts (local-first story, works offline).
- Scale: 12 / 13 / 14 (body) / 16 / 20 / 28. Line height 1.5 for body, 1.25 for headings.

### 5.5 Component rules
- **Buttons:** primary (amber fill + 1px `--accent-text` border + dark label), secondary (transparent + `--border-strong`), ghost (text only). Destructive actions use `--danger` text, not a red fill.
- **Inputs:** `--surface`, 1px `--border-strong`, `--radius-s`, 2px `--focus-ring` outline with 2px offset on focus.
- **Selected row:** `--accent-subtle` background + 3px `--accent` bar on the left. Selection must also be exposed to assistive tech (`aria-selected` or `aria-current`), not color only.
- **Tags/chips:** `--surface-2`, `--radius-s`, no color coding by hue. Differences are shown with text, not color alone.
- **Dialogs:** native `<dialog>`. **Toasts:** bottom-left, 6-8 s, with Undo where it applies.
- **Icons:** inline SVG, 1.5px stroke, `currentColor`. Copy only the icons you need from an open icon set (for example Lucide, ISC license) and keep its license notice.
- **Do not**: stack cards inside cards, use more than two font sizes in one component, animate anything longer than 180 ms, or use amber for more than one primary action per screen.

### 5.6 Screens to redesign
History (3-pane: nav, list, detail), Options (sectioned), Popup (quick search), In-page toast / chips / drawer, Welcome (first-run), Empty/error states.

---

## 6. Workflow: Antigravity and Claude Code

### 6.1 Who does what
| Use | For |
|---|---|
| **Antigravity** | UI work, new features, anything where the agent should open the page in its browser and check it. Run one task at a time; two only when files do not overlap. |
| **Claude Code** | The audit, refactors that touch many files, schema/crypto work, code review before each tag, git commits. |
| **You** | Reload the extension in Chrome **and** Edge, click through it, decide what looks right. |

Both tools have usage limits. If one runs out mid-phase, switch to the other from the last commit.

### 6.2 `PROJECT_BRIEF.md` v2 (replace the old one; paste it into the first message of each task)

```
PROJECT BRIEF: FormMemory v1.0

Goal: A Chrome + Microsoft Edge extension (Manifest V3, plain JavaScript/HTML/CSS, no build
step, no frameworks) that remembers what a user typed into Google Forms, lets them search and
organize it, and helps them reuse answers safely.

Rules:
- Local-first: all data lives in chrome.storage.local. No backend, no accounts, no analytics.
- Never store passwords, ID numbers, card numbers. Sensitive fields are masked as "[hidden]".
  Drafts also never store sensitive values.
- AI is Groq (OpenAI-compatible). Calls happen ONLY in background.js. Send only what the user
  explicitly asked about, and show the user what will be sent when drafting.
- API keys live only in the options page and secrets storage. NEVER hardcode, log, export,
  or commit a key.
- AI proposes, the user decides. Never fill or submit a form without a click. Every fill has
  an Undo. Every delete has a confirm or an Undo.
- Cross-browser: use chrome.* promises only. No sidePanel dependency. Must work in Chrome and
  Edge. Minimum browser version 123.
- UI: use ONLY the CSS variables in styles/tokens.css (no hardcoded colors). Must work in
  light, dark and system themes, and both densities. Meet WCAG AA contrast. Everything must be
  usable by keyboard with a visible focus ring. Icons are inline SVG, never emoji.
- All chrome.storage access goes through lib/storage.js. Changing a stored shape requires a
  schemaVersion bump and a non-destructive migration with a backup.
- No remote code, no eval, no remote fonts or scripts. No new dependencies unless unavoidable.
- Keep diffs small. Work only on the files I name. Do not refactor unrelated code.

File layout: see roadmap-v2.md section 4.1.
Data model: see roadmap-v2.md section 4.2.
```

### 6.3 `CLAUDE.md` (repo root, for Claude Code)

```
Read PROJECT_BRIEF.md and follow it. Plan before editing for any task touching more than 2
files. After changes: list files changed, how to test in Chrome and Edge, and what could not
be verified. Never commit secrets. Commit messages: short, imperative, one logical change each.
```

### 6.4 Git
- Tag the current state: `git tag hackathon-v0`. Work on a branch: `git switch -c v1-upgrade`.
- One commit per working step. Tag at the end of each phase. Merge to `main` only at tags.
- Before the first push of this branch, re-run the secrets check: `git diff --cached | Select-String "gsk_|AIza|gl_"`. (Groq keys start with `gsk_`. Verify the prefix on your own key and adjust.)

### 6.5 Run after EVERY prompt (2 minutes)
1. Reload the extension in **Chrome** and **Edge**. Open the page you changed.
2. Switch to light, dark, and system. Check compact density if the screen has lists.
3. Press Tab through the screen. Is focus always visible? Does Enter/Space work?
4. Open DevTools console. No errors?
5. Commit.

### 6.6 Footer to append to every prompt below

```
Constraints: use only tokens from styles/tokens.css (no hardcoded colors); all storage through
lib/storage.js; no new dependencies; change only the files named; wrap risky code in try/catch
with the "[FormMemory]" log prefix.
When done: list files changed, how to test it in Chrome and Edge (light and dark), and what you
could not verify. Then stop. Do not start the next task.
```

---

## 7. Phases and prompts

Each prompt starts with `Read PROJECT_BRIEF.md first.` (omitted below to save space; add it). Use **plan mode** for anything marked (Plan).

---

### Phase 0: Baseline, Groq, schema v2 (S1, about 3 h)

**Goal:** a clean, audited base on Groq, with data safely upgraded. Nothing looks different yet.
**Tool:** Claude Code for 0A and 0C, Antigravity for 0B.

- [ ] `git tag hackathon-v0`, then `git switch -c v1-upgrade`
- [ ] Replace `PROJECT_BRIEF.md` with the v2 brief (6.2), add `CLAUDE.md` (6.3)
- [ ] Get a Groq API key at the Groq console. Store it in your password manager.

**0A: Audit (Claude Code, read-only)**
```
Do NOT change any files. Audit this extension and write AUDIT.md:
1. File map: every file and its purpose.
2. Storage: every chrome.storage key read or written, with its shape.
3. Network: every fetch/external URL; every permission and host_permission, and whether each
   is actually used.
4. Secrets: anywhere an API key is read, logged, or could leak.
5. Fragile spots: Google Forms selectors likely to break, unhandled errors, race conditions in
   capture/suggest.
6. Anything that would not work in Microsoft Edge.
7. Duplicated logic that should become a shared helper.
Rank the top 10 fixes by impact over effort. Do not fix anything.
```

**0B: Groq migration (Antigravity, Plan)**
```
Files: lib/gemini.js (remove), lib/ai.js (new), background.js, options.html/js, history.js,
manifest.json.
Task: replace Gemini with Groq.
1. lib/ai.js: askHistory(question, entries) calls POST
   https://api.groq.com/openai/v1/chat/completions with Authorization: Bearer <key>,
   model from settings.aiModel, messages [system, user], low temperature,
   response_format {"type":"json_object"}, and the prompt must say "reply in JSON".
   Same behavior as before: answer ONLY from the provided entries, skip sensitive fields, send
   at most the 40 most relevant entries, return {answer, sourceEntryIds}. Parse defensively
   (strip code fences, try/catch, fall back to showing raw text).
2. Network calls run only in background.js via messages ({type:"ai:ask"}). Pages and content
   scripts never read the key.
3. Options page: Groq key field (password type, show/hide), "Test key" (calls
   GET https://api.groq.com/openai/v1/models), and a model dropdown filled from that response.
   Keep a default model constant at the top of ai.js that I can change.
4. Errors: 401 "key rejected"; 429 "rate limited, try again shortly" (honor retry-after);
   timeout 20 s via AbortController; 400 "this model may not support JSON mode, pick another".
5. manifest: remove generativelanguage.googleapis.com, add https://api.groq.com/*.
6. Change the notice near the Ask box to: "Only the entries relevant to your question are sent
   to Groq's API." Make no claims about retention.
7. On first run, delete the old stored Gemini key.
Test: missing key, wrong key, valid key.
```

**0C: Schema v2 and storage layer (Claude Code, Plan)**
```
Files: lib/storage.js, background.js, plus every file that calls chrome.storage directly.
Task: upgrade storage to schema v2 (see roadmap-v2.md section 4.2) without losing data.
1. meta.schemaVersion. A migrate() runs on install/update/startup and lazily before any read.
   First, once, copy existing entries to key "backup_v1". Then add to each entry: updatedAt
   (= submittedAt), pinned:false, tags:[], folderId:null, status:null, deadline:null, notes:"".
2. settings with defaults (theme "system", density "comfortable", capturePaused false,
   neverSaveKeywords [], blockedForms [], autoDeleteDays 0, autoDeleteKeepPinned true,
   suggestionsEnabled true, drawerEnabled true, lockEnabled false). Move the Groq key to
   "secrets".
3. ALL chrome.storage access goes through lib/storage.js. Export: getEntries, getEntry,
   addEntry, updateEntry (sets updatedAt), deleteEntry, deleteMany, getSettings,
   updateSettings, getSecrets/setSecret, onChange(listener). Replace every direct call.
4. Serialize writes with a small promise queue so two tabs cannot overwrite each other.
5. Add a dev helper that logs chrome.storage.local.getBytesInUse().
No UI changes.
```

**0D: Edge smoke test (you, 20 min)**
- [ ] Load the folder in `edge://extensions` (Developer mode, Load unpacked)
- [ ] Fill and submit Test Form 1 in Edge. Entry saved? History page opens? Ask works with Groq?
- [ ] Fix anything that differs from Chrome (use the bug template at the end of this file).

**Done when:** AUDIT.md exists, Ask works with Groq in Chrome and Edge, and old data is intact after migration.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.1
git push origin v0.1
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 1: Slate & Amber design system (S2-S3, about 6 h)

**Goal:** the extension looks like one product, in light and dark, in Chrome and Edge.
**Tool:** Antigravity (let it open the pages in its browser and screenshot them). Claude Code reviews at the end.

**1A: Tokens, base styles, fonts, theme engine, styleguide**
```
Create styles/tokens.css EXACTLY as in roadmap-v2.md section 5.2 (do not change any color).
Create styles/base.css: reset, typography (IBM Plex Sans body, Source Serif 4 headings, IBM Plex
Mono for meta), buttons (primary = amber fill + 1px border in --accent-text + dark label;
secondary; ghost; destructive text uses --danger), inputs, segmented control, focus ring
(2px --focus-ring, 2px offset), native <dialog> styling, toast, skeleton, empty state.
Bundle the three fonts as woff2 in fonts/ with their OFL license files; add @font-face with a
system fallback. No remote font requests.
Create js/theme.js: read settings.theme and settings.density, set data-theme (remove the
attribute for "system") and data-density on <html>, and update live when settings change.
Create dev/styleguide.html showing every token, type size, button state, input, chip, dialog,
toast, empty state, and skeleton, with a theme switcher, so I can inspect it in light and dark.
No page redesign yet.
```

**1B: History page redesign (Plan)**
```
Files: history.html/js/css.
Redesign the history page using only tokens and base.css. Keep all current behavior.
Layout: left nav (All, Pinned, Folders, Tags: render these as disabled placeholders for now),
middle list, right detail. Under 800px wide, collapse to one column with a Back button.
Top bar: search, "Ask your history" bar, theme toggle, link to settings.
List rows: form title (semibold), date in mono, answer count. Selected row = --accent-subtle
background + 3px --accent bar on the left, plus aria-selected.
Detail: serif entry title; each Q&A as a definition list (question muted and small, answer in
body size); Copy button visible on hover AND keyboard focus; sensitive fields shown as a muted
"[hidden]" pill with a small lock icon.
Ask result: a card with source links as chips.
Add: empty state with a one-sentence next step, skeleton rows while loading, an error state with
a retry button, a privacy line ("Stored only in this browser") in the footer of the nav.
Keyboard: arrow keys move through the list, Enter opens, "/" focuses search.
```

**1C: Options page redesign**
```
Files: options.html/js/css.
Left section nav: Appearance, AI (Groq), Capture & Privacy, Data, About.
Appearance: theme segmented control (System/Light/Dark) and density control, applied live.
AI: Groq key (show/hide), model dropdown, Test key, plain-language note on what is sent.
Capture & Privacy: placeholder toggles for now.
Data: Load demo data, Clear demo data (confirm dialog).
About: version, links, "Copy debug info" (version, browser, schemaVersion, counts only, no
content).
No Save buttons: save on change with a small "Saved" indicator.
```

**1D: In-page UI restyle (toast, suggestion chips)**
```
Files: content/suggest.js, content/capture.js (toast only).
Restyle the in-page toast and suggestion chips inside their shadow DOM. Copy the token block
into :host (light-dark values) and follow the theme setting. Keep them small and unobtrusive on
the light Google Forms page: no layout shift, high z-index, comfortable hit targets (at least
28px tall), keyboard reachable, Use / Dismiss labelled for screen readers.
```

**1E: Temporary icon**
```
Create icons/icon.svg: a simple original mark (a rounded document with a small amber "memory"
dot). Use a one-off script outside the repo to export 16, 32, 48, 128 PNGs into icons/, and add
them to manifest.json (icons and action.default_icon). We will refine the brand in Phase 8.
```

**Done when:** every screen passes the 6.5 check in light, dark, compact, and comfortable, in Chrome and Edge.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.2
git push origin v0.2
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 2: Data and organization (S4, about 4-5 h)

**Goal:** organize, back up, clean up, and control what gets saved.
**Tool:** Antigravity for UI, Claude Code for export/import validation.

**2A: Pin, tags, folders (feature 4) (Plan)**
```
Files: history.html/js/css, lib/storage.js (folders), lib/match.js (search helper).
1. Pin/unpin an entry (icon button + keyboard). Pinned shows in the "Pinned" nav item and sorts
   first.
2. Tags: add/remove on the entry detail with autocomplete from existing tags. The "Tags" nav
   lists tags with counts.
3. Folders: single level. Create, rename, delete (entries move back to "All"). Move an entry
   with a "Move to..." menu (keyboard friendly), and drag and drop as a bonus.
4. Bulk select (checkboxes, Shift-click range) with Pin, Tag, Move, Delete (confirm + undo).
5. Search accepts operators: tag:foo folder:bar is:pinned, combined with free text.
6. Enable the nav placeholders from Phase 1.
```

**2B: Export and import (feature 13)**
```
Files: lib/export.js, history.js, options.html/js.
Export: JSON (full backup with schemaVersion; never include secrets), CSV (one row per answer:
entryId, formTitle, formUrl, submittedAt, question, answer, tags, folder), Markdown (one
readable section per entry). Download via a Blob + <a download>; no extra permission.
Import (JSON only): validate shape and schemaVersion (migrate older versions), show a preview
("12 new, 3 duplicates, 1 invalid") before applying, dedupe by id, on conflict keep the one
with the newer updatedAt. Automatically save a backup of current data before importing.
Never import secrets or settings that contain keys.
```

**2C: Auto-delete and undo-delete (features 11 + delete safety)**
```
Files: background.js (chrome.alarms + manifest "alarms" permission), options.html/js,
lib/storage.js, history.js.
Setting: Off / 30 / 90 / 365 days (by submittedAt). Pinned entries are exempt by default
(toggle). When the user enables it, show how many entries would be deleted and require
confirmation. Run daily via chrome.alarms and on browser startup. Add an "Undo" toast (8 s) to
every single and bulk delete in the UI.
```

**2D: Pause and never-save controls (feature 10)**
```
Files: content/capture.js, lib/sensitive.js, background.js, options.html/js, popup (later).
1. capturePaused setting: while paused, nothing is captured or drafted. The toolbar badge shows
   a "paused" state and the in-page toast says "FormMemory is paused".
2. Per-form: a "Don't save this form" toggle (blockedForms by formId). Provide it in Options
   (list with remove) now; the in-page drawer will get a button in Phase 3.
3. neverSaveKeywords: user-defined words/phrases, merged with the built-in sensitive patterns
   in lib/sensitive.js. A matching question's answer is stored as "[hidden]". Built-in
   protections cannot be turned off.
4. Move the built-in regex into lib/sensitive.js and have capture.js use it.
```

**Done when:** you can organize, export, re-import, auto-clean, and pause without surprises.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.3
git push origin v0.3
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 3: Everyday use (S5-S6, about 6-8 h)

**Goal:** the extension helps while you fill forms, not just afterward.
**Tool:** Claude Code for 3A (refactor), Antigravity for 3B-3E.

**3A: Shared fill engine (Claude Code, Plan; behavior must not change)**
```
Files: content/capture.js, content/suggest.js, new content/fill.js, manifest.json (script order).
Extract the code that fills a question (the logic behind the suggestion "Use" button) into
content/fill.js with one API on the FM namespace:
  FM.fill(questionEl, value) -> { ok, previous, undo() }
previous is the value before filling. undo() restores it with the same mechanisms: the native
value setter plus input/change events for text and paragraph; clicking options for
radio/checkbox/dropdown. Also add FM.readQuestion(questionEl) -> { question, type, answer } and
use it in capture.js. Update suggest.js to use fill.js. No UI changes.
Test on both test forms: every question type fills and un-fills correctly.
```

**3B: Draft recovery (feature 1) (Plan)**
```
Files: content/capture.js, new content/recover.js, lib/storage.js, background.js, history.js.
1. While the user types, save a draft to drafts[formId], debounced about 800 ms. Never store
   sensitive field values. Keep at most 20 drafts and expire after 14 days (clean at startup).
2. When a form that has a draft opens with empty answers, show a banner in a shadow DOM:
   "Unsaved answers from <time ago>. Restore | Discard". Restore fills through FM.fill and
   shows one "Undo restore". It NEVER submits.
3. After a successful submit/save, delete that draft. If capture is paused or the form is
   blocked, do not save drafts.
4. History page: a "Drafts" section listing drafts with Open form and Delete.
5. Handle multi-page forms, a closed tab mid-form, and a reload.
```

**3C: Quick search popup and shortcut (feature 3)**
```
Files: manifest.json, popup.html/js/css, background.js, lib/match.js.
1. Set action.default_popup to popup.html. NOTE: this means the old action.onClicked handler no
   longer fires. The popup gets an "Open full history" link instead.
2. Popup (about 380px wide): autofocus search; results are individual answers (question in
   muted text, answer below, form title and date in mono), top 8, with the match highlighted.
   Keys: Up/Down move, Enter copies the answer and shows "Copied", Ctrl/Cmd+Enter opens the
   entry in history, Esc closes.
3. Footer: Open full history, a Pause capture toggle, link to settings.
4. Add a commands entry using _execute_action with a suggested key. Pick one that does not
   collide in Chrome or Edge (avoid Ctrl+Shift+K, it may collide with a built-in Edge
   shortcut; verify). Mention in Options where to rebind it.
```

**3D: In-page drawer (feature 2) (Plan)**
```
Files: new content/drawer.js, manifest.json, lib/match.js.
A slim drawer on Google Forms pages, in a shadow DOM, with its own copy of the tokens.
1. A small "FM" handle on the right edge opens a 340px overlay drawer (never shifts the form).
   Esc closes it and returns focus. Under 600px wide it becomes a bottom sheet. Respects the
   theme setting. role="complementary" with an accessible label.
2. Tab "Search": the same result rows as the popup. Each row has Copy and Insert. Insert fills
   the question the user last focused (track focusin on question containers) through FM.fill,
   with an Undo toast. If no question was focused, Insert is disabled with a tooltip.
3. Tab "Library": placeholder until 3E. Tab "Draft with AI": placeholder until Phase 4.
4. A "Don't save this form" toggle that updates blockedForms.
5. Remember the last open tab. Honor settings.drawerEnabled.
```

**3E: Answer library (feature 5)**
```
Files: history.html/js/css, content/drawer.js, lib/match.js, lib/storage.js (library).
Build a Library view (history page, plus the drawer tab):
1. Group past answers by normalized question key (lib/match.js). For each group show the
   representative question, the most recent answer, and other distinct answers with counts and
   dates. Skip sensitive fields.
2. Actions: Copy; "Pin as my standard answer" (saves a LibraryItem with an editable label);
   edit label; remove.
3. Standard answers sort first and are preferred by suggestion chips.
4. Search within the library; sort by most used or most recent.
```

**Done when:** you filled a real form with the drawer and Restore and it felt good. Start using it daily after tagging.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.4
git push origin v0.4
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 4: Smart features (S7-S8, about 6-8 h)

**Goal:** helpful intelligence that never acts without you.
**Tool:** Antigravity. Claude Code reviews 4C (anything that sends data out).

**4A: Undo after "Use" (feature 7)**
```
Files: content/suggest.js, content/drawer.js, content/recover.js.
Every action that fills a field (suggestion Use, drawer Insert, Restore, Use previous) returns
the undo from FM.fill and shows a toast with Undo for 8 seconds. After Use, the chip turns into
"Undo" for 8 seconds. Undo works even if the user typed elsewhere in the meantime (it only
touches the field it filled). Never undo into a field the user has since edited: if the current
value differs from what we filled, skip and say so.
```

**4B: Consistency checker (feature 6) (Plan)**
```
Files: content/suggest.js, lib/match.js, new lib/diff.js, content shadow DOM UI.
When the user finishes a field (on blur, not on every keystroke) and it matches a past
question with high confidence but the answer differs after normalization (case, whitespace,
punctuation), show a subtle flag: "Differs from <form title> (<date>)". Clicking it opens a
dialog with a side-by-side word-level diff (write diff.js yourself, no library) and two
buttons: Keep mine (remember per form+question) and Use previous (FM.fill + Undo).
Skip sensitive fields. Never block typing or submission. Add a settings toggle.
Also add a "Compare" action on the history page to diff the same question across two entries.
```

**4C: AI draft helper (feature 8) (Plan, then Claude Code review)**
```
Files: content/drawer.js, background.js, lib/ai.js.
In the drawer's "Draft with AI" tab, for the currently focused paragraph question:
1. Find up to 5 relevant past answers (lib/match.js). Show a "What will be sent" list: the
   question text plus those answers, each with a checkbox the user can untick. Sensitive fields
   are never included.
2. Only after the user clicks "Generate", send via background.js to Groq with a system prompt:
   write a draft answer in the user's own voice using only the provided past answers; do not
   invent facts; if unsure, say what is missing.
3. Show the draft in an editable textarea with Copy and Insert. Insert uses FM.fill with Undo.
   It never submits and never inserts automatically.
4. Handle rate limits and errors with friendly messages. If no key is set, link to Options.
```

**4D: Application tracker (feature 9) (Plan)**
```
Files: history.html/js/css, lib/storage.js.
1. A "Tracker" view with columns Applied, Interviewing, Offer, Rejected, Archived. An entry
   joins the tracker when its status is set. Entry detail gets "Track this application" (sets
   status "applied", asks for an optional deadline and notes).
2. After saving a form whose title matches /application|apply|internship|scholarship|grant|
   fellowship/i, the saved toast offers a "Track?" link. Click only, never automatic.
3. Cards show title, last status change date, a deadline chip, and a notes snippet. A deadline
   within 7 days is highlighted with amber AND the text "due in N days" (not color alone).
4. Move cards with drag and drop AND a "Move to..." menu so it works from the keyboard and
   screen readers. Board / list toggle.
5. Filters by tag and folder from Phase 2.
```

**Done when:** each feature works on both test forms and with demo data.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.5
git push origin v0.5
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 5: Security and privacy (S9-S10, about 6 h)

**Goal:** data at rest is protected, and the extension asks for the least it needs.
**Tool:** Claude Code (plan and review), Antigravity for the UI.

> This is the hardest phase. If time runs out, ship v1.0 without 12 and add it as v1.1. It is better to skip it than to ship a lock that can lose data.

**5A: Design the lock (Claude Code, Plan only, no code)**
```
Write LOCK_DESIGN.md for an optional passphrase lock, then stop for my review.
Requirements: protects stored entries, drafts, library, and the Groq key at rest. Uses only the
Web Crypto API. Capture must still save while locked (the extension is always-on). Suggested
approach to evaluate: PBKDF2-SHA256 (use the current OWASP iteration guidance) derives a key
that wraps an RSA-OAEP private key; each entry is encrypted with a fresh AES-GCM key wrapped by
the stored PUBLIC key, so new entries can be written while locked and only unlock can read
them. Unlocked key material lives in chrome.storage.session (memory only, cleared when the
browser closes; not exposed to content scripts by default). Cover: auto-lock timeout, what
suggestions/drawer do while locked, forgotten passphrase (data is unrecoverable, so force an
export before enabling), changing the passphrase, migration of existing plaintext data
(reversible), and what the lock does NOT protect against (malware, an unlocked session).
Compare with a simpler UI-only lock and recommend one.
```

**5B: Implement the lock (Plan)**
```
Implement LOCK_DESIGN.md exactly as approved. Files: lib/crypto.js, lib/storage.js,
background.js, popup/history/options UI, content scripts. Include: setup flow with a forced
backup export and a clear warning, unlock screen, auto-lock, change passphrase, disable lock
(decrypts back to plaintext). While locked: capture still saves, suggestions and the drawer
show "Locked. Unlock to use", the popup shows an unlock prompt. Add test steps for every
screen while locked and unlocked.
```

**5C: Privacy and permissions audit (Claude Code, read-only)**
```
Do not change files. Write PRIVACY_AUDIT.md: (1) every permission and host_permission with
its justification, and any that can be removed; (2) every place data leaves the browser (it
should be only the Groq calls the user triggers) and exactly what is sent; (3) every place a
secret is read; (4) anything stored that should not be (sensitive values in drafts, logs,
exports); (5) whether the Options and in-page privacy text matches real behavior. List fixes.
```

**Done when:** you cannot find plaintext entries in storage while the lock is on (check DevTools, Application / Extension storage), and capture still works while locked.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.6
git push origin v0.6
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```
If you skipped the lock (5B) and shipped without it, still tag `v0.6` after 5A and 5C are done.


---

### Phase 6: Accessibility, QA, performance (S11, about 4 h) (feature 17)

**6A: Accessibility pass (Antigravity + you)**
```
Review history, popup, options, welcome, and the in-page UI for accessibility. Fix: missing
labels, heading order, landmarks, focus order and focus return after dialogs/drawers,
aria-selected/aria-current for selection, live regions for toasts and results, visible focus
everywhere, hit targets of at least 24px (28px for in-page chips), reduced motion, and
contrast against the tokens table. Keep a log of every issue and fix.
```
You then do a keyboard-only pass on every screen, and a spot check with a screen reader (NVDA is free on Windows).

**6B: Performance with a big data set (Claude Code)**
```
Write dev/make-seed.js (run with node, outside the shipped code) that generates 500 realistic
fake entries into seed/seed-large.json (clearly fake data). Load it, then measure and report:
history page first render, search latency, popup open time, and chrome.storage bytes in use.
Targets: first render under about 300 ms, search feels instant. If storage rewrites are the
bottleneck, propose moving entries to IndexedDB, but do not implement it without asking.
```

**6C: Full test matrix (you)**: run section 8 in Chrome **and** Edge.

**Done when:** the matrix is clean and no screen needs a mouse. Use it privately for a week after tagging and fix what annoys you.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.9
git push origin v0.9
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```


---

### Phase 7 (OPTIONAL): Sync without a backend (S12-S13, about 6 h) (feature 15)

**Decision gate:** only do this if Phases 0-6 are done **and** you actually use two browsers or computers. Everything in this phase is skippable. Manual export/import from Phase 2 already covers moving data.

**Options, from cheapest to most capable:**
- **A. Manual export/import** (already built). Free, zero risk.
- **B. `chrome.storage.sync` for small things only** (settings, standard answers from the library). It has small quotas (verify the exact limits in the docs), so it cannot hold your history. Whether it syncs in Edge depends on the browser's sync settings (verify).
- **C. Encrypted sync file in a cloud folder you already use** (OneDrive, Google Drive for desktop, Dropbox). The user picks a file inside that folder using the File System Access API. The extension writes an encrypted snapshot and merges newer changes from it. No server of yours.

**Honest limits of C:** the file picker must run from an extension page (history/options), not the service worker, and permission may need to be re-granted by a click in new sessions. So "sync" happens when you open FormMemory, not silently in the background. Merge rule: per-entry `updatedAt`, last writer wins, with tombstones so deletions propagate.

**7A: Design first (Claude Code, Plan only)**
```
Write SYNC_DESIGN.md for option C (and B for settings + library only), then stop for review.
Cover: file format (schemaVersion, encrypted payload reusing lib/crypto.js, or a required
passphrase if the lock is off), picking and remembering the file handle (IndexedDB), permission
re-grant UX, merge algorithm with updatedAt + tombstones, conflict handling, first-time setup
on a second device, failure modes (file missing, corrupted, newer schema), and a "Sync now"
button with a clear status line. Do not include a backend of any kind.
```
**7B: Implement** after approval (Antigravity), plus tests with two browser profiles (for example Chrome and Edge pointing at the same file).

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v0.95
git push origin v0.95
```
Then merge into `main` (optional now; required at v1.0):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```
If you skipped Phase 7, there is nothing to tag. Go straight to Phase 8.


---

### Phase 8: Store launch kit (S14-S15, about 6-8 h) (feature 16)

**Goal:** a listing people can trust, in Chrome Web Store and Edge Add-ons. This is last on purpose, so the product is finished before strangers see it.

**8A: Account and legal basics (you)**
- [ ] Register a Chrome Web Store developer account (one-time **$5**). Consider a dedicated email for it.
- [ ] Register for Edge Add-ons at Partner Center (free; you can sign in with GitHub).
- [ ] Read the Chrome Web Store program policies (especially User Data and Limited Use) before writing the privacy policy. I did not verify the current requirements, so read them.

**8B: Privacy policy + one-page site (Antigravity)**
```
Create a /site folder (GitHub Pages ready) with: index.html (what FormMemory is, a short demo
GIF or screenshots, install links as placeholders, the Slate & Amber look) and privacy.html.
The privacy policy must match real behavior: what is saved (answers from Google Forms you
fill, stored only in your browser), what is never saved (passwords, IDs, card numbers),
that AI features are optional and require your own Groq key, exactly what is sent to Groq and
only when you click, that there is no analytics, no account, no server of ours, how to delete
data (Options > Data, uninstalling), and a contact link (GitHub issues). Use plain language.
Do not claim anything about Groq's own data handling beyond linking their policy.
```

**8C: Onboarding (first-run) (Antigravity)**
```
Files: welcome.html/js/css, background.js (runtime.onInstalled opens welcome on install only).
Three steps, skippable: (1) what FormMemory saves and never saves; (2) pick theme and density
with a live preview; (3) optional: paste a Groq key (explain it is only for the Ask and Draft
features) or "Skip, use keyword search only". Finish with "Load demo data to try it" and an
"Open a Google Form" button. Fully keyboard accessible.
```

**8D: Brand and store assets (you + Antigravity)**
- [ ] Final icon: refine `icon.svg`, export 16/32/48/128 PNG.
- [ ] Screenshots made from **demo data only** (no real personal answers), light and dark. Typical store requirements are a 128x128 icon, at least one 1280x800 (or 640x400) screenshot, and a 440x280 small promo tile. Verify current sizes in the dashboard.
- [ ] Short description, long description, single-purpose statement ("remember and search your own Google Forms answers").
- [ ] Permission justifications, one line each: `storage`, host access to `docs.google.com/forms/*`, `api.groq.com` (only on user request), `alarms` (auto-delete), anything else the audit found.

**8E: Package and pre-flight (Claude Code)**
```
Create scripts/package.js (node, run manually) that builds the store zip with manifest.json at
the root, EXCLUDING dev/, site/, seed-large.json, AUDIT.md and other docs, .git, and any .env.
Set version 1.0.0 in manifest.json and write CHANGELOG.md. Then run a pre-flight and report:
no eval or remote code, no unused permissions, no hardcoded keys (search for gsk_ and AIza),
all icons present, the CSP is default, every user-visible string matches the privacy policy,
and the zip loads unpacked in Chrome and Edge.
```

**8F: Submit (you)**
- [ ] Upload the zip to the Chrome Web Store dashboard. Fill the listing, privacy disclosures, and permission justifications honestly. Submit for review.
- [ ] Upload the same zip to Edge Add-ons (verify that no Edge-specific changes are required).
- [ ] Publish `/site` on GitHub Pages and paste the privacy URL into both listings.
- [ ] Create a GitHub release `v1.0.0` with the zip (do the git tag in the wrap-up block below, once, so the tag does not already exist).
- Review times vary and I did not verify current ones. Do not plan a launch announcement until it is approved.

**Wrap up this phase (git), so you don't forget:**
```
git add .
git commit -m "Finish phase"            # skip if nothing to commit
git push
git tag v1.0
git push origin v1.0
```
Then merge into `main` (required now):
```
git switch main
git merge v1-upgrade
git push
git switch v1-upgrade
```
The merge into `main` is **required** here: `main` should be the released v1.0. The GitHub release `v1.0.0` (with the zip) from the list above is separate from the git tag.


---

## 7.5 V2 backlog
- **#14 Other form sites** (Microsoft Forms, Typeform, others). Needs a per-site adapter layer (selectors, submit detection) and new host permissions, so treat each site as its own mini-project.
- Optional: Glasser org snapshots, a real `chrome.sidePanel` mode (after confirming Edge support), IndexedDB storage if histories get very large, Firefox port.

---

## 8. Test matrix (run in Chrome AND Edge)

| Area | Check |
|---|---|
| Capture | Text, paragraph, choice, checkbox, dropdown, date; multi-page; required fields; masked sensitive question |
| Drafts | Close tab mid-form, reopen, Restore, Undo restore, Discard; no sensitive value in storage |
| Suggestions | Use, Undo, Dismiss; none for sensitive fields |
| Consistency | Flag appears only on real differences; Keep mine remembered |
| Drawer | Opens/closes, Esc, focus returns, Insert into focused question, bottom sheet when narrow |
| Popup + shortcut | Opens from icon and shortcut, Enter copies, Esc closes, works while locked |
| Library / tracker | Pin standard answer, move cards by drag and by menu |
| Organization | Pin, tags, folders, bulk actions, operators in search |
| Export/import | JSON round trip; import preview counts; no secrets in exports |
| Auto-delete | Preview count, pinned kept, Undo on manual delete |
| Pause / block | Nothing captured while paused or blocked |
| Lock (if built) | Setup forces backup, capture while locked, unlock, auto-lock, disable |
| AI | No key, wrong key, rate limit, valid key; "What will be sent" matches what is sent |
| Theme | System/Light/Dark and both densities on every screen |
| Keyboard | Every screen usable without a mouse, focus always visible |
| Console | No errors on history, popup, options, welcome, or a Google Form |

---

## 9. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Google changes the Forms page structure | Keep selectors in one place; keep the "Save this form" manual button as a fallback; run the test forms before every release |
| Groq renames or retires a model | Model is a dropdown filled from /models; friendly 400 error |
| Groq rate limits | Show a clear message with retry time; keyword search never depends on AI |
| Lock locks you out | Forced backup before enabling; clear no-recovery warning; ship without it if not solid |
| Migration bug eats data | `backup_v1` copy before migrating; test with a copy of your real data first |
| Edge differs from Chrome | Test both every phase; Phase 0D catches it early |
| Store rejection or policy issue | Minimal permissions, accurate privacy policy, honest disclosures; fix and resubmit |
| Scope creep | Features are ordered. Stop at any tag; v0.4 is already a good product |
| Agent breaks something | Small commits; revert to the last tag; use the bug template below |

---

## 10. Quick reference

- **Load unpacked:** `chrome://extensions` or `edge://extensions` → Developer mode → Load unpacked → project folder. After each change, click reload, then refresh the form page.
- **Console filter:** open the form, F12, Console, filter `[FormMemory]`.
- **Inspect storage:** DevTools → Application → Extension storage (on the history page).
- **Never commit:** API keys, `.env`, real personal data in seed files.
- **Bug template (paste into either tool):**
```
Bug in <file>.
What I did: <steps>. Browser: <Chrome|Edge> <version>. Theme: <light|dark>.
Expected: <what should happen>
Actual: <what happened>
Console error (copy exactly): <paste>
Fix the root cause with the smallest possible change. Do not refactor or touch other files.
Then explain in two lines what was wrong.
```

---

## Sources

- [Groq API chat completions, OpenAI-compatible endpoint (rubydoc: groq gem README)](https://rubydoc.info/gems/groq/file/README.md)
- [Groq provider reference (Lava docs): /openai/v1/models and chat endpoints](https://www.lava.so/docs/reference/providers/groq)
- [Microsoft Edge Add-ons Developer: bring a Chromium extension to Edge, free registration](https://developer.microsoft.com/en-US/microsoft-edge/extensions/)
- [Publish an Edge extension with a GitHub account (Microsoft Learn)](https://learn.microsoft.com/en-us/Microsoft-Edge/extensions/publish/github)
- [Chrome Web Store: register your developer account](https://developer.chrome.com/docs/webstore/register)
- [Chromium Blog: $5 developer registration fee](https://blog.chromium.org/2020/03/new-developer-dashboard-and.html)
- [chrome.sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/sidePanel)
- [Google Antigravity codelab](https://codelabs.developers.google.com/getting-started-google-antigravity)