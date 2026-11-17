import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import {
  copyableTabs,
  extractUrls,
  formatTabs,
  type CopyFormat,
} from '@/lib/urls';

type Mode = 'copy' | 'open';

// Opening dozens of tabs at once is rarely intended; ask first.
const CONFIRM_ABOVE = 20;

const modeItem = storage.defineItem<Mode>('local:mode', { fallback: 'copy' });
const allWindowsItem = storage.defineItem<boolean>('local:allWindows', {
  fallback: false,
});
const formatItem = storage.defineItem<CopyFormat>('local:format', {
  fallback: 'plain',
});

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const tabButtons = { copy: $('tab-copy'), open: $('tab-open') };
const panels = { copy: $('panel-copy'), open: $('panel-open') };
const copyCount = $('copy-count');
const copyLabel = $('copy-label');
const allWindows = $<HTMLInputElement>('all-windows');
const copyButton = $<HTMLButtonElement>('copy');
const openCount = $('open-count');
const openLabel = $('open-label');
const paste = $<HTMLTextAreaElement>('paste');
const openButton = $<HTMLButtonElement>('open');
const status = $('status');

const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

let tabs: Browser.tabs.Tab[] = [];
let links: string[] = [];

function setStatus(message: string) {
  status.textContent = message;
}

function selectedFormat(): CopyFormat {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="format"]:checked',
  );
  return checked?.value === 'markdown' ? 'markdown' : 'plain';
}

function setMode(mode: Mode, focus = false) {
  for (const key of ['copy', 'open'] as const) {
    const selected = key === mode;
    tabButtons[key].setAttribute('aria-selected', String(selected));
    tabButtons[key].tabIndex = selected ? 0 : -1;
    panels[key].hidden = !selected;
  }
  setStatus('');
  void modeItem.setValue(mode);
  if (focus) tabButtons[mode].focus();
  else (mode === 'open' ? paste : copyButton).focus();
}

async function loadTabs() {
  if (allWindows.checked) {
    tabs = await browser.tabs.query({ windowType: 'normal' });
  } else {
    const highlighted = await browser.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    tabs =
      highlighted.length > 1
        ? highlighted
        : await browser.tabs.query({ currentWindow: true });
  }
  const scope = allWindows.checked
    ? 'in all windows'
    : tabs.length > 1 && tabs.every((tab) => tab.highlighted)
      ? 'selected'
      : 'in this window';
  const count = copyableTabs(tabs).length;
  copyCount.textContent = String(count);
  copyLabel.textContent = `${plural(count, 'tab')} ${scope}`;
  copyButton.disabled = count === 0;
  copyButton.textContent =
    count === 0 ? 'No tabs to copy' : `Copy ${count} ${plural(count, 'URL')}`;
}

async function copy() {
  const count = copyableTabs(tabs).length;
  try {
    await navigator.clipboard.writeText(formatTabs(tabs, selectedFormat()));
    setStatus(`Copied ${count} ${plural(count, 'URL')}`);
  } catch {
    setStatus('Could not write to the clipboard. Try again.');
  }
}

function updateLinks() {
  links = extractUrls(paste.value);
  const count = links.length;
  openCount.textContent = String(count);
  openLabel.textContent = `${plural(count, 'link')} found`;
  openButton.disabled = count === 0;
  openButton.textContent =
    count === 0 ? 'Open links' : `Open ${count} ${plural(count, 'tab')}`;
  delete openButton.dataset.confirm;
}

async function open() {
  const count = links.length;
  if (count === 0) return;
  if (count > CONFIRM_ABOVE && !openButton.dataset.confirm) {
    openButton.dataset.confirm = 'true';
    openButton.textContent = `Yes, open all ${count} tabs`;
    setStatus('That is a lot of tabs. Click again to confirm.');
    return;
  }
  // Sequential so tabs keep the order the links were pasted in.
  for (const url of links) await browser.tabs.create({ url, active: false });
  paste.value = '';
  updateLinks();
  setStatus(`Opened ${count} ${plural(count, 'tab')}`);
}

for (const key of ['copy', 'open'] as const) {
  tabButtons[key].addEventListener('click', () => setMode(key));
  tabButtons[key].addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setMode(key === 'copy' ? 'open' : 'copy', true);
    }
  });
}

allWindows.addEventListener('change', () => {
  void allWindowsItem.setValue(allWindows.checked);
  setStatus('');
  void loadTabs();
});

document.querySelectorAll('input[name="format"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    void formatItem.setValue(selectedFormat());
    setStatus('');
  }),
);

copyButton.addEventListener('click', () => void copy());
openButton.addEventListener('click', () => void open());
paste.addEventListener('input', () => {
  updateLinks();
  setStatus('');
});
paste.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void open();
  }
});

// Ctrl+V anywhere in the popup jumps to Open mode with the pasted text.
document.addEventListener('paste', (event) => {
  if (event.target === paste) return;
  const text = event.clipboardData?.getData('text') ?? '';
  if (!text) return;
  event.preventDefault();
  setMode('open');
  paste.value = text;
  updateLinks();
});

const [mode, all, format] = await Promise.all([
  modeItem.getValue(),
  allWindowsItem.getValue(),
  formatItem.getValue(),
]);
allWindows.checked = all;
const formatRadio = document.querySelector<HTMLInputElement>(
  `input[name="format"][value="${format}"]`,
);
if (formatRadio) formatRadio.checked = true;
await loadTabs();
setMode(mode);
