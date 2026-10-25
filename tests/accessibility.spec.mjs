import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { formatAxeViolations, waitForSiteReady } from './support/site.mjs';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoWcagViolations(page, include) {
  let builder = new AxeBuilder({ page }).withTags(wcagTags);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1366, height: 768 }
]) {
  test(`${viewport.name} page passes automated WCAG 2.2 AA checks`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await waitForSiteReady(page);
    await expectNoWcagViolations(page);
  });
}

test('open mobile navigation passes automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForSiteReady(page);

  const toggle = page.locator('.menu-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#main-nav')).toBeVisible();
  await expectNoWcagViolations(page);
});

test('open trailer modal has dialog semantics and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForSiteReady(page);

  await page.locator('[data-modal="trailer"]:visible').first().click();
  const dialog = page.locator('#trailer-modal');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expectNoWcagViolations(page, '#trailer-modal');
});

test('expanded disclosure states pass axe and preserve their relationships', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForSiteReady(page);

  const candidates = page.locator('button[aria-expanded="false"][aria-controls]:not(.menu-toggle)');
  let expanded = 0;
  for (let index = 0; index < await candidates.count() && expanded < 4; index += 1) {
    const button = candidates.nth(index);
    if (!(await button.isVisible())) continue;
    const controlledId = await button.getAttribute('aria-controls');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${controlledId}`)).toBeVisible();
    expanded += 1;
  }

  expect(expanded, 'at least one mobile disclosure should be testable').toBeGreaterThan(0);
  await expectNoWcagViolations(page);
});

test('all non-decorative images have useful alternative text', async ({ page }) => {
  await waitForSiteReady(page);

  const invalidImages = await page.locator('img').evaluateAll(images =>
    images
      .filter(image => {
        const alt = image.getAttribute('alt');
        const decorative = alt === '' && image.getAttribute('aria-hidden') === 'true';
        return !decorative && (!alt || !alt.trim());
      })
      .map(image => image.currentSrc || image.getAttribute('src') || '<unknown image>')
  );
  expect(invalidImages, `images missing useful alt text: ${invalidImages.join(', ')}`).toEqual([]);
});
