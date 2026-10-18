import { audit, resolveRoot } from './audit';
import { formatViolations } from './format';
import type { AuditOptions } from './types';

interface MatcherUtils {
  isNot: boolean;
  utils: {
    matcherHint(name: string, received?: string, expected?: string, options?: { isNot?: boolean }): string;
  };
}

export function toBeAccessible(this: MatcherUtils, received: unknown, options?: AuditOptions) {
  const hint = this.utils.matcherHint('toBeAccessible', 'element', '', { isNot: this.isNot });

  if (!resolveRoot(received)) {
    return {
      pass: false,
      message: () =>
        `${hint}\n\nReceived value is not a rendered element. Pass screen.root, screen.container, or an element from a query.`,
    };
  }

  const violations = audit(received, options);
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warn');

  if (warnings.length > 0 && !this.isNot) {
    console.warn(`toBeAccessible() found ${count(warnings.length, 'accessibility warning')}:\n\n${formatViolations(warnings)}`);
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

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
