# Migrating from react-native-accessibility-engine

`react-native-accessibility-engine` was last released in November 2022 (v3.2.0). It is built on `react-test-renderer`, which React 19 deprecates, and fails on React 19 with errors like `Can't access .root on unmounted test renderer`.

This library keeps its API where it can, so most projects only change the dependency.

## 1. Check requirements

| | react-native-accessibility-engine | react-native-accessibility-audit |
| --- | --- | --- |
| React | up to 18 | 19+ |
| React Native | any | 0.78+ (Expo SDK 53+) |
| Renderer | react-test-renderer | @testing-library/react-native v14 |

If you're still on React 18, upgrade React and React Native Testing Library first. RNTL v14 makes `render()` async, so existing `render()` calls need `await`. See the [RNTL v14 migration guide](https://callstack.github.io/react-native-testing-library/).

## 2. Swap the package

```sh
npm uninstall react-native-accessibility-engine
npm install --save-dev react-native-accessibility-audit
```

```diff
  // jest.config.js
  setupFilesAfterEnv: [
-   'react-native-accessibility-engine',
+   'react-native-accessibility-audit',
  ],
```

If you used the 1.x path `react-native-accessibility-engine/lib/commonjs/extend-expect`, replace it the same way.

For TypeScript, replace `import 'react-native-accessibility-engine'` in your setup file with `import 'react-native-accessibility-audit'`, or add the package to `types` in `tsconfig.json`.

## 3. What keeps working

| react-native-accessibility-engine | Status |
| --- | --- |
| `expect(<Component />).toBeAccessible()` | Works. The element is rendered, audited and unmounted. |
| `expect(getByRole('button')).toBeAccessible()` (RNTL) | Works. Add `await` to the `render()` call for RNTL v14. |
| `expect(render(<C />).toJSON()).toBeAccessible()` | Works. Messages can't name components for JSON input; pass `screen.root` to get them. |
| `toBeAccessible({ rules: ['no-empty-text'] })` | Works. An array still means "run only these rules". |
| `toBeAccessible({ customViolationHandler })` | Works. |
| `global.__A11Y_RULES__` / Jest `globals: { __A11Y_RULES__ }` | Works. |
| `global.__CUSTOM_VIOLATION_HANDLER__` | Works. |
| `expect(TestRenderer.create(<C />).root).toBeAccessible()` | **Not supported.** Throws an error that explains the fix. Use RNTL's `render()` and pass `screen.root`, or pass the element itself. |

## 4. Rule IDs

Old rule IDs are accepted in `rules` and mapped to the new rules. Unknown IDs throw, so typos don't silently turn a rule off.

| Old ID | New rule |
| --- | --- |
| `pressable-role-required` | `interactive-role-required` |
| `link-role-required` | `interactive-role-required` (text with `onPress` needs a role) |
| `pressable-label-required` | `interactive-label-required` |
| `pressable-accessible-required` | `interactive-accessible-required` |
| `checked-state-required` | `state-required` |
| `adjustable-value-required` | `state-required` |
| `adjustable-role-required` | `adjustable-role-required` (narrower; see below) |
| `link-role-misused` | `link-role-misused` |
| `no-empty-text` | `no-empty-text` |
| `disabled-state-required` | Accepted, does nothing: React Native's pressables expose `disabled` themselves |

Because several old IDs map to one new rule, enabling one of them enables the whole new rule. For example, `rules: ['checked-state-required']` also checks slider values.

`adjustable-role-required` changed behavior. The old rule required `accessibilityRole="adjustable"` on every `Slider`. Native sliders are already adjustable on iOS and Android, so they now need no role, and only a conflicting role (such as `button`) is reported. Instead, the rule now checks custom controls that expose `increment` / `decrement` actions. Tests that expected a failure for a role-less `Slider` will pass now.

## 5. Expect more findings

The new rules catch issues the old engine didn't:

- `input-label-required`: text inputs and sliders without a label, including inputs that only have a placeholder
- `image-label-required`: images that are neither labelled nor marked decorative
- `no-nested-interactive`: buttons inside buttons
- `role-valid`, `accessibility-actions-valid`, `consistent-hiding`, `modal-hides-background` and `no-disabled-font-scaling`: mistakes the old engine didn't look for
- `touch-target-size`, `text-contrast` and `no-nested-text-link`: printed as warnings, don't fail tests

Detection is also broader. Any element that handles presses is checked, not only the components the old engine recognized by name. And `aria-labelledby` / `accessibilityLabelledBy` alone no longer count as a label, because React Native supports them only on Android.

If switching produces a wall of failures, use baseline mode on the affected tests. It records today's violations and fails only on new ones:

```tsx
expect(screen.root).toBeAccessible({ baseline: true });
```

Then fix the recorded issues over time. See [Baseline mode](../README.md#baseline-mode).

## 6. Excluding components

The old engine had no way to skip third-party components ([issue #145](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/145)). Now:

```ts
import { configure } from 'react-native-accessibility-audit';

configure({ ignore: { components: ['MapView'], testIDs: ['ad-banner'] } });
```

## Fixed issues from react-native-accessibility-engine

| Issue | Status here |
| --- | --- |
| [#317](https://github.com/aryella-lacerda/react-native-accessibility-engine/pull/317) React 19 / unmounted test renderer | Built on RNTL v14 and test-renderer |
| [#315](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/315) Jest can't exit (open handle) | Importing the package loads no renderer. test-renderer is loaded only when you pass a React element, and that element is unmounted after the audit. |
| [#105](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/105) Audit `toJSON()` output | Supported, including rules that look at parent elements |
| [#128](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/128), [#314](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/314) Radio and checkbox roles rejected on Pressables | Any interactive role is accepted; `state-required` checks that radios and checkboxes expose `checked` |
| [#256](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/256) Role set on a custom component still reported, with a confusing path | Messages name the component that rendered the Pressable (e.g. `in StyledTag`), which shows where the role needs to be forwarded |
| [#257](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/257) Crash from a bundled react-test-renderer version | No renderer is bundled; test-renderer is loaded from your project |
| [#145](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/145) Exclude third-party components | `ignore` option |
| [#255](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/255) CLI listing components without accessibility, clickable first | Jest reporter and `report` / `baselines` CLI commands, with file and line for each issue |
| [#258](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/258) Label rule doesn't find text in nested views | Text is read from the whole rendered subtree, including nested `accessible` views and labelled images |
| [#307](https://github.com/aryella-lacerda/react-native-accessibility-engine/issues/307) `tab` role rejected; carousels required a disabled state | Any interactive role is accepted; there is no disabled-state rule, and slides hidden with `accessibilityElementsHidden` / `importantForAccessibility` are skipped |

The cases from #105, #128, #256, #258, #307 and #314 are regression tests in `src/__tests__/migration.test.tsx`, built from the code in each issue.
