import { getGlobalOptions, mergeOptions } from './config';
import { ownComponentNames } from './fiber';
import { rules } from './rules';
import { isHostNode, walk } from './tree';
import type { AuditOptions, HostNode, IgnoreOptions, Matcher, Severity, Violation } from './types';

/**
 * Accepts what tests usually have at hand: `screen.root`, `screen.container`,
 * any element returned by a query, or the object returned by `render()`.
 */
export function resolveRoot(target: unknown): HostNode | null {
  if (isHostNode(target)) return target;
  if (typeof target === 'object' && target !== null && 'container' in target) {
    const { container } = target as { container: unknown };
    if (isHostNode(container)) return container;
  }
  return null;
}

function matches(value: unknown, matchers: Matcher[]): boolean {
  if (typeof value !== 'string') return false;
  return matchers.some((m) => (typeof m === 'string' ? m === value : m.test(value)));
}

function isIgnored(node: HostNode, ignore: IgnoreOptions): boolean {
  if (ignore.testIDs?.length && matches(node.props.testID, ignore.testIDs)) return true;
  if (ignore.components?.length) {
    const components = ignore.components;
    if (ownComponentNames(node).some((name) => matches(name, components))) return true;
  }
  return ignore.elements?.(node) === true;
}

export function audit(target: unknown, options: AuditOptions = {}): Violation[] {
  const root = resolveRoot(target);
  if (!root) {
    throw new TypeError(
      'audit() expects a rendered element, such as screen.root or screen.container from @testing-library/react-native.',
    );
  }

  const { rules: settings = {}, ignore = {} } = mergeOptions(getGlobalOptions(), options);
  const active: Array<{ rule: (typeof rules)[number]; severity: Severity }> = [];
  for (const rule of rules) {
    const severity = settings[rule.id] ?? rule.severity;
    if (severity !== 'off') active.push({ rule, severity });
  }

  const violations: Violation[] = [];
  walk(
    root,
    (node) => {
      for (const { rule, severity } of active) {
        const message = rule.check(node);
        if (message) {
          violations.push({ ruleId: rule.id, severity, message, help: rule.help, element: node });
        }
      }
    },
    (node) => isIgnored(node, ignore),
  );
  return violations;
}
