'use strict';

module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:4173/'],
      startServerCommand: 'npm run serve',
      startServerReadyPattern: 'Available on:',
      startServerReadyTimeout: 120_000,
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false
        },
        throttlingMethod: 'simulate',
        maxWaitForFcp: 15_000
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './test-results/lighthouse'
    }
  }
};
