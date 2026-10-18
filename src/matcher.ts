import * as path from 'path';

import { audit, resolveRoot } from './audit';
import { baselinePath, compareToBaseline, countFingerprints, readBaseline, writeBaseline } from './baseline';
import { isRecording, recordAudit, toRecorded } from './collector';
import { formatViolations } from './format';
import { isReactElement, renderElement } from './render-element';
import type { MatcherOptions, Violation } from './types';

/** Jest's snapshot update mode: `-u` is 'all', default is 'new', `--ci` is 'none'. */
type UpdateMode = 'all' | 'new' | 'none';

interface MatcherContext {
  isNot: boolean;
  testPath?: string;
  currentTestName?: string;
  snapshotState?: { _updateSnapshot?: UpdateMode };
  utils: {
    matcherHint(name: string, received?: string, expected?: string, options?: { isNot?: boolean }): string;
  };
}

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

export function toBeAccessible(this: MatcherContext, received: unknown, options: MatcherOptions = {}): MatcherResult {
  const hint = this.utils.matcherHint('toBeAccessible', 'element', '', { isNot: this.isNot });

  if (isReactElement(received)) {
    const rendered = renderElement(received, this.testPath);
    try {
      // Build the message now: it describes elements that are gone after unmount.
      const result = check(this, hint, rendered.container, options);
      const message = result.message();
      return { pass: result.pass, message: () => message };
    } finally {
      rendered.unmount();
    }
  }

  if (!resolveRoot(received)) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\nReceived value is not a rendered element. Pass screen.root, screen.container, an element from a query, or a React element.`,
    };
  }
  return check(this, hint, received, options);
}

function check(context: MatcherContext, hint: string, target: unknown, options: MatcherOptions): MatcherResult {
  const { baseline, customViolationHandler, ...auditOptions } = options;
  let violations = audit(target, auditOptions);
  // react-native-accessibility-engine also read the handler from a Jest global.
  const handler =
    customViolationHandler ??
    (globalThis as { __CUSTOM_VIOLATION_HANDLER__?: MatcherOptions['customViolationHandler'] }).__CUSTOM_VIOLATION_HANDLER__;
  if (handler) violations = handler(violations);

  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warn');

  if (warnings.length > 0 && !context.isNot) {
    console.warn(`toBeAccessible() found ${count(warnings.length, 'accessibility warning')}:\n\n${formatViolations(warnings)}`);
  }

  let result: MatcherResult;
  let baselined = new Set<Violation>();
  if (baseline !== undefined) {
    ({ result, baselined } = matchBaseline(context, hint, baseline, errors));
  } else {
    const pass = errors.length === 0;
    const message = pass
      ? `${hint}\n\nExpected accessibility violations, but found none.`
      : `${hint}\n\nFound ${count(errors.length, 'accessibility violation')}:\n\n${formatViolations(errors)}`;
    result = { pass, message: () => message };
  }

  // .not.toBeAccessible() asserts that violations exist; those aren't findings.
  if (isRecording() && !context.isNot) {
    recordAudit({
      testFile: context.testPath,
      testName: context.currentTestName,
      baseline: baseline === true ? context.currentTestName : baseline,
      passed: result.pass,
      violations: violations.map((v) => toRecorded(v, baselined.has(v))),
    });
  }
  return result;
}

/** The matcher result, and which errors the baseline covers. */
function matchBaseline(
  context: MatcherContext,
  hint: string,
  baseline: string | true,
  errors: Violation[],
): { result: MatcherResult; baselined: Set<Violation> } {
  const none = new Set<Violation>();
  const name = baseline === true ? context.currentTestName : baseline;
  if (!context.testPath || !name) {
    return {
      result: { pass: false, message: () => `${hint}\n\nBaselines need a Jest test context (test file path and test name).` },
      baselined: none,
    };
  }

  const file = baselinePath(context.testPath);
  const relative = path.relative(process.cwd(), file);
  const mode: UpdateMode = context.snapshotState?._updateSnapshot ?? (process.env.CI ? 'none' : 'new');
  const recorded = readBaseline(file, name);

  if (mode === 'all' || (recorded === undefined && mode === 'new')) {
    writeBaseline(file, name, countFingerprints(errors));
    return {
      result: { pass: true, message: () => `${hint}\n\nRecorded accessibility baseline "${name}".` },
      baselined: new Set(errors),
    };
  }

  if (recorded === undefined) {
    return {
      result: {
        pass: false,
        message: () =>
          `${hint}\n\nNo accessibility baseline "${name}" in ${relative}.\n` +
          'Baselines are not written with --ci. Run the tests locally to record it, then commit the file.',
      },
      baselined: none,
    };
  }

  const { added, known, fixed, tightened } = compareToBaseline(recorded, errors);
  // Fixing a baselined violation tightens the baseline so it can't come back.
  if (fixed > 0 && mode !== 'none') writeBaseline(file, name, tightened);

  const pass = added.length === 0;
  const knownNote = known > 0 ? ` (${count(known, 'known violation')} in the baseline still ${known === 1 ? 'needs' : 'need'} fixing)` : '';
  const addedSet = new Set(added);
  return {
    result: {
      pass,
      message: () =>
        pass
          ? `${hint}\n\nExpected new accessibility violations compared to baseline "${name}", but found none.`
          : `${hint}\n\nFound ${count(added.length, 'new accessibility violation')} not in baseline "${name}"${knownNote}:\n\n` +
            `${formatViolations(added)}\n\nFix them, or run Jest with -u to accept them into ${relative}.`,
    },
    baselined: new Set(errors.filter((e) => !addedSet.has(e))),
  };
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
