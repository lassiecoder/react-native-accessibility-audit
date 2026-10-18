import * as React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

// Fixture for report tests: line numbers below are asserted.
export function ProbeScreen() {
  return (
    <View>
      <Text>Title</Text>
      <Pressable onPress={() => {}} />
      <Image source={{ uri: 'https://example.com/a.png' }} />
    </View>
  );
}
