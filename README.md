# FormMemory

A Chrome extension (Manifest V3, plain JavaScript, no build step) that remembers what you typed into Google Forms and lets you search it later. Everything stays local in `chrome.storage.local`. There is no backend and no accounts.

## What it does

- Saves your answers when you submit a Google Form (`docs.google.com/forms/*`).
- Shows them on a history page where you can search, copy, export (JSON) and delete entries.
- Suggests "Last time:" answers on new forms. It never auto-fills; you click **Use**.
- Masks sensitive fields (passwords and questions about SSN, card numbers, passports, bank accounts) instead of storing the answer.
- Optional "Ask your history" box, powered by an API key you provide (see below).
- The toolbar badge shows how many entries are saved.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this project folder (the one containing `manifest.json`).
4. Click the FormMemory toolbar icon (use the puzzle-piece menu to pin it) to open the history page.

After editing code, click the reload icon on the FormMemory card in `chrome://extensions`.

Want to look around first? Open **Options** and click **Load demo data**.

## Adding API keys

API keys are optional and only needed for AI features. Keys are never in the source code; you enter them yourself.

1. Open the history page and click **Options** (or right-click the toolbar icon and choose Options).
2. Paste your key into the **Groq API Key** field (get one at <https://console.groq.com/keys>).
3. Click **Save key**, then **Test key** to check it and pick a chat model.

The key is stored only in `chrome.storage.local` in your browser and is sent only to Groq's API. Clear the field and click **Save key** to remove it.

## Known limitations

- Captures from install onward: nothing is imported from forms you submitted before installing.
- Supports text, choice, checkbox and dropdown answers only. (Paragraph, date and time answers are captured on a best-effort basis; file uploads and grids are not captured.)
- Sensitive-field masking works by matching the question wording, so a question like "Student ID number" is not masked.
- Relies on Google Forms' page structure, which Google can change at any time.
- Data lives in one browser profile; there is no sync between devices.
