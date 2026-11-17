// Renders store screenshots and images from the built Chrome extension.
// Run with `pnpm assets:store`, which builds first.
/* global document, chrome -- used inside page.evaluate callbacks */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';

const out = (name) => new URL(`../store/${name}`, import.meta.url).pathname;
const icon = (
  await readFile(new URL('../public/icon/icon.svg', import.meta.url))
).toString('base64');
const iconSrc = `data:image/svg+xml;base64,${icon}`;

const TABS = [
  ['developer.mozilla.test', 'Fetch API - Web APIs | MDN'],
  ['news.ycombinator.test', 'Hacker News'],
  ['github.test', 'wxt-dev/wxt: Next-gen web extension framework'],
  ['en.wikipedia.test', 'Hypertext - Wikipedia'],
  ['docs.python.test', 'urllib.parse - Parse URLs into components'],
  ['web.dev.test', 'Learn CSS'],
  ['stackoverflow.test', 'How do I copy to the clipboard in JavaScript?'],
  ['www.rfc-editor.test', 'RFC 3986: Uniform Resource Identifier'],
];

const PASTED = `Reading list from Friday:
- https://en.wikipedia.org/wiki/Uniform_Resource_Locator
- https://developer.mozilla.org/en-US/docs/Web/API/URL
- www.rfc-editor.org/rfc/rfc3986 (the spec)
Also see https://github.com/wxt-dev/wxt and https://web.dev/learn/css.`;

const extensionPath = resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

async function popupShot(page, setup) {
  await setup(page);
  await page.locator('.status').evaluate((element) => element.remove());
  await page.locator('#shortcut').evaluate((element) => element.remove());
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.querySelector('textarea').scrollTop = 0;
  });
  const image = await page.locator('main').screenshot();
  return `data:image/png;base64,${image.toString('base64')}`;
}

function frame({ title, text, popup }) {
  return `<!doctype html><html><head><style>
    body { margin: 0; width: 1280px; height: 800px; display: grid;
      grid-template-columns: 1fr 500px; align-items: center; gap: 64px;
      padding: 0 110px; box-sizing: border-box; background: #e9ecef;
      color: #18202b; font-family: 'DejaVu Sans', sans-serif; }
    .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 44px;
      font-size: 26px; font-weight: 700; }
    .brand img { width: 48px; height: 48px; }
    h1 { margin: 0 0 20px; font-size: 52px; line-height: 1.08;
      letter-spacing: -0.03em; }
    p { margin: 0; max-width: 30ch; font-size: 23px; line-height: 1.45;
      color: #5a6573; }
    .popup { width: 440px; border-radius: 10px;
      box-shadow: 0 30px 60px -20px rgba(24, 32, 43, 0.35); }
  </style></head><body>
    <div><div class="brand"><img src="${iconSrc}">URLy</div>
    <h1>${title}</h1><p>${text}</p></div>
    <img class="popup" src="${popup}">
  </body></html>`;
}

try {
  await context.route(/^https?:\/\/[^/]*\.test\//, (route) => {
    const host = new URL(route.request().url()).hostname;
    const title = TABS.find(([name]) => name === host)?.[1] ?? host;
    return route.fulfill({
      contentType: 'text/html',
      body: `<title>${title}</title>`,
    });
  });
  for (const [host] of TABS)
    await (await context.newPage()).goto(`https://${host}/`);

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const popupUrl = new URL('popup.html', worker.url()).href;
  const page = await context.newPage();
  await page.setViewportSize({ width: 340, height: 600 });
  await page.emulateMedia({ colorScheme: 'light' });
  const canvas = await context.newPage();

  // Higher pixel density for crisp popups inside 1280x800 frames.
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 340,
    height: 600,
    deviceScaleFactor: 2,
    mobile: false,
  });

  const shots = [
    {
      name: 'screenshot-1-copy.png',
      title: 'Copy every tab URL in one click',
      text: 'From this window, all windows or only the tabs you selected. Internal pages and duplicates are skipped.',
      setup: async (popup) => {
        await popup.goto(popupUrl);
      },
    },
    {
      name: 'screenshot-2-open.png',
      title: 'Paste any text, open every link in it',
      text: 'URLy finds the links in notes, chats or emails and opens them as background tabs.',
      setup: async (popup) => {
        await popup.goto(popupUrl);
        await popup.getByRole('tab', { name: 'Open' }).click();
        await popup.getByRole('textbox').fill(PASTED);
      },
    },
    {
      name: 'screenshot-3-formats.png',
      title: 'Seven formats, or your own template',
      text: 'Plain URLs, Markdown, HTML, CSV, JSON, title and URL, or a template like {title} - {url}. Tracking parameters can be removed.',
      setup: async (popup) => {
        await popup.goto(popupUrl);
        await popup.getByRole('tab', { name: 'Copy' }).click();
        await popup.getByLabel('Format').selectOption('custom');
        await popup
          .getByRole('textbox', { name: 'Template' })
          .fill('- [{title}]({url})');
        await popup.getByLabel('Remove tracking').check();
      },
    },
  ];

  await canvas.setViewportSize({ width: 1280, height: 800 });
  for (const shot of shots) {
    const popup = await popupShot(page, shot.setup);
    await canvas.setContent(frame({ ...shot, popup }));
    await canvas.screenshot({ path: out(shot.name), scale: 'css' });
  }

  // Reset the popup so later runs start from defaults.
  await page.goto(popupUrl);
  await page.evaluate(() => chrome.storage.local.clear());

  await canvas.setViewportSize({ width: 440, height: 280 });
  await canvas.setContent(`<!doctype html><body style="margin:0;width:440px;height:280px;
    display:flex;flex-direction:column;justify-content:center;gap:18px;padding:0 40px;
    box-sizing:border-box;background:#2443d0;color:#fff;font-family:'DejaVu Sans',sans-serif">
    <div style="display:flex;align-items:center;gap:16px">
      <img src="${iconSrc}" style="width:64px;height:64px;border-radius:14px;box-shadow:0 0 0 2px #fff4">
      <span style="font-size:48px;font-weight:800;letter-spacing:-0.03em">URLy</span></div>
    <div style="font-size:21px;line-height:1.35;color:#dfe5ff">Copy tab URLs.<br>Open pasted links.</div>
  </body>`);
  await canvas.screenshot({ path: out('promo-small.png'), scale: 'css' });

  await canvas.setViewportSize({ width: 300, height: 300 });
  await canvas.setContent(
    `<body style="margin:0"><img src="${iconSrc}" width="300" height="300"></body>`,
  );
  await canvas.screenshot({
    path: out('logo-300.png'),
    omitBackground: true,
    scale: 'css',
  });
} finally {
  await context.close();
}
