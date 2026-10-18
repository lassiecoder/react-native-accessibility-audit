import * as React from 'react';
import { Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { audit, resetConfig } from '../index';

// Compatibility with react-native-accessibility-engine's documented API, so
// switching is a change of import / setupFilesAfterEnv entry.

const noop = () => {};
const icon = { uri: 'https://example.com/heart.png' };
const globals = globalThis as { __A11Y_RULES__?: unknown; __CUSTOM_VIOLATION_HANDLER__?: unknown };

afterEach(() => {
  resetConfig();
  delete globals.__A11Y_RULES__;
  delete globals.__CUSTOM_VIOLATION_HANDLER__;
});

describe('React elements', () => {
  // The first example in the old README.
  const Button = () => (
    <TouchableOpacity accessible={false}>
      <Image source={icon} />
    </TouchableOpacity>
  );

  test('expect(<Button />).toBeAccessible() renders and audits the element', () => {
    let message = '';
    try {
      expect(<Button />).toBeAccessible();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('[interactive-accessible-required]');
    expect(message).toContain('[interactive-role-required]');
    expect(message).toContain('[interactive-label-required]');
    expect(message).toContain('TouchableOpacity → <View> in Button');
  });

  test('passes an accessible element', () => {
    expect(
      <Pressable onPress={noop} accessibilityRole="button">
        <Text>Save</Text>
      </Pressable>,
    ).toBeAccessible();
  });

  test('runs effects before auditing and unmounts afterwards', () => {
    const cleanup = jest.fn();
    function Loaded() {
      const [ready, setReady] = React.useState(false);
      React.useEffect(() => {
        setReady(true);
        return cleanup;
      }, []);
      return ready ? <Text /> : <Text>Loading</Text>;
    }
    expect(<Loaded />).not.toBeAccessible();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('works alongside RNTL renders in the same test', async () => {
    await render(<Text>Screen</Text>);
    expect(<Text>Other</Text>).toBeAccessible();
    expect(screen.getByText('Screen')).toBeOnTheScreen();
  });
});

describe('rules option', () => {
  const Broken = () => (
    <View>
      <Text />
      <Pressable onPress={noop} />
    </View>
  );

  async function ruleIds(rules: Parameters<typeof audit>[1]) {
    await render(<Broken />);
    return [...new Set(audit(screen.container, rules).map((v) => v.ruleId))];
  }

  test('an array runs only the listed rules', async () => {
    expect(await ruleIds({ rules: ['no-empty-text'] })).toEqual(['no-empty-text']);
  });

  test('legacy rule IDs map to the new rules', async () => {
    expect(await ruleIds({ rules: ['pressable-role-required', 'pressable-label-required'] })).toEqual([
      'interactive-role-required',
      'interactive-label-required',
    ]);
    expect(await ruleIds({ rules: { 'pressable-role-required': 'off', 'pressable-label-required': 'off' } })).toEqual([
      'no-empty-text',
    ]);
  });

  test('retired legacy rule IDs are accepted', async () => {
    expect(await ruleIds({ rules: ['disabled-state-required', 'no-empty-text'] })).toEqual(['no-empty-text']);
  });

  test('unknown rule IDs throw instead of silently disabling checks', async () => {
    await render(<Broken />);
    expect(() => audit(screen.container, { rules: ['no-emtpy-text' as never] })).toThrow(
      'Unknown accessibility rule "no-emtpy-text"',
    );
  });

  test('reads __A11Y_RULES__ from Jest globals', async () => {
    globals.__A11Y_RULES__ = ['no-empty-text'];
    expect(await ruleIds({})).toEqual(['no-empty-text']);
  });
});

describe('customViolationHandler', () => {
  test('per call: returned violations decide the result', async () => {
    await render(<Text />);
    const handler = jest.fn(() => []);
    expect(screen.container).toBeAccessible({ customViolationHandler: handler });
    expect(handler).toHaveBeenCalledWith([expect.objectContaining({ ruleId: 'no-empty-text' })]);
  });

  test('from the __CUSTOM_VIOLATION_HANDLER__ global', async () => {
    globals.__CUSTOM_VIOLATION_HANDLER__ = () => [];
    await render(<Text />);
    expect(screen.container).toBeAccessible();
  });
});

test('rejects react-test-renderer style trees with composite components', () => {
  function Card() {
    return <Text>Card</Text>;
  }
  const legacyInstance = { type: Card, props: {}, children: [], parent: null };
  expect(() => expect(legacyInstance).toBeAccessible()).toThrow('probably from react-test-renderer');
});

describe('react-native-accessibility-engine issues', () => {
  // #258: label rule didn't find text inside nested accessible views.
  test('#258 finds text in nested accessible views', () => {
    function Card({ title, subtitle }: { title: string; subtitle: string }) {
      return (
        <Pressable onPress={noop} accessibilityRole="button" testID="tile" accessible>
          <View accessible>
            <View accessible>
              <Text accessible>{title}</Text>
              <View accessible>
                <Text accessible>{subtitle}</Text>
              </View>
            </View>
            <View>
              <Image source={icon} />
            </View>
          </View>
        </Pressable>
      );
    }
    expect(<Card title="Electricity" subtitle="Due Friday" />).toBeAccessible();
  });

  // #307: "tab" role rejected; carousels required a disabled state.
  test('#307 accepts tabs and carousels that hide inactive slides', () => {
    function Tabs() {
      const [index, setIndex] = React.useState(0);
      return (
        <View accessibilityRole="tablist">
          {['First', 'Second'].map((title, i) => (
            <Pressable
              key={title}
              onPress={() => setIndex(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
            >
              <Text>{title}</Text>
            </Pressable>
          ))}
          {['A', 'B'].map((slide, i) => (
            <View
              key={slide}
              accessibilityElementsHidden={i !== index}
              importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
            >
              <Pressable onPress={noop} accessibilityRole="button">
                <Text>{`Slide ${slide}`}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      );
    }
    expect(<Tabs />).toBeAccessible();
  });
});
