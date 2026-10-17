PROJECT BRIEF: FormMemory

Goal: A Chrome extension (Manifest V3, plain JavaScript, no build step, no frameworks)
that remembers what a user typed into Google Forms and lets them search it later.

Rules:
- Everything stays local in chrome.storage.local. No backend. No accounts.
- Never store passwords, ID numbers, card numbers. Mask sensitive fields by default.
- AI features may only send text the user explicitly asks about.
- API keys (Gemini, Glasser) are entered by the user in an options page and stored in
  chrome.storage.local. NEVER hardcode a key or commit one.
- Keep code small and readable. Prefer simple over clever. No dependencies unless necessary.
- Do not refactor files outside the task. Work only on the files I name.

File layout:
  manifest.json
  background.js           (service worker)
  content/capture.js      (runs on docs.google.com/forms/*)
  lib/storage.js          (entry CRUD on chrome.storage.local)
  lib/gemini.js           (Gemini API helper)
  lib/glasser.js          (Glasser helper, optional)
  history.html / history.js / history.css   (full-page history UI)
  options.html / options.js                 (API keys, demo data loader, privacy toggles)
  seed/seed.json          (fake demo entries)

Data model (Entry):
  {
    id: string,
    formId: string,
    formTitle: string,
    formUrl: string,
    submittedAt: string (ISO),
    fields: [{ question: string, type: "text"|"paragraph"|"choice"|"checkbox"|"dropdown"|"date"|"other",
               answer: string | string[], sensitive: boolean }],
    org: null | { name: string, summary: string, website: string, fetchedAt: string }
  }