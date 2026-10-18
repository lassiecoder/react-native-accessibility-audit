import type { HostNode } from './types';

// test-renderer exposes the React fiber as `unstable_fiber`. It is the only
// way to see composite components (LoginScreen, MapView) in RNTL v14's
// host-only tree, so every access is defensive: a React internals change must
// degrade output, never crash a test run.

interface FiberLike {
  type: unknown;
  return: FiberLike | null;
}

// Composite components that come from React Native itself.
export const RN_COMPONENTS = new Set([
  'View', 'Text', 'Image', 'ImageBackground', 'TextInput', 'Switch', 'Button',
  'Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback',
  'TouchableNativeFeedback', 'ScrollView', 'FlatList', 'SectionList', 'VirtualizedList',
  'Modal', 'SafeAreaView', 'KeyboardAvoidingView', 'ActivityIndicator', 'RefreshControl',
]);

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

/**
 * Composite components between `node` and its parent host element, innermost
 * first — i.e. the components that rendered this host element directly.
 */
export function ownComponentNames(node: HostNode): string[] {
  const names: string[] = [];
  try {
    let fiber = (node.unstable_fiber as FiberLike | null | undefined)?.return ?? null;
    while (fiber && typeof fiber.type !== 'string') {
      const name = componentName(fiber.type);
      if (name) names.push(name);
      fiber = fiber.return;
    }
  } catch {
    // See note at the top of the file.
  }
  return names;
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
        } else if (!isInternalName(name)) result.user = name;
      }
      fiber = fiber.return;
    }
  } catch {
    // See note at the top of the file.
  }
  return result;
}
