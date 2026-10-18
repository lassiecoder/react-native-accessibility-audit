import 'react-native-gesture-handler/jestSetup';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { BorderlessButton, GestureHandlerRootView, Pressable, RectButton } from 'react-native-gesture-handler';
import { render, screen } from '@testing-library/react-native';

// Real expo-image, expo-symbols and gesture-handler under jest-expo.

function ProfileHeader() {
  return (
    <>
      <Image source={{ uri: 'https://example.com/a.png' }} />
      <SymbolView name="star" />
      <RectButton onPress={() => {}} />
      <BorderlessButton onPress={() => {}} accessibilityRole="button" />
      <Pressable onPress={() => {}} accessibilityLabel="Share" />
    </>
  );
}

test('unlabelled expo-image, symbols and gesture-handler buttons are reported', async () => {
  await render(
    <GestureHandlerRootView>
      <ProfileHeader />
    </GestureHandlerRootView>,
  );
  expect(() => expect(screen.container).toBeAccessible()).toThrowErrorMatchingSnapshot();
});

test('labelled ones pass', async () => {
  await render(
    <GestureHandlerRootView>
      <Image source={{ uri: 'https://example.com/a.png' }} accessibilityLabel="Profile photo" />
      <SymbolView name="star" accessibilityLabel="Favorite" />
      <RectButton onPress={() => {}} accessibilityRole="button" accessibilityLabel="Archive" />
    </GestureHandlerRootView>,
  );
  expect(screen.container).toBeAccessible();
});
