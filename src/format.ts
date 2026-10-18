import { describeOwners } from './fiber';
import { getAccessibleName, getRole } from './tree';
import type { HostNode, Violation } from './types';

export function describeElement(node: HostNode): string {
  const attrs: string[] = [];
  const role = getRole(node);
  if (role) attrs.push(`role="${role}"`);
  if (node.props.testID) attrs.push(`testID="${node.props.testID}"`);
  const name = getAccessibleName(node);
  if (name) attrs.push(`name="${name.length > 40 ? `${name.slice(0, 37)}...` : name}"`);

  const { rn, user } = describeOwners(node);
  const tag = rn ? `${rn} → <${node.type}>` : `<${node.type}>`;
  const where = user ? ` in ${user}` : '';
  return `${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}${where}`;
}

export function formatViolations(violations: Violation[]): string {
  return violations
    .map((v, i) =>
      [
        `${i + 1}. [${v.ruleId}]${v.severity === 'warn' ? ' (warning)' : ''} ${v.message}`,
        `   Element: ${describeElement(v.element)}`,
        `   Fix: ${v.help}`,
      ].join('\n'),
    )
    .join('\n\n');
}
