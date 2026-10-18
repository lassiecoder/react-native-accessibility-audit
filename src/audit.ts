import { getGlobalOptions } from './config';
import { rules } from './rules';
import { isHostNode, walk } from './tree';
import type { AuditOptions, HostNode, RuleSetting, Violation } from './types';

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

export function audit(target: unknown, options: AuditOptions = {}): Violation[] {
  const root = resolveRoot(target);
  if (!root) {
    throw new TypeError(
      'audit() expects a rendered element, such as screen.root or screen.container from @testing-library/react-native.',
    );
  }

  const settings: Partial<Record<string, RuleSetting>> = {
    ...getGlobalOptions().rules,
    ...options.rules,
  };
  const active = rules
    .map((rule) => ({ rule, severity: settings[rule.id] ?? rule.severity }))
    .filter((r): r is { rule: typeof r.rule; severity: 'error' | 'warn' } => r.severity !== 'off');

  const violations: Violation[] = [];
  walk(root, (node) => {
    for (const { rule, severity } of active) {
      const message = rule.check(node);
      if (message) {
        violations.push({ ruleId: rule.id, severity, message, help: rule.help, element: node });
      }
    }
  });
  return violations;
}
