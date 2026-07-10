module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.preload.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/react-query)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    // Floors set just below current coverage to catch regressions;
    // ratchet up as coverage improves (SonarQube tracks the trend)
    global: {
      branches: 4,
      functions: 10,
      lines: 11,
      statements: 11,
    },
    // Higher thresholds for core modules
    './src/lib/security.ts': {
      branches: 45,
      functions: 30,
      lines: 37,
      statements: 35,
    },
    './src/context/FavoritesContext.tsx': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock expo's internal modules that cause issues
    '^expo/src/winter/runtime\\.native$': '<rootDir>/jest.mocks/expo-runtime.js',
    '^expo/src/winter/installGlobal$': '<rootDir>/jest.mocks/expo-install-global.js',
  },
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
  globals: {
    __DEV__: true,
  },
  fakeTimers: {
    enableGlobally: false,
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
