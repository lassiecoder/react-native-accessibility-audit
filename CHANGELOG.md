# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/) as described in [Versioning](README.md#versioning).

## Unreleased

## 0.1.0 - 2026-11-14

First release.

### Matcher

- `toBeAccessible()` Jest matcher for React Native Testing Library v14 and React 19.
- Accepts `screen.root`, `screen.container`, query results, `render()` results, or a React element (rendered synchronously and unmounted after the audit).
- Failure output names the rule, the element, the React Native component and the user component that rendered it, how to fix it, and the WCAG 2.2 criterion and EN 301 549 clause it breaks.
- Elements rendered by a library's own code (a navigator's tab bar, a dropdown's trigger) are reported with the library's name, the app component that used it, and an `ignore.packages` suggestion. Component names follow React's owner chain, so providers and navigators around a screen don't hide the component to fix.
- Each failure links to the rule's documentation.
- `audit()` and `formatViolations()` for custom reporting.

### Rules

- Errors: `interactive-role-required`, `interactive-label-required`, `input-label-required`, `interactive-accessible-required`, `image-label-required`, `no-nested-interactive`, `state-required`, `adjustable-role-required`, `role-valid`, `accessibility-actions-valid`, `link-role-misused`, `no-empty-text`, `consistent-hiding`, `modal-hides-background`, `no-disabled-font-scaling`.
- Warnings: `touch-target-size` (`minTouchTarget` option, default 44), `text-contrast` (WCAG AA, including `TextInput` placeholders and input text) and `no-nested-text-link`. The first two are checked only when sizes and colors are known from styles.
- Hiding is platform-aware: `accessibilityElementsHidden` (iOS) and `importantForAccessibility` (Android) each hide on one platform only, so content hidden with just one of them is still audited and reported by `consistent-hiding`.
- `aria-labelledby` / `accessibilityLabelledBy` alone don't count as a label (Android-only in React Native); the failure message says so.
- `no-nested-interactive` also reports controls inside `accessible={true}` groups, which VoiceOver can't reach.
- `modal-hides-background` treats React Native's `Modal` as its own window, so `accessibilityViewIsModal` inside a `Modal` isn't reported.
- `adjustable-role-required` checks custom controls with `increment` / `decrement` actions and conflicting roles on native sliders. Native sliders without a role pass, unlike in react-native-accessibility-engine.
- Every rule maps to WCAG 2.2 success criteria (`rule.wcag`, `violation.wcag`) and, through them, to EN 301 549 clause 11. `CRITERIA`, `describeCriteria()`, `enClause()` and `criterionUrl()` are exported.
- Recognizes `expo-image`, `expo-symbols`, `react-native-gesture-handler` buttons (including the accessible-child pattern) and `@react-native-community/slider`; messages name the library component.

### Configuration

- Per-call options and project-wide `configure()`: rule severities, ignore lists, `minTouchTarget`.
- `ignore` by component name, `testID` or predicate, for third-party components, and by npm package (`ignore.packages`), which skips a library's own elements but still audits content passed into it.
- Baseline mode: `toBeAccessible({ baseline })` records violations in `__a11y_baselines__/` and fails only on new ones. Follows Jest's snapshot modes (`-u`, `--ci`) and tightens automatically as violations are fixed.

### Reports and CLI

- Jest reporter (`react-native-accessibility-audit/reporter`) collects every `toBeAccessible()` result in a run into `a11y-report.json` (and optionally Markdown): deduplicated, prioritized, with the source file and line of each element.
- Reports include issues per WCAG criterion (`byCriterion`, with EN 301 549 clauses) and coverage: the source files each audit rendered.
- CLI: `report` prints a report as text, a Markdown checklist, GitHub Actions annotations or JSON, with `--fail-on`; `baselines` lists the violations recorded in baseline files.
- CLI: `scan` checks source files without running tests (pressables without a role or label, icon-only buttons, unlabelled images, placeholder-only inputs, empty text, invalid roles, disabled font scaling) and, with a reporter run, lists component files no test audits. `scanSource()` / `scanProject()` from `react-native-accessibility-audit/scan`.

### GitHub Action and AI agents

- GitHub Action (`uses: lassiecoder/react-native-accessibility-audit@v0.1.0`): pull request annotations, job summary, an updated summary comment, optional `fail-on`.
- Agent Skill for coding agents (Claude Code, Codex, Cursor and others), installed with `npx react-native-accessibility-audit skill`.

### react-native-accessibility-engine compatibility

- Same `setupFilesAfterEnv` setup and matcher name.
- `rules` array form and the engine's rule IDs; unknown IDs throw.
- `customViolationHandler` option, `__A11Y_RULES__` and `__CUSTOM_VIOLATION_HANDLER__` globals.
- Clear error when given a react-test-renderer tree.
- `render(...).toJSON()` output is accepted (react-native-accessibility-engine#105), rebuilt with parent links so every rule works.
