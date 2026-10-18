import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Props = { onSubmit?: () => void };

// Accessible version: every control has a role, label and state.
export function LoginScreen({ onSubmit }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        accessibilityLabel="App logo"
      />
      <Text accessibilityRole="header" style={styles.title}>
        Sign in
      </Text>
      <TextInput accessibilityLabel="Email" placeholder="Email" style={styles.input} />
      <View style={styles.row}>
        <Switch value accessibilityLabel="Remember me" />
        <Text>Remember me</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.button}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

// Broken version: the kinds of issues toBeAccessible() should catch.
export function BrokenLoginScreen({ onSubmit }: Props) {
  return (
    <View style={styles.container}>
      {/* image without a label that is not hidden */}
      <Image source={require('../../assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>Sign in</Text>
      {/* placeholder is not a label */}
      <TextInput placeholder="Email" style={styles.input} />
      {/* empty text node */}
      <Text />
      {/* icon-only pressable: no role, no label, no text, too small */}
      <Pressable onPress={onSubmit} style={styles.iconButton} />
      {/* checkbox without checked state */}
      <Pressable role="checkbox" onPress={() => {}}>
        <Text>Remember me</Text>
      </Pressable>
      {/* nested pressables */}
      <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.button}>
        <Pressable accessibilityRole="button" onPress={() => {}}>
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </Pressable>
      {/* low-contrast text */}
      <Text style={styles.faint}>Forgot password?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center', gap: 16 },
  logo: { width: 64, height: 64, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  iconButton: { width: 24, height: 24, backgroundColor: '#1d4ed8' },
  faint: { color: '#d4d4d4' },
});
