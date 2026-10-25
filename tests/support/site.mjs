import { expect } from '@playwright/test';

export const acceptanceViewports = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'android-phone', width: 360, height: 800 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'phone-landscape', width: 667, height: 375 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1440 }
];

export const visualViewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'ultrawide', width: 2560, height: 1440 }
];

export async function waitForSiteReady(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 35));
    const step = Math.max(window.innerHeight * 0.8, 240);
    for (let position = 0; position < document.documentElement.scrollHeight; position += step) {
      window.scrollTo(0, position);
      await pause();
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await pause();
    window.scrollTo(0, 0);
  });

  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images, image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      })
    );
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function expectNoHorizontalPageOverflow(page) {
  const measurement = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));

  expect(
    measurement.scrollWidth,
    `document width ${measurement.scrollWidth}px exceeded its ${measurement.clientWidth}px viewport`
  ).toBeLessThanOrEqual(measurement.clientWidth + 1);
  expect(
    measurement.bodyScrollWidth,
    `body width ${measurement.bodyScrollWidth}px exceeded its ${measurement.clientWidth}px viewport`
  ).toBeLessThanOrEqual(measurement.clientWidth + 1);
}

export async function expectPrimaryContentVisible(page) {
  const content = await page.evaluate(() => {
    const selectors = ['main h1', '#designers h2', '#merch h2', '#screenings h2', '#tours h2', 'footer'];
    return selectors.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        width: rect.width,
        height: rect.height
      };
    });
  });

  for (const item of content) {
    expect(item.missing, `${item.selector} should exist`).toBe(false);
    expect(item.display, `${item.selector} should participate in layout`).not.toBe('none');
    expect(item.visibility, `${item.selector} should not be hidden`).not.toBe('hidden');
    expect(item.opacity, `${item.selector} should remain perceivable`).toBeGreaterThan(0);
    expect(item.width, `${item.selector} should have a rendered width`).toBeGreaterThan(0);
    expect(item.height, `${item.selector} should have a rendered height`).toBeGreaterThan(0);
  }
}

export async function expectMinimumTouchTargets(page) {
  const undersized = await page.evaluate(() => {
    const selector = [
      '.menu-toggle',
      '.button',
      '.carousel-controls button',
      '[data-carousel]',
      '.register',
      '.tour-toggle',
      'button[aria-expanded][aria-controls]'
    ].join(',');

    return Array.from(document.querySelectorAll(selector))
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10
        };
      })
      .filter(({ width, height }) => width < 44 || height < 44);
  });

  expect(undersized, `touch targets smaller than 44x44px: ${JSON.stringify(undersized)}`).toEqual([]);
}

export function formatAxeViolations(violations) {
  return violations
    .map(violation => {
      const targets = violation.nodes.map(node => node.target.join(' ')).join(', ');
      return `${violation.id} (${violation.impact || 'unknown'}): ${violation.help}\n  ${targets}`;
    })
    .join('\n');
}
