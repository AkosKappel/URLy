import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  buildClipboard,
  loadSettings,
  queryTabs,
  writeClipboard,
  type ClipboardContent,
} from '@/lib/copy';
import { extractUrls } from '@/lib/urls';

const OFFSCREEN_URL = '/offscreen.html';

async function writeFromBackground(content: ClipboardContent) {
  // Firefox background pages have a DOM and can write directly.
  if (import.meta.env.FIREFOX) return writeClipboard(content);
  try {
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [browser.offscreen.Reason.CLIPBOARD],
      justification: 'Copy tab URLs to the clipboard from a keyboard shortcut',
    });
  } catch {
    // Already open from an earlier copy.
  }
  return browser.runtime.sendMessage<unknown, boolean>({
    type: 'urly:write-clipboard',
    ...content,
  });
}

async function flashBadge(text: string, color: string) {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  setTimeout(() => void browser.action.setBadgeText({ text: '' }), 1500);
}

async function copyTabs() {
  try {
    const settings = await loadSettings();
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

async function openLinks(text: string, tab?: Browser.tabs.Tab) {
  const urls = extractUrls(text);
  // Next to the page the links came from, in order.
  for (const [offset, url] of urls.entries())
    await browser.tabs.create({
      url,
      active: false,
      windowId: tab?.windowId,
      index: tab ? tab.index + 1 + offset : undefined,
    });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'copy-tabs',
      title: 'Copy tab URLs',
      contexts: ['action'],
    });
    browser.contextMenus.create({
      id: 'open-selection',
      title: 'Open links in selection',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'copy-tabs') void copyTabs();
    if (info.menuItemId === 'open-selection')
      void openLinks(info.selectionText ?? '', tab);
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === 'copy-tabs') void copyTabs();
  });
});
