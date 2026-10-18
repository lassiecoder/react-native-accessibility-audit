import {
  findAncestor,
  getAccessibleName,
  getOwnLabel,
  getRole,
  getState,
  getTextContent,
  getValue,
  isImage,
  isInteractive,
  isSwitch,
  isText,
} from './tree';
import type { Rule, RuleId } from './types';

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
    // Native switches report their own value.
    if (isSwitch(node)) return null;
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

export const rules: Rule[] = [
  interactiveRoleRequired,
  interactiveLabelRequired,
  imageLabelRequired,
  noNestedInteractive,
  stateRequired,
  noEmptyText,
];

export const ruleIds = rules.map((r) => r.id) as RuleId[];
