import { test, expect } from '@playwright/test';
import { scrollThroughPage, visualViewports, waitForSiteReady } from './support/site.mjs';

test.describe('visual regression', () => {
  for (const viewport of visualViewports) {
    test(`${viewport.name} full-page layout`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'one deterministic rendering engine owns the visual baseline');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForSiteReady(page);
      await scrollThroughPage(page);

      await expect(page).toHaveScreenshot(`${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });
  }
});
