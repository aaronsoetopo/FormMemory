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
