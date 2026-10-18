import { Button, Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import App from '../../App';
import { BrokenLoginScreen, LoginScreen } from '../screens/LoginScreen';

// Mirrors the library spike (src/__tests__/spike.test.tsx) so we can compare
// what jest-expo's mocks produce against the plain @react-native/jest-preset.
const SKIP = new Set(['children', 'style', 'source']);

function dump(node: TestInstance, depth = 0): string[] {
  const props = Object.entries(node.props)
    .filter(([k, v]) => !SKIP.has(k) && v !== undefined && typeof v !== 'function')
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  const lines = [`${'  '.repeat(depth)}<${node.type || '#container'}> ${props}`];
  for (const child of node.children) {
    lines.push(
      typeof child === 'string'
        ? `${'  '.repeat(depth + 1)}"${child}"`
        : dump(child, depth + 1).join('\n'),
    );
  }
  return lines;
}

test('App renders under jest-expo', async () => {
  await render(<App />);
  expect(screen.getByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
});

test('spike: host tree shape under jest-expo', async () => {
  await render(
    <View>
      <Pressable onPress={() => {}}>
        <Text>Pressable</Text>
      </Pressable>
      <Button title="Button" onPress={() => {}} />
      <Pressable onPress={() => {}} role="checkbox" aria-checked />
      <Image source={{ uri: 'https://x/y.png' }} />
      <Image source={{ uri: 'https://x/y.png' }} alt="Alt text" />
      <Switch value onValueChange={() => {}} />
      <TextInput placeholder="Email" />
      <Text onPress={() => {}}>Link</Text>
      <Text />
    </View>,
  );
  console.log(dump(screen.container).join('\n'));
});

test('demo screens render (fixtures for toBeAccessible)', async () => {
  await render(<LoginScreen />);
  await render(<BrokenLoginScreen />);
});
