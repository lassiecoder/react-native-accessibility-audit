import * as React from 'react';
import {
  Button,
  Image,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
  type ViewProps,
} from 'react-native';
import Slider from '@react-native-community/slider';
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

describe('interactive-accessible-required', () => {
  const rule = 'interactive-accessible-required';

  test('flags accessible={false} on a control', async () => {
    const el = <TouchableOpacity onPress={noop} accessible={false} accessibilityRole="button"><Text>Go</Text></TouchableOpacity>;
    expect(await violations(el, rule)).toEqual([rule]);
  });

  test('passes default controls and inline text links', async () => {
    const el = (
      <View>
        <Pressable onPress={noop} accessibilityRole="button"><Text>Go</Text></Pressable>
        <Text accessible={false} onPress={noop} role="link">Terms</Text>
      </View>
    );
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('link-role-misused', () => {
  const rule = 'link-role-misused';

  test('flags a link that does nothing', async () => {
    expect(await violations(<Text role="link">Terms</Text>, rule)).toEqual([rule]);
  });

  test.each([
    ['Text with onPress', <Text role="link" onPress={noop}>Terms</Text>],
    ['inside a pressable', <Pressable onPress={noop} accessibilityRole="link"><Text role="link">Terms</Text></Pressable>],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });
});

describe('touch-target-size', () => {
  const rule = 'touch-target-size';
  const button = (props: object) => (
    <Pressable onPress={noop} accessibilityRole="button" accessibilityLabel="Close" {...props} />
  );

  test.each([
    ['24×24', button({ style: { width: 24, height: 24 } }), 'Touch target is 24×24, smaller than 44×44.'],
    ['only height known', button({ style: { minHeight: 30 } }), 'Touch target is ?×30, smaller than 44×44.'],
    ['style array', button({ style: [{ width: 50 }, { height: 20 }] }), 'Touch target is 50×20, smaller than 44×44.'],
    ['hitSlop too small', button({ style: { width: 24, height: 24 }, hitSlop: 5 }), 'Touch target is 34×34, smaller than 44×44.'],
  ])('flags %s', async (_, el, message) => {
    await render(el);
    const found = audit(screen.container).filter((v) => v.ruleId === rule);
    expect(found.map((v) => [v.severity, v.message])).toEqual([['warn', message]]);
  });

  test.each([
    ['44×44', button({ style: { width: 44, height: 44 } })],
    ['minHeight 48, width unknown', button({ style: { minHeight: 48 } })],
    ['hitSlop number', button({ style: { width: 24, height: 24 }, hitSlop: 10 })],
    ['hitSlop object', button({ style: { width: 24, height: 24 }, hitSlop: { top: 10, bottom: 10, left: 10, right: 10 } })],
    ['no explicit size', button({ style: { padding: 4 } })],
    ['percentage size', button({ style: { width: '100%', height: '10%' } })],
    ['inline text link', <Text role="link" onPress={noop} style={{ height: 12 }}>Terms</Text>],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });

  test('minTouchTarget option', async () => {
    await render(button({ style: { width: 30, height: 30 } }));
    expect(audit(screen.container, { minTouchTarget: 24 }).filter((v) => v.ruleId === rule)).toEqual([]);
    expect(audit(screen.container, { minTouchTarget: 48 }).filter((v) => v.ruleId === rule)).toHaveLength(1);
  });
});

describe('text-contrast', () => {
  const rule = 'text-contrast';

  async function contrast(el: React.ReactElement) {
    await render(el);
    return audit(screen.container).filter((v) => v.ruleId === rule).map((v) => v.message);
  }

  test('flags light grey on white', async () => {
    expect(await contrast(
      <View style={{ backgroundColor: '#fff' }}><Text style={{ color: '#d4d4d4' }}>Faint</Text></View>,
    )).toEqual(['Text contrast is 1.48:1 (#d4d4d4 on #ffffff), below 4.5:1.']);
  });

  test('uses 3:1 for large text', async () => {
    // #949494 on white is ~3.03:1: fails normal text, passes large text.
    const bg = { backgroundColor: 'white' };
    expect(await contrast(<View style={bg}><Text style={{ color: '#949494' }}>Small</Text></View>)).toHaveLength(1);
    expect(await contrast(<View style={bg}><Text style={{ color: '#949494', fontSize: 24 }}>Large</Text></View>)).toEqual([]);
    expect(await contrast(<View style={bg}><Text style={{ color: '#949494', fontSize: 19, fontWeight: 'bold' }}>Bold</Text></View>)).toEqual([]);
  });

  test('blends semi-transparent text and backgrounds', async () => {
    expect(await contrast(
      <View style={{ backgroundColor: '#000' }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <Text style={{ color: 'rgba(0,0,0,0.2)' }}>Ghost</Text>
        </View>
      </View>,
    )).toHaveLength(1);
  });

  test('inherits color from an enclosing Text', async () => {
    expect(await contrast(
      <View style={{ backgroundColor: '#fff' }}>
        <Text style={{ color: '#eee' }}>Outer <Text>inner</Text></Text>
      </View>,
    )).toHaveLength(2);
  });

  test.each([
    ['good contrast', <View style={{ backgroundColor: '#fff' }}><Text style={{ color: '#333' }}>Dark</Text></View>],
    ['white on blue button', <View style={{ backgroundColor: '#1d4ed8' }}><Text style={{ color: '#fff' }}>Continue</Text></View>],
    ['no background set', <Text style={{ color: '#ddd' }}>Unknown</Text>],
    ['no text color set', <View style={{ backgroundColor: '#fff' }}><Text>Default</Text></View>],
    ['only transparent backgrounds', <View style={{ backgroundColor: 'transparent' }}><Text style={{ color: '#eee' }}>x</Text></View>],
    ['platform color', <View style={{ backgroundColor: '#fff' }}><Text style={{ color: { semantic: ['label'] } as never }}>x</Text></View>],
  ])('passes %s', async (_, el) => {
    expect(await contrast(el)).toEqual([]);
  });
});

describe('adjustable-role-required', () => {
  const rule = 'adjustable-role-required';
  const stepActions = [{ name: 'increment' }, { name: 'decrement' }];

  // A custom control VoiceOver users adjust by swiping up/down.
  function Stepper(props: ViewProps) {
    return (
      <View
        accessible
        accessibilityLabel="Quantity"
        accessibilityValue={{ min: 1, max: 9, now: 2 }}
        accessibilityActions={stepActions}
        onAccessibilityAction={noop}
        {...props}
      >
        <Text>2</Text>
      </View>
    );
  }

  test.each([
    ['no role', <Stepper />, 'Element exposes the "increment" and "decrement" actions but has no role, so screen reader users can\'t adjust it.'],
    ['wrong role', <Stepper accessibilityRole="button" />, 'Element exposes the "increment" and "decrement" actions but has the role "button", so screen reader users can\'t adjust it.'],
    ['only increment', <Stepper accessibilityActions={[{ name: 'increment' }]} />, 'Element exposes the "increment" action but has no role, so screen reader users can\'t adjust it.'],
    // From react-native-accessibility-engine's tests: a non-adjustable role replaces the native slider's behavior.
    ['native slider with role="button"', <Slider minimumValue={1} maximumValue={10} accessibilityRole="button" />, 'Slider has the role "button", which replaces its native adjustable behavior.'],
  ])('flags %s', async (_, el, message) => {
    await render(el);
    expect(audit(screen.container).filter((v) => v.ruleId === rule).map((v) => v.message)).toEqual([message]);
  });

  test.each([
    ['accessibilityRole="adjustable"', <Stepper accessibilityRole="adjustable" />],
    ['role="slider"', <Stepper role="slider" />],
    ['role="spinbutton"', <Stepper role="spinbutton" />],
    ['other custom actions', <Stepper accessibilityActions={[{ name: 'activate' }, { name: 'delete', label: 'Remove' }]} />],
    ['native slider with role="adjustable"', <Slider minimumValue={1} maximumValue={10} accessibilityRole="adjustable" />],
    // react-native-accessibility-engine flagged this, but UISlider and SeekBar are adjustable natively.
    ['native slider without a role', <Slider minimumValue={1} maximumValue={10} />],
  ])('passes %s', async (_, el) => {
    expect(await violations(el, rule)).toEqual([]);
  });

  test('state-required does not ask native sliders for a value', async () => {
    const el = <Slider minimumValue={1} maximumValue={10} accessibilityRole="adjustable" />;
    expect(await violations(el, 'state-required')).toEqual([]);
  });

  test('a fully accessible stepper passes every rule', async () => {
    expect(await violations(<Stepper accessibilityRole="adjustable" />)).toEqual([]);
  });
});
