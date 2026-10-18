module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/index.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-gesture-handler)/)',
  ],
};
