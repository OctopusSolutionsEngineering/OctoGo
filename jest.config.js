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
    // ratchet up as coverage improves (SonarQube tracks the trend).
    // NOTE: jest subtracts files matched by the path-specific thresholds
    // below from the "global" group, so these floors apply only to the
    // remaining files (currently ~17.7% stmts / 8.5% branches).
    global: {
      branches: 85,
      functions: 88,
      lines: 92,
      statements: 92,
    },
    // Higher thresholds for core modules
    './src/lib/security.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/lib/api/client.ts': {
      branches: 80,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/hooks/useOctopusQuery.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
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
    // Match tsconfig's "@/*" -> "./*" (imports are written as "@/src/...")
    '^@/(.*)$': '<rootDir>/$1',
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
