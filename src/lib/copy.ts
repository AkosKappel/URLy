import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import {
  copyableLinks,
  DEFAULT_TEMPLATE,
  formatLinks,
  isCopyFormat,
  type CopyFormat,
} from './urls';

export interface Settings {
  mode: 'copy' | 'open';
  allWindows: boolean;
  format: CopyFormat;
  template: string;
  clean: boolean;
  newWindow: boolean;
}

const DEFAULTS: Settings = {
  mode: 'copy',
  allWindows: false,
  format: 'plain',
  template: DEFAULT_TEMPLATE,
  clean: false,
  newWindow: false,
};

const settingsItem = storage.defineItem<Partial<Settings>>('local:settings', {
  fallback: {},
});

export async function loadSettings(): Promise<Settings> {
  const saved = await settingsItem.getValue();
  const settings = { ...DEFAULTS, ...saved };
  if (!isCopyFormat(settings.format)) settings.format = DEFAULTS.format;
  return settings;
}

export async function saveSettings(changes: Partial<Settings>) {
  await settingsItem.setValue({
    ...(await settingsItem.getValue()),
    ...changes,
  });
}

export type Scope = 'window' | 'selected' | 'all';

// Highlighted tabs win when more than one is selected (Ctrl/Shift-click),
// matching how the browser treats multi-tab actions.
export async function queryTabs(
  allWindows: boolean,
): Promise<{ tabs: Browser.tabs.Tab[]; scope: Scope }> {
  if (allWindows)
    return {
      tabs: await browser.tabs.query({ windowType: 'normal' }),
      scope: 'all',
    };
  const highlighted = await browser.tabs.query({
    currentWindow: true,
    highlighted: true,
  });
  if (highlighted.length > 1) return { tabs: highlighted, scope: 'selected' };
  return {
    tabs: await browser.tabs.query({ currentWindow: true }),
    scope: 'window',
  };
}

export interface ClipboardContent {
  text: string;
  html?: string;
  count: number;
}

export function buildClipboard(
  tabs: Browser.tabs.Tab[],
  settings: Settings,
): ClipboardContent {
  const links = copyableLinks(tabs, { clean: settings.clean });
  const text = formatLinks(links, settings.format, settings.template);
  return {
    text,
    // Rich editors (Docs, Notion, mail) paste the HTML format as real links.
    html: settings.format === 'html' ? text : undefined,
    count: links.length,
  };
}

// Uses a copy event rather than navigator.clipboard because it also works in
// unfocused documents (Chrome's offscreen document, Firefox's background page)
// and can set plain text and HTML in one go.
export function writeClipboard({
  text,
  html,
}: Omit<ClipboardContent, 'count'>) {
  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
    if (html) event.clipboardData?.setData('text/html', html);
  };
  document.addEventListener('copy', onCopy, { once: true });
  try {
    return document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}
