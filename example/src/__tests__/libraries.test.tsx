import { View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { render, screen } from '@testing-library/react-native';
import { audit, formatViolations } from 'react-native-accessibility-audit';

// react-native-element-dropdown#214: issues inside a library are real, but
// the app can't fix them in its own JSX. Messages must say where they come
// from, and ignore.packages must be able to skip them.

function SizePicker() {
  return (
    <View>
      <Dropdown
        data={[{ label: 'Small', value: 's' }]}
        labelField="label"
        valueField="value"
        onChange={() => {}}
        placeholder="Size"
      />
    </View>
  );
}

test('issues inside a library name the library and the app component using it', async () => {
  await render(<SizePicker />);
  const violations = audit(screen.root);
  expect(violations.map((v) => v.ruleId)).toEqual(['interactive-role-required', 'interactive-accessible-required']);

  const message = formatViolations(violations);
  expect(message).toContain('Element: TouchableWithoutFeedback → <View> name="Size" in SizePicker, rendered by react-native-element-dropdown');
  expect(message).toContain("ignore: { packages: ['react-native-element-dropdown'] }");
});

test('ignore.packages skips the library', async () => {
  await render(<SizePicker />);
  expect(screen.root).toBeAccessible({ ignore: { packages: ['react-native-element-dropdown'] } });
});
