import * as path from 'path';

import { audit, resolveRoot } from './audit';
import { baselinePath, compareToBaseline, countFingerprints, readBaseline, writeBaseline } from './baseline';
import { formatViolations } from './format';
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

  if (!resolveRoot(received)) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\nReceived value is not a rendered element. Pass screen.root, screen.container, or an element from a query.`,
    };
  }

  const { baseline, ...auditOptions } = options;
  const violations = audit(received, auditOptions);
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warn');

  if (warnings.length > 0 && !this.isNot) {
    console.warn(`toBeAccessible() found ${count(warnings.length, 'accessibility warning')}:\n\n${formatViolations(warnings)}`);
  }

  if (baseline !== undefined) {
    return matchBaseline(this, hint, baseline, errors);
  }

  const pass = errors.length === 0;
  return {
    pass,
    message: () =>
      pass
        ? `${hint}\n\nExpected accessibility violations, but found none.`
        : `${hint}\n\nFound ${count(errors.length, 'accessibility violation')}:\n\n${formatViolations(errors)}`,
  };
}

function matchBaseline(
  context: MatcherContext,
  hint: string,
  baseline: string | true,
  errors: Violation[],
): MatcherResult {
  const name = baseline === true ? context.currentTestName : baseline;
  if (!context.testPath || !name) {
    return {
      pass: false,
      message: () => `${hint}\n\nBaselines need a Jest test context (test file path and test name).`,
    };
  }

  const file = baselinePath(context.testPath);
  const relative = path.relative(process.cwd(), file);
  const mode: UpdateMode = context.snapshotState?._updateSnapshot ?? (process.env.CI ? 'none' : 'new');
  const recorded = readBaseline(file, name);

  if (mode === 'all' || (recorded === undefined && mode === 'new')) {
    writeBaseline(file, name, countFingerprints(errors));
    return { pass: true, message: () => `${hint}\n\nRecorded accessibility baseline "${name}".` };
  }

  if (recorded === undefined) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\nNo accessibility baseline "${name}" in ${relative}.\n` +
        'Baselines are not written with --ci. Run the tests locally to record it, then commit the file.',
    };
  }

  const { added, known, fixed, tightened } = compareToBaseline(recorded, errors);
  // Fixing a baselined violation tightens the baseline so it can't come back.
  if (fixed > 0 && mode !== 'none') writeBaseline(file, name, tightened);

  const pass = added.length === 0;
  const knownNote = known > 0 ? ` (${count(known, 'known violation')} in the baseline still ${known === 1 ? 'needs' : 'need'} fixing)` : '';
  return {
    pass,
    message: () =>
      pass
        ? `${hint}\n\nExpected new accessibility violations compared to baseline "${name}", but found none.`
        : `${hint}\n\nFound ${count(added.length, 'new accessibility violation')} not in baseline "${name}"${knownNote}:\n\n` +
          `${formatViolations(added)}\n\nFix them, or run Jest with -u to accept them into ${relative}.`,
  };
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
