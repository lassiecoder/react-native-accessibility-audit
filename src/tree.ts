import type { HostNode } from './types';

// RNTL v14 only exposes host elements, so everything below reads host props.
// React Native accepts both the ARIA-style props (`role`, `aria-*`) and the
// legacy `accessibility*` props; Pressable normalizes some (aria-checked ->
// accessibilityState) but not others (role stays `role`), so we read both.

const IMAGE_TYPES = new Set(['Image', 'RCTImageView']);
const TEXT_TYPES = new Set(['Text', 'RCTText', 'RCTVirtualText']);
const SWITCH_TYPES = new Set(['RCTSwitch', 'AndroidSwitch']);
// @react-native-community/slider, and React Native's own slider before it moved out.
const SLIDER_TYPES = new Set(['RNCSlider', 'RCTSlider']);

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

/** True when this node and its subtree are removed from the accessibility tree. */
export function isHiddenFromA11y(node: HostNode): boolean {
  const { props } = node;
  return (
    props['aria-hidden'] === true ||
    props.accessibilityElementsHidden === true ||
    props.importantForAccessibility === 'no-hide-descendants' ||
    flattenStyle(props.style).display === 'none'
  );
}

export function isInteractive(node: HostNode): boolean {
  const { props } = node;
  if (isSwitch(node)) return true;
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
    (isImage(node) ? nonEmpty(props.alt) : undefined) ??
    nonEmpty(props['aria-labelledby']) ??
    nonEmpty(props.accessibilityLabelledBy)
  );
}

/** Visible text in the subtree, skipping parts hidden from screen readers. */
export function getTextContent(node: HostNode): string {
  if (isHiddenFromA11y(node)) return '';
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
    if (isHiddenFromA11y(n)) return;
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
 * Depth-first walk over host nodes, skipping subtrees hidden from screen
 * readers and subtrees for which `skip` returns true.
 */
export function walk(
  root: HostNode,
  visit: (node: HostNode) => void,
  skip: (node: HostNode) => boolean = () => false,
): void {
  // The container (type '') is never audited itself.
  if (root.type !== '') {
    if (isHiddenFromA11y(root) || skip(root)) return;
    visit(root);
  }
  for (const child of root.children) {
    if (typeof child !== 'string') walk(child, visit, skip);
  }
}
