import type { HostNode } from './types';

// RNTL v14 only exposes host elements, so everything below reads host props.
// React Native accepts both the ARIA-style props (`role`, `aria-*`) and the
// legacy `accessibility*` props; Pressable normalizes some (aria-checked ->
// accessibilityState) but not others (role stays `role`), so we read both.

// expo-image and expo-symbols render as ViewManagerAdapter_* under jest-expo.
const IMAGE_TYPES = new Set([
  'Image', 'RCTImageView',
  'ExpoImage', 'ViewManagerAdapter_ExpoImage',
  'SymbolModule', 'ViewManagerAdapter_SymbolModule',
]);
const TEXT_TYPES = new Set(['Text', 'RCTText', 'RCTVirtualText']);
const SWITCH_TYPES = new Set(['RCTSwitch', 'AndroidSwitch']);
// @react-native-community/slider, and React Native's own slider before it moved out.
const SLIDER_TYPES = new Set(['RNCSlider', 'RCTSlider']);
// 'TextInput' in Jest presets; the others are the native host names.
const TEXT_INPUT_TYPES = new Set(['TextInput', 'RCTSinglelineTextInputView', 'RCTMultilineTextInputView', 'AndroidTextInput']);
// RectButton, BorderlessButton and Pressable from react-native-gesture-handler.
const GESTURE_BUTTON_TYPES = new Set(['RNGestureHandlerButton']);

export function isHostNode(value: unknown): value is HostNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'props' in value &&
    'children' in value &&
    Array.isArray((value as HostNode).children)
  );
}

export function isImage(node: HostNode): boolean {
  return IMAGE_TYPES.has(node.type);
}

export function isText(node: HostNode): boolean {
  return TEXT_TYPES.has(node.type);
}

export function isSwitch(node: HostNode): boolean {
  return SWITCH_TYPES.has(node.type);
}

export function isTextInput(node: HostNode): boolean {
  return TEXT_INPUT_TYPES.has(node.type);
}

export function isGestureButton(node: HostNode): boolean {
  return GESTURE_BUTTON_TYPES.has(node.type);
}

/** Platform sliders (UISlider / SeekBar), which are adjustable natively. */
export function isNativeSlider(node: HostNode): boolean {
  return SLIDER_TYPES.has(node.type);
}

/** Names of the custom accessibility actions the element exposes. */
export function getActionNames(node: HostNode): string[] {
  const actions = node.props.accessibilityActions;
  if (!Array.isArray(actions)) return [];
  return actions.map((a: { name?: unknown }) => a?.name).filter((n): n is string => typeof n === 'string');
}

export function flattenStyle(style: unknown): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return typeof style === 'object' ? (style as Record<string, any>) : {};
}

// accessibilityElementsHidden is iOS-only and importantForAccessibility is
// Android-only; aria-hidden and display: 'none' hide on both.

/** The node's own props hide it and its subtree from VoiceOver. */
export function hidesOnIOS(node: HostNode): boolean {
  const { props } = node;
  return props['aria-hidden'] === true || props.accessibilityElementsHidden === true || flattenStyle(props.style).display === 'none';
}

/** The node's own props hide it and its subtree from TalkBack. */
export function hidesOnAndroid(node: HostNode): boolean {
  const { props } = node;
  return (
    props['aria-hidden'] === true ||
    props.importantForAccessibility === 'no-hide-descendants' ||
    flattenStyle(props.style).display === 'none'
  );
}

/** Hidden from screen readers on both platforms by the node's own props. */
export function isHiddenFromA11y(node: HostNode): boolean {
  return hidesOnIOS(node) && hidesOnAndroid(node);
}

/** Hidden on at least one platform, so it can't be relied on as content. */
function isHiddenOnAnyPlatform(node: HostNode): boolean {
  return hidesOnIOS(node) || hidesOnAndroid(node);
}

export function isInteractive(node: HostNode): boolean {
  const { props } = node;
  if (isSwitch(node) || isGestureButton(node)) return true;
  // Pressable and every Touchable* set onClick on their host View;
  // <Text onPress> keeps onPress on the host Text.
  return (
    typeof props.onClick === 'function' ||
    typeof props.onPress === 'function' ||
    typeof props.onLongPress === 'function'
  );
}

export function getRole(node: HostNode): string | undefined {
  // `role` takes precedence over `accessibilityRole` in React Native.
  return node.props.role ?? node.props.accessibilityRole;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** The label set directly on the node, if any. */
export function getOwnLabel(node: HostNode): string | undefined {
  const { props } = node;
  return (
    nonEmpty(props['aria-label']) ??
    nonEmpty(props.accessibilityLabel) ??
    (isImage(node) ? nonEmpty(props.alt) : undefined)
  );
}

/**
 * aria-labelledby / accessibilityLabelledBy are Android-only in React Native,
 * so they don't count as a label; rules use this to explain why.
 */
export function hasAndroidOnlyLabel(node: HostNode): boolean {
  const { props } = node;
  const ids = [props['aria-labelledby'], props.accessibilityLabelledBy].flat();
  return ids.some((id) => nonEmpty(id) !== undefined);
}

/**
 * Visible text in the subtree. Text hidden on either platform is skipped:
 * a name that only one platform can read is missing on the other.
 */
export function getTextContent(node: HostNode): string {
  if (isHiddenOnAnyPlatform(node)) return '';
  return node.children
    .map((child) => (typeof child === 'string' ? child : getTextContent(child)))
    .join('');
}

/**
 * What a screen reader would announce for the node: its own label, or the
 * text and labels of its descendants (accessible containers merge children).
 */
export function getAccessibleName(node: HostNode): string | undefined {
  const own = getOwnLabel(node);
  if (own) return own;
  const parts: string[] = [];
  const collect = (n: HostNode) => {
    if (isHiddenOnAnyPlatform(n)) return;
    for (const child of n.children) {
      if (typeof child === 'string') parts.push(child);
      else {
        const label = getOwnLabel(child);
        if (label) parts.push(label);
        else collect(child);
      }
    }
  };
  collect(node);
  return nonEmpty(parts.join(' '));
}

export interface A11yState {
  checked?: boolean | 'mixed';
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
  busy?: boolean;
}

export function getState(node: HostNode): A11yState {
  const { props } = node;
  const state = props.accessibilityState ?? {};
  return {
    checked: props['aria-checked'] ?? state.checked,
    disabled: props['aria-disabled'] ?? state.disabled,
    selected: props['aria-selected'] ?? state.selected,
    expanded: props['aria-expanded'] ?? state.expanded,
    busy: props['aria-busy'] ?? state.busy,
  };
}

export function getValue(node: HostNode): { now?: number; text?: string } {
  const { props } = node;
  const value = props.accessibilityValue ?? {};
  return {
    now: props['aria-valuenow'] ?? value.now,
    text: props['aria-valuetext'] ?? value.text,
  };
}

/** First descendant matching `predicate`, depth-first, not descending past `stop`. */
export function findDescendant(
  node: HostNode,
  predicate: (n: HostNode) => boolean,
  stop: (n: HostNode) => boolean = () => false,
): HostNode | null {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (predicate(child)) return child;
    if (stop(child)) continue;
    const found = findDescendant(child, predicate, stop);
    if (found) return found;
  }
  return null;
}

/**
 * The element screen readers focus for a control. Gesture-handler buttons
 * are often made accessible through an accessible child View that carries the
 * role and label (gesture-handler's documented pattern), not the button itself.
 */
export function accessibilityTarget(node: HostNode): HostNode {
  if (!isGestureButton(node) || node.props.accessible === true) return node;
  return findDescendant(node, (n) => n.props.accessible === true, isInteractive) ?? node;
}

export function findAncestor(
  node: HostNode,
  predicate: (n: HostNode) => boolean,
): HostNode | null {
  for (let p = node.parent; p; p = p.parent) {
    if (predicate(p)) return p;
  }
  return null;
}

/**
 * Depth-first walk over host nodes, skipping subtrees for which `skip`
 * returns true and subtrees hidden from screen readers on both platforms.
 * Content hidden on only one platform is still audited: the other platform's
 * screen reader reads it.
 */
export function walk(
  root: HostNode,
  visit: (node: HostNode) => void,
  skip: (node: HostNode) => boolean = () => false,
  hidden: { ios: boolean; android: boolean } = { ios: false, android: false },
): void {
  let inherited = hidden;
  // The container (type '') is never audited itself.
  if (root.type !== '') {
    inherited = { ios: hidden.ios || hidesOnIOS(root), android: hidden.android || hidesOnAndroid(root) };
    if ((inherited.ios && inherited.android) || skip(root)) return;
    visit(root);
  }
  for (const child of root.children) {
    if (typeof child !== 'string') walk(child, visit, skip, inherited);
  }
}
