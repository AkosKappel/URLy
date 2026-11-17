import { browser, type Browser } from 'wxt/browser';
import {
  buildClipboard,
  loadSettings,
  queryTabs,
  saveSettings,
  writeClipboard,
  type Scope,
  type Settings,
} from '@/lib/copy';
import {
  copyableLinks,
  findUrls,
  isCopyable,
  formatEntries,
  FORMATS,
  isCopyFormat,
} from '@/lib/urls';

type Mode = Settings['mode'];

// Opening dozens of tabs at once is rarely intended; ask first.
const CONFIRM_ABOVE = 20;

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const tabButtons = { copy: $('tab-copy'), open: $('tab-open') };
const panels = { copy: $('panel-copy'), open: $('panel-open') };
const copyCount = $('copy-count');
const copyLabel = $('copy-label');
const copyNote = $('copy-note');
const formatSelect = $<HTMLSelectElement>('format');
const templateField = $('template-field');
const templateInput = $<HTMLInputElement>('template');
const allWindows = $<HTMLInputElement>('all-windows');
const clean = $<HTMLInputElement>('clean');
const newWindow = $<HTMLInputElement>('new-window');
const copyButton = $<HTMLButtonElement>('copy');
const openCount = $('open-count');
const openLabel = $('open-label');
const openNote = $('open-note');
const paste = $<HTMLTextAreaElement>('paste');
const openButton = $<HTMLButtonElement>('open');
const preview = $<HTMLOListElement>('preview');
const status = $('status');
const shortcut = $('shortcut');

const SCOPE_LABELS: Record<Scope, string> = {
  window: 'in this window',
  selected: 'selected',
  all: 'in all windows',
};

const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

function showDuplicates(note: HTMLElement, duplicates: number) {
  note.textContent = `${duplicates} ${plural(duplicates, 'duplicate')} skipped`;
  note.hidden = duplicates === 0;
}

let settings: Settings;
let tabs: Browser.tabs.Tab[] = [];
let scope: Scope = 'window';
let links: string[] = [];

function setStatus(message: string) {
  status.textContent = message;
}

function update(changes: Partial<Settings>) {
  settings = { ...settings, ...changes };
  setStatus('');
  void saveSettings(changes);
}

function setMode(mode: Mode, focus = false) {
  for (const key of ['copy', 'open'] as const) {
    const selected = key === mode;
    tabButtons[key].setAttribute('aria-selected', String(selected));
    tabButtons[key].tabIndex = selected ? 0 : -1;
    panels[key].hidden = !selected;
  }
  update({ mode });
  if (focus) tabButtons[mode].focus();
  else (mode === 'open' ? paste : copyButton).focus();
}

function renderCopy() {
  const entries = formatEntries(
    copyableLinks(tabs, { clean: settings.clean }),
    settings.format,
    settings.template,
  );
  const count = entries.length;
  preview.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      return item;
    }),
  );
  preview.hidden = count === 0;
  copyCount.textContent = String(count);
  copyLabel.textContent = `${plural(count, 'tab')} ${SCOPE_LABELS[scope]}`;
  showDuplicates(
    copyNote,
    tabs.filter((tab) => isCopyable(tab.url)).length - count,
  );
  copyButton.disabled = count === 0;
  copyButton.textContent =
    count === 0 ? 'No tabs to copy' : `Copy ${count} ${plural(count, 'URL')}`;
  templateField.hidden = settings.format !== 'custom';
}

async function loadTabs() {
  const result = await queryTabs(settings.allWindows);
  tabs = result.tabs;
  scope = result.scope;
  renderCopy();
}

function copy() {
  const content = buildClipboard(tabs, settings);
  setStatus(
    writeClipboard(content)
      ? `Copied ${content.count} ${plural(content.count, 'URL')}`
      : 'Could not write to the clipboard. Try again.',
  );
}

function updateLinks() {
  const found = findUrls(paste.value);
  links = [...new Set(found)];
  const count = links.length;
  showDuplicates(openNote, found.length - count);
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
  if (settings.newWindow) await browser.windows.create({ url: links });
  // Sequential so tabs keep the order the links were pasted in.
  else
    for (const url of links) await browser.tabs.create({ url, active: false });
  paste.value = '';
  updateLinks();
  setStatus(`Opened ${count} ${plural(count, 'tab')}`);
}

async function showShortcut() {
  const commands = await browser.commands.getAll();
  const keys = commands.find(
    (command) => command.name === 'copy-tabs',
  )?.shortcut;
  if (!keys) return;
  shortcut.textContent = `${keys} copies tabs without opening URLy`;
  shortcut.hidden = false;
}

for (const [value, label] of Object.entries(FORMATS))
  formatSelect.add(new Option(label, value));

for (const key of ['copy', 'open'] as const) {
  tabButtons[key].addEventListener('click', () => setMode(key));
  tabButtons[key].addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setMode(key === 'copy' ? 'open' : 'copy', true);
    }
  });
}

formatSelect.addEventListener('change', () => {
  if (isCopyFormat(formatSelect.value)) update({ format: formatSelect.value });
  renderCopy();
});
templateInput.addEventListener('input', () => {
  update({ template: templateInput.value });
  renderCopy();
});
allWindows.addEventListener('change', () => {
  update({ allWindows: allWindows.checked });
  void loadTabs();
});
newWindow.addEventListener('change', () =>
  update({ newWindow: newWindow.checked }),
);
clean.addEventListener('change', () => {
  update({ clean: clean.checked });
  void loadTabs();
});

copyButton.addEventListener('click', copy);
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

// Ctrl+V anywhere outside a text field jumps to Open mode with the text.
document.addEventListener('paste', (event) => {
  if (event.target instanceof HTMLInputElement || event.target === paste)
    return;
  const text = event.clipboardData?.getData('text') ?? '';
  if (!text) return;
  event.preventDefault();
  setMode('open');
  paste.value = text;
  updateLinks();
});

settings = await loadSettings();
formatSelect.value = settings.format;
templateInput.value = settings.template;
allWindows.checked = settings.allWindows;
clean.checked = settings.clean;
newWindow.checked = settings.newWindow;
await loadTabs();
setMode(settings.mode);
void showShortcut();
