import * as React from 'react';
import { Image, Pressable, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { audit, configure, resetConfig } from '../index';

const noop = () => {};
const img = { uri: 'https://example.com/a.png' };

// Stand-in for a third-party component the app can't change.
function FancyCarousel() {
  return (
    <View>
      <Pressable onPress={noop} />
      <View>
        <Image source={img} />
      </View>
    </View>
  );
}

function Screen() {
  return (
    <View>
      <FancyCarousel />
      <View testID="ad-banner">
        <Image source={img} />
      </View>
      <View testID="promo-1">
        <Image source={img} />
      </View>
      <Pressable onPress={noop} testID="own-button" />
    </View>
  );
}

const ownButtonOnly = ['interactive-role-required', 'interactive-label-required'];

afterEach(() => resetConfig());

async function ruleIds(options: Parameters<typeof audit>[1]) {
  await render(<Screen />);
  return audit(screen.container, options).map((v) => v.ruleId);
}

test('without ignore, every region is audited', async () => {
  expect(await ruleIds({})).toHaveLength(7);
});

test('ignores by component name, including everything inside it', async () => {
  const result = await ruleIds({ ignore: { components: ['FancyCarousel'], testIDs: ['ad-banner', /^promo-/] } });
  expect(result).toEqual(ownButtonOnly);
});

test('ignores by component name pattern', async () => {
  const result = await ruleIds({ ignore: { components: [/Carousel$/], testIDs: [/banner|promo/] } });
  expect(result).toEqual(ownButtonOnly);
});

test('ignores with a predicate', async () => {
  const result = await ruleIds({
    ignore: {
      components: ['FancyCarousel'],
      elements: (node) => typeof node.props.testID === 'string' && node.props.testID !== 'own-button',
    },
  });
  expect(result).toEqual(ownButtonOnly);
});

test('global and per-call ignore lists are combined', async () => {
  configure({ ignore: { components: ['FancyCarousel'] } });
  const result = await ruleIds({ ignore: { testIDs: ['ad-banner', 'promo-1'] } });
  expect(result).toEqual(ownButtonOnly);
});

test('matcher accepts ignore options', async () => {
  await render(<Screen />);
  expect(screen.container).toBeAccessible({
    ignore: { components: ['FancyCarousel'], testIDs: [/banner|promo|own/] },
  });
});
