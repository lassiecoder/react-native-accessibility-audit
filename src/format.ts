import { getAccessibleName, getRole } from './tree';
import type { HostNode, Violation } from './types';

// Composite components that come from React Native itself. Anything else in
// the fiber chain is treated as the user's component, which is the most
// useful thing to point at in a failure message.
const RN_COMPONENTS = new Set([
  'View', 'Text', 'Image', 'ImageBackground', 'TextInput', 'Switch', 'Button',
  'Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback',
  'TouchableNativeFeedback', 'ScrollView', 'FlatList', 'SectionList', 'VirtualizedList',
  'Modal', 'SafeAreaView', 'KeyboardAvoidingView', 'ActivityIndicator', 'RefreshControl',
]);

interface FiberLike {
  type: unknown;
  return: FiberLike | null;
}

function componentName(type: unknown): string | undefined {
  if (typeof type === 'function') {
    return (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name;
  }
  if (typeof type === 'object' && type !== null) {
    const t = type as { displayName?: string; render?: unknown; type?: unknown };
    return t.displayName || componentName(t.render) || componentName(t.type);
  }
  return undefined;
}

function isInternalName(name: string): boolean {
  return /^(RCT|Animated|Virtualized|CellRenderer|Pressability|Touchable|Base|Android|IOS)/.test(name)
    || !/^[A-Z]/.test(name);
}

/** Nearest RN component (e.g. Pressable) and nearest user component (e.g. LoginScreen). */
export function describeOwners(node: HostNode): { rn?: string; user?: string } {
  const result: { rn?: string; user?: string } = {};
  try {
    let fiber = (node.unstable_fiber as FiberLike | null | undefined)?.return ?? null;
    // Only composites between this node and the next host ancestor rendered it.
    let ownWrapper = true;
    while (fiber && !result.user) {
      if (typeof fiber.type === 'string') ownWrapper = false;
      const name = componentName(fiber.type);
      if (name) {
        // Jest mocks wrap each host element in a composite of the same name.
        if (RN_COMPONENTS.has(name)) {
          if (ownWrapper && name !== node.type) result.rn ??= name;
        }
        else if (!isInternalName(name)) result.user = name;
      }
      fiber = fiber.return;
    }
  } catch {
    // unstable_fiber is an internal API; failure output must never crash.
  }
  return result;
}

export function describeElement(node: HostNode): string {
  const attrs: string[] = [];
  const role = getRole(node);
  if (role) attrs.push(`role="${role}"`);
  if (node.props.testID) attrs.push(`testID="${node.props.testID}"`);
  const name = getAccessibleName(node);
  if (name) attrs.push(`name="${name.length > 40 ? `${name.slice(0, 37)}...` : name}"`);

  const { rn, user } = describeOwners(node);
  const tag = rn && rn !== node.type ? `${rn} → <${node.type}>` : `<${node.type}>`;
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
