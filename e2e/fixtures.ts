import { test as base, expect, type BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = realpathSync(
  resolve(process.env.URLY_EXTENSION_PATH ?? '.output/chrome-mv3'),
);

// Chromium derives an unpacked extension's ID from its absolute path:
// the first 32 hex digits of SHA-256, mapped 0-f to a-p.
const extensionId = [
  ...createHash('sha256').update(extensionPath).digest('hex').slice(0, 32),
]
  .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
  .join('');

export const test = base.extend<{ popupUrl: string }>({
  context: async ({ playwright }, use) => {
    const context = await playwright.chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      permissions: ['clipboard-read', 'clipboard-write'],
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    // Serve fake sites so tests never touch the network.
    await context.route(/^https?:\/\/[^/]*\.test\//, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<title>${new URL(route.request().url()).hostname}</title>`,
      }),
    );
    await use(context);
    await context.close();
  },
  popupUrl: `chrome-extension://${extensionId}/popup.html`,
});

export { expect };

export async function openSites(context: BrowserContext, urls: string[]) {
  for (const url of urls) await (await context.newPage()).goto(url);
}
