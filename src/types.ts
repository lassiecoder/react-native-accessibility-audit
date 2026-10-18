/**
 * Structural view of a `test-renderer` TestInstance (what RNTL v14 returns
 * from `screen.root` / `screen.container`). Declared here so the library has
 * no runtime or type dependency on a specific renderer version.
 */
export interface HostNode {
  type: string;
  props: Record<string, any>;
  children: Array<HostNode | string>;
  parent: HostNode | null;
  unstable_fiber?: unknown;
}

export type Severity = 'error' | 'warn';
export type RuleSetting = Severity | 'off';

export type RuleId =
  | 'interactive-role-required'
  | 'interactive-label-required'
  | 'image-label-required'
  | 'no-nested-interactive'
  | 'state-required'
  | 'no-empty-text';

export interface Rule {
  id: RuleId;
  severity: Severity;
  /** One-line summary of what the rule enforces. */
  description: string;
  /** How to fix a violation, shown in failure output. */
  help: string;
  /** Returns a problem description for `node`, or null when it passes. */
  check(node: HostNode): string | null;
}

export interface Violation {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  help: string;
  element: HostNode;
}

export type Matcher = string | RegExp;

/**
 * Parts of the tree to skip entirely, e.g. third-party components you can't
 * change. A matching element and everything inside it is not audited.
 */
export interface IgnoreOptions {
  /** Elements with a matching testID. */
  testIDs?: Matcher[];
  /** Elements rendered directly by a matching component, e.g. 'MapView'. */
  components?: Matcher[];
  /** Custom predicate for anything the other options can't express. */
  elements?: (node: HostNode) => boolean;
}

export interface AuditOptions {
  /** Override severity per rule, or turn a rule off. */
  rules?: Partial<Record<RuleId, RuleSetting>>;
  ignore?: IgnoreOptions;
}

export interface MatcherOptions extends AuditOptions {
  /**
   * Compare against recorded violations and fail only on new ones.
   * A string names the baseline; `true` uses the current test's name.
   */
  baseline?: string | true;
}
