import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { audit } from 'react-native-accessibility-audit';

// Most screens are tested inside navigators. React Navigation's own elements
// must not cause errors, and anything it does flag must say it comes from
// the library, not point at the app's code.

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function Home({ navigation }: { navigation: { navigate: (route: string) => void } }) {
  return (
    <View>
      <Text accessibilityRole="header">Home</Text>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Details')}>
        <Text>Open details</Text>
      </Pressable>
    </View>
  );
}

const Details = () => <Text>Details</Text>;
const Settings = () => <Text>Settings</Text>;

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Details" component={Details} />
    </Stack.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <Tabs.Navigator>
        <Tabs.Screen name="HomeTab" component={HomeStack} options={{ headerShown: false, title: 'Home' }} />
        <Tabs.Screen name="Settings" component={Settings} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

test('screens inside tab and stack navigators are accessible', async () => {
  await render(<App />);
  expect(screen.root).toBeAccessible();
  await fireEvent.press(screen.getByRole('button', { name: 'Open details' }));
  expect(screen.getByText('Details')).toBeOnTheScreen();
  expect(screen.root).toBeAccessible();
});

test('issues in the tab bar are attributed to React Navigation', async () => {
  await render(<App />);
  // The default iOS tint (#007aff) on white is 4.02:1, below AA for small text.
  const warnings = audit(screen.root).filter((v) => v.severity === 'warn');
  expect(warnings.map((v) => v.ruleId)).toEqual(['text-contrast', 'text-contrast']);

  let message = '';
  const warn = jest.spyOn(console, 'warn').mockImplementation((m) => (message = String(m)));
  expect(screen.root).toBeAccessible();
  warn.mockRestore();
  // The app component that used the navigator, the navigator, and the library.
  expect(message).toContain('Element: <Text> name="Home" in App, rendered by BottomTabNavigator from @react-navigation/*');
  expect(message).toContain("Library: Rendered by @react-navigation/*. Fix it through the library's props or theme");
  expect(message).toContain('ignore: { packages: [/^@react-navigation\\//] }');

  expect(audit(screen.root, { ignore: { packages: [/^@react-navigation\//] } })).toEqual([]);
});
