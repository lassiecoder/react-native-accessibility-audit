import { backgroundBehind, blend, contrastRatio, inheritedTextStyle, parseColor, toHex, type RGBA } from './color';
import { describeElement } from './format';
import { ACCESSIBILITY_ROLES, ARIA_ROLES, STANDARD_ACTIONS } from './roles';
import {
  accessibilityTarget,
  findAncestor,
  flattenStyle,
  getAccessibleName,
  getActionNames,
  getOwnLabel,
  getRole,
  getState,
  getTextContent,
  getValue,
  hasAndroidOnlyLabel,
  hidesOnAndroid,
  hidesOnIOS,
  isImage,
  isInteractive,
  isNativeSlider,
  isSwitch,
  isText,
  isTextInput,
} from './tree';
import type { HostNode, Rule, RuleId } from './types';

// Roles that describe content, not a control. On a pressable they make the
// screen reader announce the element as something you can't activate.
const NON_INTERACTIVE_ROLES = new Set(['none', 'presentation', 'text', 'header', 'heading', 'image', 'img', 'summary']);
const CHECKABLE_ROLES = new Set(['checkbox', 'radio', 'switch', 'togglebutton']);
const ADJUSTABLE_ROLES = new Set(['adjustable', 'slider', 'spinbutton']);

const ANDROID_ONLY_NOTE = ' aria-labelledby / accessibilityLabelledBy only work on Android, so iOS has no label.';

const interactiveRoleRequired: Rule = {
  id: 'interactive-role-required',
  severity: 'error',
  description: 'Interactive elements must expose a role.',
  help: 'Add accessibilityRole (or role), e.g. "button" or "link", so screen readers announce what the element does.',
  check(node) {
    if (!isInteractive(node) || isSwitch(node)) return null;
    const role = getRole(accessibilityTarget(node));
    if (!role) return 'Interactive element has no role.';
    if (NON_INTERACTIVE_ROLES.has(role)) {
      return `Interactive element has the non-interactive role "${role}".`;
    }
    return null;
  },
};

const inputLabelRequired: Rule = {
  id: 'input-label-required',
  severity: 'error',
  description: 'Text inputs and sliders must have a label.',
  help: 'Add accessibilityLabel (or aria-label) describing the field, usually the same text as its visible label. A placeholder is not a label: it disappears once someone types.',
  check(node) {
    const input = isTextInput(node) ? 'Text input' : isNativeSlider(node) ? 'Slider' : null;
    if (!input || getOwnLabel(node)) return null;
    if (hasAndroidOnlyLabel(node)) return `${input} has no label.${ANDROID_ONLY_NOTE}`;
    if (isTextInput(node) && typeof node.props.placeholder === 'string' && node.props.placeholder.trim()) {
      return `Text input has only a placeholder ("${node.props.placeholder.trim()}"). Placeholders disappear once someone types, so they aren't a reliable label.`;
    }
    return `${input} has no label, so screen readers can't say what it is for.`;
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
    const target = accessibilityTarget(node);
    if (getAccessibleName(target)) return null;
    return `Interactive element has no label or text, so screen readers can only announce its role.${hasAndroidOnlyLabel(target) ? ANDROID_ONLY_NOTE : ''}`;
  },
};

const imageLabelRequired: Rule = {
  id: 'image-label-required',
  severity: 'error',
  description: 'Images must have a label or be marked as decorative.',
  help: 'Add accessibilityLabel (or alt) describing the image. If it is decorative, mark it in a way both platforms understand: alt="", aria-hidden, or accessible={false}.',
  check(node) {
    if (!isImage(node)) return null;
    if (getOwnLabel(node)) return null;
    // Explicit "decorative" decisions that work on iOS and Android.
    const role = getRole(node);
    if (node.props.alt === '' || role === 'none' || role === 'presentation' || node.props.accessible === false) return null;
    // Hidden on one platform only: consistent-hiding reports that.
    if (hidesOnIOS(node) !== hidesOnAndroid(node)) return null;
    // Inside an accessible container the container's label is what gets read.
    if (findAncestor(node, (p) => p.props.accessible === true || isInteractive(p))) return null;
    if (node.props.importantForAccessibility === 'no' && node.props.accessibilityElementsHidden !== true) {
      return 'Image is marked decorative with importantForAccessibility="no", which only applies on Android.';
    }
    return 'Image has no label and is not marked as decorative.';
  },
};

const noNestedInteractive: Rule = {
  id: 'no-nested-interactive',
  severity: 'error',
  description: 'Interactive elements must not be nested inside other interactive elements or accessible groups.',
  help: 'Move the inner control out of the outer one, or remove accessible={true} from the grouping View. Screen readers focus the outer element as one item, so the inner control cannot be reached.',
  check(node) {
    if (!isInteractive(node)) return null;
    if (findAncestor(node, isInteractive)) return 'Interactive element is nested inside another interactive element.';
    // On iOS an accessible element hides its children from VoiceOver.
    return findAncestor(node, (p) => p.props.accessible === true && !isInteractive(p))
      ? 'Interactive element is inside an accessible={true} container, which VoiceOver focuses as a single element, so this control cannot be reached on iOS.'
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

const consistentHiding: Rule = {
  id: 'consistent-hiding',
  severity: 'error',
  description: 'Content hidden from screen readers must be hidden on both iOS and Android.',
  help: 'Use aria-hidden, which works on both platforms, or set accessibilityElementsHidden (iOS) together with importantForAccessibility="no-hide-descendants" (Android).',
  check(node) {
    const ios = hidesOnIOS(node);
    const android = hidesOnAndroid(node);
    if (ios === android) return null;
    const otherHides = ios ? hidesOnAndroid : hidesOnIOS;
    // The other platform may already be covered by an ancestor, or by the
    // descendants that hold all of the readable content.
    if (findAncestor(node, otherHides)) return null;
    if (!hasReadableContent(node, (n) => n !== node && otherHides(n))) return null;
    return ios
      ? 'Element is hidden from VoiceOver with accessibilityElementsHidden, but TalkBack still reads it.'
      : 'Element is hidden from TalkBack with importantForAccessibility="no-hide-descendants", but VoiceOver still reads it.';
  },
};

/** Whether a screen reader can reach anything in the subtree; `hidden` says what hides a node from it. */
function hasReadableContent(node: HostNode, hidden: (n: HostNode) => boolean): boolean {
  if (hidden(node)) return false;
  if (isInteractive(node) || getOwnLabel(node)) return true;
  if (isText(node) && node.children.some((c) => typeof c === 'string' && c.trim() !== '')) return true;
  return node.children.some((c) => typeof c !== 'string' && hasReadableContent(c, hidden));
}

const modalHidesBackground: Rule = {
  id: 'modal-hides-background',
  severity: 'error',
  description: 'Content behind a modal must be hidden from screen readers.',
  help: 'aria-modal / accessibilityViewIsModal only work on iOS, and only hide the modal\'s sibling views. While the modal is open, set importantForAccessibility="no-hide-descendants" on the content behind it (or aria-hidden, for both platforms), or render the modal with React Native\'s Modal component.',
  check(node) {
    if (node.props['aria-modal'] !== true && node.props.accessibilityViewIsModal !== true) return null;
    const androidExposed: HostNode[] = [];
    const bothExposed: HostNode[] = [];
    for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
      const direct = child === node;
      for (const sibling of parent.children) {
        if (typeof sibling === 'string' || sibling === child) continue;
        // iOS hides the modal's direct siblings; Android hides nothing.
        if (direct) {
          if (hasReadableContent(sibling, hidesOnAndroid)) androidExposed.push(sibling);
        } else if (hasReadableContent(sibling, (n) => hidesOnIOS(n) && hidesOnAndroid(n))) {
          bothExposed.push(sibling);
        }
      }
    }
    if (bothExposed.length > 0) {
      return `Content outside the modal is still read by VoiceOver and TalkBack: aria-modal only hides the modal's direct siblings. First exposed element: ${describeElement(bothExposed[0])}.`;
    }
    if (androidExposed.length > 0) {
      return `aria-modal / accessibilityViewIsModal only work on iOS, so TalkBack still reads the content behind the modal. First exposed element: ${describeElement(androidExposed[0])}.`;
    }
    return null;
  },
};

const noDisabledFontScaling: Rule = {
  id: 'no-disabled-font-scaling',
  severity: 'error',
  description: 'Text must grow with the system font size (WCAG 1.4.4).',
  help: 'Remove allowFontScaling={false}. If a layout breaks at large sizes, fix the layout (minHeight instead of height, let text wrap), or limit growth with maxFontSizeMultiplier; 2 or more still allows the 200% WCAG requires.',
  check(node) {
    const kind = isText(node) ? 'Text' : isTextInput(node) ? 'Text input' : null;
    if (!kind) return null;
    if (node.props.allowFontScaling === false) {
      return `${kind} has allowFontScaling={false}, so it ignores the user's text size setting.`;
    }
    const max = node.props.maxFontSizeMultiplier;
    // 0 means "no limit"; 1 means the text can't grow at all.
    if (typeof max === 'number' && max > 0 && max <= 1) {
      return `${kind} has maxFontSizeMultiplier={${max}}, so it can't grow beyond its base size.`;
    }
    return null;
  },
};

const accessibilityActionsValid: Rule = {
  id: 'accessibility-actions-valid',
  severity: 'error',
  description: 'Accessibility actions must have names, labels for custom actions, and a handler.',
  help: 'Give every action a name, give custom actions (anything other than activate, increment, decrement, longpress, magicTap, escape) a label for screen readers to announce, and handle them in onAccessibilityAction.',
  check(node) {
    const actions: unknown[] = Array.isArray(node.props.accessibilityActions) ? node.props.accessibilityActions : [];
    if (actions.length === 0) return null;
    const problems: string[] = [];
    const named = actions.filter((a): a is { name: string; label?: unknown } => typeof (a as { name?: unknown })?.name === 'string' && (a as { name: string }).name.trim() !== '');
    if (named.length < actions.length) problems.push('an action has no name');
    const unlabelled = named.filter((a) => !STANDARD_ACTIONS.has(a.name) && !(typeof a.label === 'string' && a.label.trim()));
    if (unlabelled.length > 0) {
      problems.push(`custom action${unlabelled.length > 1 ? 's' : ''} ${unlabelled.map((a) => `"${a.name}"`).join(', ')} ${unlabelled.length > 1 ? 'have' : 'has'} no label to announce`);
    }
    // Native sliders handle their actions natively.
    if (typeof node.props.onAccessibilityAction !== 'function' && !isNativeSlider(node)) {
      problems.push('there is no onAccessibilityAction handler, so activating an action does nothing');
    }
    return problems.length > 0 ? `Accessibility actions are broken: ${problems.join('; ')}.` : null;
  },
};

const roleValid: Rule = {
  id: 'role-valid',
  severity: 'error',
  description: 'Roles must be values React Native supports.',
  help: 'Use a supported value. accessibilityRole takes React Native names ("header", "image"); role takes ARIA names ("heading", "img"). Unsupported values are ignored, and some make Android throw.',
  check(node) {
    const { accessibilityRole, role } = node.props;
    if (typeof accessibilityRole === 'string' && !ACCESSIBILITY_ROLES.has(accessibilityRole)) {
      const hint = ARIA_ROLES.has(accessibilityRole) ? ` It is a valid value for role; use role="${accessibilityRole}" instead.` : '';
      return `accessibilityRole="${accessibilityRole}" is not a role React Native supports.${hint}`;
    }
    if (typeof role === 'string' && !ARIA_ROLES.has(role)) {
      const hint = ACCESSIBILITY_ROLES.has(role) ? ` It is a valid value for accessibilityRole; use accessibilityRole="${role}" instead.` : '';
      return `role="${role}" is not a role React Native supports.${hint}`;
    }
    return null;
  },
};

const noNestedTextLink: Rule = {
  id: 'no-nested-text-link',
  severity: 'warn',
  description: 'Pressable text inside a paragraph may not be reachable with a screen reader.',
  help: 'Render the link as its own Text outside the paragraph, or make the whole paragraph the pressable element. If you keep it inline, test it with VoiceOver and TalkBack.',
  check(node) {
    if (!isText(node) || !isInteractive(node)) return null;
    return findAncestor(node, isText)
      ? 'Pressable Text nested inside another Text cannot be focused on its own by VoiceOver on iOS (react-native#53243).'
      : null;
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
  const style = (key: string) => (isTextInput(node) ? flattenStyle(node.props.style)[key] : inheritedTextStyle(node, key));
  const fontSize = size(style('fontSize')) ?? 14;
  const weight = style('fontWeight');
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
    const background = backgroundBehind(node);
    if (!background) return null;
    const required = isLargeText(node) ? 3 : 4.5;
    const failure = (what: string, color: RGBA | null) => {
      if (!color) return null;
      const ratio = contrastRatio(blend(color, background), background);
      if (ratio >= required) return null;
      return `${what} contrast is ${ratio.toFixed(2)}:1 (${toHex(blend(color, background))} on ${toHex(background)}), below ${required}:1.`;
    };

    if (isTextInput(node)) {
      const hasPlaceholder = typeof node.props.placeholder === 'string' && node.props.placeholder.trim() !== '';
      return (
        (hasPlaceholder ? failure('Placeholder', parseColor(node.props.placeholderTextColor)) : null) ??
        failure('Input text', parseColor(flattenStyle(node.props.style).color))
      );
    }
    if (!isText(node)) return null;
    // Only text this node renders itself; nested Text is checked on its own.
    if (!node.children.some((c) => typeof c === 'string' && c.trim() !== '')) return null;
    return failure('Text', parseColor(inheritedTextStyle(node, 'color')));
  },
};

export const rules: Rule[] = [
  interactiveRoleRequired,
  interactiveLabelRequired,
  inputLabelRequired,
  interactiveAccessibleRequired,
  imageLabelRequired,
  noNestedInteractive,
  stateRequired,
  adjustableRoleRequired,
  roleValid,
  accessibilityActionsValid,
  linkRoleMisused,
  noEmptyText,
  consistentHiding,
  modalHidesBackground,
  noDisabledFontScaling,
  touchTargetSize,
  textContrast,
  noNestedTextLink,
];

export const ruleIds = rules.map((r) => r.id) as RuleId[];
