import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { main } from '../cli';
import { scanProject, scanSource } from '../scan';

const RN = "import { Image, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';\n";

function ids(body: string, header = RN) {
  return scanSource(`${header}export function Screen() {\n  return (\n${body}\n  );\n}\n`, 'Screen.tsx').map((i) => i.ruleId);
}

describe('scanSource', () => {
  test.each([
    ['icon-only Pressable', '<Pressable onPress={go} />', ['interactive-role-required', 'interactive-label-required']],
    ['Pressable with text but no role', '<Pressable onPress={go}><Text>Save</Text></Pressable>', ['interactive-role-required']],
    ['Pressable with an icon component', '<Pressable onPress={go} accessibilityRole="button"><CloseIcon /></Pressable>', ['interactive-label-required']],
    ['Pressable with an unlabelled image', '<Pressable onPress={go} role="button"><View><Image source={x} /></View></Pressable>', ['interactive-label-required']],
    ['Text with onPress', '<Text onPress={go}>Terms</Text>', ['interactive-role-required']],
    ['unlabelled Image', '<Image source={x} />', ['image-label-required']],
    ['placeholder-only TextInput', '<TextInput placeholder="Email" />', ['input-label-required']],
    ['empty Text', '<Text />', ['no-empty-text']],
    ['allowFontScaling={false}', '<Text allowFontScaling={false}>Price</Text>', ['no-disabled-font-scaling']],
    ['maxFontSizeMultiplier={1}', '<Text maxFontSizeMultiplier={1}>Price</Text>', ['no-disabled-font-scaling']],
    ['invalid role', '<Text accessibilityRole="heading">Title</Text>', ['role-valid']],
  ])('flags %s', (_, body, expected) => {
    expect(ids(body)).toEqual(expected);
  });

  test.each([
    ['labelled controls', '<Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Close"><CloseIcon /></Pressable>'],
    ['text child', '<TouchableOpacity onPress={go} role="button"><Text>Save</Text></TouchableOpacity>'],
    ['labelled image child', '<Pressable onPress={go} role="button"><Image source={x} alt="Close" /></Pressable>'],
    ['dynamic children', '<Pressable onPress={go} role="button">{label}</Pressable>'],
    ['render-function children', '<Pressable onPress={go} role="button">{({ pressed }) => <Text>Go</Text>}</Pressable>'],
    ['custom child component', '<Pressable onPress={go} role="button"><Title /></Pressable>'],
    ['spread props', '<Pressable onPress={go} {...props} />'],
    ['dynamic label', '<Pressable onPress={go} role="button" accessibilityLabel={t("close")} />'],
    ['decorative images', '<View><Image source={x} alt="" /><Image source={x} accessible={false} /><Image source={x} role="presentation" /></View>'],
    ['image inside an accessible group', '<View accessible accessibilityLabel="Avatar"><Image source={x} /></View>'],
    ['hidden subtree', '<View aria-hidden><Pressable onPress={go} /><Image source={x} /></View>'],
    ['labelled input', '<TextInput aria-label="Email" placeholder="you@example.com" />'],
    ['text with content', '<Text>{count}</Text>'],
    ['valid roles', '<View><Text accessibilityRole="header">A</Text><Text role="heading">B</Text></View>'],
    ['scaling allowed', '<Text maxFontSizeMultiplier={2}>Price</Text>'],
  ])('passes %s', (_, body) => {
    expect(ids(body)).toEqual([]);
  });

  test('only checks components imported from React Native and known libraries', () => {
    expect(ids('<Pressable onPress={go} />', "import { Pressable } from './ui';\n")).toEqual([]);
    expect(ids('<RN.Pressable onPress={go} />', "import * as RN from 'react-native';\n")).toEqual([
      'interactive-role-required',
      'interactive-label-required',
    ]);
    expect(ids('<RectButton onPress={go} />', "import { RectButton } from 'react-native-gesture-handler';\n")).toHaveLength(2);
    expect(ids('<Image source={x} />', "import { Image } from 'expo-image';\n")).toEqual(['image-label-required']);
    expect(ids('<SymbolView name="star" />', "import { SymbolView } from 'expo-symbols';\n")).toEqual(['image-label-required']);
  });

  test('icons from icon packages are not text', () => {
    const header = `${RN}import { Ionicons } from '@expo/vector-icons';\n`;
    expect(ids('<Pressable onPress={go} role="button"><Ionicons name="close" /></Pressable>', header)).toEqual([
      'interactive-label-required',
    ]);
  });

  test('a11y-audit-ignore-next-line suppresses the next element', () => {
    expect(ids('<View>\n{/* a11y-audit-ignore-next-line */}\n<Image source={x} />\n<Image source={x} />\n</View>')).toHaveLength(1);
  });

  test('issues have a location, component, fix and WCAG criteria', () => {
    const [issue] = scanSource(`${RN}const Avatar = () => <Image source={x} />;\n`, 'src/Avatar.tsx');
    expect(issue).toMatchObject({
      ruleId: 'image-label-required',
      file: 'src/Avatar.tsx',
      line: 2,
      column: 22,
      component: 'Avatar',
      element: '<Image> in Avatar',
      wcag: ['1.1.1'],
      severity: 'error',
    });
    expect(issue.help).toContain('accessibilityLabel');
  });

  test('parses JavaScript with Flow and TypeScript with generics', () => {
    expect(scanSource(`${RN}// @flow\nexport default function A(p: {| x: number |}) { return <Image source={x} />; }`, 'A.js')).toHaveLength(1);
    expect(scanSource(`${RN}const f = <T,>(x: T) => x;\nexport const B = () => <Image source={f<number>(1)} />;`, 'B.tsx')).toHaveLength(1);
  });
});

describe('scanProject and the scan command', () => {
  let dir: string;
  const cwd = process.cwd();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-scan-'));
    const write = (file: string, code: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), code);
    };
    write('src/screens/Login.tsx', `${RN}export function Login() {\n  return <Image source={x} />;\n}\n`);
    write('src/screens/Settings.tsx', `${RN}export function Settings() {\n  return <Text>Settings</Text>;\n}\n`);
    write('src/utils/format.ts', 'export const format = (n: number) => n.toFixed(2);\n');
    write('src/screens/__tests__/Login.test.tsx', `${RN}test('x', () => <Image source={x} />);\n`);
    write('src/screens/Login.stories.tsx', `${RN}export const S = () => <Image source={x} />;\n`);
    write('node_modules/lib/index.js', `${RN}export const L = () => <Image source={x} />;\n`);
    write('src/Broken.tsx', 'export const = <<<;\n');
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function run(args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation((s) => (err.push(String(s)), true));
    const code = main(args, (s) => out.push(s));
    stderr.mockRestore();
    return { code, out: out.join('\n'), err: err.join('') };
  }

  test('skips tests, stories and node_modules, and reports unparseable files', () => {
    const result = scanProject(dir);
    expect(result.issues.map((i) => `${i.file}:${i.line}`)).toEqual(['src/screens/Login.tsx:3']);
    expect(result.skipped.map((s) => s.file)).toEqual(['src/Broken.tsx']);
    expect(result.untested).toBeUndefined();
  });

  test('lists component files no test audits, using reporter coverage', () => {
    fs.writeFileSync('a11y-report.json', JSON.stringify({ coverage: { files: ['src/screens/Login.tsx'] } }));
    const { code, out } = run(['scan']);
    expect(code).toBe(0);
    expect(out).toContain('Static accessibility scan: 1 issue in 4 files, 1 component file not audited by any test.');
    expect(out).toContain('src/screens/Login.tsx\n  3:10    error     image-label-required');
    expect(out).toContain('Not audited by any toBeAccessible() test:\n  src/screens/Settings.tsx');
  });

  test('explains when the report has no coverage data', () => {
    fs.writeFileSync('a11y-report.json', JSON.stringify({ coverage: { files: [] } }));
    expect(run(['scan']).out).toContain('has no coverage data');
  });

  test('--fail-on and formats', () => {
    expect(run(['scan', '--fail-on', 'error']).code).toBe(1);
    expect(run(['scan', '--format', 'github']).out).toMatch(/^::error file=src\/screens\/Login.tsx,line=3,col=10,title=image-label-required::/);
    expect(JSON.parse(run(['scan', '--format', 'json']).out).issues).toHaveLength(1);
    expect(run(['scan', '--format', 'markdown']).out).toContain('#image-label-required)** (error)');
    expect(run(['scan', 'missing-dir']).code).toBe(2);
  });

  test('skill installs the agent skill', () => {
    const { code } = run(['skill']);
    expect(code).toBe(0);
    const skill = fs.readFileSync(path.join(dir, '.claude/skills/react-native-accessibility-audit/SKILL.md'), 'utf8');
    expect(skill).toMatch(/^---\nname: react-native-accessibility-audit\ndescription: /);
    run(['skill', '.agents/skills']);
    expect(fs.existsSync(path.join(dir, '.agents/skills/react-native-accessibility-audit/SKILL.md'))).toBe(true);
  });
});
