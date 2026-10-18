import * as React from 'react';
import {
  Button,
  Image,
  Pressable,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

const SKIP = new Set(['children', 'style', 'source']);

function dump(node: TestInstance, depth = 0): string[] {
  const props = Object.entries(node.props)
    .filter(([k, v]) => !SKIP.has(k) && v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === 'function' ? 'fn' : JSON.stringify(v)}`)
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

test('spike: host tree shape for common components', async () => {
  await render(
    <View>
      <Pressable onPress={() => {}}>
        <Text>Pressable</Text>
      </Pressable>
      <TouchableOpacity onPress={() => {}}>
        <Text>Touchable</Text>
      </TouchableOpacity>
      <Button title="Button" onPress={() => {}} />
      <Pressable onPress={() => {}} accessibilityRole="button" accessibilityLabel="Labelled" />
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
