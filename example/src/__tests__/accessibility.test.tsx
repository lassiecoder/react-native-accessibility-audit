import { render, screen } from '@testing-library/react-native';

import { BrokenLoginScreen, LoginScreen } from '../screens/LoginScreen';

test('login screen is accessible', async () => {
  await render(<LoginScreen />);
  expect(screen.container).toBeAccessible();
});

test('broken login screen reports every issue', async () => {
  await render(<BrokenLoginScreen />);
  expect(() => expect(screen.container).toBeAccessible()).toThrowErrorMatchingSnapshot();
});

// Adopting the matcher on an existing screen: record today's issues once,
// then fail only when someone adds a new one.
test('broken login screen does not get worse (baseline)', async () => {
  await render(<BrokenLoginScreen />);
  expect(screen.container).toBeAccessible({ baseline: 'broken-login' });
});
