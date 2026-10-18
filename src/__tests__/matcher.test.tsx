import * as React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { configure, resetConfig } from '../index';

const noop = () => {};

function SettingsRow() {
  return (
    <View>
      <Pressable onPress={noop} testID="close" />
      <Image source={{ uri: 'https://example.com/a.png' }} />
    </View>
  );
}

function AccessibleRow() {
  return (
    <Pressable onPress={noop} accessibilityRole="button">
      <Text>Save</Text>
    </Pressable>
  );
}

afterEach(() => resetConfig());

test('passes an accessible screen', async () => {
  await render(<AccessibleRow />);
  expect(screen.container).toBeAccessible();
  expect(screen.root).toBeAccessible();
});

test('accepts the render() result', async () => {
  const result = await render(<AccessibleRow />);
  expect(result).toBeAccessible();
});

test('failure message lists rule, element, owner component and fix', async () => {
  await render(<SettingsRow />);
  let message = '';
  try {
    expect(screen.container).toBeAccessible();
  } catch (e) {
    message = (e as Error).message;
  }

  expect(message).toContain('Found 3 accessibility violations');
  expect(message).toContain('[interactive-role-required]');
  expect(message).toContain('[interactive-label-required]');
  expect(message).toContain('[image-label-required]');
  expect(message).toContain('Pressable → <View> testID="close" in SettingsRow');
  expect(message).toContain('Fix: Add accessibilityRole');
});

test('.not passes when there are violations', async () => {
  await render(<SettingsRow />);
  expect(screen.container).not.toBeAccessible();
});

test('rejects values that are not rendered elements', () => {
  expect(() => expect(null).toBeAccessible()).toThrow('not a rendered element');
});

test('per-call options turn rules off', async () => {
  await render(<SettingsRow />);
  expect(screen.container).toBeAccessible({
    rules: {
      'interactive-role-required': 'off',
      'interactive-label-required': 'off',
      'image-label-required': 'off',
    },
  });
});

test('warnings do not fail the test but are reported', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  configure({ rules: { 'interactive-role-required': 'warn', 'interactive-label-required': 'warn' } });
  await render(<Pressable onPress={noop} accessibilityLabel={undefined} />);

  expect(screen.container).toBeAccessible();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('2 accessibility warnings');
  warn.mockRestore();
});

test('per-call options override global config', async () => {
  configure({ rules: { 'image-label-required': 'off' } });
  await render(<Image source={{ uri: 'https://example.com/a.png' }} />);
  expect(screen.container).toBeAccessible();
  expect(screen.container).not.toBeAccessible({ rules: { 'image-label-required': 'error' } });
});
