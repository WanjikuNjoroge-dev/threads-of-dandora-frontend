import { test, expect } from '@playwright/test';
import {
  acceptanceViewports,
  expectMinimumTouchTargets,
  expectNoHorizontalPageOverflow,
  expectPrimaryContentVisible,
  scrollThroughPage,
  waitForSiteReady
} from './support/site.mjs';

test.describe('responsive layout', () => {
  for (const viewport of acceptanceViewports) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) has no page overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForSiteReady(page);
      await scrollThroughPage(page);

      await expectPrimaryContentVisible(page);
      await expectNoHorizontalPageOverflow(page);

      const sections = page.locator('main > section');
      await expect(sections).not.toHaveCount(0);
      for (let index = 0; index < await sections.count(); index += 1) {
        const box = await sections.nth(index).boundingBox();
        expect(box, `section ${index + 1} should render`).not.toBeNull();
        expect(box.width, `section ${index + 1} should not be wider than its viewport`).toBeLessThanOrEqual(
          viewport.width + 1
        );
      }
    });
  }

  test('mobile controls meet the 44px touch-target minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);
    await expectMinimumTouchTargets(page);
  });

  test('200% and 400% reflow equivalents remain usable', async ({ page }) => {
    const zoomEquivalents = [
      { label: '200%', width: 640, height: 720 },
      { label: '400%', width: 320, height: 568 }
    ];

    for (const state of zoomEquivalents) {
      await page.setViewportSize({ width: state.width, height: state.height });
      await waitForSiteReady(page);
      await expectNoHorizontalPageOverflow(page);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    }
  });

  test('keyboard focus has a visible indicator', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);
    await page.keyboard.press('Tab');

    const focusStyle = await page.evaluate(() => {
      const active = document.activeElement;
      const style = getComputedStyle(active);
      return {
        tag: active.tagName,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        boxShadow: style.boxShadow
      };
    });

    expect(focusStyle.tag).not.toBe('BODY');
    expect(
      (focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth > 0) || focusStyle.boxShadow !== 'none',
      `focused ${focusStyle.tag} needs a visible outline or shadow`
    ).toBe(true);
  });
});

test.describe('responsive interactions', () => {
  test('mobile navigation opens, closes, and resets at the desktop breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const toggle = page.locator('.menu-toggle');
    const menu = page.locator('#main-nav');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    const sectionLink = menu.locator('a[href^="#"]').first();
    await sectionLink.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeVisible();
  });

  test('trailer modal traps focus, closes, and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const trigger = page.locator('[data-modal="trailer"]:visible').first();
    const dialog = page.locator('#trailer-modal');
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    const labelled = await dialog.evaluate(element =>
      Boolean(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby'))
    );
    expect(labelled, 'the trailer dialog needs an accessible name').toBe(true);
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);

    const focusableCount = await dialog
      .locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      .count();
    expect(focusableCount).toBeGreaterThan(0);
    for (let index = 0; index <= focusableCount; index += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box.x + 2, box.y + 2);
    await expect(dialog).toBeHidden();
  });

  test('mobile disclosures expose valid controlled regions and inline arrows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const candidates = page.locator('button[aria-expanded][aria-controls]:not(.menu-toggle)');
    const visibleButtons = [];
    for (let index = 0; index < await candidates.count(); index += 1) {
      const button = candidates.nth(index);
      if (await button.isVisible()) visibleButtons.push(button);
    }

    expect(visibleButtons.length, 'expected mobile film, tour, or footer disclosures').toBeGreaterThan(0);
    for (const button of visibleButtons.slice(0, 6)) {
      const controlledId = await button.getAttribute('aria-controls');
      expect(controlledId).toBeTruthy();
      await expect(page.locator(`#${controlledId}`)).toHaveCount(1);
      await expect(button.locator('svg')).not.toHaveCount(0);

      if ((await button.getAttribute('aria-expanded')) === 'true') await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`#${controlledId}`)).toBeVisible();
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('carousel advances by its measured card step and reports its limits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const track = page.locator('#product-track');
    const previous = page.locator('[data-carousel="prev"]');
    const next = page.locator('[data-carousel="next"]');
    await expect(track).toBeVisible();
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    const step = await track.evaluate(element => {
      const cards = element.querySelectorAll('.product-card');
      return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
    });
    expect(step).toBeGreaterThan(0);

    await next.click();
    await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(step * 0.7);
    const firstStop = await track.evaluate(element => element.scrollLeft);
    expect(Math.abs(firstStop - step)).toBeLessThanOrEqual(Math.max(12, step * 0.08));
    await expect(previous).toBeEnabled();

    const nativeSwipeStyles = await track.evaluate(element => {
      const style = getComputedStyle(element);
      return { overflowX: style.overflowX, scrollSnapType: style.scrollSnapType };
    });
    expect(['auto', 'scroll']).toContain(nativeSwipeStyles.overflowX);
    expect(nativeSwipeStyles.scrollSnapType).toContain('x');

    await track.evaluate(element => element.scrollTo({ left: element.scrollWidth }));
    await expect(next).toBeDisabled();
  });

  test('registration and tour controls expose their changed state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const registration = page.locator('.register').first();
    await registration.scrollIntoViewIfNeeded();
    await registration.click();
    await expect(registration).toContainText(/registered/i);

    const tourToggle = page.locator('.tour-toggle').first();
    await tourToggle.scrollIntoViewIfNeeded();
    await expect(tourToggle).toHaveAttribute('aria-expanded', 'false');
    await tourToggle.click();
    await expect(tourToggle).toHaveAttribute('aria-expanded', 'true');
    const controlledId = await tourToggle.getAttribute('aria-controls');
    await expect(page.locator(`#${controlledId}`)).toBeVisible();
  });
});

test.describe('progressive resilience', () => {
  test('reduced motion keeps content visible and removes disclosure movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);

    const result = await page.evaluate(() => {
      const revealFailures = Array.from(document.querySelectorAll('.reveal'))
        .filter(element => {
          const style = getComputedStyle(element);
          return style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0;
        })
        .length;
      const animatedArrows = Array.from(document.querySelectorAll('button[aria-expanded] svg, .disclosure-arrow'))
        .filter(element => {
          const style = getComputedStyle(element);
          const durations = style.animationDuration.split(',').map(value => parseFloat(value) || 0);
          const transitions = style.transitionDuration.split(',').map(value => parseFloat(value) || 0);
          return Math.max(...durations, ...transitions) > 0.01;
        })
        .length;
      return {
        revealFailures,
        animatedArrows,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
      };
    });

    expect(result.revealFailures).toBe(0);
    expect(result.animatedArrows).toBe(0);
    expect(result.scrollBehavior).not.toBe('smooth');
  });

  test('all production images and fonts are served locally', async ({ page }) => {
    const externalRequests = new Set();
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.add(url.href);
      }
    });

    await waitForSiteReady(page);
    await scrollThroughPage(page);
    expect([...externalRequests], `external requests remain: ${[...externalRequests].join(', ')}`).toEqual([]);
  });

  test('core content remains available when JavaScript is disabled', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('#designers h2')).toBeVisible();
    await expect(page.locator('#screenings h2')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await context.close();
  });

  test('a failed optional image does not hide content or create overflow', async ({ page }) => {
    let imageFailed = false;
    await page.route('**/*', async route => {
      if (!imageFailed && route.request().resourceType() === 'image') {
        imageFailed = true;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await waitForSiteReady(page);
    await scrollThroughPage(page);
    expect(imageFailed, 'the page should request at least one local image').toBe(true);
    await expectPrimaryContentVisible(page);
    await expectNoHorizontalPageOverflow(page);
  });

  test('slow images do not block headings or shift the page sideways', async ({ page }) => {
    await page.route('**/*', async route => {
      if (route.request().resourceType() === 'image') {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForSiteReady(page);
    await expect(page.locator('main h1')).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await scrollThroughPage(page);
    await expectNoHorizontalPageOverflow(page);
  });
});
