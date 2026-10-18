import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { baselinePath } from '../baseline';
import { toBeAccessible } from '../matcher';

const noop = () => {};
const img = { uri: 'https://example.com/a.png' };

type Mode = 'all' | 'new' | 'none';

let dir: string;
let testPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-baseline-'));
  testPath = path.join(dir, 'Login.test.tsx');
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

// Calls the matcher directly so each test controls Jest's update mode and
// where the baseline file is written.
async function check(element: React.ReactElement, mode: Mode, baseline: string | true = 'login') {
  await render(element);
  const context = {
    isNot: false,
    testPath,
    currentTestName: 'Login renders',
    snapshotState: { _updateSnapshot: mode },
    utils: { matcherHint: () => 'expect(element).toBeAccessible()' },
  };
  const result = toBeAccessible.call(context, screen.container, { baseline });
  return { pass: result.pass, message: result.message() };
}

function readFile() {
  return JSON.parse(fs.readFileSync(baselinePath(testPath), 'utf8'));
}

function Login({ images = 1, extraButton = false }: { images?: number; extraButton?: boolean }) {
  return (
    <View>
      {Array.from({ length: images }, (_, i) => (
        <Image key={i} source={img} />
      ))}
      <Text>Sign in</Text>
      {extraButton && <Pressable onPress={noop} testID="extra" />}
    </View>
  );
}

test('records a missing baseline and passes', async () => {
  const result = await check(<Login images={2} />, 'new');
  expect(result.pass).toBe(true);
  expect(readFile()).toEqual({
    login: { 'image-label-required: <Image> in Login': 2 },
  });
});

test('passes when violations match the baseline', async () => {
  await check(<Login />, 'new');
  expect((await check(<Login />, 'new')).pass).toBe(true);
});

test('fails only on violations that are not in the baseline', async () => {
  await check(<Login />, 'new');
  const result = await check(<Login extraButton />, 'new');

  expect(result.pass).toBe(false);
  expect(result.message).toContain('Found 2 new accessibility violations not in baseline "login"');
  expect(result.message).toContain('(1 known violation in the baseline still needs fixing)');
  expect(result.message).toContain('testID="extra"');
  expect(result.message).not.toContain('[image-label-required]');
  expect(result.message).toContain('run Jest with -u');
});

test('counts duplicates, so one more of the same violation fails', async () => {
  await check(<Login images={2} />, 'new');
  const result = await check(<Login images={3} />, 'new');
  expect(result.pass).toBe(false);
  expect(result.message).toContain('Found 1 new accessibility violation not');
});

test('tightens the baseline when violations are fixed, so they cannot come back', async () => {
  await check(<Login images={2} />, 'new');
  expect((await check(<Login images={1} />, 'new')).pass).toBe(true);
  expect(readFile().login).toEqual({ 'image-label-required: <Image> in Login': 1 });

  expect((await check(<Login images={2} />, 'new')).pass).toBe(false);
});

test('a clean baseline is recorded as empty and stays strict', async () => {
  await check(<Login images={0} />, 'new');
  expect(readFile()).toEqual({ login: {} });
  expect((await check(<Login />, 'new')).pass).toBe(false);
});

test('-u rewrites the baseline to accept current violations', async () => {
  await check(<Login />, 'new');
  expect((await check(<Login extraButton />, 'all')).pass).toBe(true);
  expect((await check(<Login extraButton />, 'none')).pass).toBe(true);
});

describe('--ci', () => {
  test('fails when the baseline is missing and does not write it', async () => {
    const result = await check(<Login />, 'none');
    expect(result.pass).toBe(false);
    expect(result.message).toContain('No accessibility baseline "login"');
    expect(result.message).toContain('not written with --ci');
    expect(fs.existsSync(baselinePath(testPath))).toBe(false);
  });

  test('does not tighten the baseline file', async () => {
    await check(<Login images={2} />, 'new');
    expect((await check(<Login images={1} />, 'none')).pass).toBe(true);
    expect(readFile().login['image-label-required: <Image> in Login']).toBe(2);
  });
});

test('baseline: true uses the test name', async () => {
  await check(<Login />, 'new', true);
  expect(Object.keys(readFile())).toEqual(['Login renders']);
});

test('keeps other baselines in the same file', async () => {
  await check(<Login />, 'new', 'a');
  await check(<Login images={2} />, 'new', 'b');
  expect(Object.keys(readFile())).toEqual(['a', 'b']);
  expect(readFile().a['image-label-required: <Image> in Login']).toBe(1);
});
