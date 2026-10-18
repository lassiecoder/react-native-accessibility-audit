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
