import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  buildClipboard,
  loadSettings,
  queryTabs,
  readClipboard,
  writeClipboard,
  type ClipboardContent,
} from '@/lib/copy';
import {
  CONFIRM_ABOVE,
  extractUrls,
  FORMATS,
  isCopyFormat,
  type CopyFormat,
} from '@/lib/urls';

const COPY_AS_PREFIX = 'copy-as:';

const OFFSCREEN_URL = '/offscreen.html';

async function createOffscreen() {
  try {
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [browser.offscreen.Reason.CLIPBOARD],
      justification:
        'Copy tab URLs and read links from the clipboard for shortcuts and menus',
    });
  } catch {
    // Already open from an earlier clipboard access.
  }
}

// Firefox background pages have a DOM and can use the clipboard directly.
async function writeFromBackground(content: ClipboardContent) {
  if (import.meta.env.FIREFOX) return writeClipboard(content);
  await createOffscreen();
  return browser.runtime.sendMessage<unknown, boolean>({
    type: 'urly:write-clipboard',
    ...content,
  });
}

async function readFromBackground() {
  if (import.meta.env.FIREFOX) return readClipboard();
  await createOffscreen();
  return browser.runtime.sendMessage<unknown, string>({
    type: 'urly:read-clipboard',
  });
}

// Optional, so installing URLy shows no clipboard warning. Must be called
// synchronously in the click or shortcut handler: Firefox only allows
// permission prompts during a user action.
const requestClipboardRead = () =>
  browser.permissions.request({ permissions: ['clipboardRead'] });

async function flashBadge(text: string, color: string) {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  setTimeout(() => void browser.action.setBadgeText({ text: '' }), 1500);
}

async function copyTabs(format?: CopyFormat) {
  try {
    const saved = await loadSettings();
    const settings = format ? { ...saved, format } : saved;
    const { tabs } = await queryTabs(settings.allWindows);
    const content = buildClipboard(tabs, settings);
    if (content.count === 0) return flashBadge('0', '#5a6573');
    const ok = await writeFromBackground(content);
    await flashBadge(
      ok ? String(content.count) : '!',
      ok ? '#1f7a4d' : '#b42318',
    );
  } catch {
    await flashBadge('!', '#b42318');
  }
}

async function openLinks(urls: string[], tab?: Browser.tabs.Tab) {
  // Next to the page the links came from, in order.
  for (const [offset, url] of urls.entries())
    await browser.tabs.create({
      url,
      active: false,
      windowId: tab?.windowId,
      index: tab ? tab.index + 1 + offset : undefined,
    });
}

async function openClipboard(
  granted: Promise<boolean>,
  tab?: Browser.tabs.Tab,
) {
  try {
    if (!(await granted)) return flashBadge('!', '#b42318');
    const urls = extractUrls(await readFromBackground());
    if (urls.length === 0) return flashBadge('0', '#5a6573');
    // There is nowhere to confirm here, so large lists go through the popup.
    if (urls.length > CONFIRM_ABOVE) return flashBadge('20+', '#b54708');
    await openLinks(urls, tab);
    await flashBadge(String(urls.length), '#1f7a4d');
  } catch {
    await flashBadge('!', '#b42318');
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'copy-tabs',
      title: 'Copy tab URLs',
      contexts: ['action'],
    });
    browser.contextMenus.create({
      id: 'copy-as',
      title: 'Copy tab URLs as',
      contexts: ['action'],
    });
    for (const [format, label] of Object.entries(FORMATS))
      browser.contextMenus.create({
        id: `${COPY_AS_PREFIX}${format}`,
        parentId: 'copy-as',
        title: label,
        contexts: ['action'],
      });
    browser.contextMenus.create({
      id: 'open-clipboard',
      title: 'Open links from clipboard',
      contexts: ['action'],
    });
    browser.contextMenus.create({
      id: 'open-selection',
      title: 'Open links in selection',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    if (id === 'copy-tabs') void copyTabs();
    const format = id.slice(COPY_AS_PREFIX.length);
    if (id.startsWith(COPY_AS_PREFIX) && isCopyFormat(format))
      void copyTabs(format);
    if (id === 'open-clipboard')
      void openClipboard(requestClipboardRead(), tab);
    if (id === 'open-selection')
      void openLinks(extractUrls(info.selectionText ?? ''), tab);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'copy-tabs') void copyTabs();
    if (command === 'open-clipboard')
      void openClipboard(requestClipboardRead(), tab);
  });
});
