# Browser validation

Install dependencies and browser binaries once:

```sh
npm install
npm run test:browsers:install
```

Run `npm run verify` for responsive, accessibility, and Lighthouse gates. The responsive suite covers all agreed viewport sizes in Chromium, Firefox, and WebKit. It also checks menu/modal/disclosure/carousel behavior, reduced motion, no-JavaScript rendering, failed and delayed images, local-only resources, touch targets, and horizontal overflow.

Visual baselines are owned by Chromium. After an intentional visual change, inspect the site and run `npm run test:responsive:update`, then commit the files under `tests/__screenshots__`. Do not update baselines merely to silence an unexplained difference.

Before release, manually verify the progressive fallbacks on a real iOS 12 Safari device/simulator and Chrome 70, plus browser zoom at 200% and 400%. Playwright's 640px and 320px reflow checks model the effective CSS viewports, but they do not replace the real legacy-browser pass. Confirm keyboard focus order, screen-reader announcements, backdrop modal closure, touch carousel swiping, phone landscape, safe-area insets, and the first-view disclosure-arrow animation.
