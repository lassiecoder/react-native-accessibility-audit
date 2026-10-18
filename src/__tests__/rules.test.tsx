import * as React from 'react';
import {
  Button,
  Image,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { audit } from '../index';
import type { RuleId } from '../types';

const img = { uri: 'https://example.com/a.png' };
const noop = () => {};

async function violations(element: React.ReactElement, rule?: RuleId) {
  await render(element);
  return audit(screen.container)
    .filter((v) => !rule || v.ruleId === rule)
    .map((v) => v.ruleId);
}

describe('interactive-role-required', () => {
  const rule = 'interactive-role-required';

  test.each([
    ['Pressable', <Pressable onPress={noop}><Text>Go</Text></Pressable>],
    ['TouchableOpacity', <TouchableOpacity onPress={noop}><Text>Go</Text></TouchableOpacity>],
    ['Text with onPress', <Text onPress={noop}>Go</Text>],
    ['non-interactive role', <Pressable onPress={noop} accessibilityRole="header"><Text>Go</Text></Pressable>],
    ['role="none"', <Pressable onPress={noop} role="none"><Text>Go</Text></Pressable>],
  ])('flags %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([rule]);
  });

  test.each([
    ['accessibilityRole', <Pressable onPress={noop} accessibilityRole="button"><Text>Go</Text></Pressable>],
    ['role', <Pressable onPress={noop} role="link"><Text>Go</Text></Pressable>],
    ['Button', <Button title="Go" onPress={noop} />],
    ['Switch', <Switch value onValueChange={noop} accessibilityLabel="Wifi" />],
    ['plain View', <View><Text>Hi</Text></View>],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('interactive-label-required', () => {
  const rule = 'interactive-label-required';

  test.each([
    ['empty Pressable', <Pressable onPress={noop} accessibilityRole="button" />],
    ['icon with unlabelled image', <Pressable onPress={noop} accessibilityRole="button"><Image source={img} /></Pressable>],
    ['whitespace label', <Pressable onPress={noop} accessibilityRole="button" accessibilityLabel="  " />],
    ['Switch without label', <Switch value onValueChange={noop} />],
    ['only hidden text', (
      <Pressable onPress={noop} accessibilityRole="button">
        <Text aria-hidden>Go</Text>
      </Pressable>
    )],
  ])('flags %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([rule]);
  });

  test.each([
    ['text child', <Pressable onPress={noop} accessibilityRole="button"><Text>Go</Text></Pressable>],
    ['accessibilityLabel', <Pressable onPress={noop} accessibilityRole="button" accessibilityLabel="Close" />],
    ['aria-label', <Pressable onPress={noop} accessibilityRole="button" aria-label="Close" />],
    ['labelled image child', <Pressable onPress={noop} accessibilityRole="button"><Image source={img} accessibilityLabel="Close" /></Pressable>],
    ['deep text', <Pressable onPress={noop} accessibilityRole="button"><View><Text>Go</Text></View></Pressable>],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('image-label-required', () => {
  const rule = 'image-label-required';

  test('flags an unlabelled image', async () => {
    expect(await violations(<Image source={img} />, rule)).toEqual([rule]);
  });

  test.each([
    ['accessibilityLabel', <Image source={img} accessibilityLabel="Logo" />],
    ['alt', <Image source={img} alt="Logo" />],
    ['alt="" (decorative)', <Image source={img} alt="" />],
    ['aria-hidden', <Image source={img} aria-hidden />],
    ['hidden ancestor', <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Image source={img} /></View>],
    ['importantForAccessibility="no"', <Image source={img} importantForAccessibility="no" />],
    ['inside accessible container', <View accessible accessibilityLabel="Profile"><Image source={img} /></View>],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('no-nested-interactive', () => {
  const rule = 'no-nested-interactive';

  test('flags the inner control', async () => {
    const result = await violations(
      <Pressable onPress={noop} accessibilityRole="button">
        <Pressable onPress={noop} accessibilityRole="button"><Text>Inner</Text></Pressable>
      </Pressable>,
      rule,
    );
    expect(result).toEqual([rule]);
  });

  test('passes siblings', async () => {
    const result = await violations(
      <View>
        <Pressable onPress={noop} accessibilityRole="button"><Text>A</Text></Pressable>
        <Pressable onPress={noop} accessibilityRole="button"><Text>B</Text></Pressable>
      </View>,
      rule,
    );
    expect(result).toEqual([]);
  });
});

describe('state-required', () => {
  const rule = 'state-required';

  test.each([
    ['checkbox', <Pressable onPress={noop} role="checkbox"><Text>Agree</Text></Pressable>],
    ['radio', <Pressable onPress={noop} accessibilityRole="radio"><Text>Small</Text></Pressable>],
    ['switch role', <Pressable onPress={noop} accessibilityRole="switch"><Text>Wifi</Text></Pressable>],
    ['mixed on radio', <Pressable onPress={noop} accessibilityRole="radio" accessibilityState={{ checked: 'mixed' }}><Text>Small</Text></Pressable>],
    ['adjustable without value', <View accessible accessibilityRole="adjustable" accessibilityLabel="Volume" />],
  ])('flags %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([rule]);
  });

  test.each([
    ['aria-checked', <Pressable onPress={noop} role="checkbox" aria-checked={false}><Text>Agree</Text></Pressable>],
    ['accessibilityState', <Pressable onPress={noop} accessibilityRole="radio" accessibilityState={{ checked: true }}><Text>Small</Text></Pressable>],
    ['mixed checkbox', <Pressable onPress={noop} role="checkbox" aria-checked="mixed"><Text>All</Text></Pressable>],
    ['native Switch', <Switch value={false} onValueChange={noop} accessibilityLabel="Wifi" />],
    ['adjustable with value', <View accessible accessibilityRole="adjustable" accessibilityLabel="Volume" accessibilityValue={{ min: 0, max: 10, now: 3 }} />],
    ['adjustable with text', <View accessible accessibilityRole="adjustable" accessibilityLabel="Volume" aria-valuetext="Loud" />],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('no-empty-text', () => {
  const rule = 'no-empty-text';

  test.each([
    ['empty', <Text />],
    ['whitespace', <Text>{'   '}</Text>],
    ['empty nested', <Text><Text /></Text>],
  ])('flags %s', async (_, el) => {
    expect((await violations(el, rule)).length).toBeGreaterThan(0);
  });

  test.each([
    ['text', <Text>Hello</Text>],
    ['nested text', <Text>Hello <Text>world</Text></Text>],
    ['labelled', <Text accessibilityLabel="Divider" />],
    ['hidden', <Text aria-hidden />],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

test('skips subtrees hidden from screen readers', async () => {
  const result = await violations(
    <View aria-hidden>
      <Pressable onPress={noop} />
      <Image source={img} />
      <Text />
    </View>,
  );
  expect(result).toEqual([]);
});
