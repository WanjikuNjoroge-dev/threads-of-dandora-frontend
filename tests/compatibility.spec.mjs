import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { waitForSiteReady } from './support/site.mjs';

const rootFile = file => new URL(`../${file}`, import.meta.url);

test('JavaScript source remains parseable by iOS 12 and Chrome 70', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'static compatibility check only needs one project');
  const source = await readFile(rootFile('script.js'), 'utf8');

  expect(source, 'optional chaining is unsupported by the legacy browser floor').not.toMatch(/\?\.(?!\d)/);
  expect(source, 'nullish coalescing is unsupported by the legacy browser floor').not.toMatch(/\?\?/);
});

test('CSS contains the required progressive fallbacks and breakpoints', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'static compatibility check only needs one project');
  const source = await readFile(rootFile('styles.css'), 'utf8');

  const bodyRules = [...source.matchAll(/(?:^|})\s*body\s*\{([^}]*)}/gim)].map(match => match[1]).join('\n');
  expect(bodyRules, 'body must not mask layout defects with overflow-x: hidden').not.toMatch(/overflow-x\s*:\s*hidden/i);
  expect(source).toMatch(/prefers-reduced-motion\s*:\s*reduce/i);

  const vhFallback = source.search(/(?:min-)?height\s*:\s*[^;]*100vh/i);
  const dynamicViewport = source.search(/(?:min-)?height\s*:\s*[^;]*100(?:dvh|svh)/i);
  expect(vhFallback, 'provide 100vh before any dynamic viewport enhancement').toBeGreaterThanOrEqual(0);
  expect(dynamicViewport, 'enhance viewport sizing with dvh or svh').toBeGreaterThan(vhFallback);

  for (const alternatives of [
    [/480px/i, /30rem/i],
    [/760px/i, /47\.5rem/i],
    [/1100px/i, /68\.75rem/i],
    [/1600px/i, /100rem/i]
  ]) {
    expect(
      alternatives.some(pattern => pattern.test(source)),
      `missing responsive breakpoint (${alternatives.map(pattern => pattern.source).join(' or ')})`
    ).toBe(true);
  }

  const clampDeclarations = [...source.matchAll(/([\w-]+)\s*:\s*clamp\([^;]+;/gim)];
  expect(clampDeclarations.length, 'fluid type or spacing should use clamp()').toBeGreaterThan(0);
  for (const declaration of clampDeclarations) {
    const property = declaration[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockStart = source.lastIndexOf('{', declaration.index);
    const precedingDeclarations = source.slice(blockStart + 1, declaration.index);
    expect(
      new RegExp(`${property}\\s*:\\s*(?!clamp\\()[^;]+;`, 'i').test(precedingDeclarations),
      `${declaration[1]} needs a fixed declaration before its clamp() enhancement`
    ).toBe(true);
  }
});

test('responsive images reserve space and retain JPEG fallbacks', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'DOM compatibility check only needs one project');
  await waitForSiteReady(page);

  const imageAudit = await page.locator('img').evaluateAll(images =>
    images.map((image, index) => ({
      index,
      src: image.getAttribute('src') || '',
      srcset: image.getAttribute('srcset') || '',
      sizes: image.getAttribute('sizes') || '',
      width: Number(image.getAttribute('width')),
      height: Number(image.getAttribute('height')),
      loading: image.getAttribute('loading'),
      inPicture: image.parentElement && image.parentElement.tagName === 'PICTURE',
      webpSource: Boolean(
        image.parentElement && image.parentElement.querySelector('source[type="image/webp"][srcset]')
      )
    }))
  );

  expect(imageAudit.length, 'the page should contain responsive image assets').toBeGreaterThan(0);
  for (const image of imageAudit) {
    expect(image.width, `image ${image.index + 1} needs an intrinsic width`).toBeGreaterThan(0);
    expect(image.height, `image ${image.index + 1} needs an intrinsic height`).toBeGreaterThan(0);
    expect(image.src, `image ${image.index + 1} needs a fallback src`).toMatch(/\.jpe?g(?:$|\?)/i);
    expect(image.srcset, `image ${image.index + 1} needs a JPEG srcset`).toBeTruthy();
    expect(image.sizes, `image ${image.index + 1} needs responsive sizes`).toBeTruthy();
    expect(image.inPicture, `image ${image.index + 1} should be wrapped by picture`).toBe(true);
    expect(image.webpSource, `image ${image.index + 1} needs a WebP source`).toBe(true);
  }

  for (const image of imageAudit.slice(2)) {
    expect(image.loading, 'below-fold images should be lazy-loaded').toBe('lazy');
  }
});

test('fonts are local, swapped, and selectively preloaded', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'resource compatibility check only needs one project');
  const css = await readFile(rootFile('styles.css'), 'utf8');
  const html = await readFile(rootFile('index.html'), 'utf8');

  expect(css).toMatch(/@font-face/i);
  expect(css).toMatch(/font-display\s*:\s*swap/i);
  expect(`${html}\n${css}`).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/i);

  await waitForSiteReady(page);
  const fontPreloads = await page.locator('link[rel="preload"][as="font"]').count();
  expect(fontPreloads, 'preload the primary body and hero faces only').toBeGreaterThan(0);
  expect(fontPreloads, 'do not preload every font weight').toBeLessThanOrEqual(2);
});

test('the trailer uses a compatible custom dialog instead of native dialog', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'DOM compatibility check only needs one project');
  await waitForSiteReady(page);
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('#trailer-modal')).toHaveAttribute('role', 'dialog');
});
