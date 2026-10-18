import { render, screen } from '@testing-library/react-native';

import App from '../../App';

test('App renders under jest-expo', async () => {
  await render(<App />);
  expect(screen.getByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
});

test('App is accessible', async () => {
  await render(<App />);
  expect(screen.container).toBeAccessible();
});
