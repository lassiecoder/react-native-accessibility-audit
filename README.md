# react-native-accessibility-audit

Accessibility audits for React Native and Expo tests. Render a screen, call one matcher, and the test fails if the screen has accessibility problems: missing labels, missing roles, unlabelled images, nested buttons and more.

```tsx
test('login screen is accessible', async () => {
  await render(<LoginScreen />);
  expect(screen.root).toBeAccessible();
});
```

- **Works with Expo (SDK 53+) and bare React Native.** No native code, no config plugin, no prebuild. It runs in Jest, not on a device.
- **Built for React 19 and React Native Testing Library v14.**
- **Adopt it on an existing app** with [baseline mode](#baseline-mode): record today's issues and fail only on new ones.
- **Replaces [react-native-accessibility-engine](https://github.com/aryella-lacerda/react-native-accessibility-engine)**, which no longer works with React 19. See the [migration guide](docs/migration.md).

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Rules](#rules)
- [Options](#options)
- [Baseline mode](#baseline-mode)
- [Ignoring third-party components](#ignoring-third-party-components)
- [Using audit() directly](#using-audit-directly)
- [Project reports and CLI](#project-reports-and-cli)
- [Limitations](#limitations)
- [Migrating from react-native-accessibility-engine](#migrating-from-react-native-accessibility-engine)
- [Contributing](#contributing)

## Requirements

| Package | Version |
| --- | --- |
| React | 19+ |
| React Native | 0.78+ (Expo SDK 53+) |
| @testing-library/react-native | 14+ |
| Jest | 29 or 30 |
| Node.js | ^22.13.0 or >=24 (required by RNTL v14) |

## Setup

```sh
npm install --save-dev react-native-accessibility-audit
```

Add it to `setupFilesAfterEnv` in your Jest config. This registers the `toBeAccessible()` matcher.

```js
// jest.config.js (Expo)
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['react-native-accessibility-audit'],
};
```

```js
// jest.config.js (bare React Native)
module.exports = {
  preset: '@react-native/jest-preset', // 'react-native' before RN 0.85
  setupFilesAfterEnv: ['react-native-accessibility-audit'],
};
```

### TypeScript

Jest loads the package at runtime, but TypeScript needs to be told about the matcher. Add the package to `types` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["jest", "react-native-accessibility-audit"]
  }
}
```

Or import it once from a setup file that TypeScript compiles: `import 'react-native-accessibility-audit';`.

## Usage

Pass anything that represents rendered output:

```tsx
import { render, screen } from '@testing-library/react-native';

test('settings screen', async () => {
  await render(<SettingsScreen />);

  expect(screen.root).toBeAccessible();                                 // whole screen
  expect(screen.getByRole('button', { name: 'Save' })).toBeAccessible(); // one element and its children
});

test('icon button', () => {
  expect(<IconButton icon="close" />).toBeAccessible();                  // a React element, rendered for you
});
```

React elements are rendered synchronously, audited, and unmounted again, so you don't need `render()` for small components.

When a check fails, the output names the rule, the element, the component that rendered it, and how to fix it:

```
expect(element).toBeAccessible()

Found 2 accessibility violations:

1. [interactive-label-required] Interactive element has no label or text, so screen readers can only announce its role.
   Element: Pressable → <View> role="button" testID="close" in Header
   Fix: Add accessibilityLabel (or aria-label), or render visible Text inside the element.

2. [state-required] Element with role "checkbox" does not expose a checked state.
   Element: Pressable → <View> role="checkbox" name="Remember me" in LoginForm
   Fix: Set accessibilityState={{ checked }} (or aria-checked) on checkboxes, radios, switches and toggle buttons; ...
```

Content hidden from screen readers on both platforms (`aria-hidden`, `display: 'none'`, or `accessibilityElementsHidden` together with `importantForAccessibility="no-hide-descendants"`) is not audited. Content hidden on only one platform still is, because the other platform's screen reader reads it.

## Rules

Errors fail the test. Warnings are printed but don't fail it, because they depend on layout and colors the test renderer can only partly see.

| Rule | Default | Checks that |
| --- | --- | --- |
| [interactive-role-required](docs/rules.md#interactive-role-required) | error | pressable elements have an interactive role such as `button` or `link` |
| [interactive-label-required](docs/rules.md#interactive-label-required) | error | pressable elements have a label or visible text |
| [input-label-required](docs/rules.md#input-label-required) | error | text inputs and sliders have a label (a placeholder isn't one) |
| [interactive-accessible-required](docs/rules.md#interactive-accessible-required) | error | pressable elements aren't hidden from screen readers with `accessible={false}` |
| [image-label-required](docs/rules.md#image-label-required) | error | images have a label or are marked as decorative |
| [no-nested-interactive](docs/rules.md#no-nested-interactive) | error | pressable elements aren't nested inside other pressable elements or `accessible` groups |
| [state-required](docs/rules.md#state-required) | error | checkboxes, radios and switches expose `checked`; sliders expose a value |
| [adjustable-role-required](docs/rules.md#adjustable-role-required) | error | controls with `increment` / `decrement` actions have an adjustable role, and native sliders keep theirs |
| [role-valid](docs/rules.md#role-valid) | error | `role` and `accessibilityRole` values are ones React Native supports |
| [accessibility-actions-valid](docs/rules.md#accessibility-actions-valid) | error | accessibility actions have names, labels for custom actions, and a handler |
| [link-role-misused](docs/rules.md#link-role-misused) | error | the `link` role is only used on something that can be pressed |
| [no-empty-text](docs/rules.md#no-empty-text) | error | `Text` elements aren't empty |
| [consistent-hiding](docs/rules.md#consistent-hiding) | error | content hidden from screen readers is hidden on both iOS and Android |
| [modal-hides-background](docs/rules.md#modal-hides-background) | error | content behind an `aria-modal` view is hidden from TalkBack and VoiceOver |
| [no-disabled-font-scaling](docs/rules.md#no-disabled-font-scaling) | error | text isn't prevented from growing with the system font size |
| [touch-target-size](docs/rules.md#touch-target-size) | warning | touch targets are at least 44×44 (when the size is set in styles) |
| [text-contrast](docs/rules.md#text-contrast) | warning | text, input text and placeholders meet WCAG AA contrast (when colors are set in styles) |
| [no-nested-text-link](docs/rules.md#no-nested-text-link) | warning | pressable text isn't nested inside a paragraph, where VoiceOver can't focus it |

Each rule's page has failing and passing examples.

### Supported components

The rules read host elements, so any component built on React Native's `View`, `Text`, `Image`, `TextInput`, `Pressable` or `Touchable*` is covered, including most UI kits. Libraries that render their own native elements are recognized explicitly:

| Library | Components |
| --- | --- |
| `expo-image` | `Image` |
| `expo-symbols` | `SymbolView` |
| `react-native-gesture-handler` | `RectButton`, `BorderlessButton`, `BaseButton`, `Pressable` |
| `@react-native-community/slider` | `Slider` |

For gesture-handler buttons, the role and label can be on the button or on an `accessible` child `View`, as gesture-handler's docs recommend. This applies to gesture-handler 3. gesture-handler 2's Jest setup mocks its buttons as React Native touchables, so they're checked as touchables, and the mock replaces an accessible child's role and label with the button's own.

## Options

Options can be set per call or for the whole project.

```tsx
expect(screen.root).toBeAccessible({
  rules: { 'touch-target-size': 'error', 'no-empty-text': 'off' },
  ignore: { components: ['MapView'] },
  minTouchTarget: 48,
});
```

```ts
// jest.setup.ts, listed in setupFilesAfterEnv
import { configure } from 'react-native-accessibility-audit';

configure({
  rules: { 'text-contrast': 'error' },
  ignore: { testIDs: [/^ad-/] },
});
```

| Option | Type | Description |
| --- | --- | --- |
| `rules` | `{ [ruleId]: 'error' \| 'warn' \| 'off' }` or `ruleId[]` | Change a rule's severity or turn it off. An array runs only the listed rules. Per-call settings override `configure()` rule by rule. |
| `ignore` | `{ testIDs?, components?, elements? }` | Skip parts of the tree. See [Ignoring third-party components](#ignoring-third-party-components). Per-call lists are added to the global ones. |
| `minTouchTarget` | `number` | Minimum size for `touch-target-size`. Default `44` (Apple HIG, WCAG 2.5.5). Use `48` for Material Design or `24` for the WCAG 2.2 AA minimum. |
| `baseline` | `string \| true` | Matcher only. Compare against a recorded baseline. See [Baseline mode](#baseline-mode). |
| `customViolationHandler` | `(violations) => violations` | Matcher only. Filter or inspect violations before pass/fail is decided. |

Unknown rule IDs throw an error, so a typo can't silently turn checking off.

## Baseline mode

Turning the matcher on in an existing app usually means dozens of failures on day one. Baseline mode records the current violations and fails only when new ones appear:

```tsx
test('checkout is not getting worse', async () => {
  await render(<CheckoutScreen />);
  expect(screen.root).toBeAccessible({ baseline: 'checkout' }); // or baseline: true to use the test name
});
```

Baselines are stored next to the test file in `__a11y_baselines__/<test file>.json`. Commit them. They're readable in code review:

```json
{
  "checkout": {
    "image-label-required: <Image> in ProductCard": 3,
    "interactive-label-required: Pressable → <View> testID=\"remove\" in CartRow": 1
  }
}
```

They follow Jest's snapshot rules:

| Command | No baseline yet | Baseline exists |
| --- | --- | --- |
| `jest` | Records it and passes | Fails on new violations. Fixed violations are removed from the file. |
| `jest -u` | Records it | Rewrites it to the current violations |
| `jest --ci` | Fails: baselines aren't written in CI | Fails on new violations. Never writes. |

Baselines only get stricter. Fixing a violation removes it from the baseline when you run Jest locally, so it can't come back. Violations are counted: if a baseline has 3 unlabelled images, a 4th one fails.

Each violation is identified by its rule, the element type, its role, `testID` and label, and the component that rendered it, not by its position in the tree. Moving things around doesn't break a baseline, but changing a button's label does: the old entry counts as fixed and the new one as new. Run `jest -u` to accept it.

Warnings are not part of baselines.

## Ignoring third-party components

Some components you can't fix, like a map, an ad, or a carousel from a library. Skip them and everything inside them:

```ts
configure({
  ignore: {
    components: ['MapView', /Carousel$/], // the component that rendered the element
    testIDs: ['ad-banner', /^promo-/],
    elements: (node) => node.props.nativeID === 'legacy-widget', // anything else
  },
});
```

`components` matches the component that directly rendered an element, using the component's `displayName` or function name.

## Using audit() directly

`audit()` returns the violations instead of asserting, for custom reporting:

```ts
import { audit, formatViolations } from 'react-native-accessibility-audit';

const violations = audit(screen.root, { rules: { 'text-contrast': 'off' } });
console.log(formatViolations(violations));
```

Each violation has `ruleId`, `severity`, `message`, `help` and `element` (the host element).

## Project reports and CLI

Test failures tell you about one screen at a time. To see every issue across the app, including ones covered by baselines and warnings that don't fail tests, add the reporter:

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['react-native-accessibility-audit'],
  reporters: [
    'default',
    ['react-native-accessibility-audit/reporter', { outputFile: 'a11y-report.json', markdownFile: 'a11y-report.md' }],
  ],
};
```

After each run it prints a summary and writes the report:

```
Accessibility: 13 errors, 2 warnings in 6 audits. Report: a11y-report.json
```

The report collects every `toBeAccessible()` call in the run. Issues are deduplicated when several tests render the same component, and sorted so the most urgent come first: errors, then baselined errors, then warnings, with controls (buttons, inputs, toggles) ahead of images and text. Each issue points at the line that rendered the element, so it's a to-do list you can work through:

```
$ npx react-native-accessibility-audit report

Accessibility: 13 errors, 2 warnings in 6 audits.

src/screens/LoginScreen.tsx
  37:7    error     input-label-required  Text input has only a placeholder ("Email"). ...
                    <TextInput> in BrokenLoginScreen
  41:7    error     interactive-label-required  Interactive element has no label or text, ...
                    Pressable → <View> in BrokenLoginScreen
  53:7    warning   text-contrast  Text contrast is 1.48:1 (#d4d4d4 on #ffffff), below 4.5:1.
                    <Text> name="Forgot password?" in BrokenLoginScreen
```

| Command | Does |
| --- | --- |
| `report [file]` | Prints a report. `--format text` (default), `markdown` (a checklist), `github` or `json`. `--fail-on error` or `warn` exits with 1. |
| `report --format github` | Prints [GitHub Actions annotations](https://docs.github.com/actions/reference/workflow-commands-for-github-actions), which show the issues inline on the pull request. Add `--include-baselined` to show baselined issues as notices. |
| `baselines [dir]` | Lists everything recorded in `__a11y_baselines__` files: your known accessibility debt. Doesn't need a test run. `--format text`, `markdown` or `json`. |

In GitHub Actions:

```yaml
- run: npx jest --ci
- run: npx react-native-accessibility-audit report --format github
  if: always()
```

Reporter options: `outputFile` (default `a11y-report.json`, relative to Jest's `rootDir`), `markdownFile` (optional), `summary` (default `true`). Audits using `.not.toBeAccessible()` aren't recorded, since those tests expect violations. Source locations need React 19.1 or later in its development build, which Jest uses by default. With React 19.0, issues are reported without a file and line.

`buildReport()`, `formatText()`, `formatMarkdown()` and `formatGithub()` are exported for custom tooling, along with the `Report` type. The JSON has a `version` field, currently `1`.

## Limitations

The library checks the tree React Native Testing Library renders in Node. That's fast and works in any CI, but it's not a device:

- **No layout.** `touch-target-size` uses numeric `width`/`height`/`minWidth`/`minHeight` and `hitSlop` from styles. Elements sized by flexbox, padding, or percentages are skipped, not guessed.
- **Colors only from styles.** `text-contrast` needs a text color on the `Text` (or an enclosing `Text`) and an opaque `backgroundColor` on an ancestor. Default text colors, `PlatformColor`, images and gradients behind text are not checked. Text on an `ImageBackground` with a background color behind it can give a false warning.
- **Mocked native components.** Jest presets mock native views, so components that render native UI (maps, video, `@expo/ui`) expose only the props passed to the mock.
- **Component names use a React internal.** The "in LoginScreen" part of messages and `ignore.components` read React's fiber through test-renderer's `unstable_fiber`. If a future React version changes it, messages lose component names and `ignore.components` stops matching. Nothing crashes, and the rules themselves don't depend on it.

### What needs a device

Some of the most common accessibility bugs in React Native apps can't be seen in a rendered tree. Test these with VoiceOver and TalkBack:

- **Focus order**: the order the screen reader moves through elements, especially in grids, rows and absolutely positioned layouts.
- **Focus after navigation**: where focus lands after a screen change, and whether the previous screen is still announced.
- **Text at large sizes**: whether layouts clip or overlap at the largest Dynamic Type and font scale settings. `no-disabled-font-scaling` only checks that scaling isn't turned off.
- **Reduce Motion**: whether animations respect the setting, and whether content still appears with it on.
- **Announcements**: whether toasts, loading states and form errors are announced (`accessibilityLiveRegion`, `AccessibilityInfo.announceForAccessibility`).
- **Bugs in React Native or native libraries**, where the props are correct but a platform doesn't honor them.

The library catches the common, mechanical mistakes before they ship. It doesn't replace testing with the screen readers themselves.

## Migrating from react-native-accessibility-engine

For most projects it's a dependency swap:

```diff
- "setupFilesAfterEnv": ["react-native-accessibility-engine"]
+ "setupFilesAfterEnv": ["react-native-accessibility-audit"]
```

`toBeAccessible()`, passing React elements, the `rules` array, the old rule IDs, `customViolationHandler` and the `__A11Y_RULES__` / `__CUSTOM_VIOLATION_HANDLER__` globals all still work. You'll need React 19 and React Native Testing Library v14. The new rules find more issues than the old ones; use [baseline mode](#baseline-mode) to adopt them gradually.

See the full [migration guide](docs/migration.md).

## Contributing

```sh
npm install       # also builds the library
npm test          # library tests
npm run typecheck

cd example        # Expo app using the library through jest-expo
npm install
npm test
```

The example app's `BrokenLoginScreen` has one example of each kind of issue the rules catch.

## License

MIT
