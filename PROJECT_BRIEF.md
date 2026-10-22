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