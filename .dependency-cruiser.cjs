/**
 * dependency-cruiser config — used only for architecture metrics, not CI gating.
 *
 * Purpose: compute Robert C. Martin's coupling metrics per folder/module:
 *   Ca (afferent / incoming), Ce (efferent / outgoing), I = Ce / (Ca + Ce).
 * See docs/abstract/review-framework.md, dimension 6, and docs-review.md.
 *
 * Run:
 *   npm run arch:metrics          full table (modules + folders), sorted by instability
 *   npm run arch:metrics:folders  folder/layer rollup only (the meaningful Martin view)
 *   npm run arch:churn            top-churn src files (last 6mo) — overlay with I per §12
 *
 * Priority targets = high Ca + high I + high churn (review-framework.md §12).
 * Tests/mocks are excluded below (they're always I=100%, Ca=0, and add noise).
 *
 * Boundary *rules* are enforced by eslint-plugin-boundaries (eslint.config.js),
 * not here. This file only measures.
 */
module.exports = {
  options: {
    // Resolve the `@/*` -> `src/*` alias and .ts/.tsx via the project's tsconfig.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    // Only measure our own source; ignore deps, generated code, and tests/mocks
    // (tests are always I=100% — Ca=0 — and drown out the real coupling signal).
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '(^|/)(node_modules|\\.papi|coverage|release|e2e)/',
        '\\.(spec|test)\\.[tj]sx?$',
        '\\.integration\\.spec\\.[tj]sx?$',
        '(^|/)mocks/',
        '(^|/)__mocks__/',
      ].join('|'),
    },
    includeOnly: '^src/',
  },
};
