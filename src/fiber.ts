import { loadFromProject } from './project';
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

let reactNative: Record<string, unknown> | null | undefined;
const rnTypesByName = new Map<string, Set<unknown>>();

/**
 * Compares against the component React Native actually exports under `name`,
 * so a user's own `Button` isn't mistaken for React Native's. Exports are read
 * only once a component with that name shows up: reading deprecated ones
 * (e.g. SafeAreaView) logs a warning. Falls back to the name alone when
 * react-native can't be loaded.
 */
function isReactNativeComponent(type: unknown, name: string): boolean {
  if (!RN_COMPONENTS.has(name)) return false;
  if (reactNative === undefined) {
    try {
      reactNative = loadFromProject<Record<string, unknown>>('react-native');
    } catch {
      reactNative = null;
    }
  }
  if (!reactNative) return true;

  let types = rnTypesByName.get(name);
  if (!types) {
    types = new Set();
    // memo() and forwardRef() wrappers get their own fibers, so register
    // the inner types as well as the exported one.
    let current: unknown = reactNative[name];
    for (let depth = 0; current && depth < 4; depth++) {
      types.add(current);
      const t = current as { type?: unknown; render?: unknown };
      current = typeof current === 'object' ? (t.type ?? t.render) : undefined;
    }
    rnTypesByName.set(name, types);
  }
  return types.has(type);
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
  return /^(RCT|Animated|Virtualized|CellRenderer|Pressability|Touchable|Base|Android|IOS|ViewManagerAdapter_|GestureHandler|GestureDetector|NativeDetector|RNGestureHandler)/.test(name)
    || !/^[A-Z]/.test(name);
}

// Host elements rendered by third-party libraries: the library's name for
// messages, and the library's own components, which wrap the host element at
// various depths (seen under jest-expo) and are not the user's components.
const LIBRARY_HOSTS: Record<string, { library: string; components: Set<string> }> = {};
function library(name: string, hosts: string[], components: string[]) {
  for (const host of hosts) LIBRARY_HOSTS[host] = { library: name, components: new Set([...hosts, ...components]) };
}
library('expo-image', ['ExpoImage', 'ViewManagerAdapter_ExpoImage'], ['Image']);
library('expo-symbols', ['SymbolModule', 'ViewManagerAdapter_SymbolModule'], ['SymbolView']);
library('gesture-handler', ['RNGestureHandlerButton'], [
  'NativeDetector', 'RawButton', 'BaseButton', 'RectButton', 'BorderlessButton', 'Touchable', 'PressableWithTouchable', 'Pressable',
]);
library('@react-native-community/slider', ['RNCSlider'], ['Slider', 'SliderComponent']);

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

/**
 * The component that rendered `node` as the user knows it (e.g. Pressable,
 * or "gesture-handler RectButton") and the nearest user component (e.g.
 * LoginScreen).
 */
export function describeOwners(node: HostNode): { rn?: string; user?: string } {
  const result: { rn?: string; user?: string } = {};
  try {
    let fiber = (node.unstable_fiber as FiberLike | null | undefined)?.return ?? null;
    const lib = LIBRARY_HOSTS[node.type];
    // Only composites between this node and the next host ancestor rendered it.
    let ownWrapper = true;
    let outermostLibraryComponent: string | undefined;
    while (fiber && !result.user) {
      if (typeof fiber.type === 'string') ownWrapper = false;
      const name = componentName(fiber.type);
      if (name) {
        if (lib?.components.has(name)) {
          if (!LIBRARY_HOSTS[name]) outermostLibraryComponent = name;
        } else if (isReactNativeComponent(fiber.type, name)) {
          // Jest mocks wrap each host element in a composite of the same name.
          if (!lib && ownWrapper && name !== node.type) result.rn ??= name;
        } else if (!isInternalName(name)) result.user = name;
      }
      fiber = fiber.return;
    }
    if (lib) result.rn = outermostLibraryComponent ? `${lib.library} ${outermostLibraryComponent}` : lib.library;
  } catch {
    // See note at the top of the file.
  }
  return result;
}
