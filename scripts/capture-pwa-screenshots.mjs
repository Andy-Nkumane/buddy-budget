import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputDirectory = new URL('../public/screenshots/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await desktop.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await desktop.screenshot({
    path: fileURLToPath(new URL('desktop-budget.png', outputDirectory)),
    fullPage: false,
  });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await mobile.screenshot({
    path: fileURLToPath(new URL('mobile-budget.png', outputDirectory)),
    fullPage: false,
  });
} finally {
  await browser.close();
}
