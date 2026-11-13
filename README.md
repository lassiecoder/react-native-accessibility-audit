# react-native-accessibility-audit

Accessibility audits for React Native and Expo tests: think `jest-axe`, built for React Native's tree instead of the DOM. Render a screen, call one matcher, and the test fails if the screen has accessibility problems: missing labels, missing roles, unlabelled images, nested buttons and more.

```tsx
test('login screen is accessible', async () => {
  await render(<LoginScreen />);
  expect(screen.root).toBeAccessible();
});
```

- **Works with Expo (SDK 53+) and bare React Native.** No native code, no config plugin, no prebuild. It runs in Jest, not on a device.
- **Built for React 19 and React Native Testing Library v14.**
- **Adopt it on an existing app** with [baseline mode](#baseline-mode): record today's issues and fail only on new ones.
- **Mapped to WCAG 2.2 and EN 301 549**, the standard behind the European Accessibility Act. Every failure names the criterion it breaks. See [Standards](#standards-wcag-22-and-en-301-549).
- **Project-wide view**: a [Jest reporter](#project-reports-and-cli) with file and line for every issue, a [static scan](#static-scan) that also finds screens no test covers, a [GitHub Action](#github-action) that comments on pull requests, and an [agent skill](#ai-coding-agents) so Claude Code, Codex or Cursor can fix issues the way the rules expect.
- **Replaces [react-native-accessibility-engine](https://github.com/aryella-lacerda/react-native-accessibility-engine)**, which no longer works with React 19. See the [migration guide](docs/migration.md).

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Rules](#rules)
- [Options](#options)
- [Standards: WCAG 2.2 and EN 301 549](#standards-wcag-22-and-en-301-549)
- [Baseline mode](#baseline-mode)
- [Ignoring third-party components](#ignoring-third-party-components)
- [Using audit() directly](#using-audit-directly)
- [Project reports and CLI](#project-reports-and-cli)
- [Static scan](#static-scan)
- [GitHub Action](#github-action)
- [AI coding agents](#ai-coding-agents)
- [Limitations](#limitations)
- [How it compares](#how-it-compares)
- [Migrating from react-native-accessibility-engine](#migrating-from-react-native-accessibility-engine)
- [Versioning](#versioning)
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

React elements are rendered synchronously, audited, and unmounted again, so you don't need `render()` for small components. Effects run before the audit, but asynchronous work (data fetching, timers, images loading) isn't awaited. For screens that settle asynchronously, render them with `render()`, wait with `await screen.findBy…`, then audit `screen.root`.

`render(...).toJSON()` output is accepted too, for tests written for react-native-accessibility-engine. JSON snapshots don't record which component rendered an element, so failure messages and reports can't include component names or source locations; pass `screen.root` to get them.

When a check fails, the output names the rule, the element, the component that rendered it, and how to fix it:

```
expect(element).toBeAccessible()

Found 2 accessibility violations:

1. [interactive-label-required] Interactive element has no label or text, so screen readers can only announce its role.
   Element: Pressable → <View> role="button" testID="close" in Header
   Fix: Add accessibilityLabel (or aria-label), or render visible Text inside the element.
   Standard: WCAG 4.1.2 Name, Role, Value (A) · EN 301 549 11.4.1.2
   Docs: https://github.com/lassiecoder/react-native-accessibility-audit/blob/main/docs/rules.md#interactive-label-required

2. [state-required] Element with role "checkbox" does not expose a checked state.
   Element: Pressable → <View> role="checkbox" name="Remember me" in LoginForm
   Fix: Set accessibilityState={{ checked }} (or aria-checked) on checkboxes, radios, switches and toggle buttons; ...
   Standard: WCAG 4.1.2 Name, Role, Value (A) · EN 301 549 11.4.1.2
```

Content hidden from screen readers on both platforms (`aria-hidden`, `display: 'none'`, or `accessibilityElementsHidden` together with `importantForAccessibility="no-hide-descendants"`) is not audited. Content hidden on only one platform still is, because the other platform's screen reader reads it.

## Rules

Errors fail the test. Warnings are printed but don't fail it, because they depend on layout and colors the test renderer can only partly see.

| Rule | Default | Checks that | WCAG 2.2 |
| --- | --- | --- | --- |
| [interactive-role-required](docs/rules.md#interactive-role-required) | error | pressable elements have an interactive role such as `button` or `link` | 4.1.2 |
| [interactive-label-required](docs/rules.md#interactive-label-required) | error | pressable elements have a label or visible text | 4.1.2 |
| [input-label-required](docs/rules.md#input-label-required) | error | text inputs and sliders have a label (a placeholder isn't one) | 3.3.2, 4.1.2 |
| [interactive-accessible-required](docs/rules.md#interactive-accessible-required) | error | pressable elements aren't hidden from screen readers with `accessible={false}` | 2.1.1, 4.1.2 |
| [image-label-required](docs/rules.md#image-label-required) | error | images have a label or are marked as decorative | 1.1.1 |
| [no-nested-interactive](docs/rules.md#no-nested-interactive) | error | pressable elements aren't nested inside other pressable elements or `accessible` groups | 2.1.1, 4.1.2 |
| [state-required](docs/rules.md#state-required) | error | checkboxes, radios and switches expose `checked`; sliders expose a value | 4.1.2 |
| [adjustable-role-required](docs/rules.md#adjustable-role-required) | error | controls with `increment` / `decrement` actions have an adjustable role, and native sliders keep theirs | 2.1.1, 4.1.2 |
| [role-valid](docs/rules.md#role-valid) | error | `role` and `accessibilityRole` values are ones React Native supports | 4.1.2 |
| [accessibility-actions-valid](docs/rules.md#accessibility-actions-valid) | error | accessibility actions have names, labels for custom actions, and a handler | 2.1.1, 4.1.2 |
| [link-role-misused](docs/rules.md#link-role-misused) | error | the `link` role is only used on something that can be pressed | 4.1.2 |
| [no-empty-text](docs/rules.md#no-empty-text) | error | `Text` elements aren't empty | best practice |
| [consistent-hiding](docs/rules.md#consistent-hiding) | error | content hidden from screen readers is hidden on both iOS and Android | 1.3.1 |
| [modal-hides-background](docs/rules.md#modal-hides-background) | error | content behind an `aria-modal` view is hidden from TalkBack and VoiceOver | 1.3.1, 2.4.3 |
| [no-disabled-font-scaling](docs/rules.md#no-disabled-font-scaling) | error | text isn't prevented from growing with the system font size | 1.4.4 |
| [touch-target-size](docs/rules.md#touch-target-size) | warning | touch targets are at least 44×44 (when the size is set in styles) | 2.5.8 |
| [text-contrast](docs/rules.md#text-contrast) | warning | text, input text and placeholders meet WCAG AA contrast (when colors are set in styles) | 1.4.3 |
| [no-nested-text-link](docs/rules.md#no-nested-text-link) | warning | pressable text isn't nested inside a paragraph, where VoiceOver can't focus it | 2.1.1, 4.1.2 |

Each rule's page has failing and passing examples.

### Supported components

The rules read host elements, so any component built on React Native's `View`, `Text`, `Image`, `TextInput`, `Pressable` or `Touchable*` is covered, including most UI kits. Libraries that render their own native elements are recognized explicitly:

| Library | Components |
| --- | --- |
| `expo-image` | `Image` |
| `expo-symbols` | `SymbolView` |
| `react-native-gesture-handler` | `RectButton`, `BorderlessButton`, `BaseButton`, `Pressable` |
| `@react-native-community/slider` | `Slider` |

### Issues inside libraries

Screens are usually tested inside navigators, providers and UI kits, and those render elements of their own. When an issue comes from a library's code rather than yours, the message says so, names the component of yours that used it, and tells you how to deal with it:

```
1. [interactive-role-required] Interactive element has no role.
   Element: TouchableWithoutFeedback → <View> name="Size" in SizePicker, rendered by react-native-element-dropdown
   Fix: Add accessibilityRole (or role), e.g. "button" or "link", so screen readers announce what the element does.
   Library: Rendered by react-native-element-dropdown. Fix it through the library's props or theme, report it upstream, or skip the library's own elements with ignore: { packages: ['react-native-element-dropdown'] }.
```

These are real issues for your users, so they're reported by default. The example app's tests run screens inside React Navigation 7 (native stack and bottom tabs) and check that the navigators themselves cause no errors; the only findings are contrast warnings on the default tab bar colors, attributed to `@react-navigation/*`. Attribution needs React 19.1 or later.

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
| `ignore` | `{ testIDs?, components?, packages?, elements? }` | Skip parts of the tree. See [Ignoring third-party components](#ignoring-third-party-components). Per-call lists are added to the global ones. |
| `minTouchTarget` | `number` | Minimum size for `touch-target-size`. Default `44` (Apple HIG, WCAG 2.5.5). Use `48` for Material Design or `24` for the WCAG 2.2 AA minimum. |
| `baseline` | `string \| true` | Matcher only. Compare against a recorded baseline. See [Baseline mode](#baseline-mode). |
| `customViolationHandler` | `(violations) => violations` | Matcher only. Filter or inspect violations before pass/fail is decided. |

Unknown rule IDs throw an error, so a typo can't silently turn checking off.

## Standards: WCAG 2.2 and EN 301 549

Each rule lists the [WCAG 2.2](https://www.w3.org/TR/WCAG22/) success criteria it checks, and failures, reports and annotations show them:

```
Standard: WCAG 3.3.2 Labels or Instructions (A); 4.1.2 Name, Role, Value (A) · EN 301 549 11.3.3.2, 11.4.1.2
```

[EN 301 549](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/) is the European standard the European Accessibility Act relies on. For native apps it applies WCAG through its software chapter, clause 11, numbered after the WCAG criterion (`11.` + `4.1.2`). V4.1.1, published in September 2026, is based on WCAG 2.2 and adds criteria such as 2.5.8 Target Size; V3.2.1 is based on WCAG 2.1 and doesn't include 2.5.8.

The report's `byCriterion` lists issues per criterion, and the Markdown report includes it as a table, which is a useful starting point for an accessibility statement or audit.

Passing every rule doesn't make an app conform. Automated checks cover the parts of WCAG that are visible in a component tree; conformance also needs manual testing with VoiceOver and TalkBack (see [What needs a device](#what-needs-a-device)). The criteria are exported for your own tooling: `CRITERIA`, `describeCriteria()`, `enClause()` and `criterionUrl()`, and each rule in `rules` has a `wcag` array.

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
    packages: ['react-native-maps', /^@acme\//], // elements an npm package renders
    components: ['MapView', /Carousel$/],     // the component that rendered the element
    testIDs: ['ad-banner', /^promo-/],
    elements: (node) => node.props.nativeID === 'legacy-widget', // anything else
  },
});
```

`packages` skips the elements a library's own code renders, but keeps auditing what you pass into it. For a carousel, the carousel's own buttons and wrappers are skipped, and your slides are still checked. It works out which package created an element from React's element creation stacks, so it needs React 19.1 or later (Jest uses the development build, which has them).

`components` matches the component that directly rendered an element, using the component's `displayName` or function name, and skips that element and everything inside it. `testIDs` and `elements` also skip the whole subtree.

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
| `scan [dir]` | [Static scan](#static-scan) of source files, plus component files no test audits. `--format text`, `markdown`, `github` or `json`; `--fail-on`; `--report`. |
| `baselines [dir]` | Lists everything recorded in `__a11y_baselines__` files: your known accessibility debt. Doesn't need a test run. `--format text`, `markdown` or `json`. |
| `skill [dir]` | Installs the [agent skill](#ai-coding-agents) into `.claude/skills` (or `dir`). |

In GitHub Actions:

```yaml
- run: npx jest --ci
- run: npx react-native-accessibility-audit report --format github
  if: always()
```

Reporter options: `outputFile` (default `a11y-report.json`, relative to Jest's `rootDir`), `markdownFile` (optional), `summary` (default `true`). Audits using `.not.toBeAccessible()` aren't recorded, since those tests expect violations. Source locations need React 19.1 or later in its development build, which Jest uses by default. With React 19.0, issues are reported without a file and line.

`buildReport()`, `formatText()`, `formatMarkdown()` and `formatGithub()` are exported for custom tooling, along with the `Report` type. The JSON has a `version` field, currently `1`. Besides `issues`, it has `byRule`, `byCriterion` (issues per WCAG criterion, with the EN 301 549 clause) and `coverage.files`: the source files your audited trees were rendered from.

## Static scan

The tests only see screens that have a test. `scan` reads your source files directly, without running anything:

```
$ npx react-native-accessibility-audit scan

Static accessibility scan: 5 issues in 42 files, 3 component files not audited by any test.

src/screens/LoginScreen.tsx
  41:7    error     interactive-role-required  Interactive element has no role.
                    <Pressable> in BrokenLoginScreen
                    WCAG 4.1.2

Not audited by any toBeAccessible() test:
  src/screens/ProfileScreen.tsx
  src/screens/SettingsScreen.tsx
  src/components/PromoBanner.tsx
```

It finds what JSX alone shows: pressables without a role or label, icon-only buttons, unlabelled images, inputs with only a placeholder, empty `Text`, invalid roles and disabled font scaling. It checks `Pressable`, `Touchable*`, `Text`, `Image` and `TextInput` from `react-native`, gesture-handler buttons, `expo-image` and `expo-symbols`, and only when they're imported from those packages. It is deliberately conservative: elements with spread props, children computed at runtime, and your own components are skipped, not guessed. That makes the scan quiet, not complete. The tests remain the source of truth.

The "not audited" list needs a report from the Jest [reporter](#project-reports-and-cli) (`a11y-report.json` in the current directory, or `--report <file>`), recorded with React 19.1 or later. Run `scan` from the directory Jest runs in. It's the quickest way to see where to add `toBeAccessible()` tests next.

Test files, stories, `__tests__`, `__mocks__`, `node_modules` and native folders are skipped. To silence a false positive, put `// a11y-audit-ignore-next-line` (or `{/* a11y-audit-ignore-next-line */}` in JSX) on the line before the element. `scanSource()` and `scanProject()` are available from `react-native-accessibility-audit/scan`.

## GitHub Action

The package is also a GitHub Action. After your tests, it annotates the pull request with each issue, writes the report and static scan to the job summary, and keeps one summary comment on the pull request up to date:

```yaml
permissions:
  contents: read
  pull-requests: write # for the comment

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 24, cache: npm }
  - run: npm ci
  - run: npx jest --ci
  - uses: lassiecoder/react-native-accessibility-audit@v0.1.0
    if: always()
    with:
      fail-on: error # optional: also fail this step on unbaselined errors
```

It runs the version installed in your project, so the reporter must be enabled. Inputs: `report` (default `a11y-report.json`), `working-directory`, `fail-on` (`error`, `warn` or `none`), `include-baselined`, `scan` (default `true`), `comment` (default `true`) and `github-token`. Outputs: `errors` and `warnings`. Pin the action to the same version as the package.

## AI coding agents

The package ships an [Agent Skill](https://agentskills.io) that teaches coding agents (Claude Code, Codex, Cursor and others that read skills) how to set up the matcher, read its failures, and fix each rule properly, for example by forwarding a role from a shared button component instead of turning the rule off:

```sh
npx react-native-accessibility-audit skill              # installs to .claude/skills/
npx react-native-accessibility-audit skill .agents/skills
```

Commit the installed file so everyone's agent uses it. The skill tells agents never to make a failing test pass by disabling rules, ignoring elements, hiding content or accepting a baseline unless you ask, and to mention what still needs testing on a device.

## Limitations

The library checks the tree React Native Testing Library renders in Node. That's fast and works in any CI, but it's not a device:

- **No layout.** `touch-target-size` uses numeric `width`/`height`/`minWidth`/`minHeight` and `hitSlop` from styles. Elements sized by flexbox, padding, or percentages are skipped, not guessed.
- **Colors only from styles.** `text-contrast` needs a text color on the `Text` (or an enclosing `Text`) and an opaque `backgroundColor` on an ancestor. Default text colors, `PlatformColor`, images and gradients behind text are not checked. Text on an `ImageBackground` with a background color behind it can give a false warning.
- **Mocked native components.** Jest presets mock native views, so components that render native UI (maps, video, `@expo/ui`) expose only the props passed to the mock.
- **Component names and locations use React internals.** The "in LoginScreen" part of messages, `ignore.components`, `ignore.packages`, source locations and coverage read React's fiber through test-renderer's `unstable_fiber`, and its element creation stacks. If a future React version changes them, these degrade (no names, no locations, nothing ignored by package). Nothing crashes, and the rules themselves don't depend on them.
- **The static scan sees JSX, not values.** It skips anything decided at runtime, so it complements the tests rather than replacing them.

### What needs a device

Some of the most common accessibility bugs in React Native apps can't be seen in a rendered tree. Test these with VoiceOver and TalkBack:

- **Focus order**: the order the screen reader moves through elements, especially in grids, rows and absolutely positioned layouts.
- **Focus after navigation**: where focus lands after a screen change, and whether the previous screen is still announced.
- **Text at large sizes**: whether layouts clip or overlap at the largest Dynamic Type and font scale settings. `no-disabled-font-scaling` only checks that scaling isn't turned off.
- **Reduce Motion**: whether animations respect the setting, and whether content still appears with it on.
- **Announcements**: whether toasts, loading states and form errors are announced (`accessibilityLiveRegion`, `AccessibilityInfo.announceForAccessibility`).
- **Bugs in React Native or native libraries**, where the props are correct but a platform doesn't honor them.

The library catches the common, mechanical mistakes before they ship. It doesn't replace testing with the screen readers themselves.

## How it compares

| | This package | [eslint-plugin-react-native-a11y](https://github.com/FormidableLabs/eslint-plugin-react-native-a11y) | react-native-accessibility-engine | Device tools (Appium, Accessibility Inspector, Accessibility Scanner) |
| --- | --- | --- | --- | --- |
| Runs | Jest, plus a static `scan` | ESLint | Jest | On a device or simulator |
| Sees | The rendered tree: props after your components and libraries ran | JSX as written | The rendered tree | The real app |
| React 19 / RNTL v14 | Yes | n/a | No | n/a |
| Labels from child text, wrapper components, spread props | Yes | Partly, from JSX | Yes | Yes |
| Third-party libraries | Reported with the library named; `ignore.packages` | Can't see inside them | No ignore option | Yes |
| Adopting on an existing app | Baselines, warnings, per-rule severity | Per-rule severity | All rules, one matcher | Manual triage |
| WCAG / EN 301 549 references | Every rule | No | No | Varies |
| Focus order, announcements, real layout | No (see [Limitations](#limitations)) | No | No | Yes |

They complement each other: lint while typing, this package in every test run and pull request, and a screen reader before release.

## Migrating from react-native-accessibility-engine

For most projects it's a dependency swap:

```diff
- "setupFilesAfterEnv": ["react-native-accessibility-engine"]
+ "setupFilesAfterEnv": ["react-native-accessibility-audit"]
```

`toBeAccessible()`, passing React elements, the `rules` array, the old rule IDs, `customViolationHandler` and the `__A11Y_RULES__` / `__CUSTOM_VIOLATION_HANDLER__` globals all still work. You'll need React 19 and React Native Testing Library v14. The new rules find more issues than the old ones; use [baseline mode](#baseline-mode) to adopt them gradually.

See the full [migration guide](docs/migration.md).

## Versioning

The package follows [Semantic Versioning](https://semver.org/). It's in initial development (`0.x`), and npm's default `^` range keeps you on the same minor version: `^0.1.0` installs `0.1.x` updates but not `0.2.0`.

For an accessibility checker, a release that finds more problems can fail tests that passed before. So changes are released like this:

| Release | Contains | Can a passing test start failing? |
| --- | --- | --- |
| Patch (`0.1.x`) | Bug fixes, fewer false positives, clearer messages, docs | No |
| Minor (`0.x.0`) | New rules, stricter rules, changed defaults, API changes, baseline or report format changes, dropped React / React Native / Jest / Node versions | Yes. Read the changelog before upgrading. |

Baselines are part of that contract: a change to how violations are identified would invalidate every recorded baseline, so it only happens in a minor release and is called out in the [changelog](CHANGELOG.md). Version 1.0.0 will follow once the rules and options have settled with real-world use. From then on, changes that can fail a passing test will be major releases.

## Contributing

```sh
npm install       # also builds the library
npm test          # library tests
npm run typecheck

cd example        # Expo app using the library through jest-expo
npm install
npm test
```

The example app's `BrokenLoginScreen` has one example of each kind of issue the rules catch. `npx react-native-accessibility-audit scan` in `example/` shows the static scan on it.

## License

MIT
