import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { main } from '../cli';
import { readRecords, REPORT_DIR_ENV, type AuditRecord } from '../collector';
import { buildReport, formatGithub, formatMarkdown, formatText } from '../report';
import AccessibilityReporter from '../reporter';
import { sourceLocation } from '../source';
import { toBeAccessible } from '../matcher';
import { ProbeScreen } from '../__fixtures__/ProbeScreen';

const fixture = path.join(__dirname, '..', '__fixtures__', 'ProbeScreen.tsx');
// React records element creation stacks (used for source locations) from 19.1.
const [major, minor] = React.version.split('.').map(Number);
const hasOwnerStacks = major > 19 || (major === 19 && minor >= 1);
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-report-test-'));
});

afterEach(() => {
  delete process.env[REPORT_DIR_ENV];
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('source locations', () => {
  test('point at the JSX line in the user component', async () => {
    await render(<ProbeScreen />);
    const [, pressable, image] = (screen.container.children[0] as never as { children: never[] }).children;
    if (!hasOwnerStacks) {
      expect(sourceLocation(pressable)).toBeUndefined();
      return;
    }
    expect(sourceLocation(pressable)).toEqual({ file: fixture, line: 9, column: 7 });
    expect(sourceLocation(image)).toEqual({ file: fixture, line: 10, column: 7 });
  });
});

describe('recording', () => {
  test('toBeAccessible() appends a record when the reporter is active', async () => {
    process.env[REPORT_DIR_ENV] = dir;
    await render(<ProbeScreen />);
    expect(() => expect(screen.container).toBeAccessible()).toThrow();
    expect(screen.container).not.toBeAccessible(); // .not asserts violations exist: not recorded

    const records = readRecords(dir);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ testFile: __filename, passed: false });
    const line = (n: number) => (hasOwnerStacks ? n : undefined);
    expect(records[0].files).toEqual(hasOwnerStacks ? [fixture] : []);
    expect(records[0].violations[0].wcag).toEqual(['4.1.2']);
    expect(records[0].violations.map((v) => [v.ruleId, v.source?.line, v.component, v.baselined])).toEqual([
      ['interactive-role-required', line(9), 'ProbeScreen', false],
      ['interactive-label-required', line(9), 'ProbeScreen', false],
      ['image-label-required', line(10), 'ProbeScreen', false],
    ]);
  });

  test('marks violations covered by a baseline', async () => {
    process.env[REPORT_DIR_ENV] = dir;
    const context = {
      isNot: false,
      testPath: path.join(dir, 'Probe.test.tsx'),
      currentTestName: 'probe',
      snapshotState: { _updateSnapshot: 'new' as const },
      utils: { matcherHint: () => '' },
    };
    await render(<ProbeScreen />);
    toBeAccessible.call(context, screen.container, { baseline: 'probe' }); // records the baseline
    await render(
      <>
        <ProbeScreen />
        <Text />
      </>,
    );
    toBeAccessible.call(context, screen.container, { baseline: 'probe' });

    const [, second] = readRecords(dir);
    expect(second.baseline).toBe('probe');
    expect(second.violations.map((v) => [v.ruleId, v.baselined])).toEqual([
      ['interactive-role-required', true],
      ['interactive-label-required', true],
      ['image-label-required', true],
      ['no-empty-text', false],
    ]);
  });

  test('records nothing without the reporter', async () => {
    await render(<Text />);
    expect(() => expect(screen.container).toBeAccessible()).toThrow();
    expect(readRecords(dir)).toEqual([]);
  });
});

function record(overrides: Partial<AuditRecord> & { violations: AuditRecord['violations'] }): AuditRecord {
  return { testFile: '/app/src/Login.test.tsx', testName: 'login', passed: false, ...overrides };
}

const violation = (ruleId: string, line: number, extra: object = {}) => ({
  ruleId: ruleId as never,
  severity: 'error' as const,
  message: `${ruleId} message`,
  help: 'help',
  element: '<View>',
  component: 'Login',
  source: { file: '/app/src/Login.tsx', line, column: 3 },
  baselined: false,
  ...extra,
});

describe('buildReport', () => {
  test('deduplicates issues across tests and lists the tests', () => {
    const report = buildReport(
      [
        record({ violations: [violation('image-label-required', 4)] }),
        record({ testName: 'login again', violations: [violation('image-label-required', 4)] }),
      ],
      '/app',
    );
    expect(report.summary).toMatchObject({ audits: 2, issues: 1, errors: 1 });
    expect(report.issues[0]).toMatchObject({ file: 'src/Login.tsx', line: 4 });
    expect(report.issues[0].tests).toEqual([
      { file: 'src/Login.test.tsx', name: 'login' },
      { file: 'src/Login.test.tsx', name: 'login again' },
    ]);
  });

  test('orders errors before baselined before warnings, and controls first', () => {
    const report = buildReport(
      [
        record({
          violations: [
            violation('text-contrast', 1, { severity: 'warn' }),
            violation('image-label-required', 2, { baselined: true }),
            violation('image-label-required', 3),
            violation('interactive-label-required', 9),
          ],
        }),
      ],
      '/app',
    );
    expect(report.issues.map((i) => `${i.ruleId}:${i.line}`)).toEqual([
      'interactive-label-required:9',
      'image-label-required:3',
      'image-label-required:2',
      'text-contrast:1',
    ]);
    expect(report.summary).toMatchObject({ errors: 2, baselined: 1, warnings: 1 });
    expect(report.byRule).toEqual({ 'image-label-required': 2, 'interactive-label-required': 1, 'text-contrast': 1 });
  });

  test('an issue is only baselined if every test that hit it had it baselined', () => {
    const report = buildReport(
      [
        record({ violations: [violation('image-label-required', 4, { baselined: true })] }),
        record({ testName: 'no baseline', violations: [violation('image-label-required', 4)] }),
      ],
      '/app',
    );
    expect(report.issues[0].baselined).toBe(false);
  });
});

test('buildReport counts issues per WCAG criterion and collects coverage', () => {
  const report = buildReport(
    [
      record({
        files: ['/app/src/Login.tsx', '/app/node_modules/lib/index.js'],
        violations: [
          violation('image-label-required', 2, { wcag: ['1.1.1'] }),
          violation('input-label-required', 3, { wcag: ['3.3.2', '4.1.2'] }),
          violation('interactive-label-required', 4, { wcag: ['4.1.2'] }),
        ],
      }),
      record({ files: ['/app/src/Login.tsx', '/app/src/Card.tsx'], violations: [] }),
    ],
    '/app',
  );
  expect(report.byCriterion).toEqual([
    { wcag: '1.1.1', name: 'Non-text Content', level: 'A', en301549: '11.1.1.1', issues: 1 },
    { wcag: '3.3.2', name: 'Labels or Instructions', level: 'A', en301549: '11.3.3.2', issues: 1 },
    { wcag: '4.1.2', name: 'Name, Role, Value', level: 'A', en301549: '11.4.1.2', issues: 2 },
  ]);
  expect(report.coverage.files).toEqual(['src/Card.tsx', 'src/Login.tsx']);
  expect(formatMarkdown(report)).toContain('| 4.1.2 Name, Role, Value | A | 11.4.1.2 | 2 |');
  expect(formatText(report)).toContain('WCAG 3.3.2, 4.1.2');
});

describe('formatters', () => {
  const report = buildReport(
    [record({ violations: [violation('interactive-label-required', 9, { message: 'Needs a label, really\n100%' })] })],
    '/app',
    new Date('2026-10-19T00:00:00Z'),
  );

  test('text groups by file', () => {
    expect(formatText(report)).toContain('src/Login.tsx\n  9:3     error     interactive-label-required');
  });

  test('markdown is a checklist', () => {
    expect(formatMarkdown(report)).toContain(
      '## src/Login.tsx\n\n- [ ] line 9: **[interactive-label-required](https://github.com/lassiecoder/react-native-accessibility-audit/blob/main/docs/rules.md#interactive-label-required)** (error)',
    );
  });

  test('github annotations are escaped', () => {
    expect(formatGithub(report)).toBe(
      '::error file=src/Login.tsx,line=9,col=3,title=interactive-label-required::Needs a label, really%0A100%25 <View>. Fix: help Docs: https://github.com/lassiecoder/react-native-accessibility-audit/blob/main/docs/rules.md#interactive-label-required',
    );
  });
});

describe('reporter', () => {
  test('collects worker records into a JSON and Markdown report', () => {
    const reporter = new AccessibilityReporter({ rootDir: dir }, { outputFile: 'out/a11y.json', markdownFile: 'out/a11y.md', summary: false });
    const recordDir = process.env[REPORT_DIR_ENV]!;
    expect(recordDir).toBeTruthy();
    reporter.onRunStart();
    fs.writeFileSync(path.join(recordDir, '1.jsonl'), `${JSON.stringify(record({ violations: [violation('no-empty-text', 2)] }))}\n`);
    reporter.onRunComplete();

    const report = JSON.parse(fs.readFileSync(path.join(dir, 'out/a11y.json'), 'utf8'));
    expect(report).toMatchObject({ version: 1, tool: 'react-native-accessibility-audit', summary: { errors: 1 } });
    expect(fs.readFileSync(path.join(dir, 'out/a11y.md'), 'utf8')).toContain('no-empty-text');
    expect(fs.readdirSync(recordDir)).toEqual([]);
    fs.rmSync(recordDir, { recursive: true, force: true });
  });
});

describe('cli', () => {
  function run(args: string[]) {
    const out: string[] = [];
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const code = main(args, (s) => out.push(s));
    stderr.mockRestore();
    return { code, out: out.join('\n') };
  }

  function writeReport(violations: AuditRecord['violations']) {
    const file = path.join(dir, 'a11y-report.json');
    fs.writeFileSync(file, JSON.stringify(buildReport([record({ violations })], '/app')));
    return file;
  }

  test('report prints text and exits 0 by default', () => {
    const file = writeReport([violation('no-empty-text', 2)]);
    expect(run(['report', file])).toMatchObject({ code: 0, out: expect.stringContaining('1 error') });
  });

  test('--fail-on error exits 1 when there are errors, 0 for warnings only', () => {
    expect(run(['report', writeReport([violation('no-empty-text', 2)]), '--fail-on', 'error']).code).toBe(1);
    expect(run(['report', writeReport([violation('text-contrast', 2, { severity: 'warn' })]), '--fail-on=error']).code).toBe(0);
    expect(run(['report', writeReport([violation('text-contrast', 2, { severity: 'warn' })]), '--fail-on', 'warn']).code).toBe(1);
  });

  test('baselined errors do not fail --fail-on error', () => {
    expect(run(['report', writeReport([violation('no-empty-text', 2, { baselined: true })]), '--fail-on', 'error']).code).toBe(0);
  });

  test('usage errors exit 2', () => {
    expect(run(['report', path.join(dir, 'missing.json')]).code).toBe(2);
    expect(run(['report', writeReport([]), '--format', 'xml']).code).toBe(2);
    expect(run(['nope']).code).toBe(2);
  });

  test('baselines lists entries from every __a11y_baselines__ folder', () => {
    for (const sub of ['src/screens', 'src/components']) {
      fs.mkdirSync(path.join(dir, sub, '__a11y_baselines__'), { recursive: true });
    }
    fs.mkdirSync(path.join(dir, 'node_modules/pkg/__a11y_baselines__'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/screens/__a11y_baselines__/Login.test.tsx.json'), JSON.stringify({ login: { 'no-empty-text: <Text> in Login': 2 } }));
    fs.writeFileSync(path.join(dir, 'src/components/__a11y_baselines__/Card.test.tsx.json'), JSON.stringify({ card: { 'image-label-required: <Image> in Card': 1 } }));
    fs.writeFileSync(path.join(dir, 'node_modules/pkg/__a11y_baselines__/X.test.tsx.json'), JSON.stringify({ x: { y: 1 } }));

    const { code, out } = run(['baselines', dir]);
    expect(code).toBe(0);
    expect(out).toBe(
      [
        '3 baselined accessibility violations in 2 baselines (2 test files).',
        '',
        'src/components/Card.test.tsx',
        '  card (1)',
        '    1× image-label-required: <Image> in Card',
        '',
        'src/screens/Login.test.tsx',
        '  login (2)',
        '    2× no-empty-text: <Text> in Login',
      ].join('\n'),
    );
    expect(JSON.parse(run(['baselines', dir, '--format', 'json']).out).total).toBe(3);
  });
});

