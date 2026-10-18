# Changelog

## Unreleased

First release. Not yet published to npm.

### Matcher

- `toBeAccessible()` Jest matcher for React Native Testing Library v14 and React 19.
- Accepts `screen.root`, `screen.container`, query results, `render()` results, or a React element (rendered synchronously and unmounted after the audit).
- Failure output names the rule, the element, the React Native component and the user component that rendered it, and how to fix it.
- `audit()` and `formatViolations()` for custom reporting.

### Rules

- Errors: `interactive-role-required`, `interactive-label-required`, `input-label-required`, `interactive-accessible-required`, `image-label-required`, `no-nested-interactive`, `state-required`, `adjustable-role-required`, `link-role-misused`, `no-empty-text`.
- `input-label-required` checks `TextInput` and native sliders; a placeholder alone isn't a label.
- `aria-labelledby` / `accessibilityLabelledBy` alone don't count as a label (Android-only in React Native); the failure message says so.
- `adjustable-role-required` checks custom controls with `increment` / `decrement` actions and conflicting roles on native sliders. Native sliders without a role pass, unlike in react-native-accessibility-engine.
- Warnings: `touch-target-size` (`minTouchTarget` option, default 44) and `text-contrast` (WCAG AA), checked when sizes and colors are known from styles.

### Configuration

- Per-call options and project-wide `configure()`: rule severities, ignore lists, `minTouchTarget`.
- `ignore` by component name, `testID` or predicate, for third-party components.
- Baseline mode: `toBeAccessible({ baseline })` records violations in `__a11y_baselines__/` and fails only on new ones. Follows Jest's snapshot modes (`-u`, `--ci`) and tightens automatically as violations are fixed.

### react-native-accessibility-engine compatibility

- Same `setupFilesAfterEnv` setup and matcher name.
- `rules` array form and the engine's rule IDs; unknown IDs throw.
- `customViolationHandler` option, `__A11Y_RULES__` and `__CUSTOM_VIOLATION_HANDLER__` globals.
- Clear error when given a react-test-renderer tree.
