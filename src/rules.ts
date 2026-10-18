import { backgroundBehind, blend, contrastRatio, inheritedTextStyle, parseColor, toHex } from './color';
import {
  findAncestor,
  flattenStyle,
  getAccessibleName,
  getActionNames,
  getOwnLabel,
  getRole,
  getState,
  getTextContent,
  getValue,
  isImage,
  isInteractive,
  isNativeSlider,
  isSwitch,
  isText,
} from './tree';
import type { HostNode, Rule, RuleId } from './types';

// Roles that describe content, not a control. On a pressable they make the
// screen reader announce the element as something you can't activate.
const NON_INTERACTIVE_ROLES = new Set(['none', 'presentation', 'text', 'header', 'heading', 'image', 'img', 'summary']);
const CHECKABLE_ROLES = new Set(['checkbox', 'radio', 'switch', 'togglebutton']);
const ADJUSTABLE_ROLES = new Set(['adjustable', 'slider', 'spinbutton']);

const interactiveRoleRequired: Rule = {
  id: 'interactive-role-required',
  severity: 'error',
  description: 'Interactive elements must expose a role.',
  help: 'Add accessibilityRole (or role), e.g. "button" or "link", so screen readers announce what the element does.',
  check(node) {
    if (!isInteractive(node) || isSwitch(node)) return null;
    const role = getRole(node);
    if (!role) return 'Interactive element has no role.';
    if (NON_INTERACTIVE_ROLES.has(role)) {
      return `Interactive element has the non-interactive role "${role}".`;
    }
    return null;
  },
};

const interactiveAccessibleRequired: Rule = {
  id: 'interactive-accessible-required',
  severity: 'error',
  description: 'Interactive elements must be focusable by screen readers.',
  help: 'Remove accessible={false} from the control. To group it with other content, make the parent accessible instead.',
  check(node) {
    if (!isInteractive(node) || isText(node)) return null;
    return node.props.accessible === false
      ? 'Interactive element has accessible={false}, so screen readers cannot focus it.'
      : null;
  },
};

const interactiveLabelRequired: Rule = {
  id: 'interactive-label-required',
  severity: 'error',
  description: 'Interactive elements must have an accessible name.',
  help: 'Add accessibilityLabel (or aria-label), or render visible Text inside the element.',
  check(node) {
    if (!isInteractive(node)) return null;
    return getAccessibleName(node)
      ? null
      : 'Interactive element has no label or text, so screen readers can only announce its role.';
  },
};

const imageLabelRequired: Rule = {
  id: 'image-label-required',
  severity: 'error',
  description: 'Images must have a label or be marked as decorative.',
  help: 'Add accessibilityLabel (or alt) describing the image. If it is decorative, hide it with accessibilityElementsHidden and importantForAccessibility="no-hide-descendants", or aria-hidden.',
  check(node) {
    if (!isImage(node)) return null;
    if (getOwnLabel(node)) return null;
    // alt="" or role="none" is an explicit "decorative" decision.
    if (node.props.alt === '' || getRole(node) === 'none' || getRole(node) === 'presentation') return null;
    if (node.props.importantForAccessibility === 'no') return null;
    // Inside an accessible container the container's label is what gets read.
    if (findAncestor(node, (p) => p.props.accessible === true || isInteractive(p))) return null;
    return 'Image has no label and is not marked as decorative.';
  },
};

const noNestedInteractive: Rule = {
  id: 'no-nested-interactive',
  severity: 'error',
  description: 'Interactive elements must not be nested inside other interactive elements.',
  help: 'Move the inner control out of the outer one. Screen readers usually focus only the outer element, so the inner one cannot be reached.',
  check(node) {
    if (!isInteractive(node)) return null;
    return findAncestor(node, isInteractive)
      ? 'Interactive element is nested inside another interactive element.'
      : null;
  },
};

const stateRequired: Rule = {
  id: 'state-required',
  severity: 'error',
  description: 'Checkable and adjustable controls must expose their current state.',
  help: 'Set accessibilityState={{ checked }} (or aria-checked) on checkboxes, radios, switches and toggle buttons; set accessibilityValue (or aria-valuenow / aria-valuetext) on adjustable controls.',
  check(node) {
    // Native switches and sliders report their own value.
    if (isSwitch(node) || isNativeSlider(node)) return null;
    const role = getRole(node);
    if (!role) return null;
    if (CHECKABLE_ROLES.has(role)) {
      const { checked } = getState(node);
      const valid = typeof checked === 'boolean' || (checked === 'mixed' && role === 'checkbox');
      return valid ? null : `Element with role "${role}" does not expose a checked state.`;
    }
    if (ADJUSTABLE_ROLES.has(role)) {
      const { now, text } = getValue(node);
      return typeof now === 'number' || text
        ? null
        : `Element with role "${role}" does not expose a current value.`;
    }
    return null;
  },
};

const adjustableRoleRequired: Rule = {
  id: 'adjustable-role-required',
  severity: 'error',
  description: 'Controls that can be incremented or decremented must have an adjustable role.',
  help: 'Set accessibilityRole="adjustable" (or role="slider"). VoiceOver only offers swipe up/down for increment and decrement on adjustable elements. Native sliders need no role; remove any other role you set on them.',
  check(node) {
    const role = getRole(node);
    if (role && ADJUSTABLE_ROLES.has(role)) return null;
    if (isNativeSlider(node)) {
      // Adjustable natively; only an explicit other role breaks that.
      return role ? `Slider has the role "${role}", which replaces its native adjustable behavior.` : null;
    }
    const adjustable = getActionNames(node).filter((n) => n === 'increment' || n === 'decrement');
    if (adjustable.length === 0) return null;
    return `Element exposes the ${adjustable.map((n) => `"${n}"`).join(' and ')} action${adjustable.length > 1 ? 's' : ''} but ${role ? `has the role "${role}"` : 'has no role'}, so screen reader users can't adjust it.`;
  },
};

const linkRoleMisused: Rule = {
  id: 'link-role-misused',
  severity: 'error',
  description: 'The "link" role must only be used on elements that can be activated.',
  help: 'Add onPress to the element, or remove role="link" if it is not a link.',
  check(node) {
    if (getRole(node) !== 'link') return null;
    if (isInteractive(node) || findAncestor(node, isInteractive)) return null;
    return 'Element has the "link" role but nothing happens when it is activated.';
  },
};

const noEmptyText: Rule = {
  id: 'no-empty-text',
  severity: 'error',
  description: 'Text elements must not be empty.',
  help: 'Remove the empty Text, or render it only when it has content. Empty text creates a silent stop for screen readers.',
  check(node) {
    if (!isText(node)) return null;
    // Inline images or other elements inside Text are content.
    if (node.children.some((c) => typeof c !== 'string' && !isText(c))) return null;
    if (getOwnLabel(node)) return null;
    return getTextContent(node).trim() === '' ? 'Text element has no content.' : null;
  },
};

function size(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function hitSlop(value: unknown): { top: number; bottom: number; left: number; right: number } {
  if (typeof value === 'number') return { top: value, bottom: value, left: value, right: value };
  const v = (value ?? {}) as Record<string, unknown>;
  return { top: size(v.top) ?? 0, bottom: size(v.bottom) ?? 0, left: size(v.left) ?? 0, right: size(v.right) ?? 0 };
}

// The test renderer runs no layout, so sizes come from explicit styles only.
// Elements without a numeric width/height are skipped rather than guessed.
const touchTargetSize: Rule = {
  id: 'touch-target-size',
  severity: 'warn',
  description: 'Touch targets should be large enough to tap reliably.',
  help: 'Increase width/height (or minWidth/minHeight), or add hitSlop to extend the touchable area without changing the layout.',
  check(node, { minTouchTarget }) {
    // Inline text links are exempt (WCAG 2.5.8); native switches are sized by the platform.
    if (!isInteractive(node) || isText(node) || isSwitch(node)) return null;
    const style = flattenStyle(node.props.style);
    const width = size(style.width) ?? size(style.minWidth);
    const height = size(style.height) ?? size(style.minHeight);
    if (width === undefined && height === undefined) return null;

    const slop = hitSlop(node.props.hitSlop);
    const w = width === undefined ? undefined : width + slop.left + slop.right;
    const h = height === undefined ? undefined : height + slop.top + slop.bottom;
    if ((w ?? Infinity) >= minTouchTarget && (h ?? Infinity) >= minTouchTarget) return null;

    const shown = `${w ?? '?'}×${h ?? '?'}`;
    return `Touch target is ${shown}, smaller than ${minTouchTarget}×${minTouchTarget}.`;
  },
};

function isLargeText(node: HostNode): boolean {
  const fontSize = size(inheritedTextStyle(node, 'fontSize')) ?? 14;
  const weight = inheritedTextStyle(node, 'fontWeight');
  const bold = weight === 'bold' || Number(weight) >= 700;
  // WCAG "large text": 18pt, or 14pt bold (24px / 18.66px).
  return fontSize >= 24 || (bold && fontSize >= 18.66);
}

// Only checked when both colors are known from styles: the text color set on
// the Text (or an enclosing Text) and an opaque background on an ancestor.
const textContrast: Rule = {
  id: 'text-contrast',
  severity: 'warn',
  description: 'Text should have enough contrast with its background (WCAG AA).',
  help: 'Darken or lighten the text or background color. WCAG AA needs 4.5:1 for normal text and 3:1 for large text.',
  check(node) {
    if (!isText(node)) return null;
    // Only text this node renders itself; nested Text is checked on its own.
    if (!node.children.some((c) => typeof c === 'string' && c.trim() !== '')) return null;
    const color = parseColor(inheritedTextStyle(node, 'color'));
    const background = backgroundBehind(node);
    if (!color || !background) return null;

    const ratio = contrastRatio(blend(color, background), background);
    const required = isLargeText(node) ? 3 : 4.5;
    if (ratio >= required) return null;
    return `Text contrast is ${ratio.toFixed(2)}:1 (${toHex(blend(color, background))} on ${toHex(background)}), below ${required}:1.`;
  },
};

export const rules: Rule[] = [
  interactiveRoleRequired,
  interactiveLabelRequired,
  interactiveAccessibleRequired,
  imageLabelRequired,
  noNestedInteractive,
  stateRequired,
  adjustableRoleRequired,
  linkRoleMisused,
  noEmptyText,
  touchTargetSize,
  textContrast,
];

export const ruleIds = rules.map((r) => r.id) as RuleId[];
