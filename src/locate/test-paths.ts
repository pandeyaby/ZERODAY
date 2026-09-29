/**
 * Test, spec, fixture and end-to-end files, plus vendored / minified code.
 * Findings there are still reported, but ranked after application code: a
 * hard-coded password in a spec file or a minified third-party bundle is
 * rarely what a reviewer should read first.
 */
const TEST_PATH =
  /(?:^|\/)(?:tests?|__tests__|__mocks__|spec|specs|testing|testdata|fixtures?|e2e|cypress)\/|(?:^|\/)test_[^/]*\.py$|_test\.(?:go|py)$|\.(?:test|spec|e2e)\.[cm]?[jt]sx?$|Tests?\.java$/;

export function isTestPath(filePath: string): boolean {
  return TEST_PATH.test(filePath.replace(/\\/g, "/"));
}

const VENDORED_PATH = /(?:^|\/)(?:vendor|vendors|third[_-]party|node_modules|bower_components)\/|\.min\.[cm]?js$|\.bundle\.js$/;

/** Ranked after application code: tests / fixtures, vendored and minified files. */
export function isLowPriorityPath(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  return TEST_PATH.test(p) || VENDORED_PATH.test(p);
}
