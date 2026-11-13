import { describeOwners } from './fiber';
import { getAccessibleName, getRole } from './tree';
import type { HostNode, Violation } from './types';
import { describeCriteria } from './wcag';

export function describeElement(node: HostNode): string {
  const attrs: string[] = [];
  const role = getRole(node);
  if (role) attrs.push(`role="${role}"`);
  if (node.props.testID) attrs.push(`testID="${node.props.testID}"`);
  const name = getAccessibleName(node);
  if (name) attrs.push(`name="${name.length > 40 ? `${name.slice(0, 37)}...` : name}"`);

  const { rn, user, library } = describeOwners(node);
  const tag = rn ? `${rn} → <${node.type}>` : `<${node.type}>`;
  const via = library ? `${library.component ? `${library.component} from ` : ''}${libraryName(library).name}` : '';
  const where = library
    ? `${user ? ` in ${user},` : ''} rendered by ${via}`
    : user
      ? ` in ${user}`
      : '';
  return `${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}${where}`;
}

export const DOCS_URL = 'https://github.com/lassiecoder/react-native-accessibility-audit/blob/main/docs/rules.md';

export function ruleUrl(ruleId: string): string {
  return `${DOCS_URL}#${ruleId}`;
}

/**
 * How to name a library and match it in `ignore.packages`. Packages from one
 * scope (React Navigation spreads a navigator over @react-navigation/core,
 * /elements and /bottom-tabs) are named by the scope.
 */
export function libraryName(library: { package: string; packages?: string[] }): { name: string; matcher: string } {
  const all = library.packages?.length ? library.packages : [library.package];
  const scope = all[0].startsWith('@') ? all[0].split('/')[0] : undefined;
  if (scope && all.length > 1 && all.every((p) => p.startsWith(`${scope}/`))) {
    return { name: `${scope}/*`, matcher: `/^${scope}\\//` };
  }
  return { name: library.package, matcher: `'${library.package}'` };
}

/** Advice for elements a library rendered, which the app can't edit directly. */
export function libraryNote(node: HostNode): string | undefined {
  const { library } = describeOwners(node);
  if (!library) return undefined;
  const { name, matcher } = libraryName(library);
  return `Rendered by ${name}. Fix it through the library's props or theme, report it upstream, or skip the library's own elements with ignore: { packages: [${matcher}] }.`;
}

export function formatViolations(violations: Violation[]): string {
  return violations
    .map((v, i) => {
      const note = libraryNote(v.element);
      return [
        `${i + 1}. [${v.ruleId}]${v.severity === 'warn' ? ' (warning)' : ''} ${v.message}`,
        `   Element: ${describeElement(v.element)}`,
        `   Fix: ${v.help}`,
        ...(note ? [`   Library: ${note}`] : []),
        `   Standard: ${describeCriteria(v.wcag ?? [])}`,
        `   Docs: ${ruleUrl(v.ruleId)}`,
      ].join('\n');
    })
    .join('\n\n');
}
