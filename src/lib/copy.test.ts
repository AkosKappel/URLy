import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  buildClipboard,
  loadSettings,
  queryTabs,
  saveSettings,
  type Settings,
} from './copy';

const tab = (url: string, extra: Partial<Browser.tabs.Tab> = {}) =>
  ({ url, title: url, ...extra }) as Browser.tabs.Tab;

// tabs.query's callback overload confuses spyOn's inferred type.
const mockQuery = () =>
  vi.spyOn(fakeBrowser.tabs, 'query') as unknown as MockInstance<
    (info: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>
  >;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('settings', () => {
  it('starts from defaults', async () => {
    expect(await loadSettings()).toMatchObject({
      mode: 'copy',
      format: 'plain',
      allWindows: false,
      clean: false,
      newWindow: false,
    });
  });

  it('merges partial saves', async () => {
    await saveSettings({ format: 'csv' });
    await saveSettings({ clean: true });
    expect(await loadSettings()).toMatchObject({ format: 'csv', clean: true });
  });

  it('falls back when a stored format is no longer known', async () => {
    await fakeBrowser.storage.local.set({ settings: { format: 'xml' } });
    expect((await loadSettings()).format).toBe('plain');
  });
});

describe('queryTabs', () => {
  it('queries normal windows when all windows is on', async () => {
    const query = mockQuery().mockResolvedValue([tab('https://a.com/')]);
    expect((await queryTabs(true)).scope).toBe('all');
    expect(query).toHaveBeenCalledWith({ windowType: 'normal' });
  });

  it('uses selected tabs when more than one is highlighted', async () => {
    const selected = [tab('https://a.com/'), tab('https://b.com/')];
    mockQuery().mockResolvedValue(selected);
    expect(await queryTabs(false)).toEqual({
      tabs: selected,
      scope: 'selected',
    });
  });

  it('uses the whole window when only the active tab is highlighted', async () => {
    const query = mockQuery()
      .mockResolvedValueOnce([tab('https://a.com/')])
      .mockResolvedValueOnce([tab('https://a.com/'), tab('https://b.com/')]);
    const result = await queryTabs(false);
    expect(result.scope).toBe('window');
    expect(result.tabs).toHaveLength(2);
    expect(query).toHaveBeenLastCalledWith({ currentWindow: true });
  });
});

describe('buildClipboard', () => {
  const settings = (changes: Partial<Settings>) =>
    ({ format: 'plain', template: '', clean: false, ...changes }) as Settings;
  const tabs = [
    tab('https://a.com/?utm_source=x'),
    tab('https://a.com/'),
    tab('chrome://newtab/'),
  ];

  it('counts copyable links and leaves html empty for text formats', () => {
    expect(buildClipboard(tabs, settings({}))).toEqual({
      text: 'https://a.com/?utm_source=x\nhttps://a.com/',
      html: undefined,
      count: 2,
    });
  });

  it('removes tracking before counting', () => {
    expect(buildClipboard(tabs, settings({ clean: true })).count).toBe(1);
  });

  it('adds rich HTML for the HTML format', () => {
    const content = buildClipboard(tabs, settings({ format: 'html' }));
    expect(content.html).toBe(content.text);
    expect(content.html).toContain('<a href="https://a.com/">');
  });
});
