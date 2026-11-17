import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icon/icon.svg', import.meta.url));
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg.toString('base64')}"></body>`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    await page.screenshot({
      path: new URL(`../public/icon/${size}.png`, import.meta.url).pathname,
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
