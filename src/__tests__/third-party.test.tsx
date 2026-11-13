import 'react-native-gesture-handler/jestSetup';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BorderlessButton,
  GestureHandlerRootView,
  Pressable as GesturePressable,
  RectButton,
} from 'react-native-gesture-handler';
import { render, screen } from '@testing-library/react-native';

import { audit } from '../index';

// Components from libraries that render their own host elements. Without
// explicit support the rules can't see them at all.

const noop = () => {};

async function ruleIds(element: React.ReactElement) {
  await render(<GestureHandlerRootView>{element}</GestureHandlerRootView>);
  return audit(screen.container).map((v) => v.ruleId);
}

describe('react-native-gesture-handler', () => {
  test.each([
    ['RectButton', <RectButton onPress={noop} />],
    ['BorderlessButton', <BorderlessButton onPress={noop} />],
    ['Pressable', <GesturePressable onPress={noop} />],
  ])('%s without role or label is reported', async (_, el) => {
    expect(await ruleIds(el)).toEqual(['interactive-role-required', 'interactive-label-required']);
  });

  test.each([
    ['RectButton with props', <RectButton onPress={noop} accessibilityRole="button" accessibilityLabel="Archive" />],
    ['BorderlessButton with text', <BorderlessButton onPress={noop} accessibilityRole="button"><Text>Undo</Text></BorderlessButton>],
    ['Pressable with props', <GesturePressable onPress={noop} accessibilityRole="button" accessibilityLabel="Like" />],
    // gesture-handler's documented pattern: an accessible child View carries role and label.
    ['RectButton with an accessible child', (
      <RectButton onPress={noop}>
        <View accessible accessibilityRole="button" accessibilityLabel="Archive" />
      </RectButton>
    )],
  ])('%s passes', async (_, el) => {
    expect(await ruleIds(el)).toEqual([]);
  });

  test('a gesture-handler button inside a Pressable is nested', async () => {
    const result = await ruleIds(
      <Pressable onPress={noop} accessibilityRole="button" accessibilityLabel="Row">
        <RectButton onPress={noop} accessibilityRole="button" accessibilityLabel="Delete" />
      </Pressable>,
    );
    expect(result).toEqual(['no-nested-interactive']);
  });
});

describe('expo-image and expo-symbols host types', () => {
  // jest-expo renders these as ViewManagerAdapter_* host elements; the example
  // app tests the real packages. Here the host types are rendered directly.
  test.each(['ViewManagerAdapter_ExpoImage', 'ExpoImage', 'ViewManagerAdapter_SymbolModule'])(
    '%s is treated as an image',
    async (type) => {
      await render(React.createElement(type, { source: { uri: 'https://example.com/a.png' } }));
      expect(audit(screen.container).map((v) => v.ruleId)).toEqual(['image-label-required']);
      await render(React.createElement(type, { accessibilityLabel: 'Avatar' }));
      expect(audit(screen.container)).toEqual([]);
    },
  );
});

describe('ignore.packages', () => {
  test('skips elements a package renders, but still audits content passed into it', async () => {
    await render(
      <GestureHandlerRootView>
        <RectButton onPress={noop}>
          <Text />
        </RectButton>
        <Pressable onPress={noop} />
      </GestureHandlerRootView>,
    );
    const all = audit(screen.container).map((v) => v.ruleId);
    expect(all).toEqual(expect.arrayContaining(['interactive-role-required', 'no-empty-text']));

    const [major, minor] = React.version.split('.').map(Number);
    if (major === 19 && minor < 1) return; // needs owner stacks
    const ignored = audit(screen.container, { ignore: { packages: ['react-native-gesture-handler'] } }).map((v) => v.ruleId);
    // The RectButton's own issues are gone; the empty Text inside it and the app's Pressable remain.
    expect(ignored).toEqual(['no-empty-text', 'interactive-role-required', 'interactive-label-required']);
    expect(audit(screen.container, { ignore: { packages: [/^react-native-gesture/] } })).toHaveLength(3);
  });
});
