import AxeBuilder from '@axe-core/playwright';
import type { browser } from 'wxt/browser';
import { expect, openSites, test } from './fixtures';

// The extension API global inside the popup page.
declare const chrome: typeof browser;

const readClipboard = (page: import('@playwright/test').Page) =>
  page.evaluate(() => navigator.clipboard.readText());

test('copies the URLs of open tabs', async ({ context, page, popupUrl }) => {
  await openSites(context, ['https://one.test/', 'https://two.test/a?b=1']);
  await page.goto(popupUrl);

  await expect(page.locator('#copy-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Copy 2 URLs' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied 2 URLs');
  expect(await readClipboard(page)).toBe(
    'https://one.test/\nhttps://two.test/a?b=1',
  );
});

test('copies Markdown and remembers the format', async ({
  context,
  page,
  popupUrl,
}) => {
  await openSites(context, ['https://one.test/']);
  await page.goto(popupUrl);

  await page.getByLabel('Format').selectOption({ label: 'Markdown links' });
  await page.getByRole('button', { name: 'Copy 1 URL' }).click();
  expect(await readClipboard(page)).toBe('[one.test](https://one.test/)');

  await page.reload();
  await expect(page.getByLabel('Format')).toHaveValue('markdown');
});

test('copies with a custom template', async ({ context, page, popupUrl }) => {
  await openSites(context, ['https://one.test/a', 'https://two.test/b']);
  await page.goto(popupUrl);

  await page.getByLabel('Format').selectOption({ label: 'Custom template' });
  await page.getByRole('textbox', { name: 'Template' }).fill('* {host}: {url}');
  await expect(
    page.getByLabel('Preview of the copied text').getByRole('listitem'),
  ).toHaveText([
    '* one.test: https://one.test/a',
    '* two.test: https://two.test/b',
  ]);
  await page.getByRole('button', { name: 'Copy 2 URLs' }).click();
  expect(await readClipboard(page)).toBe(
    '* one.test: https://one.test/a\n* two.test: https://two.test/b',
  );
});

test('removes tracking parameters and merges the duplicates', async ({
  context,
  page,
  popupUrl,
}) => {
  await openSites(context, [
    'https://one.test/?utm_source=mail&id=1',
    'https://one.test/?id=1&fbclid=abc',
  ]);
  await page.goto(popupUrl);
  await expect(page.locator('#copy-count')).toHaveText('2');

  await expect(page.locator('#copy-note')).toBeHidden();
  await page.getByLabel('Remove tracking').check();
  await expect(page.locator('#copy-count')).toHaveText('1');
  await expect(page.locator('#copy-note')).toHaveText('1 duplicate skipped');
  await page.getByRole('button', { name: 'Copy 1 URL' }).click();
  expect(await readClipboard(page)).toBe('https://one.test/?id=1');
});

test('offscreen document writes the clipboard for the shortcut', async ({
  context,
  page,
  popupUrl,
}) => {
  await page.goto(popupUrl);
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const ok = await worker.evaluate(async () => {
    await chrome.offscreen.createDocument({
      url: '/offscreen.html',
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: 'test',
    });
    return chrome.runtime.sendMessage({
      type: 'urly:write-clipboard',
      text: 'https://from.test/',
    });
  });
  expect(ok).toBe(true);
  expect(await readClipboard(page)).toBe('https://from.test/');
});

test('opens links pasted into the text box', async ({ page, popupUrl }) => {
  await page.goto(popupUrl);
  await page.getByRole('tab', { name: 'Open' }).click();

  await page
    .getByRole('textbox', { name: 'Text with links' })
    .fill('Read https://one.test/x and www.two.test, then https://one.test/x');
  await expect(page.locator('#open-count')).toHaveText('2');
  await expect(page.locator('#open-note')).toHaveText('1 duplicate skipped');

  await page.getByRole('button', { name: 'Open 2 tabs' }).click();
  await expect(page.getByRole('status')).toHaveText('Opened 2 tabs');
  // Extension-opened tabs skip Playwright routing, so ask the browser what
  // each tab was asked to load.
  const urls = await page.evaluate(async () =>
    (await chrome.tabs.query({})).map((tab) => tab.pendingUrl ?? tab.url),
  );
  expect(urls).toEqual(
    expect.arrayContaining(['https://one.test/x', 'https://www.two.test/']),
  );
});

test('long lists scroll inside the text box, not the popup', async ({
  page,
  popupUrl,
}) => {
  await page.goto(popupUrl);
  await page.getByRole('tab', { name: 'Open' }).click();
  const box = page.getByRole('textbox');
  const before = await box.boundingBox();
  const pageHeight = () =>
    page.evaluate(() => document.querySelector('main')!.offsetHeight);
  const mainBefore = await pageHeight();

  await box.fill(
    Array.from({ length: 100 }, (_, i) => `https://s${i}.test/`).join('\n'),
  );
  expect((await box.boundingBox())?.height).toBe(before?.height);
  expect(await pageHeight()).toBe(mainBefore);
  expect(
    await box.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
});

test('opens links in a new window', async ({ page, popupUrl }) => {
  await page.goto(popupUrl);
  await page.getByRole('tab', { name: 'Open' }).click();
  await page.getByLabel('In a new window').check();
  await page
    .getByRole('textbox', { name: 'Text with links' })
    .fill('https://one.test/ https://two.test/');
  await page.getByRole('button', { name: 'Open 2 tabs' }).click();
  await expect(page.getByRole('status')).toHaveText('Opened 2 tabs');

  const windows = await page.evaluate(async () =>
    (await chrome.windows.getAll({ populate: true })).map((window) =>
      window.tabs?.map((tab) => tab.pendingUrl ?? tab.url),
    ),
  );
  expect(windows).toContainEqual(['https://one.test/', 'https://two.test/']);
});

test('asks before opening more than 20 tabs', async ({ page, popupUrl }) => {
  await page.goto(popupUrl);
  await page.getByRole('tab', { name: 'Open' }).click();
  const many = Array.from({ length: 21 }, (_, i) => `https://s${i}.test/`);
  await page.getByRole('textbox').fill(many.join('\n'));

  await page.getByRole('button', { name: 'Open 21 tabs' }).click();
  await expect(
    page.getByRole('button', { name: 'Yes, open all 21 tabs' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Click again');
});

test('pasting in Copy mode switches to Open mode', async ({
  page,
  popupUrl,
}) => {
  await page.goto(popupUrl);
  await page.evaluate(() => navigator.clipboard.writeText('https://one.test/'));
  await page.keyboard.press('ControlOrMeta+V');

  await expect(page.getByRole('tab', { name: 'Open' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#open-count')).toHaveText('1');
});

test('registers the context menu items', async ({
  context,
  page,
  popupUrl,
}) => {
  await page.goto(popupUrl);
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  // update() rejects for unknown IDs, so it doubles as an existence check.
  const missing = await worker.evaluate(async () => {
    const ids = [
      'copy-tabs',
      'copy-as',
      'copy-as:plain',
      'copy-as:custom',
      'open-clipboard',
      'open-selection',
    ];
    const results = await Promise.allSettled(
      ids.map((id) => chrome.contextMenus.update(id, {})),
    );
    return ids.filter((_, i) => results[i]?.status === 'rejected');
  });
  expect(missing).toEqual([]);
});

test('has no detectable accessibility issues', async ({ page, popupUrl }) => {
  await page.goto(popupUrl);
  await page.getByRole('combobox', { name: 'Format' }).selectOption('custom');
  for (const scheme of ['light', 'dark'] as const) {
    // Reduced motion skips the color transitions axe would otherwise sample.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const mode of ['Copy', 'Open']) {
      await page.getByRole('tab', { name: mode }).click();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations, `${mode} mode, ${scheme}`).toEqual([]);
    }
  }
});
