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
  | 'input-label-required'
  | 'interactive-accessible-required'
  | 'image-label-required'
  | 'no-nested-interactive'
  | 'state-required'
  | 'adjustable-role-required'
  | 'role-valid'
  | 'accessibility-actions-valid'
  | 'link-role-misused'
  | 'no-empty-text'
  | 'consistent-hiding'
  | 'modal-hides-background'
  | 'no-disabled-font-scaling'
  | 'touch-target-size'
  | 'text-contrast'
  | 'no-nested-text-link';

/** Rule IDs from react-native-accessibility-engine, accepted for migration. */
export type LegacyRuleId =
  | 'pressable-accessible-required'
  | 'pressable-role-required'
  | 'pressable-label-required'
  | 'link-role-required'
  | 'link-role-misused'
  | 'adjustable-role-required'
  | 'adjustable-value-required'
  | 'checked-state-required'
  | 'disabled-state-required'
  | 'no-empty-text';

/**
 * Per-rule severities, or (as in react-native-accessibility-engine) an array
 * of the only rule IDs to run.
 */
export type RulesOption =
  | Partial<Record<RuleId | LegacyRuleId, RuleSetting>>
  | Array<RuleId | LegacyRuleId>;

export interface RuleContext {
  /** Minimum touch target size in dp/pt. */
  minTouchTarget: number;
}

export interface Rule {
  id: RuleId;
  severity: Severity;
  /** One-line summary of what the rule enforces. */
  description: string;
  /** How to fix a violation, shown in failure output. */
  help: string;
  /**
   * WCAG 2.2 success criteria the rule checks, e.g. ['4.1.2']. Empty for
   * best-practice rules. EN 301 549 clauses follow from these (clause 11.x).
   */
  wcag: readonly string[];
  /** Returns a problem description for `node`, or null when it passes. */
  check(node: HostNode, context: RuleContext): string | null;
}

export interface Violation {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  help: string;
  /** WCAG 2.2 success criteria, copied from the rule. */
  wcag: readonly string[];
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
  /**
   * npm packages whose own elements are skipped, e.g. 'react-native-maps' or
   * /^@acme\//. Unlike `components`, content you pass into the library
   * (carousel slides, list items) is still audited. Needs React 19.1+.
   */
  packages?: Matcher[];
  /** Custom predicate for anything the other options can't express. */
  elements?: (node: HostNode) => boolean;
}

export interface AuditOptions {
  /** Override severity per rule, or turn a rule off. */
  rules?: RulesOption;
  ignore?: IgnoreOptions;
  /**
   * Minimum touch target size for `touch-target-size`, in dp/pt.
   * Defaults to 44 (Apple HIG and WCAG 2.5.5). Use 48 for Material, 24 for
   * the WCAG 2.2 AA minimum.
   */
  minTouchTarget?: number;
}

export interface MatcherOptions extends AuditOptions {
  /**
   * Compare against recorded violations and fail only on new ones.
   * A string names the baseline; `true` uses the current test's name.
   */
  baseline?: string | true;
  /**
   * Receives the violations before the matcher decides pass/fail and returns
   * the ones to keep (react-native-accessibility-engine compatible).
   */
  customViolationHandler?: (violations: Violation[]) => Violation[];
}
