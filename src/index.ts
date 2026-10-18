import { toBeAccessible } from './matcher';
import type { MatcherOptions } from './types';

export { audit } from './audit';
export { configure, resetConfig } from './config';
export { formatViolations } from './format';
export { rules } from './rules';
export { toBeAccessible };
export type {
  AuditOptions,
  HostNode,
  IgnoreOptions,
  Matcher,
  MatcherOptions,
  Rule,
  RuleId,
  RuleSetting,
  Severity,
  Violation,
} from './types';

// Importing the package (or listing it in setupFilesAfterEnv) registers the
// matcher, matching react-native-accessibility-engine's setup.
const jestExpect = (globalThis as { expect?: { extend?: (m: object) => void } }).expect;
if (typeof jestExpect?.extend === 'function') {
  jestExpect.extend({ toBeAccessible });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /** Fails when the rendered element has accessibility violations. */
      toBeAccessible(options?: MatcherOptions): R;
    }
  }
}
