---
name: react-native-accessibility-audit
description: Find and fix accessibility problems in React Native and Expo apps with react-native-accessibility-audit. Use when writing or changing React Native screens or components, when asked to check, audit or improve accessibility (a11y, VoiceOver, TalkBack, screen readers, WCAG, EN 301 549, European Accessibility Act), when a toBeAccessible() test fails, or when adding accessibility checks to tests or CI.
---

# React Native accessibility audits

`react-native-accessibility-audit` checks rendered React Native trees in Jest. `toBeAccessible()` fails a test when a screen has accessibility problems, and the CLI scans source files and summarizes results across the project. It needs React 19+, React Native 0.78+ (Expo SDK 53+), `@testing-library/react-native` v14 and Jest 29+.

## Check that it is set up

1. `react-native-accessibility-audit` is in `devDependencies`. If not: `npm install --save-dev react-native-accessibility-audit`.
2. The Jest config lists it in `setupFilesAfterEnv`: `setupFilesAfterEnv: ['react-native-accessibility-audit']`.
3. For TypeScript, `tsconfig.json` has `"types": ["jest", "react-native-accessibility-audit"]`, or a setup file imports the package.
4. Optional, for project-wide reports: `reporters: ['default', 'react-native-accessibility-audit/reporter']`.

## Audit a screen

Add an accessibility test next to the component's existing tests. Render it the way the app does, with its providers and realistic props, and wait for asynchronous content first.

```tsx
import { render, screen } from '@testing-library/react-native';

test('settings screen is accessible', async () => {
  await render(<SettingsScreen />);
  await screen.findByText('Notifications'); // wait until data has loaded
  expect(screen.root).toBeAccessible();
});
```

Small components can be passed directly: `expect(<IconButton icon="close" />).toBeAccessible()`. This renders synchronously, so don't use it for components that load data.

Run the test: `npx jest path/to/test`.

## Read a failure

Each violation shows the rule, the element, the component that rendered it, the fix and the WCAG criterion:

```
1. [interactive-label-required] Interactive element has no label or text, so screen readers can only announce its role.
   Element: Pressable → <View> role="button" testID="close" in Header
   Fix: Add accessibilityLabel (or aria-label), or render visible Text inside the element.
   Standard: WCAG 4.1.2 Name, Role, Value (A) · EN 301 549 11.4.1.2
```

`in Header` names the component whose source needs the change. A `Library:` line and `rendered by <package>` mean the element comes from a library's own code: look for a prop or theme option in that library (for example a navigator's `tabBarActiveTintColor`), or tell the user it needs an upstream fix. Only suggest `ignore: { packages: [...] }` if the user agrees the library's issues are out of scope. `Pressable → <View>` means a `Pressable` rendered the element. If the component that rendered it is a shared wrapper (for example `in StyledButton`), fix the wrapper so it forwards `accessibilityRole` / `accessibilityLabel` to the `Pressable`, rather than patching each screen.

## Fix violations

Fix the source, not the test. Prefer the ARIA-style props (`role`, `aria-label`, `aria-checked`, `aria-hidden`); React Native supports both these and the `accessibility*` props.

| Rule | Usual fix |
| --- | --- |
| `interactive-role-required` | Add `accessibilityRole="button"` (or `role="button"`, `"link"`, `"tab"`, `"checkbox"`…) to the pressable. |
| `interactive-label-required` | Add `accessibilityLabel` describing the action ("Close", "Add to cart") for icon-only buttons. Buttons with visible text need nothing. |
| `input-label-required` | Add `accessibilityLabel` to `TextInput` / `Slider`, usually the visible label text. A placeholder is not a label. |
| `interactive-accessible-required` | Remove `accessible={false}` from the control. |
| `image-label-required` | Informative image: `accessibilityLabel` / `alt`. Decorative image: `alt=""`, `aria-hidden` or `accessible={false}`. `importantForAccessibility="no"` alone only works on Android. |
| `no-nested-interactive` | Move the inner control out of the outer pressable or `accessible` group; use `accessibilityActions` on the outer element if a row needs several actions. |
| `state-required` | Checkbox, radio, switch, toggle button: `aria-checked={value}` or `accessibilityState={{ checked: value }}`. Adjustable: `accessibilityValue={{ min, max, now }}`. |
| `adjustable-role-required` | Add `accessibilityRole="adjustable"` to custom controls with `increment` / `decrement` actions; don't set another role on native sliders. |
| `role-valid` | `accessibilityRole` takes React Native names (`header`, `image`); `role` takes ARIA names (`heading`, `img`). |
| `accessibility-actions-valid` | Give every action a `name`, give custom actions a `label`, and handle them in `onAccessibilityAction`. |
| `link-role-misused` | Add `onPress`, or remove `role="link"`. |
| `no-empty-text` | Render the `Text` only when it has content. |
| `consistent-hiding` | Use `aria-hidden`, or set both `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`. |
| `modal-hides-background` | While the custom modal is open, set `aria-hidden` on the content behind it, or use React Native's `Modal`. |
| `no-disabled-font-scaling` | Remove `allowFontScaling={false}`; fix layouts with `minHeight` and wrapping text; use `maxFontSizeMultiplier` of 2 or more if growth must be limited. |
| `touch-target-size` (warning) | Make the control at least 44×44 or add `hitSlop`. |
| `text-contrast` (warning) | Darken or lighten the color: 4.5:1 for normal text, 3:1 for large text. |
| `no-nested-text-link` (warning) | Move the pressable `Text` out of the paragraph, or make the whole paragraph pressable. |

Labels describe purpose, not appearance: "Delete message", not "Trash icon". Don't add the role to the label ("Close button" is read as "Close button, button").

After fixing, run the test again until it passes. Then check the user-visible behavior with the existing tests.

## Rules for agents

- Never make a failing accessibility test pass by turning a rule off, adding `ignore`, using `customViolationHandler`, wrapping content in `aria-hidden`, or running `jest -u` to accept a baseline, unless the user asks. Fix the component.
- `ignore` is for code the app can't change (third-party maps, ads, carousels). Prefer `ignore: { packages: ['library-name'] }`, which still audits content the app passes into the library.
- Don't hide content that conveys information just to silence `image-label-required`; describe it.
- Warnings (`touch-target-size`, `text-contrast`, `no-nested-text-link`) don't fail tests but are real issues. Fix them when you touch the component.
- The tests can't see focus order, focus after navigation, layout at large font sizes, Reduce Motion or announcements. Say so when reporting results, and suggest checking them with VoiceOver and TalkBack.

## Existing apps: baseline mode

When an existing screen has many violations, don't fix everything in one change unless asked. Record today's violations so only new ones fail:

```tsx
expect(screen.root).toBeAccessible({ baseline: 'settings' }); // or baseline: true
```

The first local run writes `__a11y_baselines__/<test file>.json`; commit it. Fixed violations are removed from the file automatically. `jest --ci` never writes baselines.

## Whole-project overview

- `npx react-native-accessibility-audit scan` checks source files without running tests and lists component files that no `toBeAccessible()` test renders (after a Jest run with the reporter). Use it to find where to add tests. It only reports what it can see in JSX, so a clean scan does not replace the tests.
- `npx react-native-accessibility-audit report` prints every issue from the last Jest run with the reporter, highest priority first, with file and line.
- `npx react-native-accessibility-audit baselines` lists the violations recorded in baseline files: the known accessibility debt.
- A finding from `scan` can be suppressed with `// a11y-audit-ignore-next-line` (or `{/* a11y-audit-ignore-next-line */}` in JSX) on the line before the element, when it is a false positive.

Work through `report` output from the top: errors first, then baselined errors, then warnings, with controls before images and text.
